"""
FastAPI Backend for Video Memory AI
With authentication, billing, notes, tags, search, and collection chat features
"""
from fastapi import FastAPI, HTTPException, Depends, Request, Header, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import sys
import os

# Fix Windows console encoding — prevent crashes on Unicode characters in video titles/paths
if sys.stdout and hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(errors='replace')
if sys.stderr and hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(errors='replace')
from pathlib import Path
import uuid
import logging
from collections import OrderedDict
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import text, func

sys.path.insert(0, str(Path(__file__).parent))

from app import VideoMemoryAI
from video_processor import _extract_video_id
from database import get_db, init_db, User, get_tier_limits, engine, SessionLocal, ChatSession, ChatMessage, GeneratedContent, ContentVector, Collection, CREDIT_COSTS, TIER_CREDITS, TOPUP_PACKS
from auth import (
    UserCreate, UserLogin, UserResponse, Token,
    ForgotPasswordRequest, ResetPasswordRequest, GoogleAuthRequest,
    AuthService, get_current_user, get_current_active_user, get_optional_user
)
from billing import BillingService, CheckoutSessionCreate, CheckoutSessionResponse, SubscriptionResponse, CreditBalanceResponse, CreditCostsResponse, TopupCheckoutRequest
from notes import NotesService, NoteCreate, NoteUpdate, NoteResponse, BookmarkCreate, BookmarkResponse
from tags import TagsService, TagCreate, TagUpdate, TagResponse, ContentTagAdd, ContentTagsResponse
from search import SearchService
from config import get_config, init_config
from middleware.rate_limit import RateLimitMiddleware, rate_limiter
from job_service import JobService
from vector_memory import VectorMemory
from redis_client import cache_set, cache_get, cache_delete

import subprocess
import json
import math
import threading


def _enqueue_or_thread(func_path: str, **kwargs):
    """Try to enqueue job via RQ worker; fall back to in-process thread.

    Uses RQ when a Redis connection is available and USE_THREAD_FALLBACK is not set.
    Otherwise runs the job function in a daemon thread (single-instance mode).
    """
    use_thread = os.getenv("USE_THREAD_FALLBACK", "").lower() == "true"

    if not use_thread:
        try:
            from rq import Queue
            from redis_client import get_redis_client
            conn = get_redis_client()
            if conn is not None:
                q = Queue(connection=conn)
                timeout = kwargs.pop("job_timeout", "30m")
                q.enqueue(func_path, job_timeout=timeout, **kwargs)
                return
        except Exception as e:
            print(f"[RQ] Enqueue failed, falling back to thread: {e}")

    # Fallback: import the worker module (this eagerly loads openai and all
    # transitive deps) then run the function in a daemon thread.
    from worker import process_video_job, process_upload_job  # noqa: triggers openai import
    func_map = {
        "worker.process_video_job": process_video_job,
        "worker.process_upload_job": process_upload_job,
    }
    fn = func_map[func_path]
    kwargs.pop("job_timeout", None)
    thread = threading.Thread(target=fn, kwargs=kwargs, daemon=True)
    thread.start()


def _validate_cookies_string(s: str) -> bool:
    """Validate Netscape-format cookie string (tab-separated, 7 fields per line)."""
    if not s or len(s) > 500_000:
        return False
    for line in s.strip().split('\n'):
        if line.startswith('#') or not line.strip():
            continue
        if len(line.split('\t')) != 7:
            return False
    return True


def _get_chat_model(db: Session, user_id: int) -> str:
    """Get the AI model for a user based on their subscription tier"""
    sub = BillingService._ensure_subscription(db, user_id)
    limits = get_tier_limits(sub.tier)
    return limits.get("ai_model", "gpt-4o-mini")

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Initialize configuration
config = init_config(validate=True, strict=False)

# Initialize database on startup
init_db()

# Application startup time
APP_START_TIME = datetime.utcnow()

app = FastAPI(
    title="Video Memory AI API",
    description="AI-powered video content extraction and memory system",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# Add rate limiting middleware
app.add_middleware(RateLimitMiddleware)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=config.cors.allowed_origins,
    allow_origin_regex=r"^chrome-extension://.*$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Security headers middleware
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Content-Security-Policy"] = (
        "default-src 'self'; "
        "script-src 'self' https://accounts.google.com; "
        "style-src 'self' 'unsafe-inline'; "
        "img-src 'self' data: https:; "
        "connect-src 'self' https://accounts.google.com https://oauth2.googleapis.com https://www.googleapis.com; "
        "frame-src https://accounts.google.com"
    )
    # HSTS only in production (when not localhost)
    host = request.headers.get("host", "")
    if "localhost" not in host and "127.0.0.1" not in host:
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    return response


# Stateless app creation (no global state)
def get_app(user_id: Optional[int] = None, db: Optional[Session] = None):
    """Create VideoMemoryAI instance (stateless - new instance per request)"""
    config = get_config()

    # Determine user's tier for AI model gating
    tier = "free"
    if db is not None and user_id is not None:
        from billing import BillingService as _BS
        sub = _BS._ensure_subscription(db, user_id)
        tier = sub.tier or "free"

    # Create new instance
    ai = VideoMemoryAI(
        llm_provider="openai" if config.openai.is_configured else "ollama",
        tier=tier
    )

    # Set up VectorMemory for storage
    if db is not None and user_id is not None:
        from vector_memory import VectorMemory
        ai.memory = VectorMemory(db, user_id)

    return ai


# =============================================
# Request/Response Models
# =============================================
class VideoAddRequest(BaseModel):
    url_or_path: str
    analyze_frames: bool = True
    provider: str = "openai"
    mode: str = "general"  # general, recipe, learn, creator, meeting
    language: Optional[str] = None  # None = auto-detect, or ISO code like "en", "es", "fr"
    collection_id: Optional[str] = None  # Auto-add to collection after processing
    cookies: Optional[str] = None  # Netscape-format cookies for YouTube (transient, never stored)


class SettingsUpdate(BaseModel):
    provider: Optional[str] = None


class ExportRequest(BaseModel):
    content_ids: List[str] = []
    format: str = "markdown"
    include_transcript: bool = True


class CollectionCreate(BaseModel):
    name: str
    description: str = ""


class CollectionAddContent(BaseModel):
    content_id: str


class SearchRequest(BaseModel):
    query: Optional[str] = None
    tag_ids: Optional[List[int]] = None
    content_type: Optional[str] = None
    has_notes: Optional[bool] = None
    n_results: int = 20
    match_all_tags: bool = False


# =============================================
# Auth Endpoints
# =============================================
@app.post("/api/auth/register", response_model=Token)
async def register(user_data: UserCreate, db: Session = Depends(get_db)):
    """Register a new user"""
    # Check if email already exists
    existing_user = AuthService.get_user_by_email(db, user_data.email)
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")

    # Create user
    user = AuthService.create_user(db, user_data)

    # Get subscription tier
    tier = AuthService.get_user_tier(db, user.id)

    # Create token
    return AuthService.create_user_token(user, tier)


@app.post("/api/auth/login", response_model=Token)
async def login(credentials: UserLogin, db: Session = Depends(get_db)):
    """Login and get JWT token"""
    user = AuthService.authenticate_user(db, credentials.email, credentials.password)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password")

    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account is deactivated")

    # Get subscription tier
    tier = AuthService.get_user_tier(db, user.id)

    return AuthService.create_user_token(user, tier)


