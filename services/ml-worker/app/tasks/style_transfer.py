"""
Celery task for style transfer.
"""
import io
import logging
import traceback
from typing import Dict, Any, Optional, List
from uuid import uuid4

import requests
from celery import shared_task
from minio import Minio
from PIL import Image

from app.config import settings
from app.ml.style_pipeline import get_style_pipeline, get_available_styles

logger = logging.getLogger(__name__)

# MinIO client
minio_client = Minio(
    settings.MINIO_ENDPOINT,
    access_key=settings.MINIO_ACCESS_KEY,
    secret_key=settings.MINIO_SECRET_KEY,
    secure=settings.MINIO_SECURE,
)


def load_image_from_url(url: str) -> Image.Image:
    """Load image from URL."""
    response = requests.get(url, timeout=30)
    response.raise_for_status()
    return Image.open(io.BytesIO(response.content))


def upload_to_minio(
    data: bytes,
    bucket: str,
    object_name: str,
    content_type: str = "image/png",
) -> str:
    """Upload bytes to MinIO and return URL."""
    if not minio_client.bucket_exists(bucket):
        minio_client.make_bucket(bucket)

    minio_client.put_object(
        bucket,
        object_name,
        io.BytesIO(data),
        len(data),
        content_type=content_type,
    )

    return f"http://{settings.MINIO_ENDPOINT}/{bucket}/{object_name}"


@shared_task(
    name="apply_style",
    queue="image_generation",
    max_retries=2,
    soft_time_limit=180,
    time_limit=240,
)
def apply_style(
    task_id: str,
    image_url: str,
    style: str,
    user_id: str,
    prompt: str = "",
    strength: Optional[float] = None,
    seed: Optional[int] = None,
) -> Dict[str, Any]:
    """
    Apply artistic style to image.

    Args:
        task_id: Unique task ID
        image_url: URL of image
        style: Style preset name
        user_id: User ID for storage
        prompt: Optional additional prompt
        strength: Override style strength
        seed: Random seed for reproducibility

    Returns:
        Task result with styled image URL
    """
    try:
        logger.info(f"[{task_id}] Starting style transfer: {style}")

        # Load image
        image = load_image_from_url(image_url)
        original_size = image.size
        logger.info(f"[{task_id}] Image loaded: {image.size}")

        # Get pipeline
        pipeline = get_style_pipeline()

        # Apply style
        result_bytes = pipeline.apply_style(
            image=image,
            style=style,
            prompt=prompt,
            strength=strength,
            seed=seed,
        )

        # Open result to get size
        result_image = Image.open(io.BytesIO(result_bytes))

        # Resize back to original if needed
        if result_image.size != original_size:
            result_image = result_image.resize(original_size, Image.LANCZOS)
            buffer = io.BytesIO()
            result_image.save(buffer, format="PNG")
            result_bytes = buffer.getvalue()

        logger.info(f"[{task_id}] Style applied")

        # Upload result
        image_id = str(uuid4())
        object_name = f"images/{user_id}/{task_id}/{image_id}.png"
        result_url = upload_to_minio(
            result_bytes,
            settings.MINIO_BUCKET,
            object_name,
        )

        # Cleanup
        pipeline.cleanup()

        return {
            "task_id": task_id,
            "status": "completed",
            "style": style,
            "image": {
                "id": image_id,
                "url": result_url,
                "width": original_size[0],
                "height": original_size[1],
            },
        }

    except Exception as e:
        logger.error(f"[{task_id}] Style transfer failed: {e}")
        logger.error(traceback.format_exc())
        return {
            "task_id": task_id,
            "status": "failed",
            "error": str(e),
        }


@shared_task(
    name="list_styles",
    queue="image_generation",
)
def list_styles() -> List[Dict[str, str]]:
    """
    Get list of available styles.

    Returns:
        List of style info dicts
    """
    return get_available_styles()
