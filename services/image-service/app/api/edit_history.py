from fastapi import APIRouter, Depends, HTTPException, status, Header, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc
from typing import Optional
from uuid import UUID

from app.db.session import get_db
from app.models.edit_history import EditHistory
from app.models.image import Image
from app.schemas.edit_history import (
    EditHistoryItem,
    EditHistoryListResponse,
)

router = APIRouter()


def get_user_id_from_header(x_user_id: Optional[str] = Header(None)) -> Optional[str]:
    """Get user ID from header (set by API Gateway)"""
    return x_user_id


@router.get("/images/{image_id}/edit-history", response_model=EditHistoryListResponse)
async def get_image_edit_history(
    image_id: UUID,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_user_id_from_header),
):
    """Get edit history for a specific image (as original or edited)"""
    if not user_id:
        user_id = "00000000-0000-0000-0000-000000000001"

    # Build query for history where this image is the original or the result
    base_query = select(EditHistory).where(
        (EditHistory.original_image_id == image_id) |
        (EditHistory.edited_image_id == image_id)
    ).where(EditHistory.user_id == UUID(user_id))

    # Count total
    count_query = select(func.count()).select_from(base_query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar_one()

    # Get paginated results
    offset = (page - 1) * page_size
    query = base_query.order_by(desc(EditHistory.created_at)).offset(offset).limit(page_size)
    result = await db.execute(query)
    items = result.scalars().all()

    return EditHistoryListResponse(
        items=[EditHistoryItem.model_validate(item) for item in items],
        total=total,
        page=page,
        page_size=page_size,
        has_more=(offset + len(items)) < total,
    )


@router.get("/edit-history", response_model=EditHistoryListResponse)
async def list_all_edit_history(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_user_id_from_header),
):
    """List all edit history for the current user"""
    if not user_id:
        user_id = "00000000-0000-0000-0000-000000000001"

    base_query = select(EditHistory).where(EditHistory.user_id == UUID(user_id))

    # Count total
    count_query = select(func.count()).select_from(base_query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar_one()

    # Get paginated results
    offset = (page - 1) * page_size
    query = base_query.order_by(desc(EditHistory.created_at)).offset(offset).limit(page_size)
    result = await db.execute(query)
    items = result.scalars().all()

    return EditHistoryListResponse(
        items=[EditHistoryItem.model_validate(item) for item in items],
        total=total,
        page=page,
        page_size=page_size,
        has_more=(offset + len(items)) < total,
    )


@router.get("/edit-history/{history_id}", response_model=EditHistoryItem)
async def get_edit_history_detail(
    history_id: UUID,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_user_id_from_header),
):
    """Get single edit history entry"""
    if not user_id:
        user_id = "00000000-0000-0000-0000-000000000001"

    result = await db.execute(
        select(EditHistory).where(
            EditHistory.id == history_id,
            EditHistory.user_id == UUID(user_id)
        )
    )
    history = result.scalar_one_or_none()

    if not history:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Edit history not found"
        )

    return EditHistoryItem.model_validate(history)


@router.delete("/edit-history/{history_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_edit_history(
    history_id: UUID,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_user_id_from_header),
):
    """Delete edit history entry"""
    if not user_id:
        user_id = "00000000-0000-0000-0000-000000000001"

    result = await db.execute(
        select(EditHistory).where(
            EditHistory.id == history_id,
            EditHistory.user_id == UUID(user_id)
        )
    )
    history = result.scalar_one_or_none()

    if not history:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Edit history not found"
        )

    await db.delete(history)
