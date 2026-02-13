"""
Database Module for Video Memory AI SaaS
SQLAlchemy models and session management
"""

from sqlalchemy import create_engine, Column, Integer, String, Boolean, DateTime, Float, ForeignKey, Text, JSON, Index, text, UniqueConstraint
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from sqlalchemy import event
from datetime import datetime
import os
import uuid

# Database URL - SQLite for development, can switch to PostgreSQL for production
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./data/video_memory.db")

# Create engine with connection pooling for PostgreSQL
# See: https://supabase.com/docs/guides/database/connecting-to-postgres
if "postgresql" in DATABASE_URL or "postgres" in DATABASE_URL:
    # Direct (5432) or pooler: session mode 5432, transaction mode 6543.
    # Transaction mode (6543) does not support prepared statements — disable them.
    use_transaction_pooler = ":6543/" in DATABASE_URL or ":6543?" in DATABASE_URL
    engine = create_engine(
        DATABASE_URL,
        pool_size=5,
        max_overflow=10,
        pool_pre_ping=True,
        pool_recycle=3600,
        connect_args={
            "connect_timeout": 10,
            "sslmode": "require",
        },
        echo=False,
    )
    if use_transaction_pooler:
        @event.listens_for(engine, "connect")
        def _disable_prepared_statements(dbapi_conn, connection_record):
            dbapi_conn.prepare_threshold = 0  # Supabase transaction pooler compatibility
else:
    engine = create_engine(
        DATABASE_URL,
        connect_args={"check_same_thread": False}
    )

# Session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base class for models
Base = declarative_base()


# =============================================
# User Model
# =============================================
class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=True)
    full_name = Column(String(255), nullable=True)
    is_active = Column(Boolean, default=True)
    is_superuser = Column(Boolean, default=False)
    google_id = Column(String(255), unique=True, nullable=True, index=True)
    password_reset_token = Column(String(255), nullable=True)
    password_reset_expires = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    is_edu_verified = Column(Boolean, default=False)

    # Relationships
    subscription = relationship("Subscription", back_populates="user", uselist=False)
    notes = relationship("Note", back_populates="user")
    bookmarks = relationship("Bookmark", back_populates="user")
    tags = relationship("UserTag", back_populates="user")
    jobs = relationship("Job", backref="user")
    content_vectors = relationship("ContentVector", backref="user")


# =============================================
# Subscription Model
# =============================================
class Subscription(Base):
    __tablename__ = "subscriptions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)
    tier = Column(String(50), default="free")  # free, starter, pro, team
    stripe_customer_id = Column(String(255), nullable=True)
    stripe_subscription_id = Column(String(255), nullable=True)
    status = Column(String(50), default="active")  # active, cancelled, past_due, trialing
    period_end = Column(DateTime, nullable=True)
    credit_balance = Column(Integer, default=50)
    topup_balance = Column(Integer, default=0)  # Purchased credits (never expire, never reset)
    credits_reset_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    user = relationship("User", back_populates="subscription")


# =============================================
# Note Model
# =============================================
class Note(Base):
    __tablename__ = "notes"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    content_id = Column(String(255), nullable=False, index=True)  # References content_vectors.id
    note_text = Column(Text, nullable=False)
    timestamp_seconds = Column(Float, nullable=True)  # Optional timestamp in the video
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    user = relationship("User", back_populates="notes")


# =============================================
# Bookmark Model
# =============================================
class Bookmark(Base):
    __tablename__ = "bookmarks"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    content_id = Column(String(255), nullable=False, index=True)  # References content_vectors.id
    timestamp_seconds = Column(Float, nullable=False)  # Timestamp in the video
    label = Column(String(255), nullable=True)  # Optional label/description
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    user = relationship("User", back_populates="bookmarks")


