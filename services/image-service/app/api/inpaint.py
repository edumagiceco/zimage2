from fastapi import APIRouter, Depends, HTTPException, status, Header
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Optional
from uuid import UUID, uuid4
from celery import Celery
from datetime import datetime

from app.db.session import get_db
from app.config import settings
from app.models.image import Image
from app.models.inpaint_task import InpaintTask
from app.models.task import TaskStatus
from app.schemas.inpaint import (
    InpaintRequest,
    InpaintResponse,
    InpaintTaskStatusResponse,
    InpaintImageResult,
)

router = APIRouter()

# Celery client
celery_app = Celery(
    "image_tasks",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
)


def get_user_id_from_header(x_user_id: Optional[str] = Header(None)) -> Optional[str]:
    """Get user ID from header (set by API Gateway)"""
    return x_user_id


@router.post("/inpaint", response_model=InpaintResponse, status_code=status.HTTP_202_ACCEPTED)
async def inpaint_image(
    request: InpaintRequest,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_user_id_from_header),
):
    """Submit image inpainting request"""
    # For development, use a default user ID if not provided
    if not user_id:
        user_id = "00000000-0000-0000-0000-000000000001"

    # Get original image
    result = await db.execute(
        select(Image).where(Image.id == request.original_image_id)
    )
    original_image = result.scalar_one_or_none()

    if not original_image:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Original image not found"
        )

    # Create inpaint task record
    task_id = uuid4()
    task = InpaintTask(
        id=task_id,
        user_id=UUID(user_id),
        original_image_id=request.original_image_id,
        prompt=request.prompt,
        negative_prompt=request.negative_prompt,
        strength=request.strength,
        guidance_scale=request.guidance_scale,
        num_inference_steps=request.num_inference_steps,
        seed=request.seed,
        status=TaskStatus.PENDING,
    )
    db.add(task)
    await db.flush()

    # Send task to Celery
    celery_task = celery_app.send_task(
        "inpaint_image",
        kwargs={
            "task_id": str(task_id),
            "original_image_url": original_image.url,
            "mask_data": request.mask_data,
            "prompt": request.prompt,
            "negative_prompt": request.negative_prompt or "",
            "strength": request.strength,
            "guidance_scale": request.guidance_scale,
            "num_inference_steps": request.num_inference_steps,
            "seed": request.seed,
            "user_id": user_id,
        },
        queue="image_generation",
    )

    # Update task with celery task ID
    task.celery_task_id = celery_task.id

    # Estimate time (inpainting takes longer than generation)
    estimated_time = 15.0

    return InpaintResponse(
        task_id=task_id,
        status="pending",
        estimated_time=estimated_time,
    )


@router.get("/inpaint/tasks/{task_id}", response_model=InpaintTaskStatusResponse)
async def get_inpaint_task_status(
    task_id: UUID,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_user_id_from_header),
):
    """Get inpainting task status"""
    result = await db.execute(
        select(InpaintTask).where(InpaintTask.id == task_id)
    )
    task = result.scalar_one_or_none()

    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found"
        )

    # Get original image URL
    original_image_url = None
    if task.original_image_id:
        img_result = await db.execute(
            select(Image).where(Image.id == task.original_image_id)
        )
        original_image = img_result.scalar_one_or_none()
        if original_image:
            original_image_url = original_image.url

    # Check Celery task status if still pending/processing
    if task.status in [TaskStatus.PENDING, TaskStatus.PROCESSING]:
        if task.celery_task_id:
            celery_result = celery_app.AsyncResult(task.celery_task_id)

            if celery_result.ready():
                result_data = celery_result.result
                if isinstance(result_data, dict):
                    if result_data.get("status") == "completed":
                        task.status = TaskStatus.COMPLETED
                        task.result = result_data.get("images", [])
                        task.mask_object_name = result_data.get("mask_object_name")
                        task.completed_at = datetime.utcnow()
                    elif result_data.get("status") == "failed":
                        task.status = TaskStatus.FAILED
                        task.error = result_data.get("error")
                        task.completed_at = datetime.utcnow()

                    await db.flush()
            elif celery_result.state == "STARTED":
                task.status = TaskStatus.PROCESSING
                if not task.started_at:
                    task.started_at = datetime.utcnow()
                    await db.flush()

    # Calculate progress
    progress = 0
    progress_message = "대기 중..."
    if task.status == TaskStatus.PENDING:
        progress = 5
        progress_message = "작업 대기 중..."
    elif task.status == TaskStatus.PROCESSING:
        progress = 50
        progress_message = "이미지 편집 중..."
    elif task.status == TaskStatus.COMPLETED:
        progress = 100
        progress_message = "완료!"
    elif task.status == TaskStatus.FAILED:
        progress = 0
        progress_message = "실패"

    # Calculate elapsed time
    elapsed_seconds = None
    if task.started_at:
        end_time = task.completed_at or datetime.utcnow()
        elapsed_seconds = (end_time - task.started_at).total_seconds()

    # Parse result images
    images = None
    if task.result and task.status == TaskStatus.COMPLETED:
        images = [
            InpaintImageResult(
                id=img.get("id", ""),
                url=img.get("url", ""),
                width=img.get("width", 0),
                height=img.get("height", 0),
                seed=img.get("seed"),
            )
            for img in task.result
        ]

    return InpaintTaskStatusResponse(
        task_id=task.id,
        status=task.status.value,
        progress=progress,
        progress_message=progress_message,
        elapsed_seconds=elapsed_seconds,
        estimated_seconds=15.0 if task.status in [TaskStatus.PENDING, TaskStatus.PROCESSING] else None,
        original_image_url=original_image_url,
        images=images,
        error=task.error,
        created_at=task.created_at,
        completed_at=task.completed_at,
    )
