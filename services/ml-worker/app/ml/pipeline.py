import torch
from diffusers import AutoPipelineForText2Image
from typing import Optional, List
import logging
import io

from app.config import settings

logger = logging.getLogger(__name__)


class ImagePipeline:
    """Image Generation Pipeline Wrapper (Singleton)"""

    _instance: Optional['ImagePipeline'] = None
    _pipeline = None
    _is_loaded = False

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def __init__(self):
        if not self._is_loaded:
            self._load_model()

    def _load_model(self):
        """Load image generation model"""
        logger.info("Loading image generation model...")
        logger.info(f"Model: {settings.MODEL_NAME}")
        logger.info(f"CUDA available: {torch.cuda.is_available()}")

        if torch.cuda.is_available():
            logger.info(f"GPU: {torch.cuda.get_device_name(0)}")
            logger.info(f"GPU Memory: {torch.cuda.get_device_properties(0).total_memory / 1e9:.2f} GB")

        try:
            self._pipeline = AutoPipelineForText2Image.from_pretrained(
                settings.MODEL_NAME,
                torch_dtype=torch.float16,
                variant="fp16",
                cache_dir=settings.HF_HOME,
            )

            # Enable memory optimizations - this automatically handles GPU/CPU transfers
            # Note: Do NOT use .to("cuda") with enable_model_cpu_offload()
            self._pipeline.enable_model_cpu_offload()

            self._is_loaded = True
            logger.info("Image generation model loaded successfully!")

        except Exception as e:
            logger.error(f"Failed to load model: {e}")
            raise

    def generate(
        self,
        prompt: str,
        negative_prompt: str = "",
        width: int = 1024,
        height: int = 1024,
        num_images: int = 1,
        num_inference_steps: int = None,
        guidance_scale: float = None,
        seed: Optional[int] = None,
    ) -> List[bytes]:
        """
        Generate images from prompt.

        Args:
            prompt: Text prompt for image generation
            negative_prompt: Negative prompt to avoid certain features
            width: Image width
            height: Image height
            num_images: Number of images to generate
            num_inference_steps: Number of denoising steps (default: 8 for Turbo)
            guidance_scale: Guidance scale (default: 3.5)
            seed: Random seed for reproducibility

        Returns:
            List of image bytes in PNG format
        """
        if num_inference_steps is None:
            num_inference_steps = settings.DEFAULT_INFERENCE_STEPS
        if guidance_scale is None:
            guidance_scale = settings.DEFAULT_GUIDANCE_SCALE

        # Ensure dimensions are divisible by 8 (required by SDXL)
        width = (width // 8) * 8
        height = (height // 8) * 8

        logger.info(f"Generating {num_images} image(s): {prompt[:50]}...")
        logger.info(f"Size: {width}x{height}, Steps: {num_inference_steps}, CFG: {guidance_scale}")

        # Set up generator for reproducibility
        # Note: Use "cpu" device when using enable_model_cpu_offload()
        generator = None
        if seed is not None:
            generator = torch.Generator(device="cpu").manual_seed(seed)
            logger.info(f"Using seed: {seed}")

        try:
            with torch.inference_mode():
                result = self._pipeline(
                    prompt=prompt,
                    negative_prompt=negative_prompt if negative_prompt else None,
                    width=width,
                    height=height,
                    num_images_per_prompt=num_images,
                    num_inference_steps=num_inference_steps,
                    guidance_scale=guidance_scale,
                    generator=generator,
                )

            # Convert PIL images to bytes
            images_bytes = []
            for img in result.images:
                buffer = io.BytesIO()
                img.save(buffer, format="PNG", optimize=True)
                images_bytes.append(buffer.getvalue())

            logger.info(f"Generated {len(images_bytes)} image(s) successfully")
            return images_bytes

        except Exception as e:
            logger.error(f"Image generation failed: {e}")
            raise

    def cleanup(self):
        """Clean up GPU memory"""
        if torch.cuda.is_available():
            torch.cuda.empty_cache()
            logger.info("GPU memory cache cleared")


# Singleton accessor
_pipeline_instance: Optional[ImagePipeline] = None


def get_pipeline() -> ImagePipeline:
    """Get the singleton pipeline instance"""
    global _pipeline_instance
    if _pipeline_instance is None:
        _pipeline_instance = ImagePipeline()
    return _pipeline_instance
