"""
Auth Module for Video Memory AI
Handles authentication, JWT tokens, and user management
"""

from .models import (
    UserCreate, UserLogin, UserResponse, Token, TokenData,
    ForgotPasswordRequest, ResetPasswordRequest, GoogleAuthRequest
)
from .service import AuthService
from .dependencies import get_current_user, get_current_active_user, get_optional_user

__all__ = [
    "UserCreate",
    "UserLogin",
    "UserResponse",
    "Token",
    "TokenData",
    "ForgotPasswordRequest",
    "ResetPasswordRequest",
    "GoogleAuthRequest",
    "AuthService",
    "get_current_user",
    "get_current_active_user",
    "get_optional_user"
]
