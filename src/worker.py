"""
RQ Worker Jobs — Video processing runs here, not in the API server.

Each function is an RQ-compatible top-level function that the worker process
picks up from the Redis queue.  They use their own DB sessions and are fully
self-contained.
"""

import os
import sys
import tempfile
import threading
import traceback
from pathlib import Path

# Ensure src/ is on the path (same trick as api.py)
sys.path.insert(0, str(Path(__file__).parent))

# Eagerly import openai so all submodules (openai.resources.chat etc.) are
# fully loaded before any thread tries to use them.  Python's per-module
# import lock can deadlock when a lazy import happens inside a daemon thread.
import openai  # noqa: F401

from database import SessionLocal, Job as JobModel, Report, ContentVector, Collection
from job_service import JobService
from billing import BillingService
from video_processor import download_audio_with_metadata, get_video_info
from vector_memory import VectorMemory
from config import get_config, init_config

# ---------------------------------------------------------------------------
# Concurrency limiter — prevents OOM when multiple users submit videos.
# Excess jobs wait in "Queued" status until a slot opens.
# ---------------------------------------------------------------------------
MAX_CONCURRENT_JOBS = int(os.getenv("MAX_CONCURRENT_JOBS", "2"))
_processing_semaphore = threading.Semaphore(MAX_CONCURRENT_JOBS)
_queue_lock = threading.Lock()
_queued_count = 0  # Number of jobs waiting for a slot


def _send_completion_notifications(db, user_id: int, result_dict: dict):
    """Send job-complete email and create in-app notification."""
    try:
        from database import User as _User
        user = db.query(_User).filter(_User.id == user_id).first()
        if not user:
            return
        content_title = result_dict.get("title", "Untitled")
        content_id = result_dict.get("id", "")
        # Email
        from email_service import send_job_complete_email
        send_job_complete_email(user.email, user.full_name or "", content_title, content_id)
        # In-app notification
        try:
            from notification_service import create_notification
            create_notification(
                db, user_id, "job_complete",
                "Source ready",
                f"{content_title} has been processed and is ready to explore.",
                link=f"/app?content={content_id}",
            )
        except Exception:
            pass  # notification_service may not exist yet during migration
    except Exception as e:
        print(f"[Worker] Completion notification failed: {e}")


def _acquire_slot(job_id: str):
    """Wait for a processing slot. Updates job status while queued."""
    global _queued_count
    # Try to acquire immediately
    if _processing_semaphore.acquire(blocking=False):
        print(f"[Job {job_id}] Got processing slot immediately")
        return

    # No slot available — update status and wait
    with _queue_lock:
        _queued_count += 1
        position = _queued_count

    print(f"[Job {job_id}] Waiting for processing slot (position ~{position})")
    _qdb = SessionLocal()
    try:
        JobService.update_job_progress(
            db=_qdb, job_id=job_id, progress=0,
            status=f"Queued — waiting for slot ({position} ahead)...",
        )
    except Exception:
        pass
    finally:
        _qdb.close()

    # Block until a slot opens
    _processing_semaphore.acquire()

    with _queue_lock:
        _queued_count = max(0, _queued_count - 1)

    print(f"[Job {job_id}] Got processing slot")


def _release_slot():
    """Release a processing slot."""
    _processing_semaphore.release()


def _get_app(user_id, db):
    """Create a VideoMemoryAI instance for the worker (mirrors api.py get_app)."""
    from app import VideoMemoryAI

    config = get_config()
    tier = "free"
    if db is not None and user_id is not None:
        sub = BillingService._ensure_subscription(db, user_id)
        tier = sub.tier or "free"

    ai = VideoMemoryAI(
        llm_provider="openai" if config.openai.is_configured else "ollama",
        tier=tier,
    )
    if db is not None and user_id is not None:
        ai.memory = VectorMemory(db, user_id)
    return ai


# ---------------------------------------------------------------------------
# Job 1: process a video from URL  (was the inner process_video() in api.py)
# ---------------------------------------------------------------------------

