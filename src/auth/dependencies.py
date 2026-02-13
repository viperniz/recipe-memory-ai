"""
Auth Dependencies
FastAPI dependencies for protected routes
"""

from typing import Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from database import get_db, User
from .service import AuthService

# Bearer token security scheme
security = HTTPBearer(auto_error=False)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
) -> User:
    """
    Dependency to get the current authenticated user.
    Raises 401 if not authenticated or token is invalid.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    if credentials is None:
        raise credentials_exception

    token = credentials.credentials

    # Check if token is blacklisted
    if AuthService.is_token_blacklisted(db, token):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has been revoked",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Decode token
    token_data = AuthService.decode_token(token)
    if token_data is None:
        raise credentials_exception

    # Get user
    user = AuthService.get_user_by_id(db, token_data.user_id)
    if user is None:
        raise credentials_exception

    return user


async def get_current_active_user(
    current_user: User = Depends(get_current_user)
) -> User:
    """
    Dependency to get the current active user.
    Raises 403 if user is inactive.
    """
    if not current_user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Inactive user"
        )
    return current_user


async def get_optional_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
) -> Optional[User]:
    """
    Dependency to optionally get the current user.
    Returns None if not authenticated (doesn't raise exception).
    Useful for endpoints that work with or without auth.
    """
    if credentials is None:
        return None

    token = credentials.credentials

    # Check if token is blacklisted
    if AuthService.is_token_blacklisted(db, token):
        return None

    # Decode token
    token_data = AuthService.decode_token(token)
    if token_data is None:
        return None

    # Get user
    user = AuthService.get_user_by_id(db, token_data.user_id)
    return user


def require_tier(required_tiers: list[str]):
    """
    Dependency factory to require specific subscription tiers.
    Usage: @app.get("/pro-feature", dependencies=[Depends(require_tier(["pro", "team"]))])
    """
    async def tier_checker(
        current_user: User = Depends(get_current_active_user),
        db: Session = Depends(get_db)
    ):
        tier = AuthService.get_user_tier(db, current_user.id)
        if tier not in required_tiers:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"This feature requires one of these tiers: {', '.join(required_tiers)}. Your tier: {tier}"
            )
        return current_user

    return tier_checker


def check_video_limit():
    """
    Dependency to check if user is within their video limit.
    """
    async def limit_checker(
        current_user: User = Depends(get_current_active_user),
        db: Session = Depends(get_db)
    ):
        # This will be populated with actual count from content_memory
        # For now, return the user and let the endpoint handle the check
        return current_user

    return limit_checker