# =============================================
# User Tag Model
# =============================================
class UserTag(Base):
    __tablename__ = "user_tags"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    name = Column(String(100), nullable=False)
    color = Column(String(7), default="#3B82F6")  # Hex color code
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    user = relationship("User", back_populates="tags")
    content_tags = relationship("ContentTag", back_populates="tag")

    class Config:
        # Unique constraint on user_id + name
        __table_args__ = (
            {"sqlite_autoincrement": True},
        )


# =============================================
# Content Tag Model (Many-to-Many)
# =============================================
class ContentTag(Base):
    __tablename__ = "content_tags"

    id = Column(Integer, primary_key=True, index=True)
    content_id = Column(String(255), nullable=False, index=True)  # References content_vectors.id
    tag_id = Column(Integer, ForeignKey("user_tags.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    tag = relationship("UserTag", back_populates="content_tags")


# =============================================
# Token Blacklist (for logout)
# =============================================
class TokenBlacklist(Base):
    __tablename__ = "token_blacklist"

    id = Column(Integer, primary_key=True, index=True)
    token = Column(String(500), unique=True, index=True, nullable=False)
    blacklisted_at = Column(DateTime, default=datetime.utcnow)
    expires_at = Column(DateTime, nullable=False)


# =============================================
# Usage Log Model (for tracking actual usage)
# =============================================
class UsageLog(Base):
    __tablename__ = "usage_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    action = Column(String(50), nullable=False)  # video_processed, api_call, storage_used
    resource_id = Column(String(255), nullable=True)  # content_id if applicable
    value = Column(Float, default=1.0)  # Count or size in MB
    metadata_json = Column(Text, nullable=True)  # JSON metadata
    created_at = Column(DateTime, default=datetime.utcnow)

    # Index for efficient querying
    __table_args__ = (
        {"sqlite_autoincrement": True},
    )


# =============================================
# Credit Transaction Model
# =============================================
class CreditTransaction(Base):
    __tablename__ = "credit_transactions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    amount = Column(Integer, nullable=False)      # positive = credit, negative = debit
    balance_after = Column(Integer, nullable=False)
    action = Column(String(50), nullable=False)    # video_short, chat, flashcard, etc.
    content_id = Column(String(255), nullable=True)
    description = Column(String(500), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)


# =============================================
# Credit Top-Up Purchase Model
# =============================================
class CreditTopup(Base):
    __tablename__ = "credit_topups"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    pack_id = Column(String(50), nullable=False)     # small, medium, large, bulk
    credits = Column(Integer, nullable=False)
    price = Column(Float, nullable=False)
    stripe_session_id = Column(String(255), nullable=True)
    status = Column(String(50), default="pending")   # pending, completed, failed
    created_at = Column(DateTime, default=datetime.utcnow)


# =============================================
# Job Model (replaces in-memory jobs)
# =============================================
class Job(Base):
    __tablename__ = "jobs"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    video_url = Column(String, nullable=False)
    status = Column(String(50), default="queued", index=True)  # queued, processing, completed, failed, cancelled
    progress = Column(Float, default=0.0)
    title = Column(String(255), nullable=True)
    mode = Column(String(50), default="general")  # general, recipe, learn, creator, meeting
    error = Column(Text, nullable=True)
    result = Column(JSON, nullable=True)  # Store full result as JSON
    settings = Column(JSON, nullable=True)  # Store provider, whisper_model, etc.
    credits_deducted = Column(Integer, nullable=True)  # For refund on failure
    started_at = Column(DateTime, default=datetime.utcnow, index=True)
    completed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


# =============================================
# Content Vector Model (for pgvector)
# =============================================
class ContentVector(Base):
    __tablename__ = "content_vectors"
    
    id = Column(String, primary_key=True)  # content_id from ContentExtract
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    
    # Vector embedding (384 dimensions for all-MiniLM-L6-v2)
    embedding = Column(JSON, nullable=False)

    # Content metadata
    title = Column(String(255), nullable=False, index=True)
    content_type = Column(String(50), default="other")
    mode = Column(String(50), default="general", index=True)  # general, recipe, learn, creator, meeting
    summary = Column(Text, nullable=True)
    topics = Column(JSON, nullable=True)
    tags = Column(JSON, nullable=True)
    collections = Column(JSON, nullable=True)
    source_url = Column(String, nullable=True)
    has_transcript = Column(Boolean, default=False)
    full_content = Column(JSON, nullable=False)  # Full ContentExtract as JSON

    # File size tracking for storage enforcement
    file_size_bytes = Column(Integer, nullable=True, default=0)

    # Searchable text (for full-text search)
    searchable_text = Column(Text, nullable=False)

    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


# =============================================
# Entity Vector Model (for pgvector)
# =============================================
class EntityVector(Base):
    __tablename__ = "entity_vectors"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    content_id = Column(String, ForeignKey("content_vectors.id"), nullable=False, index=True)
    entity_name = Column(String(255), nullable=False)
    entity_type = Column(String(50), nullable=True)  # person, place, concept, etc.
    embedding = Column(JSON, nullable=False)  # Vector(384) with pgvector
    
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    content = relationship("ContentVector", backref="entities")


# =============================================
# Collection Model (replaces ChromaDB collections_store)
# =============================================
class Collection(Base):
    __tablename__ = "collections"

    id = Column(String, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True, default="")
    created_at = Column(DateTime, default=datetime.utcnow)


# =============================================
# Chat Session Model (persistent chat history)
# =============================================
class ChatSession(Base):
    __tablename__ = "chat_sessions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    scope_type = Column(String(50), nullable=False)  # "collection", "content", "global"
    scope_id = Column(String(255), nullable=True)  # collection_id or content_id; null for global
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    messages = relationship("ChatMessage", back_populates="session", cascade="all, delete-orphan", order_by="ChatMessage.created_at")

    __table_args__ = (
        UniqueConstraint("user_id", "scope_type", "scope_id", name="uq_chat_session_scope"),
    )


# =============================================
# Chat Message Model
# =============================================
class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("chat_sessions.id", ondelete="CASCADE"), nullable=False, index=True)
    role = Column(String(20), nullable=False)  # "user" or "assistant"
    content = Column(Text, nullable=False)
    sources = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    session = relationship("ChatSession", back_populates="messages")


# =============================================
# Generated Content Model (cached flashcards, mindmaps, guides)
# =============================================
class GeneratedContent(Base):
    __tablename__ = "generated_content"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    content_id = Column(String(255), nullable=False, index=True)
    content_type = Column(String(50), nullable=False)  # "flashcards", "mindmap", "guide"
    data = Column(JSON, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint("user_id", "content_id", "content_type", name="uq_generated_content"),
    )


# =============================================
# Database Initialization
# =============================================
def _add_column_if_missing(conn, table: str, column: str, col_type: str, default=None):
    """Helper: ALTER TABLE ADD COLUMN only when the column doesn't exist yet."""
    is_pg = "postgresql" in DATABASE_URL or "postgres" in DATABASE_URL

    if is_pg:
        # Translate SQLite types to PostgreSQL equivalents
        pg_type_map = {"DATETIME": "TIMESTAMP", "BOOLEAN": "BOOLEAN"}
        col_type = pg_type_map.get(col_type.upper(), col_type)
        # Translate default values for PostgreSQL
        if col_type == "BOOLEAN" and default is not None:
            default = "TRUE" if str(default) in ("1", "true", "TRUE") else "FALSE"

        result = conn.execute(text(
            "SELECT 1 FROM information_schema.columns "
            f"WHERE table_name = '{table}' AND column_name = '{column}'"
        ))
        exists = result.fetchone() is not None
    else:
        result = conn.execute(text(f"PRAGMA table_info({table})"))
        exists = column in [row[1] for row in result.fetchall()]

    if not exists:
        default_clause = f" DEFAULT {default}" if default is not None else ""
        conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {column} {col_type}{default_clause}"))
        conn.commit()
        print(f"  Added {table}.{column}")


def init_db():
    """Create all database tables"""
    # Ensure data directory exists
    os.makedirs("data", exist_ok=True)
    Base.metadata.create_all(bind=engine)

    # Auto-migrate: add columns introduced after initial schema
    migrations = [
        ("users", "google_id", "VARCHAR(255)", None),
        ("users", "password_reset_token", "VARCHAR(255)", None),
        ("users", "password_reset_expires", "DATETIME", None),
        ("users", "is_edu_verified", "BOOLEAN", "0"),
        # Credits system columns
        ("subscriptions", "credit_balance", "INTEGER", "50"),
        ("subscriptions", "topup_balance", "INTEGER", "0"),
        ("subscriptions", "credits_reset_at", "DATETIME", None),
        ("jobs", "credits_deducted", "INTEGER", None),
        # Storage tracking
        ("content_vectors", "file_size_bytes", "INTEGER", "0"),
    ]
    with engine.connect() as conn:
        for table, column, col_type, default in migrations:
            try:
                _add_column_if_missing(conn, table, column, col_type, default)
            except Exception as e:
                print(f"Note: Migration {table}.{column}: {e}")

    # Enable pgvector extension if using PostgreSQL
    if "postgresql" in DATABASE_URL or "postgres" in DATABASE_URL:
        try:
            with engine.connect() as conn:
                conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
                conn.commit()
            print("pgvector extension enabled")
        except Exception as e:
            print(f"Note: Could not enable pgvector extension (may already exist): {e}")

    print("Database initialized successfully")


def get_db():
    """Dependency for getting database session"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# =============================================
# Credit System Configuration
# =============================================
CREDIT_COSTS = {
    "video_per_minute": 1,   # 1 credit per minute (ceil, min 1)
    "vision_per_minute": 1,  # +1 credit per minute when vision enabled
    "reanalyze": 5,          # Re-analyze existing video
    "chat": 2,
    "flashcard": 3,
    "mindmap": 3,
    "guide": 3,
    "content_spin": 3,
    "export_premium": 1,     # pdf, obsidian, json, docx
}

TIER_CREDITS = {
    "free":    {"credits_monthly": 50,   "price_monthly": 0},
    "starter": {"credits_monthly": 250,  "price_monthly": 12.99},
    "pro":     {"credits_monthly": 750,  "price_monthly": 29.99},
    "team":    {"credits_monthly": 2000, "price_monthly": 59.99},
}

# =============================================
# Top-Up Packs (one-time credit purchases)
# Credits never expire, consumed after monthly credits
# Not available on Free tier; Bulk only for Pro+
# =============================================
TOPUP_PACKS = {
    "starter_pack": {"credits": 100,  "price": 4.99,   "min_tier": "starter"},
    "plus_pack":    {"credits": 500,  "price": 19.99,  "min_tier": "starter"},
    "power_pack":   {"credits": 1500, "price": 49.99,  "min_tier": "starter"},
    "bulk_pack":    {"credits": 5000, "price": 129.99, "min_tier": "pro"},
}


# =============================================
# Tier Limits Configuration
# =============================================
TIER_LIMITS = {
    "free": {
        "videos": 5,
        "storage_mb": 100,
        "price_monthly": 0,
        "features": [
            "~5 videos/month (50 credits)",
            "Videos up to 10 minutes",
            "AI summaries, key points & transcripts",
            "Basic search across your notes",
            "3 collections to stay organized",
        ],
        # Feature flags
        "max_video_duration_minutes": 10,
        "vision_analysis": False,
        "advanced_search": False,
        "search_type": "basic",
        "export_formats": ["txt", "md"],
        "collections_limit": 3,
        "api_access": False,
        "priority_processing": False,
        "content_spinning": False,
        "top10_generator": False,
        "chat_queries_per_day": -1,  # Unlimited (costs credits)
        "guide_generation": False,
        "flashcard_generation": False,
        "mindmap_generation": False,
        "ai_model": "gpt-4o-mini",
        "team_members": 1,
        "support_level": "community",
    },
    "starter": {
        "videos": 25,
        "storage_mb": 1024,  # 1GB
        "price_monthly": 12.99,
        "features": [
            "Process up to 25 hours of content per month",
            "Videos and lectures up to 30 minutes",
            "Auto-detect language + translate to 20+ languages",
            "AI-powered summaries, key points & transcripts",
            "Flashcards that turn any source into study material",
            "Search across your entire library by meaning",
            "Export to PDF, Markdown & plain text",
            "10 collections to organize by topic, course, or project",
        ],
        # Feature flags
        "max_video_duration_minutes": 30,
        "vision_analysis": False,
        "advanced_search": False,
        "search_type": "semantic",
        "export_formats": ["txt", "md", "pdf"],
        "collections_limit": 10,
        "api_access": False,
        "priority_processing": False,
        "content_spinning": False,
        "top10_generator": False,
        "chat_queries_per_day": -1,
        "guide_generation": False,
        "flashcard_generation": True,
        "mindmap_generation": False,
        "ai_model": "gpt-4o-mini",
        "team_members": 1,
        "support_level": "email",
    },
    "pro": {
        "videos": 75,
        "storage_mb": 10240,  # 10GB
        "price_monthly": 29.99,
        "features": [
            "Process up to 75 hours of content per month",
            "Full-length lectures, podcasts & talks up to 2 hours",
            "Translate & output to any of 20+ supported languages",
            "Vision AI \u2014 captures diagrams, code, slides & more",
            "Research-grade AI analysis for deeper breakdowns",
            "Mind maps that visualize how ideas connect",
            "Step-by-step guides generated from tutorials",
            "Flashcards for exam-ready review & long-term retention",
            "Advanced search & API access",
            "Export to JSON & Obsidian",
        ],
        # Feature flags
        "max_video_duration_minutes": 120,
        "vision_analysis": True,
        "advanced_search": True,
        "search_type": "advanced",
        "export_formats": ["txt", "md", "json", "pdf", "obsidian"],
        "collections_limit": 20,
        "api_access": True,
        "priority_processing": True,
        "content_spinning": True,
        "top10_generator": True,
        "chat_queries_per_day": -1,
        "guide_generation": True,
        "flashcard_generation": True,
        "mindmap_generation": True,
        "ai_model": "gpt-4o",
        "team_members": 1,
        "support_level": "priority",
    },
    "team": {
        "videos": 200,
        "storage_mb": 51200,  # 50GB
        "price_monthly": 59.99,
        "features": [
            "Process up to 200 hours of content per month",
            "No video length limits \u2014 conferences, full courses, anything",
            "Everything in Scholar, plus:",
            "Full multilingual support with priority translation",
            "DOCX export for reports, documentation & submissions",
            "Up to 10 team members with shared access",
            "Dedicated support \u2014 real humans, fast responses",
        ],
        # Feature flags
        "max_video_duration_minutes": -1,  # Unlimited
        "vision_analysis": True,
        "advanced_search": True,
        "search_type": "advanced",
        "export_formats": ["txt", "md", "json", "pdf", "docx", "obsidian"],
        "collections_limit": -1,  # Unlimited
        "api_access": True,
        "priority_processing": True,
        "content_spinning": True,
        "top10_generator": True,
        "chat_queries_per_day": -1,
        "guide_generation": True,
        "flashcard_generation": True,
        "mindmap_generation": True,
        "ai_model": "gpt-4o",
        "team_members": 10,
        "support_level": "dedicated",
    }
}


def get_tier_limits(tier: str) -> dict:
    """Get limits for a subscription tier"""
    return TIER_LIMITS.get(tier, TIER_LIMITS["free"])


if __name__ == "__main__":
    init_db()
