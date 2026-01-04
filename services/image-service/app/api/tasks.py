from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from uuid import UUID
from celery.result import AsyncResult
from datetime import datetime

from app.db.session import get_db
from app.config import settings
from app.models.task import GenerationTask, TaskStatus
from app.models.image import Image
from app.schemas.task import TaskStatusResponse, GeneratedImageInfo
from celery import Celery

router = APIRouter()

# Celery client
celery_app = Celery(
    "image_tasks",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
)

# Estimated time per image based on resolution (in seconds)
def estimate_generation_time(width: int, height: int, num_images: int = 1) -> float:
    """Estimate image generation time based on resolution"""
    pixels = width * height
    # Base time: ~3 seconds for 512x512, scales with pixels
    base_pixels = 512 * 512
    base_time = 3.0

    # First image takes longer (model loading), subsequent images are faster
    first_image_time = base_time * (pixels / base_pixels) + 5.0  # +5 for model loading on first run
    additional_image_time = base_time * (pixels / base_pixels)

    if num_images == 1:
        return first_image_time
    return first_image_time + (num_images - 1) * additional_image_time


@router.get("/{task_id}", response_model=TaskStatusResponse)
async def get_task_status(
    task_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    """Get task status and results"""
    # Get task from database
    result = await db.execute(
        select(GenerationTask).where(GenerationTask.id == task_id)
    )
    task = result.scalar_one_or_none()

    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found",
        )

    # Check Celery task status if still processing
    if task.status in [TaskStatus.PENDING, TaskStatus.PROCESSING] and task.celery_task_id:
        celery_result = AsyncResult(task.celery_task_id, app=celery_app)

        if celery_result.ready():
            if celery_result.successful():
                # Task completed - check the result status
                task_result = celery_result.get()
                task.completed_at = datetime.utcnow()

                # Check if the task result indicates failure (e.g., CUDA OOM)
                if task_result and task_result.get("status") == "failed":
                    task.status = TaskStatus.FAILED
                    task.error = task_result.get("error", "이미지 생성에 실패했습니다.")
                    task.result = task_result
                else:
                    task.status = TaskStatus.COMPLETED
                    task.result = task_result

                    # Save generated images to database
                    if task_result and "images" in task_result:
                        for img_data in task_result["images"]:
                            image = Image(
                                user_id=task.user_id,
                                task_id=task.id,
                                url=img_data["url"],
                                object_name=img_data["object_name"],
                                prompt=task.prompt,
                                negative_prompt=task.negative_prompt,
                                width=img_data["width"],
                                height=img_data["height"],
                                seed=img_data.get("seed"),
                            )
                            db.add(image)

            else:
                # Celery task itself failed (exception thrown)
                task.status = TaskStatus.FAILED
                task.error = str(celery_result.result)
                task.completed_at = datetime.utcnow()

        elif celery_result.state == "STARTED":
            task.status = TaskStatus.PROCESSING
            if not task.started_at:
                task.started_at = datetime.utcnow()

    # Build response
    images = []
    if task.status == TaskStatus.COMPLETED and task.result:
        for img_data in task.result.get("images", []):
            images.append(GeneratedImageInfo(
                id=img_data.get("id", task.id),
                url=img_data["url"],
                width=img_data["width"],
                height=img_data["height"],
                seed=img_data.get("seed"),
            ))

    # Calculate progress information
    progress = None
    progress_message = None
    estimated_seconds = None
    elapsed_seconds = None

    if task.status == TaskStatus.COMPLETED:
        progress = 100
        progress_message = "완료"
    elif task.status == TaskStatus.FAILED:
        progress = 0
        progress_message = "실패"
    elif task.status in [TaskStatus.PENDING, TaskStatus.PROCESSING]:
        # Calculate estimated time
        estimated_seconds = estimate_generation_time(task.width, task.height, task.num_images)

        # Calculate elapsed time
        start_time = task.started_at or task.created_at
        elapsed_seconds = (datetime.utcnow() - start_time).total_seconds()

        # Calculate progress percentage
        if estimated_seconds > 0:
            progress = min(95, int((elapsed_seconds / estimated_seconds) * 100))
        else:
            progress = 0

        # Generate progress message
        if task.status == TaskStatus.PENDING:
            progress_message = "대기 중..."
            progress = 5
        elif elapsed_seconds < 2:
            progress_message = "모델 초기화 중..."
            progress = max(progress, 10)
        elif elapsed_seconds < 5:
            progress_message = "이미지 생성 준비 중..."
            progress = max(progress, 20)
        else:
            remaining = max(0, estimated_seconds - elapsed_seconds)
            if remaining > 0:
                progress_message = f"이미지 생성 중... (약 {int(remaining)}초 남음)"
            else:
                progress_message = "이미지 생성 마무리 중..."
                progress = 90

    return TaskStatusResponse(
        task_id=task.id,
        status=task.status.value,
        images=images,
        error=task.error,
        created_at=task.created_at,
        started_at=task.started_at,
        completed_at=task.completed_at,
        progress=progress,
        progress_message=progress_message,
        estimated_seconds=estimated_seconds,
        elapsed_seconds=elapsed_seconds,
    )
