"""
SAM (Segment Anything Model) API endpoints.
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
    SAMPointRequest,
    SAMBoxRequest,
    SAMAutoRequest,
    SAMResponse,
    SAMTaskStatusResponse,
)

router = APIRouter(prefix="/sam", tags=["SAM Segmentation"])

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


@router.post("/segment-point", response_model=SAMResponse, status_code=status.HTTP_202_ACCEPTED)
async def segment_by_point(
    request: SAMPointRequest,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_user_id_from_header),
):
    """
    Segment object at given point coordinates using SAM.

    Click on the object you want to select. Use multiple points for better accuracy.
    - label=1: foreground (object to select)
    - label=0: background (to exclude)
    """
    image_url = await get_image_url(db, request.image_id)

    task_id = uuid4()
    celery_app.send_task(
        "segment_point",
        kwargs={
            "task_id": str(task_id),
            "image_url": image_url,
            "point_coords": request.point_coords,
            "point_labels": request.point_labels,
            "user_id": user_id,
        },
        queue="image_generation",
    )

    return SAMResponse(
        task_id=task_id,
        status="pending",
        estimated_time=5.0,
    )


@router.post("/segment-box", response_model=SAMResponse, status_code=status.HTTP_202_ACCEPTED)
async def segment_by_box(
    request: SAMBoxRequest,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_user_id_from_header),
):
    """
    Segment object within bounding box using SAM.

    Draw a bounding box around the object you want to select.
    """
    image_url = await get_image_url(db, request.image_id)

    task_id = uuid4()
    celery_app.send_task(
        "segment_box",
        kwargs={
            "task_id": str(task_id),
            "image_url": image_url,
            "box": request.box,
            "user_id": user_id,
        },
        queue="image_generation",
    )

    return SAMResponse(
        task_id=task_id,
        status="pending",
        estimated_time=5.0,
    )


@router.post("/segment-auto", response_model=SAMResponse, status_code=status.HTTP_202_ACCEPTED)
async def segment_auto(
    request: SAMAutoRequest,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_user_id_from_header),
):
    """
    Automatically segment all objects in image using SAM.

    Returns multiple masks for all detected objects.
    """
    image_url = await get_image_url(db, request.image_id)

    task_id = uuid4()
    celery_app.send_task(
        "segment_auto",
        kwargs={
            "task_id": str(task_id),
            "image_url": image_url,
            "user_id": user_id,
        },
        queue="image_generation",
    )

    return SAMResponse(
        task_id=task_id,
        status="pending",
        estimated_time=10.0,
    )


@router.get("/tasks/{task_id}", response_model=SAMTaskStatusResponse)
async def get_sam_task_status(
    task_id: UUID,
    user_id: str = Depends(get_user_id_from_header),
):
    """Get SAM segmentation task status."""
    celery_result = celery_app.AsyncResult(str(task_id))

    if celery_result.ready():
        result_data = celery_result.result
        if isinstance(result_data, dict):
            return SAMTaskStatusResponse(
                task_id=task_id,
                status=result_data.get("status", "unknown"),
                mask_url=result_data.get("mask_url"),
                mask_base64=result_data.get("mask_base64"),
                masks=result_data.get("masks"),
                error=result_data.get("error"),
            )

    return SAMTaskStatusResponse(
        task_id=task_id,
        status="processing" if celery_result.state == "STARTED" else "pending",
    )