def process_video_job(
    job_id: str,
    user_id: int,
    url_or_path: str,
    analyze_frames: bool,
    mode: str,
    cookies_str: str | None = None,
    language: str | None = None,
    collection_id: str | None = None,
    provider: str = "openai",
):
    """RQ job: download + process a video URL."""

    # Wait for a processing slot (prevents OOM with concurrent users)
    _acquire_slot(job_id)

    # Speaker diarization controlled by env var (off on small instances)
    detect_speakers = os.getenv("ENABLE_SPEAKER_DETECTION", "false").lower() == "true"

    is_youtube = any(d in url_or_path for d in ["youtube.com", "youtu.be"])

    bg_db = SessionLocal()
    try:
        print(f"[Job {job_id}] Starting processing for: {url_or_path[:50]}")
        print(f"[Job {job_id}] Cookies provided: {bool(cookies_str)}, YouTube: {is_youtube}")

        # Set up cookies temp file if provided
        cookies_temp_path = None
        if cookies_str and is_youtube:
            cookies_temp = tempfile.NamedTemporaryFile(
                mode="w", suffix=".txt", delete=False, prefix="vmem_cookies_"
            )
            cookies_temp.write(cookies_str)
            cookies_temp.close()
            cookies_temp_path = cookies_temp.name

        try:
            # Download audio + metadata
            youtube_stats = None
            duration_min = 0
            if url_or_path.startswith(("http://", "https://")):
                try:
                    JobService.update_job_progress(
                        db=bg_db, job_id=job_id, progress=2,
                        status="Downloading audio & metadata...",
                    )
                    _audio_path, meta = download_audio_with_metadata(
                        url_or_path, output_dir="data/videos",
                        cookies_file=cookies_temp_path,
                    )
                    duration_sec = meta.get("duration", 0)
                    duration_min = duration_sec / 60

                    if meta.get("view_count") or meta.get("title"):
                        youtube_stats = {
                            "view_count": meta.get("view_count", 0),
                            "like_count": meta.get("like_count", 0),
                            "comment_count": meta.get("comment_count", 0),
                            "subscriber_count": meta.get("channel_follower_count", 0),
                            "upload_date": meta.get("upload_date", ""),
                            "channel": meta.get("uploader", ""),
                            "categories": meta.get("categories", []),
                            "description": meta.get("description", "")[:500],
                        }
                        print(f"[Job {job_id}] YouTube stats: {youtube_stats.get('view_count', 0)} views")

                    print(f"[Job {job_id}] Audio downloaded: {_audio_path}, duration: {duration_min:.1f} min")
                except Exception as dur_err:
                    # If download itself failed, don't bother trying again in process_video
                    err_str = str(dur_err)
                    if "ERROR:" in err_str or "Unable to download" in err_str:
                        raise
                    # Metadata parsing errors are non-fatal — proceed without stats
                    print(f"[Job {job_id}] Metadata extraction failed (proceeding): {dur_err}")

            # Feature gate: check video duration against tier limits
            if duration_min > 0:
                dur_check = BillingService.check_video_duration(bg_db, user_id, duration_min)
                if not dur_check["allowed"]:
                    JobService.complete_job(
                        db=bg_db, job_id=job_id,
                        error=(
                            f"Video is {int(duration_min)} min. Your plan allows up to "
                            f"{dur_check['max_duration']} min. Upgrade to "
                            f"{dur_check['required_tier'].capitalize()} for longer videos."
                        ),
                    )
                    return

            # Deduct credits based on actual duration
            import math
            actual_cost = BillingService.get_video_credit_cost(duration_min, analyze_frames)
            try:
                BillingService.deduct_credits(
                    bg_db, user_id, actual_cost, "video_processing",
                    content_id=job_id,
                    description=f"Video processing ({int(duration_min)} min)",
                )
                job_row = bg_db.query(JobModel).filter(JobModel.id == job_id).first()
                if job_row:
                    job_row.credits_deducted = actual_cost
                    bg_db.commit()
                print(f"[Job {job_id}] Deducted {actual_cost} credits")
            except ValueError:
                balance = BillingService.get_credit_balance(bg_db, user_id)
                JobService.complete_job(
                    db=bg_db, job_id=job_id,
                    error=f"Insufficient credits: need {actual_cost}, have {balance}. Upgrade for more credits.",
                )
                return

            def progress_callback(percent, status):
                _pdb = SessionLocal()
                try:
                    # Don't overwrite terminal states (failed/completed/cancelled)
                    j = _pdb.query(JobModel).filter(JobModel.id == job_id).first()
                    if j and j.status in ("failed", "completed", "cancelled"):
                        return
                    JobService.update_job_progress(
                        db=_pdb, job_id=job_id, progress=percent,
                        status=status or "processing",
                    )
                except Exception as _pe:
                    print(f"[Job {job_id}] Progress update failed: {_pe}")
                finally:
                    _pdb.close()
                print(f"[Job {job_id}] Progress: {percent}% - {status}")

            ai = _get_app(user_id, bg_db)

            # Close bg_db BEFORE the long process_video() call.
            # It's no longer needed — progress callbacks use their own sessions,
            # and save operations will use a fresh save_db.
            bg_db.close()
            bg_db = None  # Prevent accidental reuse

            result = ai.process_video(
                url_or_path,
                analyze_frames=analyze_frames,
                progress_callback=progress_callback,
                detect_speakers=detect_speakers,
                user_id=user_id,
                mode=mode,
                youtube_stats=youtube_stats,
                language=language,
                save_content=False,
                cookies_file=cookies_temp_path,
            )
        finally:
            if cookies_temp_path:
                try:
                    os.unlink(cookies_temp_path)
                except OSError:
                    pass

        # Fresh DB session for save operations (bg_db already closed above)
        save_db = SessionLocal()
        try:
            print(f"[Job {job_id}] Processing done, saving results...")

            # If user cancelled while we were processing, do not save
            j = JobService.get_job(save_db, job_id)
            if j and j.status == "cancelled":
                print(f"[Job {job_id}] Cancelled by user, skipping save.")
                return

            # Get file size for storage tracking
            file_size_bytes = 0
            if result.source_video:
                try:
                    file_size_bytes = os.path.getsize(result.source_video)
                except OSError:
                    pass

            # Storage check
            if file_size_bytes > 0:
                storage_check = BillingService.check_storage(save_db, user_id, file_size_bytes)
                if not storage_check["allowed"]:
                    job_row = save_db.query(JobModel).filter(JobModel.id == job_id).first()
                    if job_row and job_row.credits_deducted:
                        try:
                            BillingService.refund_credits(
                                save_db, user_id, job_row.credits_deducted,
                                "video_processing", content_id=job_id,
                                description="Refund: storage limit exceeded",
                            )
                        except Exception:
                            pass
                    JobService.complete_job(
                        db=save_db, job_id=job_id,
                        error=(
                            f"Storage full: using {storage_check['used_mb']:.0f} MB of "
                            f"{storage_check['limit_mb']} MB. Upgrade your plan for more storage."
                        ),
                    )
                    return

            # Save to vector database (dedup by source URL)
            print(f"[Job {job_id}] Generating embedding...")
            vector_memory = VectorMemory(save_db, user_id)
            result_dict = result.to_dict()
            result_dict["file_size_bytes"] = file_size_bytes

            source_url = result_dict.get("source_url", "")
            new_content_id = result_dict.get("id", "")
            if source_url:
                existing_id = vector_memory.find_by_source_url(source_url, user_id)
                if existing_id and existing_id != new_content_id:
                    print(f"[Job {job_id}] Dedup: overwriting {existing_id} (same source URL)")
                    import shutil
                    thumb_base = Path("data/thumbnails")
                    old_thumb_dir = thumb_base / existing_id
                    new_thumb_dir = thumb_base / new_content_id
                    if old_thumb_dir.exists():
                        shutil.rmtree(old_thumb_dir, ignore_errors=True)
                    if new_thumb_dir.exists():
                        new_thumb_dir.rename(old_thumb_dir)
                        thumbs = (result_dict.get("metadata") or {}).get("thumbnails", [])
                        for t in thumbs:
                            if "path" in t:
                                t["path"] = t["path"].replace(new_content_id, existing_id)
                    result_dict["id"] = existing_id

            print(f"[Job {job_id}] Writing to database...")
            vector_memory.add_content(result_dict, user_id)

            # Auto-add to collection if specified
            if collection_id:
                content_id = result_dict.get("id")
                if content_id:
                    vector_memory.add_to_collection(content_id, collection_id, user_id)
                    print(f"[Job {job_id}] Added to collection {collection_id}")

            # Mark job complete
            JobService.complete_job(db=save_db, job_id=job_id, result=result_dict)
            print(f"[Job {job_id}] Completed successfully!")

            # Send job complete email + notification
            _send_completion_notifications(save_db, user_id, result_dict)
        finally:
            save_db.close()

    except Exception as e:
        error_msg = str(e)
        error_trace = traceback.format_exc()
        print(f"[Job {job_id}] ERROR: {error_msg}")
        print(f"[Job {job_id}] Traceback:\n{error_trace}")

        error_db = SessionLocal()
        try:
            j = JobService.get_job(error_db, job_id)
            if j and j.status != "cancelled":
                JobService.complete_job(db=error_db, job_id=job_id, error=error_msg)
                if j.credits_deducted and j.credits_deducted > 0:
                    try:
                        BillingService.refund_credits(
                            error_db, user_id, j.credits_deducted,
                            "video_processing", content_id=job_id,
                            description="Refund: processing failed",
                        )
                        print(f"[Job {job_id}] Refunded {j.credits_deducted} credits")
                    except Exception as refund_err:
                        print(f"[Job {job_id}] Refund failed: {refund_err}")
        finally:
            error_db.close()
    finally:
        _release_slot()
        try:
            if bg_db is not None:
                bg_db.close()
        except Exception:
            pass


