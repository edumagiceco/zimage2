from fastapi import APIRouter, Depends, HTTPException, status, Header, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc
from typing import Optional
from uuid import UUID, uuid4
from celery import Celery
from minio import Minio
import base64
import io

from app.db.session import get_db
from app.config import settings
from app.models.edit_history import EditHistory
from app.models.image import Image
from app.models.inpaint_task import InpaintTask
from app.models.task import TaskStatus
from app.schemas.edit_history import (
    EditHistoryItem,
    EditHistoryListResponse,
    ReplayEditRequest,
    ReplayEditResponse,
)

router = APIRouter()

# Celery client
celery_app = Celery(
    "image_tasks",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
)

# MinIO client
minio_client = Minio(
    settings.MINIO_ENDPOINT,
    access_key=settings.MINIO_ACCESS_KEY,
    secret_key=settings.MINIO_SECRET_KEY,
    secure=settings.MINIO_USE_SSL,
)


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


@router.post("/edit-history/{history_id}/replay", response_model=ReplayEditResponse)
async def replay_edit(
    history_id: UUID,
    request: ReplayEditRequest,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_user_id_from_header),
):
    """Replay an edit from history on a new target image"""
    if not user_id:
        user_id = "00000000-0000-0000-0000-000000000001"

    # Get the edit history entry
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

    if not history.mask_object_name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No mask available for this edit"
        )

    # Get the target image
    target_result = await db.execute(
        select(Image).where(Image.id == request.target_image_id)
    )
    target_image = target_result.scalar_one_or_none()

    if not target_image:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Target image not found"
        )

    # Fetch mask from MinIO
    try:
        response = minio_client.get_object(
            settings.MINIO_BUCKET,
            history.mask_object_name
        )
        mask_data_bytes = response.read()
        response.close()
        response.release_conn()

        # Convert to base64 data URL
        mask_base64 = base64.b64encode(mask_data_bytes).decode('utf-8')
        mask_data = f"data:image/png;base64,{mask_base64}"
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve mask: {str(e)}"
        )

    # Get edit parameters from history
    guidance_scale = history.edit_metadata.get("guidance_scale", 7.5) if history.edit_metadata else 7.5
    num_inference_steps = history.edit_metadata.get("num_inference_steps", 30) if history.edit_metadata else 30
    seed = history.edit_metadata.get("seed") if history.edit_metadata else None

    # Create new inpaint task
    task_id = uuid4()
    task = InpaintTask(
        id=task_id,
        user_id=UUID(user_id),
        original_image_id=request.target_image_id,
        prompt=history.prompt,
        negative_prompt=history.negative_prompt,
        strength=history.strength or 0.85,
        guidance_scale=guidance_scale,
        num_inference_steps=num_inference_steps,
        seed=seed,
        status=TaskStatus.PENDING,
    )
    db.add(task)
    await db.flush()

    # Send task to Celery
    celery_task = celery_app.send_task(
        "inpaint_image",
        kwargs={
            "task_id": str(task_id),
            "original_image_url": target_image.url,
            "mask_data": mask_data,
            "prompt": history.prompt or "",
            "negative_prompt": history.negative_prompt or "",
            "strength": history.strength or 0.85,
            "guidance_scale": guidance_scale,
            "num_inference_steps": num_inference_steps,
            "seed": seed,
            "user_id": user_id,
        },
        queue="image_generation",
    )

    # Update task with celery task ID
    task.celery_task_id = celery_task.id
    await db.flush()

    return ReplayEditResponse(
        task_id=task_id,
        status="pending",
        estimated_time=15.0,
    )
