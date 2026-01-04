from pydantic import BaseModel, EmailStr, Field
from datetime import datetime
from uuid import UUID
from typing import Optional

from app.models.user import UserRole


class UserCreate(BaseModel):
    """Schema for user registration"""

    email: EmailStr
    password: str = Field(..., min_length=8, max_length=100)
    name: str = Field(..., min_length=2, max_length=100)


class UserLogin(BaseModel):
    """Schema for user login"""

    email: EmailStr
    password: str


class UserResponse(BaseModel):
    """Schema for user response"""

    id: UUID
    email: str
    name: str
    role: UserRole
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class TokenResponse(BaseModel):
    """Schema for token response"""

    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: UserResponse


class TokenRefresh(BaseModel):
    """Schema for token refresh"""

    refresh_token: str


class UserUpdate(BaseModel):
    """Schema for user update"""

    name: Optional[str] = Field(None, min_length=2, max_length=100)
    password: Optional[str] = Field(None, min_length=8, max_length=100)


class PasswordChange(BaseModel):
    """Schema for password change"""

    current_password: str
    new_password: str = Field(..., min_length=8, max_length=100)