# ---------------------------------------------------------------------------
# Job 2: process an uploaded local file  (was process_upload() in api.py)
# ---------------------------------------------------------------------------

def process_upload_job(
    job_id: str,
    user_id: int,
    dest_path: str,
    analyze_frames: bool,
    mode: str,
    display_name: str,
    language: str | None = None,
    collection_id: str | None = None,
    provider: str = "openai",
):
    """RQ job: process an uploaded local video file."""

    # Wait for a processing slot (prevents OOM with concurrent users)
    _acquire_slot(job_id)

    detect_speakers = os.getenv("ENABLE_SPEAKER_DETECTION", "false").lower() == "true"

    bg_db = SessionLocal()
    try:
        print(f"[Job {job_id}] Starting upload processing for: {display_name}")

        # Check video duration
        duration_min = 0
        try:
            info = get_video_info(dest_path)
            duration_min = info.get("duration", 0) / 60
        except Exception as e:
            print(f"[Job {job_id}] Duration check failed (proceeding): {e}")

        if duration_min > 0:
            dur_check = BillingService.check_video_duration(bg_db, user_id, duration_min)
            if not dur_check["allowed"]:
                JobService.complete_job(
                    db=bg_db, job_id=job_id,
                    error=(
                        f"Video is {int(duration_min)} min. Your plan allows up to "
                        f"{dur_check['max_duration']} min. Upgrade to "
                        f"{dur_check['required_tier'].capitalize()} for longer videos."
                    ),
                )
                return

        # Deduct credits
        actual_cost = BillingService.get_video_credit_cost(duration_min, analyze_frames)
        try:
            BillingService.deduct_credits(
                bg_db, user_id, actual_cost, "video_processing",
                content_id=job_id,
                description=f"Video upload ({int(duration_min)} min)",
            )
            job_row = bg_db.query(JobModel).filter(JobModel.id == job_id).first()
            if job_row:
                job_row.credits_deducted = actual_cost
                bg_db.commit()
            print(f"[Job {job_id}] Deducted {actual_cost} credits")
        except ValueError:
            balance = BillingService.get_credit_balance(bg_db, user_id)
            JobService.complete_job(
                db=bg_db, job_id=job_id,
                error=f"Insufficient credits: need {actual_cost}, have {balance}. Upgrade for more credits.",
            )
            return

        def progress_callback(percent, status):
            _pdb = SessionLocal()
            try:
                # Don't overwrite terminal states (failed/completed/cancelled)
                j = _pdb.query(JobModel).filter(JobModel.id == job_id).first()
                if j and j.status in ("failed", "completed", "cancelled"):
                    return
                JobService.update_job_progress(
                    db=_pdb, job_id=job_id, progress=percent,
                    status=status or "processing",
                )
            except Exception as _pe:
                print(f"[Job {job_id}] Progress update failed: {_pe}")
            finally:
                _pdb.close()
            print(f"[Job {job_id}] Progress: {percent}% - {status}")

        ai = _get_app(user_id, bg_db)

        # Close bg_db BEFORE the long process_video() call.
        bg_db.close()
        bg_db = None

        result = ai.process_video(
            dest_path,
            analyze_frames=analyze_frames,
            progress_callback=progress_callback,
            detect_speakers=detect_speakers,
            user_id=user_id,
            mode=mode,
            language=language,
            save_content=False,
        )

        # Fresh DB session for save operations (bg_db already closed above)
        save_db = SessionLocal()
        try:
            print(f"[Job {job_id}] Processing done, saving results...")

            # Check cancellation
            j = JobService.get_job(save_db, job_id)
            if j and j.status == "cancelled":
                print(f"[Job {job_id}] Cancelled by user, skipping save.")
                return

            # File size for storage tracking
            file_size_bytes = 0
            if result.source_video:
                try:
                    file_size_bytes = os.path.getsize(result.source_video)
                except OSError:
                    pass

            # Storage check
            if file_size_bytes > 0:
                storage_check = BillingService.check_storage(save_db, user_id, file_size_bytes)
                if not storage_check["allowed"]:
                    job_row = save_db.query(JobModel).filter(JobModel.id == job_id).first()
                    if job_row and job_row.credits_deducted:
                        try:
                            BillingService.refund_credits(
                                save_db, user_id, job_row.credits_deducted,
                                "video_processing", content_id=job_id,
                                description="Refund: storage limit exceeded",
                            )
                        except Exception:
                            pass
                    JobService.complete_job(
                        db=save_db, job_id=job_id,
                        error=(
                            f"Storage full: using {storage_check['used_mb']:.0f} MB of "
                            f"{storage_check['limit_mb']} MB. Upgrade your plan for more storage."
                        ),
                    )
                    return

            # Save to vector database
            print(f"[Job {job_id}] Generating embedding...")
            vector_memory = VectorMemory(save_db, user_id)
            result_dict = result.to_dict()
            result_dict["file_size_bytes"] = file_size_bytes
            print(f"[Job {job_id}] Writing to database...")
            vector_memory.add_content(result_dict, user_id)

            # Auto-add to collection
            if collection_id:
                content_id = result_dict.get("id")
                if content_id:
                    vector_memory.add_to_collection(content_id, collection_id, user_id)
                    print(f"[Job {job_id}] Added to collection {collection_id}")

            JobService.complete_job(db=save_db, job_id=job_id, result=result_dict)
            print(f"[Job {job_id}] Upload completed successfully!")

            # Send job complete email + notification
            _send_completion_notifications(save_db, user_id, result_dict)
        finally:
            save_db.close()

    except Exception as e:
        error_msg = str(e)
        error_trace = traceback.format_exc()
        print(f"[Job {job_id}] ERROR: {error_msg}")
        print(f"[Job {job_id}] Traceback:\n{error_trace}")

        error_db = SessionLocal()
        try:
            j = JobService.get_job(error_db, job_id)
            if j and j.status != "cancelled":
                JobService.complete_job(db=error_db, job_id=job_id, error=error_msg)
                if j.credits_deducted and j.credits_deducted > 0:
                    try:
                        BillingService.refund_credits(
                            error_db, user_id, j.credits_deducted,
                            "video_processing", content_id=job_id,
                            description="Refund: processing failed",
                        )
                        print(f"[Job {job_id}] Refunded {j.credits_deducted} credits")
                    except Exception as refund_err:
                        print(f"[Job {job_id}] Refund failed: {refund_err}")
        finally:
            error_db.close()
    finally:
        _release_slot()
        try:
            if bg_db is not None:
                bg_db.close()
        except Exception:
            pass


