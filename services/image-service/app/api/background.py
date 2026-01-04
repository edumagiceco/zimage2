"""
Background removal and replacement API endpoints.
"""
from fastapi import APIRouter, Depends, HTTPException, status, Header
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Optional
from uuid import UUID, uuid4
from celery import Celery

from app.db.session import get_db
from app.config import settings
from app.models.image import Image
from app.schemas.advanced_edit import (
    BackgroundRemoveRequest,
    BackgroundReplaceImageRequest,
    BackgroundReplaceColorRequest,
    BackgroundMaskRequest,
    BackgroundResponse,
    BackgroundTaskStatusResponse,
)

router = APIRouter(prefix="/background", tags=["Background"])

# Celery client
celery_app = Celery(
    "image_tasks",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
)


def get_user_id_from_header(x_user_id: Optional[str] = Header(None)) -> Optional[str]:
    """Get user ID from header."""
    return x_user_id or "00000000-0000-0000-0000-000000000001"


async def get_image_url(db: AsyncSession, image_id: UUID) -> str:
    """Get image URL by ID."""
    result = await db.execute(select(Image).where(Image.id == image_id))
    image = result.scalar_one_or_none()
    if not image:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Image not found"
        )
    return image.url


@router.post("/remove", response_model=BackgroundResponse, status_code=status.HTTP_202_ACCEPTED)
async def remove_background(
    request: BackgroundRemoveRequest,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_user_id_from_header),
):
    """
    Remove background from image.

    Returns image with transparent background (PNG).
    """
    image_url = await get_image_url(db, request.image_id)

    task_id = uuid4()
    celery_app.send_task(
        "remove_background",
        kwargs={
            "task_id": str(task_id),
            "image_url": image_url,
            "user_id": user_id,
            "alpha_matting": request.alpha_matting,
        },
        queue="image_generation",
    )

    return BackgroundResponse(
        task_id=task_id,
        status="pending",
        estimated_time=5.0,
    )


@router.post("/replace-image", response_model=BackgroundResponse, status_code=status.HTTP_202_ACCEPTED)
async def replace_background_with_image(
    request: BackgroundReplaceImageRequest,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_user_id_from_header),
):
    """
    Replace background with another image.

    Extracts foreground from source image and composites over background image.
    """
    image_url = await get_image_url(db, request.image_id)
    background_url = await get_image_url(db, request.background_image_id)

    task_id = uuid4()
    celery_app.send_task(
        "replace_background",
        kwargs={
            "task_id": str(task_id),
            "image_url": image_url,
            "background_url": background_url,
            "user_id": user_id,
            "alpha_matting": request.alpha_matting,
        },
        queue="image_generation",
    )

    return BackgroundResponse(
        task_id=task_id,
        status="pending",
        estimated_time=8.0,
    )


@router.post("/replace-color", response_model=BackgroundResponse, status_code=status.HTTP_202_ACCEPTED)
async def replace_background_with_color(
    request: BackgroundReplaceColorRequest,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_user_id_from_header),
):
    """
    Replace background with solid color.

    Color should be RGB values [r, g, b], each 0-255.
    """
    image_url = await get_image_url(db, request.image_id)

    # Validate color
    if len(request.color) != 3 or not all(0 <= c <= 255 for c in request.color):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Color must be [r, g, b] with values 0-255"
        )

    task_id = uuid4()
    celery_app.send_task(
        "replace_background_color",
        kwargs={
            "task_id": str(task_id),
            "image_url": image_url,
            "color": tuple(request.color),
            "user_id": user_id,
            "alpha_matting": request.alpha_matting,
        },
        queue="image_generation",
    )

    return BackgroundResponse(
        task_id=task_id,
        status="pending",
        estimated_time=5.0,
    )


@router.post("/mask", response_model=BackgroundResponse, status_code=status.HTTP_202_ACCEPTED)
async def get_foreground_mask(
    request: BackgroundMaskRequest,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_user_id_from_header),
):
    """
    Get foreground mask as red overlay.

    Useful for applying to mask canvas in the editor.
    """
    image_url = await get_image_url(db, request.image_id)

    task_id = uuid4()
    celery_app.send_task(
        "get_background_mask",
        kwargs={
            "task_id": str(task_id),
            "image_url": image_url,
            "user_id": user_id,
        },
        queue="image_generation",
    )

    return BackgroundResponse(
        task_id=task_id,
        status="pending",
        estimated_time=5.0,
    )


@router.get("/tasks/{task_id}", response_model=BackgroundTaskStatusResponse)
async def get_background_task_status(
    task_id: UUID,
    user_id: str = Depends(get_user_id_from_header),
):
    """Get background task status."""
    celery_result = celery_app.AsyncResult(str(task_id))

    if celery_result.ready():
        result_data = celery_result.result
        if isinstance(result_data, dict):
            return BackgroundTaskStatusResponse(
                task_id=task_id,
                status=result_data.get("status", "unknown"),
                image=result_data.get("image"),
                mask_url=result_data.get("mask_url"),
                mask_base64=result_data.get("mask_base64"),
                error=result_data.get("error"),
            )

    return BackgroundTaskStatusResponse(
        task_id=task_id,
        status="processing" if celery_result.state == "STARTED" else "pending",
    )