@app.get("/api/auth/me", response_model=UserResponse)
async def get_me(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get current user info"""
    tier = AuthService.get_user_tier(db, current_user.id)
    return UserResponse(
        id=current_user.id,
        email=current_user.email,
        full_name=current_user.full_name,
        is_active=current_user.is_active,
        created_at=current_user.created_at,
        tier=tier
    )


@app.post("/api/auth/logout")
async def logout(
    request: Request,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Logout (invalidate token)"""
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        token = auth_header[7:]
        token_data = AuthService.decode_token(token)
        if token_data and token_data.exp:
            AuthService.blacklist_token(db, token, token_data.exp)

    return {"message": "Logged out successfully"}


@app.post("/api/auth/forgot-password")
async def forgot_password(
    request: ForgotPasswordRequest,
    db: Session = Depends(get_db)
):
    """Request a password reset email. Always returns success to prevent email enumeration."""
    user = AuthService.get_user_by_email(db, request.email)
    if user and user.hashed_password is not None:
        raw_token = AuthService.create_password_reset_token(db, user)
        from email_service import send_password_reset_email
        send_password_reset_email(user.email, raw_token)

    return {"message": "If an account exists with that email, a reset link has been sent."}


@app.post("/api/auth/reset-password")
async def reset_password(
    request: ResetPasswordRequest,
    db: Session = Depends(get_db)
):
    """Reset password using a valid reset token."""
    user = AuthService.validate_password_reset_token(db, request.token)
    if not user:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")

    AuthService.change_password(db, user, request.new_password)
    AuthService.clear_password_reset_token(db, user)

    return {"message": "Password reset successfully. You can now log in."}


@app.post("/api/auth/google", response_model=Token)
async def google_login(
    request: GoogleAuthRequest,
    db: Session = Depends(get_db)
):
    """Authenticate with Google OAuth credential."""
    google_info = AuthService.verify_google_token(request.credential)
    if not google_info:
        raise HTTPException(status_code=401, detail="Invalid Google credential")

    user = AuthService.get_or_create_google_user(db, google_info)
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account is deactivated")

    tier = AuthService.get_user_tier(db, user.id)
    return AuthService.create_user_token(user, tier)


# =============================================
# Education Verification
# =============================================
@app.post("/api/auth/verify-edu")
async def verify_edu(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Verify .edu email for education discount"""
    if current_user.email.endswith(".edu"):
        current_user.is_edu_verified = True
        db.commit()
        return {"verified": True}
    return {"verified": False, "message": "Only .edu email addresses qualify for the education discount."}


# =============================================
# Health Check Endpoints
# =============================================
@app.get("/api/health")
async def health_check():
    """
    Basic health check endpoint.
    Returns service status and uptime.
    """
    uptime = (datetime.utcnow() - APP_START_TIME).total_seconds()
    return {
        "status": "healthy",
        "service": "video-memory-ai",
        "version": "1.0.0",
        "uptime_seconds": int(uptime),
        "timestamp": datetime.utcnow().isoformat()
    }


@app.get("/api/health/detailed")
async def detailed_health_check(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Detailed health check with component status.
    Requires authentication (admin recommended in production).
    """
    health_status = {
        "status": "healthy",
        "service": "video-memory-ai",
        "version": "1.0.0",
        "uptime_seconds": int((datetime.utcnow() - APP_START_TIME).total_seconds()),
        "timestamp": datetime.utcnow().isoformat(),
        "components": {}
    }

    # Check database connection
    try:
        db.execute(text("SELECT 1"))
        health_status["components"]["database"] = {
            "status": "healthy",
            "type": "sqlite" if "sqlite" in str(engine.url) else "postgresql"
        }
    except Exception as e:
        health_status["components"]["database"] = {
            "status": "unhealthy",
            "error": str(e)
        }
        health_status["status"] = "degraded"

    # Check VectorMemory
    try:
        vector_memory = VectorMemory(db, current_user.id)
        doc_count = vector_memory.count_user_content(current_user.id)
        health_status["components"]["vector_memory"] = {
            "status": "healthy",
            "documents": doc_count
        }
    except Exception as e:
        health_status["components"]["vector_memory"] = {
            "status": "unhealthy",
            "error": str(e)
        }
        health_status["status"] = "degraded"

    # Check OpenAI configuration
    health_status["components"]["openai"] = {
        "status": "configured" if config.openai.is_configured else "not_configured"
    }

    # Check Stripe configuration
    health_status["components"]["stripe"] = {
        "status": "configured" if config.stripe.is_configured else "not_configured"
    }

    # Rate limiter stats
    health_status["components"]["rate_limiter"] = {
        "status": "healthy",
        **rate_limiter.get_stats()
    }

    # Active jobs
    with jobs_lock:
        active_jobs = len([j for j in jobs.values() if j.get("status") not in ["complete", "error"]])
        health_status["components"]["job_queue"] = {
            "status": "healthy",
            "active_jobs": active_jobs,
            "total_jobs": len(jobs)
        }

    return health_status


# =============================================
# Billing Endpoints
# =============================================
@app.get("/api/billing/plans")
async def get_plans():
    """Get available subscription plans"""
    plans = BillingService.get_plans()
    return {"plans": [p.model_dump() for p in plans]}


@app.post("/api/billing/checkout", response_model=CheckoutSessionResponse)
async def create_checkout(
    request: CheckoutSessionCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Create Stripe checkout session"""
    result = BillingService.create_checkout_session(
        db, current_user, request.tier, request.billing_period,
        request.success_url, request.cancel_url
    )
    if not result:
        raise HTTPException(status_code=500, detail="Failed to create checkout session")
    return CheckoutSessionResponse(**result)


@app.get("/api/billing/subscription", response_model=SubscriptionResponse)
async def get_subscription(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get current subscription"""
    return BillingService.get_subscription(db, current_user.id)


@app.post("/api/billing/cancel")
async def cancel_subscription(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Cancel subscription"""
    result = BillingService.cancel_subscription(db, current_user)
    if not result:
        raise HTTPException(status_code=400, detail="No active subscription to cancel")
    return result


@app.post("/api/billing/portal")
async def create_portal(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Create Stripe customer portal session"""
    url = BillingService.create_portal_session(db, current_user)
    if not url:
        raise HTTPException(status_code=400, detail="No billing account found")
    return {"portal_url": url}


@app.get("/api/profile/stats")
async def get_profile_stats(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get profile activity stats"""
    total_videos = db.query(func.count(ContentVector.id)).filter(ContentVector.user_id == current_user.id).scalar() or 0
    total_collections = db.query(func.count(Collection.id)).filter(Collection.user_id == current_user.id).scalar() or 0
    total_chats = db.query(func.count(ChatSession.id)).filter(ChatSession.user_id == current_user.id).scalar() or 0
    return {
        "total_videos": total_videos,
        "total_collections": total_collections,
        "total_chats": total_chats,
        "is_edu_verified": current_user.is_edu_verified or False
    }


@app.post("/api/webhooks/stripe")
async def stripe_webhook(
    request: Request,
    db: Session = Depends(get_db)
):
    """Handle Stripe webhook events"""
    payload = await request.body()
    signature = request.headers.get("stripe-signature", "")

    try:
        result = BillingService.handle_webhook(db, payload, signature)
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/api/billing/limits")
async def get_usage_limits(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get current usage and limits for the user's tier"""
    return BillingService.check_limits(db, current_user.id)


@app.get("/api/billing/feature/{feature}")
async def check_feature(
    feature: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Check if user has access to a specific feature"""
    valid_features = [
        "vision_analysis", "advanced_search", "api_access",
        "priority_processing", "content_spinning", "top10_generator",
        "guide_generation", "flashcard_generation", "mindmap_generation"
    ]
    if feature not in valid_features:
        raise HTTPException(status_code=400, detail=f"Invalid feature. Valid features: {valid_features}")
    return BillingService.check_feature_access(db, current_user.id, feature)


@app.get("/api/billing/check-video-duration")
async def check_video_duration(
    duration_minutes: float,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Check if user can process a video of given duration"""
    return BillingService.check_video_duration(db, current_user.id, duration_minutes)


@app.get("/api/billing/export-formats")
async def get_export_formats(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get available export formats for user's tier"""
    formats = BillingService.get_export_formats(db, current_user.id)
    return {"formats": formats}


@app.get("/api/billing/credits")
async def get_credits(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get credit balance and recent transactions"""
    sub = BillingService._ensure_subscription(db, current_user.id)
    tier_info = TIER_CREDITS.get(sub.tier, TIER_CREDITS["free"])
    history = BillingService.get_credit_history(db, current_user.id, limit=50)
    monthly = sub.credit_balance or 0
    topup = sub.topup_balance or 0
    return {
        "balance": monthly + topup,
        "monthly_balance": monthly,
        "topup_balance": topup,
        "credits_monthly": tier_info["credits_monthly"],
        "tier": sub.tier,
        "credits_reset_at": sub.credits_reset_at.isoformat() if sub.credits_reset_at else None,
        "transactions": history
    }


@app.get("/api/billing/credit-costs")
async def get_credit_costs():
    """Get full credit cost matrix"""
    return {
        "costs": CREDIT_COSTS,
        "tier_credits": TIER_CREDITS,
        "topup_packs": TOPUP_PACKS,
    }


@app.get("/api/billing/topup-packs")
async def get_topup_packs(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get available top-up packs for the user's tier"""
    return BillingService.get_topup_packs(db, current_user.id)


@app.post("/api/billing/topup")
async def purchase_topup(
    request: TopupCheckoutRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Create a Stripe checkout session for top-up credits"""
    try:
        result = BillingService.create_topup_checkout(
            db, current_user, request.pack_id,
            success_url=request.success_url,
            cancel_url=request.cancel_url
        )
        if not result:
            raise HTTPException(status_code=500, detail="Billing not configured")
        return result
    except ValueError as e:
        raise HTTPException(status_code=403, detail=str(e))


# =============================================
# Notes Endpoints
# =============================================
@app.post("/api/notes", response_model=NoteResponse)
async def create_note(
    note_data: NoteCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Create a new note"""
    note = NotesService.create_note(db, current_user.id, note_data)
    return NoteResponse.model_validate(note)


@app.get("/api/notes")
async def get_notes(
    content_id: Optional[str] = None,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get notes, optionally filtered by content_id"""
    if content_id:
        notes = NotesService.get_notes_for_content(db, current_user.id, content_id)
    else:
        notes = NotesService.get_all_notes(db, current_user.id)

    return {
        "notes": [NoteResponse.model_validate(n) for n in notes],
        "total": len(notes)
    }


@app.put("/api/notes/{note_id}", response_model=NoteResponse)
async def update_note(
    note_id: int,
    note_data: NoteUpdate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Update a note"""
    note = NotesService.update_note(db, note_id, current_user.id, note_data)
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    return NoteResponse.model_validate(note)


@app.delete("/api/notes/{note_id}")
async def delete_note(
    note_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Delete a note"""
    success = NotesService.delete_note(db, note_id, current_user.id)
    if not success:
        raise HTTPException(status_code=404, detail="Note not found")
    return {"message": "Note deleted"}


# =============================================
# Bookmarks Endpoints
# =============================================
@app.post("/api/bookmarks", response_model=BookmarkResponse)
async def create_bookmark(
    bookmark_data: BookmarkCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Create a new bookmark"""
    bookmark = NotesService.create_bookmark(db, current_user.id, bookmark_data)
    return BookmarkResponse.model_validate(bookmark)


@app.get("/api/bookmarks")
async def get_bookmarks(
    content_id: Optional[str] = None,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get bookmarks, optionally filtered by content_id"""
    if content_id:
        bookmarks = NotesService.get_bookmarks_for_content(db, current_user.id, content_id)
    else:
        bookmarks = NotesService.get_all_bookmarks(db, current_user.id)

    return {
        "bookmarks": [BookmarkResponse.model_validate(b) for b in bookmarks],
        "total": len(bookmarks)
    }


@app.delete("/api/bookmarks/{bookmark_id}")
async def delete_bookmark(
    bookmark_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Delete a bookmark"""
    success = NotesService.delete_bookmark(db, bookmark_id, current_user.id)
    if not success:
        raise HTTPException(status_code=404, detail="Bookmark not found")
    return {"message": "Bookmark deleted"}


# =============================================
# Tags Endpoints
# =============================================
@app.post("/api/tags", response_model=TagResponse)
async def create_tag(
    tag_data: TagCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Create a new tag"""
    # Check if tag with same name exists
    existing = TagsService.get_tag_by_name(db, tag_data.name, current_user.id)
    if existing:
        raise HTTPException(status_code=400, detail="Tag with this name already exists")

    tag = TagsService.create_tag(db, current_user.id, tag_data)
    return TagResponse(
        id=tag.id,
        name=tag.name,
        color=tag.color,
        created_at=tag.created_at,
        content_count=0
    )


@app.get("/api/tags")
async def get_tags(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get all user tags"""
    tags = TagsService.get_all_tags(db, current_user.id)
    return {"tags": tags, "total": len(tags)}


@app.put("/api/tags/{tag_id}", response_model=TagResponse)
async def update_tag(
    tag_id: int,
    tag_data: TagUpdate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Update a tag"""
    tag = TagsService.update_tag(db, tag_id, current_user.id, tag_data)
    if not tag:
        raise HTTPException(status_code=404, detail="Tag not found")
    return TagResponse(
        id=tag.id,
        name=tag.name,
        color=tag.color,
        created_at=tag.created_at,
        content_count=0
    )


@app.delete("/api/tags/{tag_id}")
async def delete_tag(
    tag_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Delete a tag"""
    success = TagsService.delete_tag(db, tag_id, current_user.id)
    if not success:
        raise HTTPException(status_code=404, detail="Tag not found")
    return {"message": "Tag deleted"}


@app.post("/api/content/{content_id}/tags", response_model=ContentTagsResponse)
async def add_tags_to_content(
    content_id: str,
    tag_data: ContentTagAdd,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Add tags to content"""
    return TagsService.add_tags_to_content(db, current_user.id, content_id, tag_data.tag_ids)


@app.delete("/api/content/{content_id}/tags/{tag_id}")
async def remove_tag_from_content(
    content_id: str,
    tag_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Remove a tag from content"""
    success = TagsService.remove_tag_from_content(db, current_user.id, content_id, tag_id)
    if not success:
        raise HTTPException(status_code=404, detail="Tag association not found")
    return {"message": "Tag removed from content"}


@app.get("/api/content/{content_id}/tags", response_model=ContentTagsResponse)
async def get_content_tags(
    content_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get tags for a content"""
    return TagsService.get_content_tags(db, current_user.id, content_id)


# =============================================
# Search Endpoint
# =============================================
@app.post("/api/search")
async def search_content(
    request: SearchRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Advanced search with filters"""
    # Search is free for all tiers (no credit cost)
    ai = get_app(current_user.id, db)
    results = SearchService.search(
        content_memory=ai.memory,
        db=db,
        user_id=current_user.id,
        query=request.query,
        tag_ids=request.tag_ids,
        content_type=request.content_type,
        has_notes=request.has_notes,
        n_results=request.n_results,
        match_all_tags=request.match_all_tags
    )
    return {"results": results, "total": len(results)}


@app.get("/api/search/stats")
async def get_search_stats(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get search statistics for user"""
    ai = get_app(current_user.id, db)
    return SearchService.get_search_stats(ai.memory, db, current_user.id)


# =============================================
# Video Processing Endpoints (Protected)
# =============================================
@app.get("/")
async def root():
    return {"message": "Video Memory AI API"}


@app.post("/api/videos/add")
async def add_video(
    request: VideoAddRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Add a video to processing queue"""
    # Feature gate: Vision AI requires Pro+
    if request.analyze_frames:
        vision_check = BillingService.check_feature_access(db, current_user.id, "vision_analysis")
        if not vision_check["has_access"]:
            raise HTTPException(
                status_code=403,
                detail={
                    "error": "feature_locked",
                    "feature": "vision_analysis",
                    "required_tier": vision_check["required_tier"],
                    "current_tier": vision_check["current_tier"],
                    "message": f"Vision AI requires {vision_check['required_tier'].capitalize()}+ plan."
                }
            )

    # Feature gate: YouTube download requires Starter+
    is_youtube = any(d in request.url_or_path for d in ['youtube.com', 'youtu.be'])
    if is_youtube:
        yt_check = BillingService.check_feature_access(db, current_user.id, "youtube_download")
        if not yt_check["has_access"]:
            raise HTTPException(
                status_code=403,
                detail={
                    "error": "feature_locked",
                    "feature": "youtube_download",
                    "required_tier": yt_check["required_tier"],
                    "current_tier": yt_check["current_tier"],
                    "message": f"YouTube downloads require {yt_check['required_tier'].capitalize()}+ plan. Free users can upload local video files."
                }
            )

    # Validate cookies format if provided
    if request.cookies:
        if not _validate_cookies_string(request.cookies):
            raise HTTPException(status_code=400, detail="Invalid cookie format. Expected Netscape tab-separated format.")

    # Credit pre-check: minimum 1 credit (1 min video)
    estimated_cost = CREDIT_COSTS["video_per_minute"]  # Minimum 1 credit
    if request.analyze_frames:
        estimated_cost += CREDIT_COSTS["vision_per_minute"]
    credit_check = BillingService.check_credits(db, current_user.id, estimated_cost)
    if not credit_check["has_credits"]:
        raise HTTPException(
            status_code=403,
            detail={
                "error": "insufficient_credits",
                "cost": estimated_cost,
                "balance": credit_check["balance"],
                "tier": credit_check["tier"],
                "message": f"This costs at least {estimated_cost} credits. You have {credit_check['balance']}."
            }
        )

    # Validate mode - "auto" means auto-detect from content
    valid_modes = ["auto", "general", "recipe", "learn", "creator", "meeting"]
    mode = request.mode if request.mode in valid_modes else "auto"

    # Create job in database
    job = JobService.create_job(
        db=db,
        user_id=current_user.id,
        video_url=request.url_or_path,
        settings={
            "provider": request.provider or "openai",
            "analyze_frames": request.analyze_frames
        },
        title=request.url_or_path[:50],
        mode=mode
    )

    # Enqueue processing in background (RQ worker or thread fallback)
    user_id = current_user.id
    cookies_str = request.cookies  # Captured here, never stored in job settings
    is_youtube = any(d in request.url_or_path for d in ['youtube.com', 'youtu.be'])
    if is_youtube:
        print(f"[API] YouTube video submitted. Cookies provided: {bool(cookies_str)}, length: {len(cookies_str) if cookies_str else 0}")

    _enqueue_or_thread(
        "worker.process_video_job",
        job_id=job.id,
        user_id=user_id,
        url_or_path=request.url_or_path,
        analyze_frames=request.analyze_frames,
        mode=mode,
        cookies_str=cookies_str,
        language=request.language,
        collection_id=request.collection_id,
        provider=request.provider or "openai",
        job_timeout="30m",
    )

    has_cookies = bool(cookies_str) if is_youtube else None
    return {
        "job": {
            "id": job.id,
            "status": job.status,
            "progress": job.progress,
            "title": job.title,
            "video_url": job.video_url,
            "mode": job.mode,
            "started_at": job.started_at.isoformat() if job.started_at else None,
            "error": None,
            "cookies_provided": has_cookies
        }
    }


ALLOWED_VIDEO_EXTENSIONS = {'.mp4', '.mkv', '.webm', '.avi', '.mov'}
MAX_UPLOAD_SIZE = 500 * 1024 * 1024  # 500MB


@app.post("/api/videos/upload")
async def upload_video(
    file: UploadFile = File(...),
    analyze_frames: bool = Form(False),
    provider: str = Form("openai"),
    mode: str = Form("general"),
    language: Optional[str] = Form(None),
    collection_id: Optional[str] = Form(None),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Upload a local video file for processing (available to all tiers)"""
    # Validate file extension
    ext = os.path.splitext(file.filename or '')[1].lower()
    if ext not in ALLOWED_VIDEO_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type '{ext}'. Allowed: {', '.join(sorted(ALLOWED_VIDEO_EXTENSIONS))}"
        )

    # Feature gate: Vision AI requires Pro+
    if analyze_frames:
        vision_check = BillingService.check_feature_access(db, current_user.id, "vision_analysis")
        if not vision_check["has_access"]:
            raise HTTPException(
                status_code=403,
                detail={
                    "error": "feature_locked",
                    "feature": "vision_analysis",
                    "required_tier": vision_check["required_tier"],
                    "current_tier": vision_check["current_tier"],
                    "message": f"Vision AI requires {vision_check['required_tier'].capitalize()}+ plan."
                }
            )

    # Credit pre-check: minimum 1 credit
    estimated_cost = CREDIT_COSTS["video_per_minute"]
    if analyze_frames:
        estimated_cost += CREDIT_COSTS["vision_per_minute"]
    credit_check = BillingService.check_credits(db, current_user.id, estimated_cost)
    if not credit_check["has_credits"]:
        raise HTTPException(
            status_code=403,
            detail={
                "error": "insufficient_credits",
                "cost": estimated_cost,
                "balance": credit_check["balance"],
                "tier": credit_check["tier"],
                "message": f"This costs at least {estimated_cost} credits. You have {credit_check['balance']}."
            }
        )

    # Validate mode
    valid_modes = ["auto", "general", "recipe", "learn", "creator", "meeting"]
    mode = mode if mode in valid_modes else "auto"

    # Stream file to disk with size check
    upload_dir = os.path.join("data", "videos")
    os.makedirs(upload_dir, exist_ok=True)
    file_id = str(uuid.uuid4())[:12]
    dest_path = os.path.join(upload_dir, f"upload_{file_id}{ext}")

    total_size = 0
    try:
        with open(dest_path, "wb") as f:
            while True:
                chunk = await file.read(1024 * 1024)  # 1MB chunks
                if not chunk:
                    break
                total_size += len(chunk)
                if total_size > MAX_UPLOAD_SIZE:
                    raise HTTPException(status_code=400, detail=f"File too large. Maximum size is {MAX_UPLOAD_SIZE // (1024*1024)} MB.")
                f.write(chunk)
    except HTTPException:
        # Clean up partial file on size error
        if os.path.exists(dest_path):
            os.unlink(dest_path)
        raise

    if total_size == 0:
        if os.path.exists(dest_path):
            os.unlink(dest_path)
        raise HTTPException(status_code=400, detail="Empty file uploaded.")

    # Create job
    display_name = (file.filename or f"upload_{file_id}{ext}")[:50]
    job = JobService.create_job(
        db=db,
        user_id=current_user.id,
        video_url=dest_path,
        settings={
            "provider": provider or "openai",
            "analyze_frames": analyze_frames
        },
        title=display_name,
        mode=mode
    )

    user_id = current_user.id

    # Enqueue processing in background (RQ worker or thread fallback)
    _enqueue_or_thread(
        "worker.process_upload_job",
        job_id=job.id,
        user_id=user_id,
        dest_path=dest_path,
        analyze_frames=analyze_frames,
        mode=mode,
        display_name=display_name,
        language=language,
        collection_id=collection_id,
        provider=provider or "openai",
        job_timeout="30m",
    )

    return {
        "job": {
            "id": job.id,
            "status": job.status,
            "progress": job.progress,
            "title": job.title,
            "video_url": job.video_url,
            "mode": job.mode,
            "started_at": job.started_at.isoformat() if job.started_at else None,
            "error": None
        }
    }


@app.get("/api/jobs")
async def get_jobs(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get all jobs for current user (lightweight — no result/settings columns)"""
    rows = JobService.get_user_jobs(db, current_user.id, limit=50)

    return {
        "jobs": [
            {
                "id": row.id,
                "status": row.status,
                "progress": row.progress,
                "title": row.title,
                "video_url": row.video_url,
                "mode": row.mode,
                "started_at": row.started_at.isoformat() if row.started_at else None,
                "completed_at": row.completed_at.isoformat() if row.completed_at else None,
                "error": row.error
            }
            for row in rows
        ]
    }


@app.get("/api/jobs/{job_id}")
async def get_job(
    job_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get a specific job"""
    job = JobService.get_job(db, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if job.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    return {
        "id": job.id,
        "status": job.status,
        "progress": job.progress,
        "title": job.title,
        "result": job.result,
        "error": job.error,
        "started_at": job.started_at.isoformat() if job.started_at else None,
        "completed_at": job.completed_at.isoformat() if job.completed_at else None
    }


@app.post("/api/jobs/{job_id}/cancel")
async def cancel_job(
    job_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Cancel a job (queued or in progress). Processing will stop saving when it finishes."""
    success = JobService.cancel_job(db, job_id, current_user.id)
    if not success:
        raise HTTPException(status_code=400, detail="Job cannot be cancelled or not found")
    return {"status": "cancelled"}


@app.delete("/api/jobs/{job_id}")
async def delete_job(
    job_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Remove a job from the list (e.g. dismiss failed/cancelled)."""
    success = JobService.delete_job(db, job_id, current_user.id)
    if not success:
        raise HTTPException(status_code=404, detail="Job not found")
    return {"status": "deleted"}


@app.get("/api/library")
async def get_library(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get all content in library for current user"""
    vector_memory = VectorMemory(db, current_user.id)
    contents = vector_memory.list_all(current_user.id)
    return {"contents": contents}


@app.get("/api/content/{content_id}")
async def get_content(
    content_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get full content details by ID"""
    vector_memory = VectorMemory(db, current_user.id)
    content = vector_memory.get_content(content_id, current_user.id)
    if content is None:
        raise HTTPException(status_code=404, detail="Content not found")
    return {"content": content}


@app.delete("/api/content/{content_id}")
async def delete_content(
    content_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Delete content from library"""
    vector_memory = VectorMemory(db, current_user.id)
    success = vector_memory.delete_content(content_id, current_user.id)
    if not success:
        raise HTTPException(status_code=404, detail="Content not found or could not be deleted")

    # Also delete associated notes, bookmarks, and tags
    NotesService.delete_all_for_content(db, current_user.id, content_id)
    TagsService.delete_all_tags_for_content(db, current_user.id, content_id)

    # Clean up generated content and chat sessions for this content
    db.query(GeneratedContent).filter(
        GeneratedContent.user_id == current_user.id,
        GeneratedContent.content_id == content_id
    ).delete()
    content_sessions = db.query(ChatSession).filter(
        ChatSession.user_id == current_user.id,
        ChatSession.scope_type == "content",
        ChatSession.scope_id == content_id
    ).all()
    for s in content_sessions:
        db.delete(s)
    db.commit()

    return {"message": "Content deleted successfully", "content_id": content_id}


# =============================================
# Thumbnail Endpoints
# =============================================
from fastapi.responses import FileResponse

@app.get("/api/thumbnails/{content_id}/{filename}")
async def get_thumbnail(
    content_id: str,
    filename: str,
):
    """Serve a frame thumbnail image (no auth — loaded by <img> tags).
    Checks local disk first, then redirects to Vercel Blob if available."""
    # Sanitise content_id and filename to prevent path traversal
    import re as _re
    if not _re.match(r'^content_\d{8}_\d{6}$', content_id):
        raise HTTPException(status_code=400, detail="Invalid content ID")
    if not _re.match(r'^\d+\.jpg$', filename):
        raise HTTPException(status_code=400, detail="Invalid filename")

    # 1. Try local filesystem first
    filepath = Path("data/thumbnails") / content_id / filename
    if filepath.exists():
        return FileResponse(
            str(filepath),
            media_type="image/jpeg",
            headers={"Cache-Control": "public, max-age=86400"}
        )

    # 2. Try Vercel Blob – look up the URL from blob storage
    try:
        from blob_storage import get_thumbnail_url, is_blob_enabled
        if is_blob_enabled():
            blob_path = f"thumbnails/{content_id}/{filename}"
            blob_url = get_thumbnail_url(blob_path)
            if blob_url:
                from fastapi.responses import RedirectResponse
                return RedirectResponse(
                    url=blob_url,
                    status_code=302,
                    headers={"Cache-Control": "public, max-age=86400"}
                )
    except Exception:
        pass  # blob_storage not available or error – fall through to 404

    raise HTTPException(status_code=404, detail="Thumbnail not found")


@app.post("/api/content/{content_id}/generate-thumbnails")
async def generate_thumbnails(
    content_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Generate thumbnails for existing content from already-downloaded video"""
    from video_processor import save_frame_thumbnails, extract_frames_at_timestamps, _extract_video_id as _evi
    import re as _re

    vector_memory = VectorMemory(db, current_user.id)
    content = vector_memory.get_content(content_id, current_user.id)
    if content is None:
        raise HTTPException(status_code=404, detail="Content not found")

    # Check if thumbnails already exist
    metadata = content.get("metadata", {}) or {}
    if metadata.get("thumbnails"):
        return {"message": "Thumbnails already exist", "thumbnails": metadata["thumbnails"]}

    # Find the video file
    source_video = content.get("source_video", "")
    source_url = content.get("source_url", "")
    video_path = None

    if source_video and Path(source_video).exists():
        video_path = source_video
    elif source_url:
        video_id = _evi(source_url)
        if video_id:
            videos_dir = Path("data/videos")
            if videos_dir.exists():
                for ext in ['*.mp4', '*.webm', '*.mkv']:
                    files = [f for f in videos_dir.glob(ext) if video_id in f.stem]
                    if files:
                        video_path = str(max(files, key=lambda f: f.stat().st_mtime))
                        break

    if not video_path:
        raise HTTPException(status_code=404, detail="Source video not found on disk. Cannot generate thumbnails.")

    # Parse timestamps from existing frame_descriptions
    frame_descs = content.get("frame_descriptions", [])
    timestamps = []
    for desc in frame_descs:
        match = _re.match(r'^\[(\d+(?:\.\d+)?)s\]', desc)
        if match:
            timestamps.append(float(match.group(1)))

    if not timestamps:
        # Fallback: extract from timeline vision entries
        timeline = content.get("timeline", [])
        timestamps = [e["timestamp"] for e in timeline if e.get("type") == "vision"]

    if not timestamps:
        raise HTTPException(status_code=400, detail="No frame timestamps found in content")

    # Extract frames at those timestamps and save as thumbnails
    frames = extract_frames_at_timestamps(video_path, timestamps)
    manifest = save_frame_thumbnails(frames, content_id)

    # Update content metadata with thumbnail manifest
    metadata["thumbnails"] = manifest

    # Also store youtube_thumbnail if not present
    if not metadata.get("youtube_thumbnail") and source_url:
        vid = _evi(source_url)
        if vid:
            metadata["youtube_thumbnail"] = f"https://img.youtube.com/vi/{vid}/mqdefault.jpg"

    # Update timeline entries with thumbnail paths (use blob URLs if available)
    blob_url_map = {}
    for m in manifest:
        ts_key = round(m["timestamp"])
        if "url" in m:
            blob_url_map[ts_key] = m["url"]

    timeline = content.get("timeline", [])
    if timeline:
        for entry in timeline:
            if entry.get("type") == "vision":
                ts_key = int(entry["timestamp"])
                if ts_key in blob_url_map:
                    entry["thumbnail"] = blob_url_map[ts_key]
        content["timeline"] = timeline
    return {"message": f"Generated {len(manifest)} thumbnails", "thumbnails": manifest}


@app.post("/api/admin/backfill-thumbnails")
async def backfill_all_thumbnails(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Backfill thumbnails for all content that has frame_descriptions but no thumbnails"""
    from video_processor import save_frame_thumbnails, extract_frames_at_timestamps, _extract_video_id as _evi
    import re as _re

    vector_memory = VectorMemory(db, current_user.id)
    all_content = vector_memory.list_all(user_id=current_user.id)

    results = {"processed": 0, "skipped": 0, "failed": 0, "details": []}

    for item in all_content:
        cid = item.get("id", "")
        metadata = item.get("metadata", {}) or {}

        # Skip if already has thumbnails
        if metadata.get("thumbnails"):
            results["skipped"] += 1
            continue

        # Skip if no frame descriptions
        frame_descs = item.get("frame_descriptions", [])
        if not frame_descs:
            results["skipped"] += 1
            continue

        # Try to find video file
        source_video = item.get("source_video", "")
        source_url = item.get("source_url", "")
        video_path = None

        if source_video and Path(source_video).exists():
            video_path = source_video
        elif source_url:
            vid = _evi(source_url)
            if vid:
                videos_dir = Path("data/videos")
                if videos_dir.exists():
                    for ext in ['*.mp4', '*.webm', '*.mkv']:
                        files = [f for f in videos_dir.glob(ext) if vid in f.stem]
                        if files:
                            video_path = str(max(files, key=lambda f: f.stat().st_mtime))
                            break

        if not video_path:
            results["failed"] += 1
            results["details"].append({"id": cid, "error": "Video not found"})
            continue

        try:
            timestamps = []
            for desc in frame_descs:
                match = _re.match(r'^\[(\d+(?:\.\d+)?)s\]', desc)
                if match:
                    timestamps.append(float(match.group(1)))

            if not timestamps:
                results["skipped"] += 1
                continue

            frames = extract_frames_at_timestamps(video_path, timestamps)
            manifest = save_frame_thumbnails(frames, cid)

            # Get full content to update
            full = vector_memory.get_content(cid, current_user.id)
            if full:
                full_meta = full.get("metadata", {}) or {}
                full_meta["thumbnails"] = manifest
                if not full_meta.get("youtube_thumbnail") and source_url:
                    vid = _evi(source_url)
                    if vid:
                        full_meta["youtube_thumbnail"] = f"https://img.youtube.com/vi/{vid}/mqdefault.jpg"

                timeline = full.get("timeline", [])
                if timeline:
                    # Build blob URL lookup from manifest
                    blob_urls = {}
                    for m in manifest:
                        tsk = round(m["timestamp"])
                        if "url" in m:
                            blob_urls[tsk] = m["url"]
                    for entry in timeline:
                        if entry.get("type") == "vision":
                            tsk = int(entry["timestamp"])
                            if tsk in blob_urls:
                                entry["thumbnail"] = blob_urls[tsk]
                    full["timeline"] = timeline

                full["metadata"] = full_meta
                vector_memory.update_content(cid, full, current_user.id)

            results["processed"] += 1
            results["details"].append({"id": cid, "thumbnails": len(manifest)})
        except Exception as e:
            results["failed"] += 1
            results["details"].append({"id": cid, "error": str(e)})

    return results


# =============================================
# Export Endpoints
# =============================================
def generate_markdown(contents: List[dict], include_transcript: bool) -> str:
    """Generate Markdown export"""
    lines = ["# Video Memory AI Export\n\n"]
    lines.append(f"_Generated: {datetime.now().strftime('%Y-%m-%d %H:%M')}_\n\n")
    lines.append(f"_Total items: {len(contents)}_\n\n---\n\n")

    for content in contents:
        lines.append(f"## {content.get('title', 'Untitled')}\n\n")
        lines.append(f"**Type:** {content.get('content_type', 'video')}\n\n")

        if content.get('summary'):
            lines.append(f"### Summary\n\n{content['summary']}\n\n")

        if content.get('key_points'):
            lines.append("### Key Points\n\n")
            for kp in content['key_points']:
                point = kp.get('point', str(kp)) if isinstance(kp, dict) else str(kp)
                lines.append(f"- {point}\n")
            lines.append("\n")

        if content.get('entities'):
            lines.append("### Entities\n\n")
            for e in content['entities']:
                name = e.get('name', str(e)) if isinstance(e, dict) else str(e)
                lines.append(f"- {name}\n")
            lines.append("\n")

        if content.get('tags'):
            lines.append(f"**Tags:** {', '.join(content['tags'])}\n\n")

        if include_transcript and content.get('transcript'):
            lines.append("### Transcript\n\n")
            lines.append(f"```\n{content['transcript'][:10000]}\n```\n\n")

        lines.append("---\n\n")

    return "".join(lines)


def generate_plain_text(contents: List[dict], include_transcript: bool) -> str:
    """Generate plain text export"""
    lines = ["Video Memory AI Export\n\n"]
    lines.append(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M')}\n\n")
    lines.append(f"Total items: {len(contents)}\n\n")

    for content in contents:
        lines.append(f"{content.get('title', 'Untitled')}\n\n")
        lines.append(f"Type: {content.get('content_type', 'video')}\n\n")

        if content.get('summary'):
            lines.append(f"Summary\n{content['summary']}\n\n")

        if content.get('key_points'):
            lines.append("Key Points\n")
            for kp in content['key_points']:
                point = kp.get('point', str(kp)) if isinstance(kp, dict) else str(kp)
                lines.append(f"  - {point}\n")
            lines.append("\n")

        if content.get('entities'):
            lines.append("Entities\n")
            for e in content['entities']:
                name = e.get('name', str(e)) if isinstance(e, dict) else str(e)
                lines.append(f"  - {name}\n")
            lines.append("\n")

        if content.get('tags'):
            lines.append(f"Tags: {', '.join(content['tags'])}\n\n")

        if include_transcript and content.get('transcript'):
            lines.append("Transcript\n")
            lines.append(f"{content['transcript'][:10000]}\n\n")

        lines.append("\n")

    return "".join(lines)


def generate_obsidian_markdown(contents: List[dict], include_transcript: bool) -> str:
    """Generate Obsidian-flavoured Markdown with YAML frontmatter per item"""
    parts = []
    for content in contents:
        # YAML frontmatter
        tags = content.get('tags', [])
        tag_str = ', '.join(f'"{t}"' for t in tags) if tags else ''
        fm = [
            "---",
            f"title: \"{(content.get('title') or 'Untitled').replace('\"', '')}\"",
            f"type: {content.get('content_type', 'video')}",
            f"mode: {content.get('mode', 'general')}",
            f"source: \"{content.get('source_url', '')}\"",
            f"created: {datetime.now().strftime('%Y-%m-%d')}",
        ]
        if tags:
            fm.append(f"tags: [{tag_str}]")
        if content.get('topics'):
            fm.append(f"topics: {content['topics']}")
        fm.append("---\n")
        parts.append("\n".join(fm))

        parts.append(f"# {content.get('title', 'Untitled')}\n")

        if content.get('summary'):
            parts.append(f"> [!note] Summary\n> {content['summary']}\n")

        if content.get('key_points'):
            parts.append("## Key Points\n")
            for kp in content['key_points']:
                if isinstance(kp, dict):
                    point = kp.get('point', kp.get('text', ''))
                    ts = kp.get('timestamp', '')
                    ts_str = f" `{ts}`" if ts else ''
                    parts.append(f"- {point}{ts_str}")
                else:
                    parts.append(f"- {kp}")
            parts.append("")

        if content.get('quotes'):
            parts.append("## Quotes\n")
            for q in content['quotes']:
                if isinstance(q, dict):
                    text = q.get('text', q.get('quote', ''))
                    speaker = q.get('speaker', '')
                    parts.append(f"> {text}")
                    if speaker:
                        parts.append(f"> — {speaker}\n")
                else:
                    parts.append(f"> {q}\n")
            parts.append("")

        if content.get('entities'):
            entities = [e.get('name', str(e)) if isinstance(e, dict) else str(e) for e in content['entities']]
            parts.append(f"## Entities\n\n{', '.join(f'[[{e}]]' for e in entities)}\n")

        if include_transcript and content.get('transcript'):
            parts.append("## Transcript\n")
            parts.append(f"{content['transcript'][:10000]}\n")

        parts.append("\n---\n")

    return "\n".join(parts)


@app.post("/api/export")
async def export_content(
    request: ExportRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Export content in various formats (reads from user's storage e.g. Supabase)"""
    # Feature gate: check if format is allowed for user's tier
    allowed_formats = BillingService.get_export_formats(db, current_user.id)
    export_fmt = request.format if request.format not in ("markdown",) else "md"
    if export_fmt not in allowed_formats:
        raise HTTPException(
            status_code=403,
            detail={
                "error": "feature_locked",
                "feature": "export_format",
                "message": f"Export as {request.format} requires a higher plan. Your plan supports: {', '.join(allowed_formats)}."
            }
        )

    # Premium export formats (pdf, obsidian, json, docx) cost 1 credit; txt/md are free
    premium_formats = ["pdf", "obsidian", "json", "docx"]
    if request.format in premium_formats:
        cost = CREDIT_COSTS["export_premium"]
        credit_check = BillingService.check_credits(db, current_user.id, cost)
        if not credit_check["has_credits"]:
            raise HTTPException(
                status_code=403,
                detail={
                    "error": "insufficient_credits",
                    "cost": cost,
                    "balance": credit_check["balance"],
                    "tier": credit_check["tier"],
                    "message": f"This export costs {cost} credit. You have {credit_check['balance']}."
                }
            )
        BillingService.deduct_credits(db, current_user.id, cost, "export_premium",
                                      description=f"Export as {request.format}")

    ai = get_app(current_user.id, db)

    if request.content_ids:
        contents = []
        for cid in request.content_ids:
            content = ai.memory.get_content(cid, user_id=current_user.id)
            if content:
                contents.append(content)
    else:
        all_items = ai.memory.list_all(user_id=current_user.id)
        contents = []
        for item in all_items:
            content = ai.memory.get_content(item.get('id'), user_id=current_user.id)
            if content:
                contents.append(content)

    if not contents:
        raise HTTPException(status_code=400, detail="No content to export")

    if request.format == "json":
        return {"data": contents, "count": len(contents)}

    if request.format == "markdown" or request.format == "md":
        md = generate_markdown(contents, request.include_transcript)
        return Response(
            content=md,
            media_type="text/markdown; charset=utf-8",
            headers={"Content-Disposition": "attachment; filename=video-memory-export.md"}
        )

    if request.format == "txt":
        text = generate_plain_text(contents, request.include_transcript)
        return Response(
            content=text,
            media_type="text/plain; charset=utf-8",
            headers={"Content-Disposition": "attachment; filename=video-memory-export.txt"}
        )

    if request.format == "obsidian":
        md = generate_obsidian_markdown(contents, request.include_transcript)
        return Response(
            content=md,
            media_type="text/markdown; charset=utf-8",
            headers={"Content-Disposition": "attachment; filename=video-memory-obsidian.md"}
        )

    raise HTTPException(status_code=400, detail=f"Unknown format: {request.format}")


# =============================================
# Collections Endpoints
# =============================================
@app.get("/api/collections")
async def get_collections(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get all collections for current user"""
    vector_memory = VectorMemory(db, current_user.id)
    collections = vector_memory.get_collections(user_id=current_user.id)
    return {"collections": collections}


@app.post("/api/collections")
async def create_collection(
    request: CollectionCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Create a new collection"""
    # Feature gate: check collection limit
    coll_check = BillingService.check_collection_limit(db, current_user.id)
    if not coll_check["allowed"]:
        raise HTTPException(
            status_code=403,
            detail={
                "error": "limit_reached",
                "message": f"You've reached your collection limit ({coll_check['limit']}). Upgrade for more.",
                "count": coll_check["count"],
                "limit": coll_check["limit"],
                "tier": coll_check["tier"]
            }
        )

    vector_memory = VectorMemory(db, current_user.id)
    collection_id = vector_memory.create_collection(request.name, request.description, user_id=current_user.id)
    return {"collection_id": collection_id, "name": request.name}


@app.delete("/api/collections/{collection_id}")
async def delete_collection(
    collection_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Delete a collection"""
    vector_memory = VectorMemory(db, current_user.id)
    success = vector_memory.delete_collection(collection_id, user_id=current_user.id)
    if not success:
        raise HTTPException(status_code=404, detail="Collection not found")

    # Clean up chat sessions for this collection
    collection_sessions = db.query(ChatSession).filter(
        ChatSession.user_id == current_user.id,
        ChatSession.scope_type == "collection",
        ChatSession.scope_id == collection_id
    ).all()
    for s in collection_sessions:
        db.delete(s)
    db.commit()

    return {"message": "Collection deleted"}


@app.get("/api/collections/{collection_id}/contents")
async def get_collection_contents(
    collection_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get all content in a collection"""
    vector_memory = VectorMemory(db, current_user.id)
    contents = vector_memory.get_collection_contents(collection_id, user_id=current_user.id)
    return {"contents": contents}


@app.post("/api/collections/{collection_id}/add")
async def add_to_collection(
    collection_id: str,
    request: CollectionAddContent,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Add content to a collection"""
    vector_memory = VectorMemory(db, current_user.id)
    success = vector_memory.add_to_collection(request.content_id, collection_id, user_id=current_user.id)
    if not success:
        raise HTTPException(status_code=400, detail="Failed to add to collection")
    return {"message": "Content added to collection"}


@app.post("/api/collections/{collection_id}/remove")
async def remove_from_collection(
    collection_id: str,
    request: CollectionAddContent,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Remove content from a collection"""
    vector_memory = VectorMemory(db, current_user.id)
    success = vector_memory.remove_from_collection(request.content_id, collection_id, user_id=current_user.id)
    if not success:
        raise HTTPException(status_code=400, detail="Failed to remove from collection")
    return {"message": "Content removed from collection"}


# =============================================
# Video Chat (per-video Q&A)
# =============================================

class VideoChatRequest(BaseModel):
    message: str
    conversation_history: List[dict] = []  # [{"role": "user"|"assistant", "content": "..."}]


@app.post("/api/content/{content_id}/chat")
async def chat_with_video(
    content_id: str,
    request: VideoChatRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Chat with a specific video using its transcript and extracted content"""
    if not request.message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty")

    # Check credits for chat
    chat_cost = CREDIT_COSTS["chat"]
    credit_check = BillingService.check_credits(db, current_user.id, chat_cost)
    if not credit_check["has_credits"]:
        raise HTTPException(
            status_code=403,
            detail={
                "error": "insufficient_credits",
                "cost": chat_cost,
                "balance": credit_check["balance"],
                "tier": credit_check["tier"],
                "message": f"Each chat message costs {chat_cost} credit. You have {credit_check['balance']}."
            }
        )

    # Fetch the content
    vector_memory = VectorMemory(db, current_user.id)
    content = vector_memory.get_content(content_id, user_id=current_user.id)
    if not content:
        raise HTTPException(status_code=404, detail="Content not found")

    # Build context from the video's data
    title = content.get("title", "Untitled")
    summary = content.get("summary", "")
    transcript = content.get("transcript", "")[:8000]
    key_points = content.get("key_points", [])
    kp_text = "\n".join([
        f"- {kp.get('point', str(kp))} ({kp.get('timestamp', '')})" if isinstance(kp, dict) else f"- {kp}"
        for kp in key_points[:15]
    ])

    # Mode-specific context
    mode = content.get("mode", "general")
    mode_context = ""
    if mode == "learn" and content.get("learn"):
        concepts = content["learn"].get("key_concepts", [])
        if concepts:
            mode_context = "\nKey Concepts:\n" + "\n".join([
                f"- {c.get('concept', '')}: {c.get('definition', '')}" for c in concepts[:10]
            ])
    elif mode == "meeting" and content.get("meeting"):
        decisions = content["meeting"].get("decisions", [])
        actions = content["meeting"].get("action_items", [])
        if decisions:
            mode_context += "\nDecisions:\n" + "\n".join([
                f"- {d.get('decision', str(d))}" if isinstance(d, dict) else f"- {d}" for d in decisions[:5]
            ])
        if actions:
            mode_context += "\nAction Items:\n" + "\n".join([
                f"- {a.get('task', str(a))}" if isinstance(a, dict) else f"- {a}" for a in actions[:5]
            ])

    # Build messages with conversation history
    system_msg = (
        f"You are a helpful assistant that answers questions about the video: \"{title}\".\n"
        f"Use the content below to answer. Include timestamps in [MM:SS] format when referencing specific moments.\n"
        f"If the content doesn't fully answer the question, say so.\n\n"
        f"SUMMARY: {summary}\n\n"
        f"KEY POINTS:\n{kp_text}\n{mode_context}\n\n"
        f"TRANSCRIPT (partial):\n{transcript}"
    )

    messages = [{"role": "system", "content": system_msg}]
    # Add conversation history (last 10 turns)
    for msg in request.conversation_history[-10:]:
        if msg.get("role") in ("user", "assistant"):
            messages.append({"role": msg["role"], "content": msg["content"]})
    messages.append({"role": "user", "content": request.message})

    try:
        from openai import OpenAI
        client = OpenAI()
        chat_model = _get_chat_model(db, current_user.id)
        response = client.chat.completions.create(
            model=chat_model,
            messages=messages,
            max_tokens=1000
        )
        answer = response.choices[0].message.content
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI generation failed: {str(e)}")

    # Deduct credit and log
    BillingService.deduct_credits(db, current_user.id, chat_cost, "chat",
                                  content_id=content_id, description="Video chat query")
    BillingService.log_chat_query(db, current_user.id)

    return {"answer": answer}


# =============================================
# Helper: Upsert Generated Content
# =============================================
def _upsert_generated_content(db: Session, user_id: int, content_id: str, content_type: str, data: dict):
    """Insert or update a GeneratedContent row"""
    existing = db.query(GeneratedContent).filter(
        GeneratedContent.user_id == user_id,
        GeneratedContent.content_id == content_id,
        GeneratedContent.content_type == content_type
    ).first()
    if existing:
        existing.data = data
        existing.updated_at = datetime.utcnow()
    else:
        db.add(GeneratedContent(
            user_id=user_id,
            content_id=content_id,
            content_type=content_type,
            data=data
        ))
    db.commit()


# =============================================
# AI Flashcard Generation (Pro+)
# =============================================

@app.post("/api/content/{content_id}/flashcards")
async def generate_flashcards(
    content_id: str,
    regenerate: bool = False,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Generate flashcards from video content"""
    # Check for cached generated content first (no charge for cached)
    if not regenerate:
        stored = db.query(GeneratedContent).filter(
            GeneratedContent.user_id == current_user.id,
            GeneratedContent.content_id == content_id,
            GeneratedContent.content_type == "flashcards"
        ).first()
        if stored:
            cards = stored.data.get("cards", [])
            anki_csv = "front\tback\n" + "\n".join([f"{c.get('front', '')}\t{c.get('back', '')}" for c in cards])
            return {"cards": cards, "anki_csv": anki_csv, "source": "cached"}

    # Feature gate: flashcards require Starter+
    fc_access = BillingService.check_feature_access(db, current_user.id, "flashcard_generation")
    if not fc_access["has_access"]:
        raise HTTPException(
            status_code=403,
            detail={
                "error": "feature_locked",
                "feature": "flashcard_generation",
                "required_tier": fc_access["required_tier"],
                "current_tier": fc_access["current_tier"],
                "message": f"Flashcards require {fc_access['required_tier'].capitalize()}+ plan."
            }
        )

    # Check credits for flashcard generation
    fc_cost = CREDIT_COSTS["flashcard"]
    credit_check = BillingService.check_credits(db, current_user.id, fc_cost)
    if not credit_check["has_credits"]:
        raise HTTPException(
            status_code=403,
            detail={
                "error": "insufficient_credits",
                "cost": fc_cost,
                "balance": credit_check["balance"],
                "tier": credit_check["tier"],
                "message": f"Flashcard generation costs {fc_cost} credits. You have {credit_check['balance']}."
            }
        )

    # Fetch the content
    vector_memory = VectorMemory(db, current_user.id)
    content = vector_memory.get_content(content_id, user_id=current_user.id)
    if not content:
        raise HTTPException(status_code=404, detail="Content not found")

    # If learn mode content already has flashcards, reuse them
    if not regenerate and content.get("learn", {}).get("flashcards"):
        existing = content["learn"]["flashcards"]
        cards = [{"front": c.get("front", ""), "back": c.get("back", ""), "difficulty": "medium"} for c in existing]
        # Generate Anki CSV
        anki_csv = "front\tback\n" + "\n".join([f"{c['front']}\t{c['back']}" for c in cards])
        # Persist for future loads
        _upsert_generated_content(db, current_user.id, content_id, "flashcards", {"cards": cards, "anki_csv": anki_csv})
        return {"cards": cards, "anki_csv": anki_csv, "source": "existing"}

    # Generate flashcards via LLM
    title = content.get("title", "Untitled")
    summary = content.get("summary", "")
    key_points = content.get("key_points", [])
    kp_text = "\n".join([
        f"- {kp.get('point', str(kp))}" if isinstance(kp, dict) else f"- {kp}"
        for kp in key_points[:15]
    ])
    transcript = content.get("transcript", "")[:4000]

    prompt = f"""Generate 8-12 flashcards from this video content. Return JSON with a "cards" array.
Each card: {{"front": "question", "back": "answer", "difficulty": "easy"|"medium"|"hard"}}

VIDEO: "{title}"
SUMMARY: {summary}
KEY POINTS:
{kp_text}
TRANSCRIPT (partial): {transcript}

Return ONLY the JSON object."""

    try:
        from openai import OpenAI
        client = OpenAI()
        fc_model = _get_chat_model(db, current_user.id)
        response = client.chat.completions.create(
            model=fc_model,
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"},
            max_tokens=2000
        )
        data = json.loads(response.choices[0].message.content)
        cards = data.get("cards", [])
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Flashcard generation failed: {str(e)}")

    # Generate Anki CSV
    anki_csv = "front\tback\n" + "\n".join([f"{c.get('front', '')}\t{c.get('back', '')}" for c in cards])

    # Persist generated content
    _upsert_generated_content(db, current_user.id, content_id, "flashcards", {"cards": cards, "anki_csv": anki_csv})

    # Deduct credits for generation
    BillingService.deduct_credits(db, current_user.id, fc_cost, "flashcard",
                                  content_id=content_id, description="Flashcard generation")

    return {"cards": cards, "anki_csv": anki_csv, "source": "generated"}


# =============================================
# Mind Map Generation (Pro+)
# =============================================

class MindMapNode(BaseModel):
    label: str
    description: Optional[str] = None
    timestamp: Optional[str] = None
    importance: Optional[str] = "medium"  # high, medium, low
    children: List["MindMapNode"] = []

MindMapNode.model_rebuild()


@app.post("/api/content/{content_id}/mindmap")
async def generate_mindmap(
    content_id: str,
    regenerate: bool = False,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Generate a mind map from video content"""
    # Check for cached generated content first (no charge for cached)
    if not regenerate:
        stored = db.query(GeneratedContent).filter(
            GeneratedContent.user_id == current_user.id,
            GeneratedContent.content_id == content_id,
            GeneratedContent.content_type == "mindmap"
        ).first()
        if stored:
            return {"mindmap": stored.data, "source": "cached"}

    # Feature gate: mind maps require Pro+
    mm_access = BillingService.check_feature_access(db, current_user.id, "mindmap_generation")
    if not mm_access["has_access"]:
        raise HTTPException(
            status_code=403,
            detail={
                "error": "feature_locked",
                "feature": "mindmap_generation",
                "required_tier": mm_access["required_tier"],
                "current_tier": mm_access["current_tier"],
                "message": f"Mind maps require {mm_access['required_tier'].capitalize()}+ plan."
            }
        )

    # Check credits for mindmap generation
    mm_cost = CREDIT_COSTS["mindmap"]
    credit_check = BillingService.check_credits(db, current_user.id, mm_cost)
    if not credit_check["has_credits"]:
        raise HTTPException(
            status_code=403,
            detail={
                "error": "insufficient_credits",
                "cost": mm_cost,
                "balance": credit_check["balance"],
                "tier": credit_check["tier"],
                "message": f"Mind map generation costs {mm_cost} credits. You have {credit_check['balance']}."
            }
        )

    # Fetch the content
    vector_memory = VectorMemory(db, current_user.id)
    content = vector_memory.get_content(content_id, user_id=current_user.id)
    if not content:
        raise HTTPException(status_code=404, detail="Content not found")

    title = content.get("title", "Untitled")
    summary = content.get("summary", "")
    key_points = content.get("key_points", [])
    kp_text = "\n".join([
        f"- {kp.get('point', str(kp))} ({kp.get('timestamp', '')})" if isinstance(kp, dict) else f"- {kp}"
        for kp in key_points[:15]
    ])
    topics = content.get("topics", [])

    prompt = f"""Create a 3-level mind map for this video content. Return JSON with a root node.
Each node: {{"label": "topic", "description": "brief detail", "timestamp": "MM:SS or null", "importance": "high"|"medium"|"low", "children": [...]}}
The root should be the video title. Level 2 should be 4-6 main topics. Level 3 should be 2-4 subtopics each.

VIDEO: "{title}"
SUMMARY: {summary}
TOPICS: {', '.join(topics)}
KEY POINTS:
{kp_text}

Return ONLY the JSON object with a single root node."""

    try:
        from openai import OpenAI
        client = OpenAI()
        mm_model = _get_chat_model(db, current_user.id)
        response = client.chat.completions.create(
            model=mm_model,
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"},
            max_tokens=2000
        )
        data = json.loads(response.choices[0].message.content)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Mind map generation failed: {str(e)}")

    # Persist generated content
    _upsert_generated_content(db, current_user.id, content_id, "mindmap", data)

    # Deduct credits for generation
    BillingService.deduct_credits(db, current_user.id, mm_cost, "mindmap",
                                  content_id=content_id, description="Mind map generation")

    return {"mindmap": data, "source": "generated"}


# =============================================
# Chat Session Persistence
# =============================================

class ChatSessionMessagesRequest(BaseModel):
    scope_type: str  # "collection", "content", "global"
    scope_id: Optional[str] = None
    messages: List[Dict[str, Any]]  # [{role, content, sources?}]


@app.get("/api/chat/sessions")
async def get_chat_session(
    scope_type: str,
    scope_id: Optional[str] = None,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get the active chat session with all messages for a given scope"""
    session = db.query(ChatSession).filter(
        ChatSession.user_id == current_user.id,
        ChatSession.scope_type == scope_type,
        ChatSession.scope_id == scope_id
    ).first()

    if not session:
        return {"session": None}

    return {
        "session": {
            "id": session.id,
            "scope_type": session.scope_type,
            "scope_id": session.scope_id,
            "messages": [
                {
                    "role": msg.role,
                    "content": msg.content,
                    "sources": msg.sources or []
                }
                for msg in session.messages
            ],
            "created_at": session.created_at.isoformat(),
            "updated_at": session.updated_at.isoformat() if session.updated_at else None
        }
    }


@app.post("/api/chat/sessions/messages")
async def save_chat_messages(
    request: ChatSessionMessagesRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Append messages to a chat session (get-or-create)"""
    session = db.query(ChatSession).filter(
        ChatSession.user_id == current_user.id,
        ChatSession.scope_type == request.scope_type,
        ChatSession.scope_id == request.scope_id
    ).first()

    if not session:
        session = ChatSession(
            user_id=current_user.id,
            scope_type=request.scope_type,
            scope_id=request.scope_id
        )
        db.add(session)
        db.flush()

    for msg in request.messages:
        chat_msg = ChatMessage(
            session_id=session.id,
            role=msg.get("role", "user"),
            content=msg.get("content", ""),
            sources=msg.get("sources")
        )
        db.add(chat_msg)

    session.updated_at = datetime.utcnow()
    db.commit()

    return {"session_id": session.id, "message_count": len(request.messages)}


@app.delete("/api/chat/sessions/{session_id}")
async def delete_chat_session(
    session_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Delete a chat session and all its messages"""
    session = db.query(ChatSession).filter(
        ChatSession.id == session_id,
        ChatSession.user_id == current_user.id
    ).first()

    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    db.delete(session)
    db.commit()
    return {"message": "Session deleted"}


# =============================================
# Generated Content Persistence
# =============================================

@app.get("/api/content/{content_id}/generated/{gen_type}")
async def get_generated_content(
    content_id: str,
    gen_type: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get stored generated content (flashcards, mindmap, guide)"""
    if gen_type not in ("flashcards", "mindmap", "guide"):
        raise HTTPException(status_code=400, detail="Invalid type. Must be: flashcards, mindmap, guide")

    stored = db.query(GeneratedContent).filter(
        GeneratedContent.user_id == current_user.id,
        GeneratedContent.content_id == content_id,
        GeneratedContent.content_type == gen_type
    ).first()

    if not stored:
        return {"data": None}

    return {
        "data": stored.data,
        "generated_at": stored.updated_at.isoformat() if stored.updated_at else stored.created_at.isoformat()
    }


# =============================================
# AI Chat / Q&A (RAG-based)
# =============================================

class ChatRequest(BaseModel):
    message: str
    collection_id: Optional[str] = None  # Optional: limit search to a collection
    content_ids: Optional[List[str]] = None  # Optional: limit search to specific content
    web_search: bool = False  # Include web search results alongside collection content


class URLAddRequest(BaseModel):
    url: str
    research_mode: bool = False  # If True, focus on extracting tools/methods/opportunities


class ChatSource(BaseModel):
    content_id: str
    title: str
    content_type: str
    relevance: float
    source_type: str = "collection"  # "collection" or "web"


class ChatResponse(BaseModel):
    answer: str
    sources: List[ChatSource]


@app.post("/api/chat", response_model=ChatResponse)
async def chat_with_knowledge(
    request: ChatRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Ask questions about your saved content using RAG.
    The AI will search your knowledge base and provide answers with sources.
    """
    if not request.message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty")

    # Check credits for chat
    global_chat_cost = CREDIT_COSTS["chat"]
    credit_check = BillingService.check_credits(db, current_user.id, global_chat_cost)
    if not credit_check["has_credits"]:
        raise HTTPException(
            status_code=403,
            detail={
                "error": "insufficient_credits",
                "cost": global_chat_cost,
                "balance": credit_check["balance"],
                "tier": credit_check["tier"],
                "message": f"Each chat message costs {global_chat_cost} credit. You have {credit_check['balance']}."
            }
        )

    # Get vector memory for searching
    vector_memory = VectorMemory(db, current_user.id)

    logger.info(f"[Chat] collection_id={request.collection_id!r}, content_ids={request.content_ids!r}, message={request.message[:50]!r}")

    if request.collection_id:
        # Collection-scoped: load ALL content in the bin directly (no similarity search)
        results = vector_memory.get_collection_contents(request.collection_id, full=True)
        logger.info(f"[Chat] Collection scope returned {len(results)} results for collection {request.collection_id}")
    elif request.content_ids:
        # Single-content scoped: load specific content by ID
        results = []
        for cid in request.content_ids:
            c = vector_memory.get_content(cid, current_user.id)
            if c:
                results.append(c)
        logger.info(f"[Chat] Content scope returned {len(results)} results")
    else:
        # Global: semantic search across everything
        results = vector_memory.search(request.message, n_results=5, user_id=current_user.id)
        logger.info(f"[Chat] Global search returned {len(results)} results")

    if not results:
        return ChatResponse(
            answer="I don't have any content that matches your question. Try adding some videos or expanding your search.",
            sources=[]
        )

    # Build context from results with more detail
    context_parts = []
    sources = []

    # Scoped chats get more transcript context since user expects deep answers
    is_scoped = bool(request.collection_id or request.content_ids)
    max_results = len(results) if is_scoped else 3
    transcript_limit = 8000 if is_scoped else 2000

    for r in results[:max_results]:
        title = r.get("title", "Untitled")
        content_type = r.get("content_type", "video")
        summary = r.get("summary", "")
        key_points = r.get("key_points", [])
        transcript = r.get("transcript", "")[:transcript_limit]

        # Mode-specific context
        mode = r.get("mode", "general")
        mode_context = ""

        if mode == "recipe" and r.get("recipe"):
            recipe = r.get("recipe", {})
            ingredients = recipe.get("ingredients", [])
            if ingredients:
                mode_context = f"\nIngredients: {', '.join([i.get('item', '') for i in ingredients[:10]])}"
            steps = recipe.get("steps", [])
            if steps:
                mode_context += f"\nSteps: {len(steps)} steps total"

        elif mode == "learn" and r.get("learn"):
            learn = r.get("learn", {})
            concepts = learn.get("key_concepts", [])
            if concepts:
                mode_context = f"\nKey Concepts: {', '.join([c.get('concept', '') for c in concepts[:5]])}"

        elif mode == "creator" and r.get("creator"):
            creator = r.get("creator", {})
            quotes = creator.get("quotable_quotes", [])
            if quotes:
                mode_context = f"\nQuotes: {len(quotes)} quotable quotes"

        elif mode == "meeting" and r.get("meeting"):
            meeting = r.get("meeting", {})
            actions = meeting.get("action_items", [])
            decisions = meeting.get("decisions", [])
            if actions:
                mode_context = f"\nAction Items: {len(actions)}"
            if decisions:
                mode_context += f"\nDecisions: {len(decisions)}"

        # Build context for this source
        kp_text = ", ".join([kp.get("point", str(kp)) if isinstance(kp, dict) else str(kp) for kp in key_points[:5]])

        context_parts.append(f"""
**{title}** ({content_type}, {mode} mode)
Summary: {summary}
Key Points: {kp_text}{mode_context}
Transcript: {transcript}
""")

        sources.append(ChatSource(
            content_id=r.get("id", ""),
            title=title,
            content_type=content_type,
            relevance=r.get("_similarity", 0.0)
        ))

    context = "\n---\n".join(context_parts)

    # Web search augmentation (collection-scoped only)
    web_context = ""
    if request.web_search and request.collection_id:
        try:
            # Generate a search query from the user's message + collection topics
            collection_topics = set()
            for r in results[:3]:
                collection_topics.update(r.get("topics", []))
            topic_hint = ", ".join(list(collection_topics)[:5])

            from openai import OpenAI as _OAI
            _client = _OAI()
            _q_model = _get_chat_model(db, current_user.id)
            _q_resp = _client.chat.completions.create(
                model=_q_model,
                messages=[{"role": "user", "content": f"Generate a concise web search query (max 8 words) to answer this question in the context of these topics [{topic_hint}]: {request.message}"}],
                max_tokens=30
            )
            search_query = _q_resp.choices[0].message.content.strip().strip('"')
            logger.info(f"[Chat] Web search query: {search_query}")

            import sys
            logger.info(f"[Chat] Python exec: {sys.executable}, path: {sys.path[:3]}")
            try:
                from ddgs import DDGS
            except ImportError as ie:
                logger.error(f"[Chat] ddgs import failed: {ie}. Trying duckduckgo_search...")
                from duckduckgo_search import DDGS
            ddgs_instance = DDGS()
            web_results = list(ddgs_instance.text(search_query, max_results=3))

            if web_results:
                # Fetch actual page content for top 2 results
                from web_scraper import WebScraper
                scraper = WebScraper()
                web_parts = []
                for wr in web_results[:2]:
                    url = wr.get("href", "")
                    title = wr.get("title", "Web Result")
                    try:
                        page = scraper.fetch(url, timeout=10)
                        page_text = page.content[:3000]  # Cap at 3000 chars per page
                        web_parts.append(f"**{title}**\nURL: {url}\n{page_text}")
                    except Exception:
                        # Fall back to snippet if fetch fails
                        web_parts.append(f"**{title}**\nURL: {url}\n{wr.get('body', '')}")
                    sources.append(ChatSource(
                        content_id=url,
                        title=title,
                        content_type="web",
                        relevance=0.5,
                        source_type="web"
                    ))
                web_context = "\n\nWEB SEARCH RESULTS:\n" + "\n---\n".join(web_parts)
                logger.info(f"[Chat] Web search: fetched {len(web_parts)} pages")
        except Exception as web_err:
            logger.warning(f"Web search failed (non-fatal): {web_err}")

    # Generate answer using OpenAI
    if request.content_ids and len(request.content_ids) == 1:
        system_instruction = (
            "You are an assistant focused on this specific piece of content. "
            "Only answer based on the transcript and details provided below. "
            "If the answer isn't in this content, say so clearly."
        )
    elif request.collection_id and web_context:
        system_instruction = (
            "You are a research assistant for this specific collection. "
            "Answer using BOTH the collection content AND the web search results provided below. "
            "Combine insights from your collection with the web results to give a thorough answer. "
            "Clearly distinguish what comes from the collection vs. the web."
        )
    elif request.collection_id:
        system_instruction = (
            "You are a research assistant for this specific collection. "
            "Only answer based on the content provided. "
            "If the information isn't in the collection content, say so clearly."
        )
    else:
        system_instruction = (
            "You are a helpful AI assistant with access to a personal knowledge base of video content. "
            "Answer questions based on the content below. Be specific and reference the sources when relevant. "
            "If the content doesn't fully answer the question, say so and provide what you can."
        )

    prompt = f"""{system_instruction}

KNOWLEDGE BASE CONTENT:
{context}{web_context}

USER QUESTION: {request.message}

Provide a helpful, accurate answer. If referencing specific content, mention the title."""

    try:
        from openai import OpenAI
        client = OpenAI()
        global_model = _get_chat_model(db, current_user.id)
        response = client.chat.completions.create(
            model=global_model,
            messages=[{"role": "user", "content": prompt}],
            max_tokens=1000
        )
        answer = response.choices[0].message.content
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI generation failed: {str(e)}")

    # Deduct credit and log
    BillingService.deduct_credits(db, current_user.id, global_chat_cost, "chat",
                                  description="Knowledge base chat query")
    BillingService.log_chat_query(db, current_user.id)

    return ChatResponse(answer=answer, sources=sources)


# =============================================
# Web URL Import
# =============================================
@app.post("/api/urls/add")
async def add_url(
    request: URLAddRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Import web content from a URL.
    Scrapes the page, extracts structured information using AI, and saves to knowledge base.
    """
    if not request.url.strip():
        raise HTTPException(status_code=400, detail="URL cannot be empty")

    # Web articles cost the same as a short video
    url_cost = CREDIT_COSTS["video_short"]
    credit_check = BillingService.check_credits(db, current_user.id, url_cost)
    if not credit_check["has_credits"]:
        raise HTTPException(
            status_code=403,
            detail={
                "error": "insufficient_credits",
                "cost": url_cost,
                "balance": credit_check["balance"],
                "tier": credit_check["tier"],
                "message": f"Importing a web article costs {url_cost} credits. You have {credit_check['balance']}."
            }
        )

    try:
        # Import web scraper and analyzer
        from web_scraper import WebScraper
        from web_analyzer import WebAnalyzer

        # Fetch the web page
        scraper = WebScraper()
        web_content = scraper.fetch(request.url)

        # Analyze with LLM
        analyzer = WebAnalyzer(provider="openai")
        extract = analyzer.analyze(web_content, research_mode=request.research_mode)

        # Convert to dict for storage
        content_dict = extract.to_dict()

        # Save to vector memory
        vm = VectorMemory(db, current_user.id)
        vm.add_content(content_dict, current_user.id)

        # Deduct credits
        BillingService.deduct_credits(db, current_user.id, url_cost, "video_short",
                                      content_id=extract.id, description="Web article import")

        return {
            "success": True,
            "content": {
                "id": extract.id,
                "title": extract.title,
                "summary": extract.summary,
                "content_type": extract.content_type,
                "mode": "web",
                "source_url": extract.source_url,
                "site_name": extract.site_name,
                "author": extract.author,
                "word_count": extract.word_count,
                "reading_time_minutes": extract.reading_time_minutes,
                "topics": extract.topics,
                "tags": extract.tags,
                "key_points": extract.key_points,
                "tools_mentioned": extract.tools_mentioned,
                "methods": extract.methods,
                "opportunities": extract.opportunities
            }
        }

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"URL import failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to import URL: {str(e)}")


# =============================================
# Content Annotations (Notes + Bookmarks for a content)
# =============================================
@app.get("/api/content/{content_id}/annotations")
async def get_content_annotations(
    content_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get all annotations (notes + bookmarks) for a content"""
    return NotesService.get_content_annotations(db, current_user.id, content_id)


# =============================================
# Step-by-Step Guide Generator
# =============================================
class GuideGenerateRequest(BaseModel):
    format: str = "json"  # "json" or "markdown"
    regenerate: bool = False


@app.post("/api/content/{content_id}/generate-guide")
async def generate_guide(
    content_id: str,
    request: GuideGenerateRequest = GuideGenerateRequest(),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Generate a complete step-by-step guide from content.

    Takes extracted content (from videos or web articles) and creates
    a comprehensive guide with installation commands, prerequisites,
    code examples, and troubleshooting - filling in what sources often skip.
    """
    # Check for cached guide first (no charge for cached)
    # Check for cached guide (JSON format only, markdown always re-renders from stored data)
    if not request.regenerate and request.format == "json":
        stored = db.query(GeneratedContent).filter(
            GeneratedContent.user_id == current_user.id,
            GeneratedContent.content_id == content_id,
            GeneratedContent.content_type == "guide"
        ).first()
        if stored:
            return {"success": True, "guide": stored.data, "source": "cached"}

    # For markdown download, check if we have cached JSON to render from
    if not request.regenerate and request.format == "markdown":
        stored = db.query(GeneratedContent).filter(
            GeneratedContent.user_id == current_user.id,
            GeneratedContent.content_id == content_id,
            GeneratedContent.content_type == "guide"
        ).first()
        if stored:
            try:
                from guide_generator import StepByStepGuide
                guide = StepByStepGuide(**stored.data)
                return Response(
                    content=guide.to_markdown(),
                    media_type="text/markdown; charset=utf-8",
                    headers={"Content-Disposition": f"attachment; filename={content_id}-guide.md"}
                )
            except Exception:
                pass  # Fall through to regeneration

    # Feature gate: guides require Pro+
    guide_access = BillingService.check_feature_access(db, current_user.id, "guide_generation")
    if not guide_access["has_access"]:
        raise HTTPException(
            status_code=403,
            detail={
                "error": "feature_locked",
                "feature": "guide_generation",
                "required_tier": guide_access["required_tier"],
                "current_tier": guide_access["current_tier"],
                "message": f"Guides require {guide_access['required_tier'].capitalize()}+ plan."
            }
        )

    # Check credits for guide generation
    guide_cost = CREDIT_COSTS["guide"]
    credit_check = BillingService.check_credits(db, current_user.id, guide_cost)
    if not credit_check["has_credits"]:
        raise HTTPException(
            status_code=403,
            detail={
                "error": "insufficient_credits",
                "cost": guide_cost,
                "balance": credit_check["balance"],
                "tier": credit_check["tier"],
                "message": f"Guide generation costs {guide_cost} credits. You have {credit_check['balance']}."
            }
        )

    # Get the content
    vector_memory = VectorMemory(db, current_user.id)
    content = vector_memory.get_content(content_id, current_user.id)

    if not content:
        raise HTTPException(status_code=404, detail="Content not found")

    try:
        from guide_generator import GuideGenerator

        generator = GuideGenerator(provider="openai")
        guide = generator.generate(content)

        # Persist the guide as JSON
        guide_dict = guide.to_dict()
        _upsert_generated_content(db, current_user.id, content_id, "guide", guide_dict)

        # Deduct credits for generation
        BillingService.deduct_credits(db, current_user.id, guide_cost, "guide",
                                      content_id=content_id, description="Guide generation")

        if request.format == "markdown":
            return Response(
                content=guide.to_markdown(),
                media_type="text/markdown; charset=utf-8",
                headers={"Content-Disposition": f"attachment; filename={guide.id}.md"}
            )
        else:
            return {
                "success": True,
                "guide": guide_dict
            }

    except Exception as e:
        logger.error(f"Guide generation failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to generate guide: {str(e)}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
