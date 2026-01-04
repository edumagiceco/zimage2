from celery import shared_task
from minio import Minio
from io import BytesIO
import uuid
import logging
from typing import Dict, Any, Optional

from app.config import settings
from app.ml.pipeline import get_pipeline

logger = logging.getLogger(__name__)

# MinIO client
minio_client = Minio(
    settings.MINIO_ENDPOINT,
    access_key=settings.MINIO_ACCESS_KEY,
    secret_key=settings.MINIO_SECRET_KEY,
    secure=settings.MINIO_USE_SSL,
)


def ensure_bucket_exists():
    """Ensure the MinIO bucket exists"""
    try:
        if not minio_client.bucket_exists(settings.MINIO_BUCKET):
            minio_client.make_bucket(settings.MINIO_BUCKET)
            logger.info(f"Created bucket: {settings.MINIO_BUCKET}")
    except Exception as e:
        logger.warning(f"Could not create bucket: {e}")


@shared_task(
    bind=True,
    name="generate_image",
    queue="image_generation",
    max_retries=2,
    soft_time_limit=180,
    time_limit=240,
)
def generate_image(
    self,
    task_id: str,
    prompt: str,
    negative_prompt: str = "",
    width: int = 1024,
    height: int = 1024,
    num_images: int = 1,
    seed: Optional[int] = None,
    user_id: str = None,
) -> Dict[str, Any]:
    """
    Celery task for image generation.

    Args:
        task_id: Unique task identifier
        prompt: Text prompt for generation
        negative_prompt: Negative prompt
        width: Image width
        height: Image height
        num_images: Number of images to generate
        seed: Random seed
        user_id: User ID for organizing storage

    Returns:
        Dict with task_id, status, and generated images info
    """
    logger.info(f"Starting image generation task: {task_id}")
    logger.info(f"Prompt: {prompt[:100]}...")

    try:
        # Ensure bucket exists
        ensure_bucket_exists()

        # Get pipeline
        pipeline = get_pipeline()

        # Generate images
        images_bytes = pipeline.generate(
            prompt=prompt,
            negative_prompt=negative_prompt,
            width=width,
            height=height,
            num_images=num_images,
            seed=seed,
        )

        # Upload to MinIO
        image_results = []
        for idx, img_bytes in enumerate(images_bytes):
            # Generate unique object name
            image_id = str(uuid.uuid4())
            object_name = f"images/{user_id or 'anonymous'}/{task_id}/{image_id}.png"

            # Upload to MinIO
            minio_client.put_object(
                settings.MINIO_BUCKET,
                object_name,
                BytesIO(img_bytes),
                length=len(img_bytes),
                content_type="image/png",
            )

            # Generate URL for external (browser) access
            url = f"{settings.MINIO_EXTERNAL_URL}/{settings.MINIO_BUCKET}/{object_name}"

            image_results.append({
                "id": image_id,
                "url": url,
                "object_name": object_name,
                "width": width,
                "height": height,
                "seed": seed,
            })

            logger.info(f"Uploaded image {idx + 1}/{len(images_bytes)}: {object_name}")

        # Clean up GPU memory
        pipeline.cleanup()

        result = {
            "task_id": task_id,
            "status": "completed",
            "images": image_results,
        }

        logger.info(f"Task {task_id} completed successfully. Generated {len(image_results)} images.")
        return result

    except Exception as e:
        logger.error(f"Task {task_id} failed: {str(e)}", exc_info=True)

        # Retry on failure
        if self.request.retries < self.max_retries:
            logger.info(f"Retrying task {task_id} (attempt {self.request.retries + 1})")
            raise self.retry(exc=e, countdown=5 * (self.request.retries + 1))

        # Max retries exceeded
        return {
            "task_id": task_id,
            "status": "failed",
            "error": str(e),
            "images": [],
        }
