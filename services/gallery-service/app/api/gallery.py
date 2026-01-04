from fastapi import APIRouter, Depends, HTTPException, status, Header, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import Optional, List
from uuid import UUID

from app.db.session import get_db

router = APIRouter()


def get_user_id_from_header(x_user_id: Optional[str] = Header(None)) -> Optional[str]:
    """Get user ID from header (set by API Gateway)"""
    return x_user_id


@router.get("/")
async def list_images(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    folder_id: Optional[UUID] = None,
    tag: Optional[str] = None,
    search: Optional[str] = None,
    favorites_only: bool = False,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_user_id_from_header),
):
    """List user's images with filtering and pagination"""
    # For now, return placeholder response
    # In production, this would query the images table
    return {
        "images": [],
        "total": 0,
        "page": page,
        "limit": limit,
    }


@router.get("/{image_id}")
async def get_image(
    image_id: UUID,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_user_id_from_header),
):
    """Get image details"""
    # Placeholder - implement with actual database query
    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail="Image not found",
    )


@router.post("/{image_id}/favorite")
async def toggle_favorite(
    image_id: UUID,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_user_id_from_header),
):
    """Toggle image favorite status"""
    # Placeholder - implement with actual database update
    return {"message": "Favorite toggled"}


@router.delete("/{image_id}")
async def delete_image(
    image_id: UUID,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_user_id_from_header),
):
    """Delete an image"""
    # Placeholder - implement with actual database delete
    return {"message": "Image deleted"}


@router.post("/{image_id}/move")
async def move_image(
    image_id: UUID,
    folder_id: Optional[UUID] = None,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_user_id_from_header),
):
    """Move image to a folder"""
    # Placeholder - implement with actual database update
    return {"message": "Image moved"}
