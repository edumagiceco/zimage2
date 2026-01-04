"""
Celery task for background removal and replacement.
"""
import base64
import io
import logging
import traceback
from typing import Dict, Any, Optional, Tuple
from uuid import uuid4

import requests
from celery import shared_task
from minio import Minio
from PIL import Image

from app.config import settings
from app.ml.background_pipeline import get_background_pipeline

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
    name="remove_background",
    queue="image_generation",
    max_retries=2,
    soft_time_limit=60,
    time_limit=90,
)
def remove_background(
    task_id: str,
    image_url: str,
    user_id: str,
    alpha_matting: bool = True,
) -> Dict[str, Any]:
    """
    Remove background from image.

    Args:
        task_id: Unique task ID
        image_url: URL of image
        user_id: User ID for storage
        alpha_matting: Use alpha matting for better edges

    Returns:
        Task result with transparent image URL
    """
    try:
        logger.info(f"[{task_id}] Starting background removal")

        # Load image
        image = load_image_from_url(image_url)
        logger.info(f"[{task_id}] Image loaded: {image.size}")

        # Get pipeline
        pipeline = get_background_pipeline()

        # Remove background
        result_bytes = pipeline.remove_background(image, alpha_matting=alpha_matting)
        logger.info(f"[{task_id}] Background removed")

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
            "image": {
                "id": image_id,
                "url": result_url,
                "width": image.width,
                "height": image.height,
            },
        }

    except Exception as e:
        logger.error(f"[{task_id}] Background removal failed: {e}")
        logger.error(traceback.format_exc())
        return {
            "task_id": task_id,
            "status": "failed",
            "error": str(e),
        }


@shared_task(
    name="replace_background",
    queue="image_generation",
    max_retries=2,
    soft_time_limit=60,
    time_limit=90,
)
def replace_background(
    task_id: str,
    image_url: str,
    background_url: str,
    user_id: str,
    alpha_matting: bool = True,
) -> Dict[str, Any]:
    """
    Replace background with new image.

    Args:
        task_id: Unique task ID
        image_url: URL of foreground image
        background_url: URL of new background image
        user_id: User ID for storage
        alpha_matting: Use alpha matting for better edges

    Returns:
        Task result with composited image URL
    """
    try:
        logger.info(f"[{task_id}] Starting background replacement")

        # Load images
        image = load_image_from_url(image_url)
        background = load_image_from_url(background_url)

        # Get pipeline
        pipeline = get_background_pipeline()

        # Replace background
        result_bytes = pipeline.replace_background(
            image,
            background,
            alpha_matting=alpha_matting,
        )

        # Upload result
        image_id = str(uuid4())
        object_name = f"images/{user_id}/{task_id}/{image_id}.png"
        result_url = upload_to_minio(
            result_bytes,
            settings.MINIO_BUCKET,
            object_name,
        )

        pipeline.cleanup()

        return {
            "task_id": task_id,
            "status": "completed",
            "image": {
                "id": image_id,
                "url": result_url,
                "width": image.width,
                "height": image.height,
            },
        }

    except Exception as e:
        logger.error(f"[{task_id}] Background replacement failed: {e}")
        return {
            "task_id": task_id,
            "status": "failed",
            "error": str(e),
        }


@shared_task(
    name="replace_background_color",
    queue="image_generation",
    max_retries=2,
    soft_time_limit=60,
    time_limit=90,
)
def replace_background_color(
    task_id: str,
    image_url: str,
    color: Tuple[int, int, int],
    user_id: str,
    alpha_matting: bool = True,
) -> Dict[str, Any]:
    """
    Replace background with solid color.

    Args:
        task_id: Unique task ID
        image_url: URL of foreground image
        color: RGB tuple (r, g, b)
        user_id: User ID for storage
        alpha_matting: Use alpha matting for better edges

    Returns:
        Task result with composited image URL
    """
    try:
        logger.info(f"[{task_id}] Starting background color replacement")

        # Load image
        image = load_image_from_url(image_url)

        # Get pipeline
        pipeline = get_background_pipeline()

        # Replace with color
        result_bytes = pipeline.replace_with_color(
            image,
            tuple(color),
            alpha_matting=alpha_matting,
        )

        # Upload result
        image_id = str(uuid4())
        object_name = f"images/{user_id}/{task_id}/{image_id}.png"
        result_url = upload_to_minio(
            result_bytes,
            settings.MINIO_BUCKET,
            object_name,
        )

        pipeline.cleanup()

        return {
            "task_id": task_id,
            "status": "completed",
            "image": {
                "id": image_id,
                "url": result_url,
                "width": image.width,
                "height": image.height,
            },
        }

    except Exception as e:
        logger.error(f"[{task_id}] Background color replacement failed: {e}")
        return {
            "task_id": task_id,
            "status": "failed",
            "error": str(e),
        }


@shared_task(
    name="get_background_mask",
    queue="image_generation",
    max_retries=2,
    soft_time_limit=60,
    time_limit=90,
)
def get_background_mask(
    task_id: str,
    image_url: str,
    user_id: str,
) -> Dict[str, Any]:
    """
    Get foreground mask as red overlay for mask canvas.

    Args:
        task_id: Unique task ID
        image_url: URL of image
        user_id: User ID for storage

    Returns:
        Task result with mask URL and base64
    """
    try:
        logger.info(f"[{task_id}] Getting background mask")

        # Load image
        image = load_image_from_url(image_url)

        # Get pipeline
        pipeline = get_background_pipeline()

        # Get mask overlay
        mask_bytes = pipeline.get_mask_as_overlay(image)

        # Upload mask
        mask_id = str(uuid4())
        object_name = f"masks/{user_id}/{task_id}/{mask_id}.png"
        mask_url = upload_to_minio(
            mask_bytes,
            settings.MINIO_BUCKET,
            object_name,
        )

        mask_base64 = base64.b64encode(mask_bytes).decode("utf-8")

        pipeline.cleanup()

        return {
            "task_id": task_id,
            "status": "completed",
            "mask_url": mask_url,
            "mask_base64": f"data:image/png;base64,{mask_base64}",
        }

    except Exception as e:
        logger.error(f"[{task_id}] Get background mask failed: {e}")
        return {
            "task_id": task_id,
            "status": "failed",
            "error": str(e),
        }