# ---------------------------------------------------------------------------
# Job 3: generate a report from sources
# ---------------------------------------------------------------------------

def generate_report_job(report_id: str, user_id: int):
    """RQ job: generate a structured report from source content."""
    from datetime import datetime as _dt

    db = SessionLocal()
    try:
        print(f"[Report {report_id}] Starting report generation", flush=True)

        # Load report row
        report = db.query(Report).filter(Report.id == report_id).first()
        if not report:
            print(f"[Report {report_id}] Report not found in DB")
            return

        config = report.config or {}

        # Determine user tier
        sub = BillingService._ensure_subscription(db, user_id)
        tier = sub.tier or "free"

        # Gather source content
        sources = []
        content_ids = report.content_ids or []

        # If collection-based, get all content in collection
        if report.collection_id and not content_ids:
            vm = VectorMemory(db, user_id)
            coll_contents = vm.get_collection_contents(report.collection_id, user_id)
            content_ids = [c["id"] for c in coll_contents]
            report.content_ids = content_ids
            db.commit()

        # Load full content for each source
        vm = VectorMemory(db, user_id)
        for cid in content_ids:
            content = vm.get_content(cid, user_id)
            if content:
                fc = content.get("full_content", content)
                if isinstance(fc, str):
                    import json as _json
                    try:
                        fc = _json.loads(fc)
                    except Exception:
                        fc = content
                sources.append(fc)

        if not sources:
            report.status = "failed"
            report.error = "No source content found"
            report.completed_at = _dt.utcnow()
            db.commit()
            print(f"[Report {report_id}] Failed: no sources")
            return

        print(f"[Report {report_id}] Generating {report.report_type} from {len(sources)} sources (tier={tier})", flush=True)

        # Generate the report
        from report_generator import ReportGenerator
        generator = ReportGenerator(provider="openai", tier=tier)
        result = generator.generate(report.report_type, sources, config)

        # Calculate credit cost
        from database import CREDIT_COSTS
        num_sources = len(sources)
        credit_cost = CREDIT_COSTS["report_base"] + max(0, num_sources - 1) * CREDIT_COSTS["report_per_source"]
        if config.get("web_enrichment"):
            credit_cost += CREDIT_COSTS["report_web_enrichment"]

        # Deduct credits
        try:
            BillingService.deduct_credits(
                db, user_id, credit_cost, "report",
                content_id=report_id,
                description=f"Report: {report.report_type} ({num_sources} sources)",
            )
        except ValueError:
            report.status = "failed"
            report.error = "Insufficient credits"
            report.completed_at = _dt.utcnow()
            db.commit()
            print(f"[Report {report_id}] Failed: insufficient credits")
            return

        # Save result
        report.result = result
        report.status = "completed"
        report.credits_charged = credit_cost
        report.completed_at = _dt.utcnow()
        db.commit()

        # Send notification
        try:
            from notification_service import create_notification
            create_notification(
                db, user_id, "report_ready",
                "Report ready",
                f'Your {report.report_type.replace("_", " ").title()} report "{report.title}" is ready.',
                link=f"/app?report={report_id}",
            )
        except Exception as ne:
            print(f"[Report {report_id}] Notification failed: {ne}")

        print(f"[Report {report_id}] Completed successfully! ({credit_cost} credits)", flush=True)

    except Exception as e:
        error_msg = str(e)
        error_trace = traceback.format_exc()
        print(f"[Report {report_id}] ERROR: {error_msg}")
        print(f"[Report {report_id}] Traceback:\n{error_trace}")

        try:
            report = db.query(Report).filter(Report.id == report_id).first()
            if report:
                report.status = "failed"
                report.error = error_msg
                report.completed_at = _dt.utcnow()
                db.commit()
        except Exception:
            pass
    finally:
        db.close()
