from fastapi import APIRouter, Depends, HTTPException, status, Header
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional
from uuid import UUID, uuid4
from celery import Celery

from app.db.session import get_db
from app.config import settings
from app.models.task import GenerationTask, TaskStatus
from app.schemas.image import ImageGenerateRequest, ImageGenerateResponse

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


@router.post("/generate", response_model=ImageGenerateResponse, status_code=status.HTTP_202_ACCEPTED)
async def generate_image(
    request: ImageGenerateRequest,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_user_id_from_header),
):
    """Submit image generation request"""
    # For development, use a default user ID if not provided
    if not user_id:
        user_id = "00000000-0000-0000-0000-000000000001"

    # Create task record
    task_id = uuid4()
    task = GenerationTask(
        id=task_id,
        user_id=UUID(user_id),
        prompt=request.prompt,
        negative_prompt=request.negative_prompt,
        width=request.width,
        height=request.height,
        num_images=request.num_images,
        seed=request.seed,
        status=TaskStatus.PENDING,
    )
    db.add(task)
    await db.flush()

    # Send task to Celery
    celery_task = celery_app.send_task(
        "generate_image",
        kwargs={
            "task_id": str(task_id),
            "prompt": request.prompt,
            "negative_prompt": request.negative_prompt or "",
            "width": request.width,
            "height": request.height,
            "num_images": request.num_images,
            "seed": request.seed,
            "user_id": user_id,
        },
        queue="image_generation",
    )

    # Update task with celery task ID
    task.celery_task_id = celery_task.id

    # Estimate time (roughly 2 seconds per image)
    estimated_time = request.num_images * 2.0

    return ImageGenerateResponse(
        task_id=task_id,
        status="pending",
        estimated_time=estimated_time,
    )
