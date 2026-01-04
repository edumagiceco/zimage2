"""
Background removal and replacement pipeline using rembg.
"""
import io
import logging
from typing import Optional, Tuple
import torch
from PIL import Image
from rembg import remove, new_session

logger = logging.getLogger(__name__)


class BackgroundPipeline:
    """Pipeline for background removal and replacement."""

    _instance = None
    _is_loaded = False

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def __init__(self):
        self._session = None

    def _load_model(self):
        """Load rembg model lazily."""
        if self._is_loaded:
            return

        try:
            logger.info("Loading background removal model...")
            # Use u2net model (good balance of speed and quality)
            self._session = new_session("u2net")
            self._is_loaded = True
            logger.info("Background removal model loaded successfully")

        except Exception as e:
            logger.error(f"Failed to load background removal model: {e}")
            raise

    def remove_background(
        self,
        image: Image.Image,
        alpha_matting: bool = False,
        alpha_matting_foreground_threshold: int = 240,
        alpha_matting_background_threshold: int = 10,
    ) -> bytes:
        """
        Remove background from image.

        Args:
            image: PIL Image
            alpha_matting: Use alpha matting for better edges
            alpha_matting_foreground_threshold: Foreground threshold
            alpha_matting_background_threshold: Background threshold

        Returns:
            PNG bytes with transparent background
        """
        self._load_model()

        logger.info("Removing background...")

        # Remove background
        result = remove(
            image,
            session=self._session,
            alpha_matting=alpha_matting,
            alpha_matting_foreground_threshold=alpha_matting_foreground_threshold,
            alpha_matting_background_threshold=alpha_matting_background_threshold,
        )

        # Save to bytes
        buffer = io.BytesIO()
        result.save(buffer, format="PNG")

        logger.info("Background removed successfully")
        return buffer.getvalue()

    def replace_background(
        self,
        image: Image.Image,
        background: Image.Image,
        alpha_matting: bool = True,
    ) -> bytes:
        """
        Replace background with new image.

        Args:
            image: PIL Image (foreground)
            background: PIL Image (new background)
            alpha_matting: Use alpha matting for better edges

        Returns:
            PNG bytes with new background
        """
        self._load_model()

        logger.info("Replacing background...")

        # Remove background
        foreground = remove(
            image,
            session=self._session,
            alpha_matting=alpha_matting,
        )

        # Resize background to match foreground
        background = background.convert("RGBA")
        background = background.resize(foreground.size, Image.LANCZOS)

        # Composite foreground over background
        result = Image.alpha_composite(background, foreground)

        # Save to bytes
        buffer = io.BytesIO()
        result.save(buffer, format="PNG")

        logger.info("Background replaced successfully")
        return buffer.getvalue()

    def replace_with_color(
        self,
        image: Image.Image,
        color: Tuple[int, int, int],
        alpha_matting: bool = True,
    ) -> bytes:
        """
        Replace background with solid color.

        Args:
            image: PIL Image
            color: RGB tuple (r, g, b)
            alpha_matting: Use alpha matting for better edges

        Returns:
            PNG bytes with solid color background
        """
        self._load_model()

        logger.info(f"Replacing background with color {color}...")

        # Remove background
        foreground = remove(
            image,
            session=self._session,
            alpha_matting=alpha_matting,
        )

        # Create solid color background
        background = Image.new("RGBA", foreground.size, (*color, 255))

        # Composite
        result = Image.alpha_composite(background, foreground)

        # Save to bytes
        buffer = io.BytesIO()
        result.save(buffer, format="PNG")

        logger.info("Background replaced with color successfully")
        return buffer.getvalue()

    def get_mask(self, image: Image.Image) -> bytes:
        """
        Get background mask (for use with other tools).

        Args:
            image: PIL Image

        Returns:
            PNG bytes of mask (white foreground, black background)
        """
        self._load_model()

        logger.info("Generating background mask...")

        # Remove background
        result = remove(
            image,
            session=self._session,
            only_mask=True,
        )

        # Convert to grayscale mask
        if result.mode != "L":
            result = result.convert("L")

        # Save to bytes
        buffer = io.BytesIO()
        result.save(buffer, format="PNG")

        logger.info("Background mask generated")
        return buffer.getvalue()

    def get_mask_as_overlay(self, image: Image.Image) -> bytes:
        """
        Get background mask as red overlay (for mask canvas).

        Args:
            image: PIL Image

        Returns:
            PNG bytes of red overlay mask
        """
        self._load_model()

        logger.info("Generating background mask overlay...")

        # Get mask
        mask = remove(
            image,
            session=self._session,
            only_mask=True,
        )

        if mask.mode != "L":
            mask = mask.convert("L")

        # Convert to red overlay
        overlay = Image.new("RGBA", mask.size, (0, 0, 0, 0))
        mask_pixels = mask.load()
        overlay_pixels = overlay.load()

        for y in range(mask.height):
            for x in range(mask.width):
                alpha = mask_pixels[x, y]
                if alpha > 0:
                    overlay_pixels[x, y] = (255, 0, 0, alpha // 2)

        # Save to bytes
        buffer = io.BytesIO()
        overlay.save(buffer, format="PNG")

        logger.info("Background mask overlay generated")
        return buffer.getvalue()

    def cleanup(self):
        """Clean up resources."""
        if torch.cuda.is_available():
            torch.cuda.empty_cache()


# Singleton instance
_bg_pipeline: Optional[BackgroundPipeline] = None


def get_background_pipeline() -> BackgroundPipeline:
    """Get background pipeline singleton."""
    global _bg_pipeline
    if _bg_pipeline is None:
        _bg_pipeline = BackgroundPipeline()
    return _bg_pipeline
