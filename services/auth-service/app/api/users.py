from fastapi import APIRouter, Depends, HTTPException, status, Header
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List, Optional
from uuid import UUID

from app.db.session import get_db
from app.models.user import User
from app.schemas.user import UserResponse

router = APIRouter()


def get_user_id_from_header(x_user_id: Optional[str] = Header(None)) -> Optional[str]:
    """Get user ID from header (set by API Gateway)"""
    return x_user_id


def get_user_role_from_header(x_user_role: Optional[str] = Header(None)) -> Optional[str]:
    """Get user role from header (set by API Gateway)"""
    return x_user_role


@router.get("/", response_model=List[UserResponse])
async def list_users(
    skip: int = 0,
    limit: int = 20,
    db: AsyncSession = Depends(get_db),
    user_role: str = Depends(get_user_role_from_header),
):
    """List all users (admin only)"""
    if user_role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )

    result = await db.execute(
        select(User).offset(skip).limit(limit).order_by(User.created_at.desc())
    )
    users = result.scalars().all()

    return [UserResponse.model_validate(user) for user in users]


@router.get("/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user_id: str = Depends(get_user_id_from_header),
    user_role: str = Depends(get_user_role_from_header),
):
    """Get user by ID"""
    # Users can only get their own info, admins can get anyone
    if user_role != "admin" and str(user_id) != current_user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to access this user",
        )

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    return UserResponse.model_validate(user)


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: UUID,
    db: AsyncSession = Depends(get_db),
    user_role: str = Depends(get_user_role_from_header),
):
    """Delete user (admin only)"""
    if user_role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    await db.delete(user)
