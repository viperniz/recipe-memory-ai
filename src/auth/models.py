"""
Auth Pydantic Models
Request/Response schemas for authentication endpoints
"""

from pydantic import BaseModel, EmailStr, Field
from typing import Optional
from datetime import datetime


# =============================================
# User Models
# =============================================
class UserCreate(BaseModel):
    """Schema for user registration"""
    email: EmailStr
    password: str = Field(..., min_length=8, description="Password must be at least 8 characters")
    full_name: Optional[str] = None


class UserLogin(BaseModel):
    """Schema for user login"""
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    """Schema for user response (excludes sensitive data)"""
    id: int
    email: str
    full_name: Optional[str]
    is_active: bool
    created_at: datetime
    tier: str = "free"

    class Config:
        from_attributes = True


class UserUpdate(BaseModel):
    """Schema for updating user profile"""
    full_name: Optional[str] = None
    email: Optional[EmailStr] = None


class PasswordChange(BaseModel):
    """Schema for password change"""
    current_password: str
    new_password: str = Field(..., min_length=8)


class ForgotPasswordRequest(BaseModel):
    """Schema for forgot password request"""
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    """Schema for password reset with token"""
    token: str
    new_password: str = Field(..., min_length=8)


class GoogleAuthRequest(BaseModel):
    """Schema for Google OAuth login"""
    credential: str


# =============================================
# Token Models
# =============================================
class Token(BaseModel):
    """Schema for JWT token response"""
    access_token: str
    token_type: str = "bearer"
    expires_in: int  # Seconds until expiration
    user: UserResponse


class TokenData(BaseModel):
    """Schema for decoded JWT token data"""
    user_id: Optional[int] = None
    email: Optional[str] = None
    exp: Optional[datetime] = None


class RefreshToken(BaseModel):
    """Schema for refresh token request"""
    refresh_token: str


# =============================================
# Auth Response Models
# =============================================
class AuthResponse(BaseModel):
    """Generic auth response"""
    message: str
    success: bool = True


class RegistrationResponse(BaseModel):
    """Registration response with user and token"""
    message: str
    user: UserResponse
    token: Token
