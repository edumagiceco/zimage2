import torch
from diffusers import AutoPipelineForInpainting
from PIL import Image, ImageFilter
from typing import Optional, List
import logging
import io

from app.config import settings

logger = logging.getLogger(__name__)


class InpaintPipeline:
    """Inpainting Pipeline Wrapper (Singleton)"""

    _instance: Optional['InpaintPipeline'] = None
    _pipeline = None
    _is_loaded = False

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def __init__(self):
        pass  # Lazy loading - call load() explicitly

    def load(self):
        """Load SDXL Inpainting model"""
        if self._is_loaded:
            return

        logger.info("Loading SDXL Inpainting model...")
        logger.info(f"CUDA available: {torch.cuda.is_available()}")

        if torch.cuda.is_available():
            logger.info(f"GPU: {torch.cuda.get_device_name(0)}")
            logger.info(f"GPU Memory: {torch.cuda.get_device_properties(0).total_memory / 1e9:.2f} GB")

        try:
            self._pipeline = AutoPipelineForInpainting.from_pretrained(
                "diffusers/stable-diffusion-xl-1.0-inpainting-0.1",
                torch_dtype=torch.float16,
                variant="fp16",
                cache_dir=settings.HF_HOME,
            )

            # Enable memory optimizations
            self._pipeline.enable_model_cpu_offload()

            self._is_loaded = True
            logger.info("SDXL Inpainting model loaded successfully!")

        except Exception as e:
            logger.error(f"Failed to load inpainting model: {e}")
            raise

    @property
    def is_loaded(self) -> bool:
        return self._is_loaded

    def preprocess_mask(self, mask_image: Image.Image) -> Image.Image:
        """
        Preprocess mask for inpainting model.
        Frontend sends red overlay -> convert to white (edit area) / black (keep area)
        """
        # Convert to RGBA if needed
        if mask_image.mode != 'RGBA':
            mask_image = mask_image.convert('RGBA')

        # Create grayscale mask from alpha channel or red channel
        width, height = mask_image.size
        mask = Image.new('L', (width, height), 0)

        pixels = mask_image.load()
        mask_pixels = mask.load()

        for y in range(height):
            for x in range(width):
                r, g, b, a = pixels[x, y]
                # Check if pixel is part of mask (red overlay with alpha)
                if a > 128 and r > 128:
                    mask_pixels[x, y] = 255

        # Apply slight blur for smoother edges
        mask = mask.filter(ImageFilter.GaussianBlur(radius=2))

        return mask

    def inpaint(
        self,
        image: Image.Image,
        mask: Image.Image,
        prompt: str,
        negative_prompt: str = "",
        strength: float = 0.85,
        guidance_scale: float = 7.5,
        num_inference_steps: int = 30,
        seed: Optional[int] = None,
    ) -> List[bytes]:
        """
        Execute inpainting.

        Args:
            image: Original image (RGB)
            mask: Mask image (white=edit area, black=keep area)
            prompt: Description of what to generate in masked area
            negative_prompt: What to avoid
            strength: Edit strength (0.0~1.0)
            guidance_scale: Guidance scale
            num_inference_steps: Number of denoising steps
            seed: Random seed for reproducibility

        Returns:
            List of image bytes in PNG format
        """
        if not self._is_loaded:
            self.load()

        # Ensure image is RGB
        if image.mode != 'RGB':
            image = image.convert('RGB')

        # Ensure mask is grayscale
        if mask.mode != 'L':
            mask = mask.convert('L')

        # Resize mask to match image if needed
        if mask.size != image.size:
            mask = mask.resize(image.size, Image.Resampling.LANCZOS)

        # Ensure dimensions are divisible by 8
        width, height = image.size
        width = (width // 8) * 8
        height = (height // 8) * 8

        if (width, height) != image.size:
            image = image.resize((width, height), Image.Resampling.LANCZOS)
            mask = mask.resize((width, height), Image.Resampling.LANCZOS)

        logger.info(f"Inpainting: {prompt[:50]}...")
        logger.info(f"Size: {width}x{height}, Steps: {num_inference_steps}, Strength: {strength}")

        # Set up generator for reproducibility
        generator = None
        if seed is not None:
            generator = torch.Generator(device="cpu").manual_seed(seed)
            logger.info(f"Using seed: {seed}")

        try:
            with torch.inference_mode():
                result = self._pipeline(
                    prompt=prompt,
                    negative_prompt=negative_prompt if negative_prompt else None,
                    image=image,
                    mask_image=mask,
                    strength=strength,
                    guidance_scale=guidance_scale,
                    num_inference_steps=num_inference_steps,
                    generator=generator,
                )

            # Convert PIL images to bytes
            images_bytes = []
            for img in result.images:
                buffer = io.BytesIO()
                img.save(buffer, format="PNG", optimize=True)
                images_bytes.append(buffer.getvalue())

            logger.info(f"Inpainting completed successfully")
            return images_bytes

        except Exception as e:
            logger.error(f"Inpainting failed: {e}")
            raise

    def cleanup(self):
        """Clean up GPU memory"""
        if torch.cuda.is_available():
            torch.cuda.empty_cache()
            logger.info("GPU memory cache cleared")


# Singleton accessor
_inpaint_pipeline_instance: Optional[InpaintPipeline] = None


def get_inpaint_pipeline() -> InpaintPipeline:
    """Get the singleton inpaint pipeline instance"""
    global _inpaint_pipeline_instance
    if _inpaint_pipeline_instance is None:
        _inpaint_pipeline_instance = InpaintPipeline()
    return _inpaint_pipeline_instance
