"""
Auth Service
Password hashing, JWT token creation/validation, user management
"""

from datetime import datetime, timedelta
from typing import Optional
import os
import secrets

from jose import JWTError, jwt
import bcrypt
from sqlalchemy.orm import Session, load_only

from database import User, Subscription, TokenBlacklist, get_tier_limits
from .models import UserCreate, UserResponse, Token, TokenData

# =============================================
# Configuration
# =============================================
SECRET_KEY = os.getenv("JWT_SECRET_KEY", "change-this-in-production-use-a-secure-random-key")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 30  # 30 days


class AuthService:
    """Authentication service for user management and JWT tokens"""

    # =============================================
    # Password Handling
    # =============================================
    @staticmethod
    def verify_password(plain_password: str, hashed_password: str) -> bool:
        """Verify a password against its hash"""
        if hashed_password is None:
            return False
        try:
            # Handle both passlib format ($2b$...) and raw bcrypt
            if isinstance(hashed_password, str) and hashed_password.startswith('$2'):
                # Passlib format - extract the actual bcrypt hash
                return bcrypt.checkpw(
                    plain_password.encode('utf-8'),
                    hashed_password.encode('utf-8')
                )
            else:
                # Raw bcrypt hash
                return bcrypt.checkpw(
                    plain_password.encode('utf-8'),
                    hashed_password.encode('utf-8')
                )
        except Exception as e:
            print(f"Password verification error: {e}")
            return False

    @staticmethod
    def get_password_hash(password: str) -> str:
        """Hash a password"""
        # Generate salt and hash password
        salt = bcrypt.gensalt()
        hashed = bcrypt.hashpw(password.encode('utf-8'), salt)
        return hashed.decode('utf-8')

    # =============================================
    # JWT Token Handling
    # =============================================
    @staticmethod
    def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
        """Create a JWT access token"""
        to_encode = data.copy()

        now = datetime.utcnow()
        if expires_delta:
            expire = now + expires_delta
        else:
            expire = now + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)

        to_encode.update({"exp": expire, "iat": now})
        encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
        return encoded_jwt

    @staticmethod
    def decode_token(token: str) -> Optional[TokenData]:
        """Decode and validate a JWT token"""
        try:
            payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
            user_id_str: str = payload.get("sub")
            email: str = payload.get("email")
            exp: datetime = datetime.fromtimestamp(payload.get("exp"))

            if user_id_str is None:
                return None

            # Convert string back to int for user_id
            user_id: int = int(user_id_str)

            return TokenData(user_id=user_id, email=email, exp=exp)
        except JWTError as e:
            # Log the error for debugging
            import logging
            logger = logging.getLogger(__name__)
            logger.warning(f"JWT decode error: {e}")
            return None
        except Exception as e:
            # Log unexpected errors
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"Unexpected error decoding token: {e}")
            return None

    @staticmethod
    def decode_token_allow_expired(token: str, grace_seconds: int = 86400) -> Optional[TokenData]:
        """Decode a JWT token, allowing tokens expired up to grace_seconds ago"""
        try:
            payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM], options={"verify_exp": False})
            user_id_str: str = payload.get("sub")
            email: str = payload.get("email")
            exp_ts = payload.get("exp")

            if user_id_str is None or exp_ts is None:
                return None

            exp = datetime.fromtimestamp(exp_ts)
            # Reject if token expired more than grace_seconds ago
            if datetime.utcnow() > exp + timedelta(seconds=grace_seconds):
                return None

            user_id: int = int(user_id_str)
            return TokenData(user_id=user_id, email=email, exp=exp)
        except (JWTError, Exception):
            return None

    @staticmethod
    def is_token_blacklisted(db: Session, token: str) -> bool:
        """Check if a token has been blacklisted (logged out)"""
        blacklisted = db.query(TokenBlacklist).filter(
            TokenBlacklist.token == token
        ).first()
        return blacklisted is not None

    @staticmethod
    def blacklist_token(db: Session, token: str, expires_at: datetime) -> None:
        """Add a token to the blacklist"""
        blacklist_entry = TokenBlacklist(
            token=token,
            expires_at=expires_at
        )
        db.add(blacklist_entry)
        db.commit()

    @staticmethod
    def cleanup_expired_tokens(db: Session) -> int:
        """Remove expired tokens from blacklist"""
        result = db.query(TokenBlacklist).filter(
            TokenBlacklist.expires_at < datetime.utcnow()
        ).delete()
        db.commit()
        return result

    # =============================================
    # User Management
    # =============================================
    @staticmethod
    def get_user_by_email(db: Session, email: str) -> Optional[User]:
        """Get a user by email"""
        return db.query(User).filter(User.email == email).first()

    @staticmethod
    def get_user_by_id(db: Session, user_id: int) -> Optional[User]:
        """Get a user by ID — lightweight, excludes password/reset columns."""
        return db.query(User).options(
            load_only(
                User.id, User.email, User.full_name,
                User.is_active, User.is_superuser, User.google_id,
                User.is_edu_verified, User.created_at, User.updated_at
            )
        ).filter(User.id == user_id).first()

    @staticmethod
    def create_user(db: Session, user_data: UserCreate) -> User:
        """Create a new user with free tier subscription"""
        # Hash password
        hashed_password = AuthService.get_password_hash(user_data.password)

        # Create user
        db_user = User(
            email=user_data.email,
            hashed_password=hashed_password,
            full_name=user_data.full_name
        )
        db.add(db_user)
        db.commit()
        db.refresh(db_user)

        # Create free tier subscription
        subscription = Subscription(
            user_id=db_user.id,
            tier="free",
            status="active"
        )
        db.add(subscription)
        db.commit()

        return db_user

    @staticmethod
    def authenticate_user(db: Session, email: str, password: str) -> Optional[User]:
        """Authenticate a user by email and password"""
        user = AuthService.get_user_by_email(db, email)
        if not user:
            return None
        if not AuthService.verify_password(password, user.hashed_password):
            return None
        return user

    @staticmethod
    def update_user(db: Session, user: User, **kwargs) -> User:
        """Update user fields"""
        for key, value in kwargs.items():
            if hasattr(user, key) and value is not None:
                setattr(user, key, value)
        db.commit()
        db.refresh(user)
        return user

    @staticmethod
    def change_password(db: Session, user: User, new_password: str) -> User:
        """Change user password"""
        user.hashed_password = AuthService.get_password_hash(new_password)
        db.commit()
        db.refresh(user)
        return user

    @staticmethod
    def deactivate_user(db: Session, user: User) -> User:
        """Deactivate a user account"""
        user.is_active = False
        db.commit()
        db.refresh(user)
        return user

    # =============================================
    # Token Generation with User Info
    # =============================================
    @staticmethod
    def create_user_token(user: User, subscription_tier: str = "free") -> Token:
        """Create a token response with user info"""
        access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        access_token = AuthService.create_access_token(
            data={"sub": str(user.id), "email": user.email},  # sub must be a string
            expires_delta=access_token_expires
        )

        user_response = UserResponse(
            id=user.id,
            email=user.email,
            full_name=user.full_name,
            is_active=user.is_active,
            created_at=user.created_at,
            tier=subscription_tier
        )

        return Token(
            access_token=access_token,
            token_type="bearer",
            expires_in=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
            user=user_response
        )

    # =============================================
    # Subscription Helpers
    # =============================================
    @staticmethod
    def get_user_subscription(db: Session, user_id: int) -> Optional[Subscription]:
        """Get user's subscription"""
        return db.query(Subscription).filter(Subscription.user_id == user_id).first()

    @staticmethod
    def get_user_tier(db: Session, user_id: int) -> str:
        """Get user's subscription tier"""
        subscription = AuthService.get_user_subscription(db, user_id)
        if subscription and subscription.status == "active":
            return subscription.tier
        return "free"

    # =============================================
    # Password Reset
    # =============================================
    @staticmethod
    def create_password_reset_token(db: Session, user: User) -> str:
        """Generate a password reset token, store hashed, return raw token"""
        raw_token = secrets.token_urlsafe(32)
        hashed_token = bcrypt.hashpw(raw_token.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
        user.password_reset_token = hashed_token
        user.password_reset_expires = datetime.utcnow() + timedelta(hours=1)
        db.commit()
        return raw_token

    @staticmethod
    def validate_password_reset_token(db: Session, raw_token: str) -> Optional[User]:
        """Find user with a valid (non-expired) reset token matching the raw token"""
        users_with_tokens = db.query(User).filter(
            User.password_reset_token.isnot(None),
            User.password_reset_expires > datetime.utcnow()
        ).all()

        for user in users_with_tokens:
            try:
                if bcrypt.checkpw(raw_token.encode('utf-8'), user.password_reset_token.encode('utf-8')):
                    return user
            except Exception:
                continue
        return None

    @staticmethod
    def clear_password_reset_token(db: Session, user: User) -> None:
        """Clear the password reset token fields"""
        user.password_reset_token = None
        user.password_reset_expires = None
        db.commit()

    # =============================================
    # Google OAuth
    # =============================================
    @staticmethod
    def verify_google_token(credential: str) -> Optional[dict]:
        """Verify a Google ID token and return user info"""
        try:
            from google.oauth2 import id_token
            from google.auth.transport import requests as google_requests

            google_client_id = os.getenv("GOOGLE_CLIENT_ID", "")
            if not google_client_id:
                return None

            idinfo = id_token.verify_oauth2_token(
                credential,
                google_requests.Request(),
                google_client_id
            )
            return {
                "google_id": idinfo["sub"],
                "email": idinfo.get("email", ""),
                "name": idinfo.get("name", ""),
            }
        except Exception as e:
            import logging
            logging.getLogger(__name__).error(f"Google token verification failed: {e}")
            return None

    @staticmethod
    def get_or_create_google_user(db: Session, google_info: dict) -> User:
        """Find or create a user from Google OAuth info"""
        # 1. Try to find by google_id
        user = db.query(User).filter(User.google_id == google_info["google_id"]).first()
        if user:
            return user

        # 2. Try to find by email (link existing account)
        user = db.query(User).filter(User.email == google_info["email"]).first()
        if user:
            user.google_id = google_info["google_id"]
            if not user.full_name and google_info.get("name"):
                user.full_name = google_info["name"]
            db.commit()
            db.refresh(user)
            return user

        # 3. Create new user (no password — Google-only)
        new_user = User(
            email=google_info["email"],
            full_name=google_info.get("name"),
            google_id=google_info["google_id"],
            hashed_password=None
        )
        db.add(new_user)
        db.commit()
        db.refresh(new_user)

        # Create free tier subscription
        subscription = Subscription(
            user_id=new_user.id,
            tier="free",
            status="active"
        )
        db.add(subscription)
        db.commit()

        return new_user

    @staticmethod
    def check_tier_limit(db: Session, user_id: int, resource: str, current_count: int) -> bool:
        """Check if user is within their tier limits"""
        tier = AuthService.get_user_tier(db, user_id)
        limits = get_tier_limits(tier)

        if resource == "videos":
            limit = limits.get("videos", 5)
            if limit == -1:  # Unlimited
                return True
            return current_count < limit

        elif resource == "storage":
            limit = limits.get("storage_mb", 500)
            return current_count < limit

        return True
