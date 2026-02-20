"""
Job Service - Manages video processing jobs in database
"""
from sqlalchemy.orm import Session
from sqlalchemy import desc, update
from datetime import datetime
from typing import Optional, List, Dict
from database import Job
from redis_client import cache_delete


# Only the columns the /api/jobs list endpoint actually returns.
# Excludes result (~100KB-1MB), settings (~1-10KB), and error (only needed on fail).
_LIST_COLUMNS = [
    Job.id, Job.status, Job.progress, Job.title,
    Job.video_url, Job.mode, Job.error,
    Job.started_at, Job.completed_at
]


class JobService:
    @staticmethod
    def create_job(
        db: Session,
        user_id: int,
        video_url: str,
        settings: Dict = None,
        title: Optional[str] = None,
        mode: str = "general"
    ) -> Job:
        """Create a new job"""
        job = Job(
            user_id=user_id,
            video_url=video_url,
            title=title or video_url[:50],
            status="queued",
            progress=0.0,
            settings=settings or {},
            mode=mode
        )
        db.add(job)
        db.commit()
        db.refresh(job)

        # Invalidate user's job list cache
        cache_delete(f"jobs:user:{user_id}")

        return job

    @staticmethod
    def get_job(db: Session, job_id: str) -> Optional[Job]:
        """Get a job by ID (full row including result)"""
        return db.query(Job).filter(Job.id == job_id).first()

    @staticmethod
    def get_user_jobs(
        db: Session,
        user_id: int,
        limit: int = 50,
        status: Optional[str] = None
    ) -> List:
        """Get jobs for a user — only lightweight columns (no result/settings)."""
        query = db.query(*_LIST_COLUMNS).filter(Job.user_id == user_id)

        if status:
            query = query.filter(Job.status == status)

        return query.order_by(desc(Job.created_at)).limit(limit).all()

    @staticmethod
    def update_job_progress(
        db: Session,
        job_id: str,
        progress: float,
        status: Optional[str] = None
    ) -> Optional[Job]:
        """Update job progress using a targeted UPDATE (avoids loading heavy columns)."""
        values = {
            "progress": min(progress, 100.0),
            "updated_at": datetime.utcnow()
        }
        if status:
            values["status"] = status

        result = db.execute(
            update(Job).where(Job.id == job_id).values(**values)
        )
        if result.rowcount == 0:
            return None

        db.commit()

        # Load lightweight version for cache invalidation
        job = db.query(Job.user_id).filter(Job.id == job_id).first()
        if job:
            cache_delete(f"jobs:user:{job.user_id}")

        return True

    @staticmethod
    def complete_job(
        db: Session,
        job_id: str,
        result: Dict = None,
        error: Optional[str] = None
    ) -> Optional[Job]:
        """Mark job as completed or failed"""
        now = datetime.utcnow()
        if error:
            values = {"status": "failed", "error": error, "completed_at": now, "updated_at": now}
        else:
            values = {"status": "completed", "result": result, "progress": 100.0, "completed_at": now, "updated_at": now}

        res = db.execute(
            update(Job).where(Job.id == job_id).values(**values)
        )
        if res.rowcount == 0:
            return None

        db.commit()

        # Invalidate cache
        job = db.query(Job.user_id).filter(Job.id == job_id).first()
        if job:
            cache_delete(f"jobs:user:{job.user_id}")

        return True

    @staticmethod
    def cancel_job(db: Session, job_id: str, user_id: int) -> bool:
        """Cancel a job if it is not already in a terminal state."""
        result = db.execute(
            update(Job)
            .where(Job.id == job_id, Job.user_id == user_id)
            .where(Job.status.notin_(["completed", "failed", "cancelled"]))
            .values(status="cancelled", updated_at=datetime.utcnow())
        )
        if result.rowcount == 0:
            return False

        db.commit()
        cache_delete(f"jobs:user:{user_id}")
        return True

    @staticmethod
    def delete_job(db: Session, job_id: str, user_id: int) -> bool:
        """Remove a job (e.g. failed/cancelled so user can dismiss it from the list)"""
        result = db.query(Job).filter(
            Job.id == job_id,
            Job.user_id == user_id
        ).delete(synchronize_session=False)

        if not result:
            return False

        db.commit()
        cache_delete(f"jobs:user:{user_id}")
        return True
