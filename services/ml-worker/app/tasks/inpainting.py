from celery import shared_task
from minio import Minio
from io import BytesIO
import uuid
import base64
import logging
import requests
from typing import Dict, Any, Optional
from PIL import Image

from app.config import settings
from app.ml.inpaint_pipeline import get_inpaint_pipeline
from app.ml.translation_pipeline import translate_prompt

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


def load_image_from_url(url: str) -> Image.Image:
    """Load image from URL (MinIO or external)"""
    # Check if it's an internal MinIO URL and convert to internal endpoint
    if settings.MINIO_EXTERNAL_URL in url:
        # Convert external URL to internal for container access
        internal_url = url.replace(
            settings.MINIO_EXTERNAL_URL,
            f"http://{settings.MINIO_ENDPOINT}"
        )
        response = requests.get(internal_url, timeout=30)
    else:
        response = requests.get(url, timeout=30)

    response.raise_for_status()
    return Image.open(BytesIO(response.content))


def decode_base64_image(data: str) -> Image.Image:
    """Decode base64 image data to PIL Image"""
    if data.startswith('data:'):
        # Remove data URL prefix
        data = data.split(',')[1]
    image_data = base64.b64decode(data)
    return Image.open(BytesIO(image_data))


@shared_task(
    bind=True,
    name="inpaint_image",
    queue="image_generation",
    max_retries=2,
    soft_time_limit=300,
    time_limit=360,
)
def inpaint_image(
    self,
    task_id: str,
    original_image_url: str,
    mask_data: str,
    prompt: str,
    negative_prompt: str = "",
    strength: float = 0.85,
    guidance_scale: float = 7.5,
    num_inference_steps: int = 30,
    seed: Optional[int] = None,
    user_id: str = None,
) -> Dict[str, Any]:
    """
    Celery task for image inpainting.

    Args:
        task_id: Unique task identifier
        original_image_url: URL of original image to edit
        mask_data: Base64 encoded mask image
        prompt: Text prompt describing the edit
        negative_prompt: Negative prompt
        strength: Edit strength (0.0-1.0)
        guidance_scale: CFG scale
        num_inference_steps: Number of denoising steps
        seed: Random seed
        user_id: User ID for organizing storage

    Returns:
        Dict with task_id, status, and result images info
    """
    logger.info(f"Starting inpainting task: {task_id}")
    logger.info(f"Prompt: {prompt[:100]}...")

    try:
        # Ensure bucket exists
        ensure_bucket_exists()

        # Translate prompt if needed (Korean -> English)
        original_prompt = prompt
        translated_prompt, was_translated = translate_prompt(prompt)

        if was_translated:
            logger.info(f"Translated prompt: {translated_prompt[:100]}...")
            prompt = translated_prompt

        # Also translate negative prompt if needed
        if negative_prompt:
            translated_negative, neg_was_translated = translate_prompt(negative_prompt)
            if neg_was_translated:
                negative_prompt = translated_negative

        # Load original image
        logger.info(f"Loading original image from: {original_image_url}")
        original_image = load_image_from_url(original_image_url)
        logger.info(f"Original image size: {original_image.size}")

        # Decode mask
        logger.info("Decoding mask...")
        mask_image = decode_base64_image(mask_data)
        logger.info(f"Mask size: {mask_image.size}")

        # Get pipeline
        pipeline = get_inpaint_pipeline()

        # Preprocess mask
        processed_mask = pipeline.preprocess_mask(mask_image)

        # Execute inpainting
        images_bytes = pipeline.inpaint(
            image=original_image,
            mask=processed_mask,
            prompt=prompt,
            negative_prompt=negative_prompt,
            strength=strength,
            guidance_scale=guidance_scale,
            num_inference_steps=num_inference_steps,
            seed=seed,
        )

        # Upload results to MinIO
        image_results = []
        for idx, img_bytes in enumerate(images_bytes):
            image_id = str(uuid.uuid4())
            object_name = f"images/{user_id or 'anonymous'}/{task_id}/{image_id}.png"

            minio_client.put_object(
                settings.MINIO_BUCKET,
                object_name,
                BytesIO(img_bytes),
                length=len(img_bytes),
                content_type="image/png",
            )

            url = f"{settings.MINIO_EXTERNAL_URL}/{settings.MINIO_BUCKET}/{object_name}"

            # Get image dimensions
            result_img = Image.open(BytesIO(img_bytes))
            width, height = result_img.size

            image_results.append({
                "id": image_id,
                "url": url,
                "object_name": object_name,
                "width": width,
                "height": height,
                "seed": seed,
            })

            logger.info(f"Uploaded inpainted image {idx + 1}: {object_name}")

        # Save mask for reference (optional)
        mask_id = str(uuid.uuid4())
        mask_object_name = f"masks/{user_id or 'anonymous'}/{task_id}/{mask_id}.png"
        mask_buffer = BytesIO()
        processed_mask.save(mask_buffer, format="PNG")
        mask_bytes = mask_buffer.getvalue()

        minio_client.put_object(
            settings.MINIO_BUCKET,
            mask_object_name,
            BytesIO(mask_bytes),
            length=len(mask_bytes),
            content_type="image/png",
        )

        # Clean up GPU memory
        pipeline.cleanup()

        result = {
            "task_id": task_id,
            "status": "completed",
            "images": image_results,
            "mask_object_name": mask_object_name,
            "original_prompt": original_prompt,
            "translated_prompt": translated_prompt if was_translated else None,
            "was_translated": was_translated,
        }

        logger.info(f"Inpainting task {task_id} completed successfully.")
        return result

    except Exception as e:
        logger.error(f"Inpainting task {task_id} failed: {str(e)}", exc_info=True)

        # Retry on failure
        if self.request.retries < self.max_retries:
            logger.info(f"Retrying task {task_id} (attempt {self.request.retries + 1})")
            raise self.retry(exc=e, countdown=5 * (self.request.retries + 1))

        return {
            "task_id": task_id,
            "status": "failed",
            "error": str(e),
            "images": [],
        }
