"""
Celery task for SAM segmentation.
"""
import base64
import io
import logging
import traceback
from typing import Dict, Any, List, Optional
from uuid import uuid4

import requests
from celery import shared_task
from minio import Minio
from PIL import Image

from app.config import settings
from app.ml.sam_pipeline import get_sam_pipeline

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
    # Ensure bucket exists
    if not minio_client.bucket_exists(bucket):
        minio_client.make_bucket(bucket)

    # Upload
    minio_client.put_object(
        bucket,
        object_name,
        io.BytesIO(data),
        len(data),
        content_type=content_type,
    )

    # Return URL
    return f"http://{settings.MINIO_ENDPOINT}/{bucket}/{object_name}"


@shared_task(
    name="segment_point",
    queue="image_generation",
    max_retries=2,
    soft_time_limit=60,
    time_limit=90,
)
def segment_point(
    task_id: str,
    image_url: str,
    point_coords: List[List[int]],
    point_labels: List[int],
    user_id: str,
) -> Dict[str, Any]:
    """
    Segment object at given point coordinates using SAM.

    Args:
        task_id: Unique task ID
        image_url: URL of image to segment
        point_coords: List of [x, y] coordinates
        point_labels: List of labels (1=foreground, 0=background)
        user_id: User ID for storage

    Returns:
        Task result with mask URL
    """
    try:
        logger.info(f"[{task_id}] Starting SAM point segmentation")

        # Load image
        image = load_image_from_url(image_url)
        logger.info(f"[{task_id}] Image loaded: {image.size}")

        # Get SAM pipeline
        pipeline = get_sam_pipeline()

        # Convert point coords
        coords = [(p[0], p[1]) for p in point_coords]

        # Segment
        mask_bytes = pipeline.segment_point(image, coords, point_labels)
        logger.info(f"[{task_id}] Segmentation complete")

        # Upload mask to MinIO
        mask_id = str(uuid4())
        object_name = f"masks/{user_id}/{task_id}/{mask_id}.png"
        mask_url = upload_to_minio(
            mask_bytes,
            settings.MINIO_BUCKET,
            object_name,
        )

        # Also return base64 for immediate use
        mask_base64 = base64.b64encode(mask_bytes).decode("utf-8")

        # Cleanup
        pipeline.cleanup()

        return {
            "task_id": task_id,
            "status": "completed",
            "mask_url": mask_url,
            "mask_base64": f"data:image/png;base64,{mask_base64}",
        }

    except Exception as e:
        logger.error(f"[{task_id}] SAM segmentation failed: {e}")
        logger.error(traceback.format_exc())
        return {
            "task_id": task_id,
            "status": "failed",
            "error": str(e),
        }


@shared_task(
    name="segment_box",
    queue="image_generation",
    max_retries=2,
    soft_time_limit=60,
    time_limit=90,
)
def segment_box(
    task_id: str,
    image_url: str,
    box: List[int],
    user_id: str,
) -> Dict[str, Any]:
    """
    Segment object within bounding box using SAM.

    Args:
        task_id: Unique task ID
        image_url: URL of image to segment
        box: [x1, y1, x2, y2] bounding box
        user_id: User ID for storage

    Returns:
        Task result with mask URL
    """
    try:
        logger.info(f"[{task_id}] Starting SAM box segmentation")

        # Load image
        image = load_image_from_url(image_url)

        # Get SAM pipeline
        pipeline = get_sam_pipeline()

        # Segment
        mask_bytes = pipeline.segment_box(image, tuple(box))

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
        logger.error(f"[{task_id}] SAM box segmentation failed: {e}")
        return {
            "task_id": task_id,
            "status": "failed",
            "error": str(e),
        }


@shared_task(
    name="segment_auto",
    queue="image_generation",
    max_retries=2,
    soft_time_limit=120,
    time_limit=180,
)
def segment_auto(
    task_id: str,
    image_url: str,
    user_id: str,
) -> Dict[str, Any]:
    """
    Automatically segment all objects in image.

    Args:
        task_id: Unique task ID
        image_url: URL of image to segment
        user_id: User ID for storage

    Returns:
        Task result with list of mask URLs
    """
    try:
        logger.info(f"[{task_id}] Starting SAM auto segmentation")

        # Load image
        image = load_image_from_url(image_url)

        # Get SAM pipeline
        pipeline = get_sam_pipeline()

        # Segment
        mask_bytes_list = pipeline.segment_auto(image)

        # Upload masks
        masks = []
        for i, mask_bytes in enumerate(mask_bytes_list):
            mask_id = str(uuid4())
            object_name = f"masks/{user_id}/{task_id}/{mask_id}.png"
            mask_url = upload_to_minio(
                mask_bytes,
                settings.MINIO_BUCKET,
                object_name,
            )
            mask_base64 = base64.b64encode(mask_bytes).decode("utf-8")
            masks.append({
                "id": mask_id,
                "url": mask_url,
                "base64": f"data:image/png;base64,{mask_base64}",
            })

        pipeline.cleanup()

        return {
            "task_id": task_id,
            "status": "completed",
            "masks": masks,
        }

    except Exception as e:
        logger.error(f"[{task_id}] SAM auto segmentation failed: {e}")
        return {
            "task_id": task_id,
            "status": "failed",
            "error": str(e),
        }
