from fastapi import APIRouter, Depends, HTTPException, status, Header, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc
from sqlalchemy.orm import selectinload
from typing import Optional, List
from uuid import UUID

from app.db.session import get_db
from app.models.image import Image
from app.schemas.image import ImageResponse, ImageListResponse

router = APIRouter()


def get_user_id_from_header(x_user_id: Optional[str] = Header(None)) -> Optional[str]:
    """Get user ID from header (set by API Gateway)"""
    return x_user_id


@router.get("/", response_model=ImageListResponse)
async def list_images(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    favorites_only: bool = False,
    search: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_user_id_from_header),
):
    """List user's images with filtering and pagination"""
    # For development, use a default user ID if not provided
    if not user_id:
        user_id = "00000000-0000-0000-0000-000000000001"

    # Build query
    query = select(Image).where(Image.user_id == UUID(user_id))

    # Apply filters
    if favorites_only:
        query = query.where(Image.is_favorite == True)

    if search:
        query = query.where(Image.prompt.ilike(f"%{search}%"))

    # Get total count
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    # Apply pagination and ordering
    query = query.order_by(desc(Image.created_at))
    query = query.offset((page - 1) * limit).limit(limit)

    # Execute query
    result = await db.execute(query)
    images = result.scalars().all()

    return ImageListResponse(
        images=[
            ImageResponse(
                id=img.id,
                url=img.url,
                thumbnail_url=img.thumbnail_url,
                prompt=img.prompt,
                negative_prompt=img.negative_prompt,
                width=img.width,
                height=img.height,
                seed=img.seed,
                is_favorite=img.is_favorite,
                created_at=img.created_at,
            )
            for img in images
        ],
        total=total,
        page=page,
        limit=limit,
    )


@router.get("/{image_id}", response_model=ImageResponse)
async def get_image(
    image_id: UUID,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_user_id_from_header),
):
    """Get image details"""
    if not user_id:
        user_id = "00000000-0000-0000-0000-000000000001"

    result = await db.execute(
        select(Image).where(
            Image.id == image_id,
            Image.user_id == UUID(user_id),
        )
    )
    image = result.scalar_one_or_none()

    if not image:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Image not found",
        )

    return ImageResponse(
        id=image.id,
        url=image.url,
        thumbnail_url=image.thumbnail_url,
        prompt=image.prompt,
        negative_prompt=image.negative_prompt,
        width=image.width,
        height=image.height,
        seed=image.seed,
        is_favorite=image.is_favorite,
        created_at=image.created_at,
    )


@router.post("/{image_id}/favorite", response_model=ImageResponse)
async def toggle_favorite(
    image_id: UUID,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_user_id_from_header),
):
    """Toggle image favorite status"""
    if not user_id:
        user_id = "00000000-0000-0000-0000-000000000001"

    result = await db.execute(
        select(Image).where(
            Image.id == image_id,
            Image.user_id == UUID(user_id),
        )
    )
    image = result.scalar_one_or_none()

    if not image:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Image not found",
        )

    image.is_favorite = not image.is_favorite
    await db.commit()
    await db.refresh(image)

    return ImageResponse(
        id=image.id,
        url=image.url,
        thumbnail_url=image.thumbnail_url,
        prompt=image.prompt,
        negative_prompt=image.negative_prompt,
        width=image.width,
        height=image.height,
        seed=image.seed,
        is_favorite=image.is_favorite,
        created_at=image.created_at,
    )


@router.delete("/{image_id}")
async def delete_image(
    image_id: UUID,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_user_id_from_header),
):
    """Delete an image"""
    if not user_id:
        user_id = "00000000-0000-0000-0000-000000000001"

    result = await db.execute(
        select(Image).where(
            Image.id == image_id,
            Image.user_id == UUID(user_id),
        )
    )
    image = result.scalar_one_or_none()

    if not image:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Image not found",
        )

    await db.delete(image)
    await db.commit()

    return {"message": "Image deleted successfully"}
