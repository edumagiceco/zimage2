"""
Segment Anything Model (SAM) Pipeline for automatic object selection.
"""
import io
import logging
import os
from typing import List, Tuple, Optional
import numpy as np
import torch
from PIL import Image

logger = logging.getLogger(__name__)

# SAM model paths
SAM_MODEL_PATH = os.getenv("SAM_MODEL_PATH", "/models/sam")
SAM_CHECKPOINT = os.path.join(SAM_MODEL_PATH, "sam_vit_b_01ec64.pth")


class SAMPipeline:
    """Segment Anything Model pipeline for automatic object selection."""

    _instance = None
    _is_loaded = False

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def __init__(self):
        self._sam = None
        self._predictor = None
        self._device = None

    def _load_model(self):
        """Load SAM model lazily."""
        if self._is_loaded:
            return

        try:
            from segment_anything import sam_model_registry, SamPredictor

            self._device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
            logger.info(f"Loading SAM model on {self._device}...")

            # Check if checkpoint exists, download if not
            if not os.path.exists(SAM_CHECKPOINT):
                logger.info("SAM checkpoint not found, downloading...")
                self._download_checkpoint()

            # Load SAM model (vit_b is smaller and faster)
            self._sam = sam_model_registry["vit_b"](checkpoint=SAM_CHECKPOINT)
            self._sam.to(self._device)
            self._predictor = SamPredictor(self._sam)

            self._is_loaded = True
            logger.info("SAM model loaded successfully")

        except Exception as e:
            logger.error(f"Failed to load SAM model: {e}")
            raise

    def _download_checkpoint(self):
        """Download SAM checkpoint if not exists."""
        import urllib.request

        os.makedirs(SAM_MODEL_PATH, exist_ok=True)
        url = "https://dl.fbaipublicfiles.com/segment_anything/sam_vit_b_01ec64.pth"

        logger.info(f"Downloading SAM checkpoint from {url}...")
        urllib.request.urlretrieve(url, SAM_CHECKPOINT)
        logger.info("SAM checkpoint downloaded successfully")

    def segment_point(
        self,
        image: Image.Image,
        point_coords: List[Tuple[int, int]],
        point_labels: List[int],
    ) -> bytes:
        """
        Segment object at given point coordinates.

        Args:
            image: PIL Image
            point_coords: List of (x, y) coordinates
            point_labels: List of labels (1 for foreground, 0 for background)

        Returns:
            PNG bytes of mask image (red overlay)
        """
        self._load_model()

        # Convert PIL to numpy
        image_np = np.array(image.convert("RGB"))

        # Set image for predictor
        self._predictor.set_image(image_np)

        # Convert points
        input_points = np.array(point_coords)
        input_labels = np.array(point_labels)

        # Predict masks
        masks, scores, logits = self._predictor.predict(
            point_coords=input_points,
            point_labels=input_labels,
            multimask_output=True,
        )

        # Select best mask (highest score)
        best_mask_idx = np.argmax(scores)
        mask = masks[best_mask_idx]

        # Convert to red overlay mask
        mask_image = self._mask_to_overlay(mask, image.size)

        # Save to bytes
        buffer = io.BytesIO()
        mask_image.save(buffer, format="PNG")
        return buffer.getvalue()

    def segment_box(
        self,
        image: Image.Image,
        box: Tuple[int, int, int, int],
    ) -> bytes:
        """
        Segment object within bounding box.

        Args:
            image: PIL Image
            box: (x1, y1, x2, y2) bounding box

        Returns:
            PNG bytes of mask image (red overlay)
        """
        self._load_model()

        # Convert PIL to numpy
        image_np = np.array(image.convert("RGB"))

        # Set image for predictor
        self._predictor.set_image(image_np)

        # Predict mask from box
        input_box = np.array(box)
        masks, scores, logits = self._predictor.predict(
            box=input_box,
            multimask_output=True,
        )

        # Select best mask
        best_mask_idx = np.argmax(scores)
        mask = masks[best_mask_idx]

        # Convert to red overlay mask
        mask_image = self._mask_to_overlay(mask, image.size)

        buffer = io.BytesIO()
        mask_image.save(buffer, format="PNG")
        return buffer.getvalue()

    def segment_auto(
        self,
        image: Image.Image,
        points_per_side: int = 32,
        pred_iou_thresh: float = 0.88,
        stability_score_thresh: float = 0.95,
    ) -> List[bytes]:
        """
        Automatically segment all objects in image.

        Args:
            image: PIL Image
            points_per_side: Points grid size
            pred_iou_thresh: IoU threshold
            stability_score_thresh: Stability threshold

        Returns:
            List of PNG bytes for each mask
        """
        self._load_model()

        from segment_anything import SamAutomaticMaskGenerator

        mask_generator = SamAutomaticMaskGenerator(
            model=self._sam,
            points_per_side=points_per_side,
            pred_iou_thresh=pred_iou_thresh,
            stability_score_thresh=stability_score_thresh,
            min_mask_region_area=100,
        )

        # Convert PIL to numpy
        image_np = np.array(image.convert("RGB"))

        # Generate all masks
        masks = mask_generator.generate(image_np)

        # Sort by area (largest first)
        masks = sorted(masks, key=lambda x: x["area"], reverse=True)

        # Convert to overlay images
        result = []
        for mask_data in masks[:10]:  # Limit to top 10 masks
            mask = mask_data["segmentation"]
            mask_image = self._mask_to_overlay(mask, image.size)

            buffer = io.BytesIO()
            mask_image.save(buffer, format="PNG")
            result.append(buffer.getvalue())

        return result

    def _mask_to_overlay(
        self,
        mask: np.ndarray,
        size: Tuple[int, int],
    ) -> Image.Image:
        """Convert boolean mask to red overlay RGBA image."""
        # Create RGBA image
        overlay = Image.new("RGBA", size, (0, 0, 0, 0))
        pixels = overlay.load()

        for y in range(size[1]):
            for x in range(size[0]):
                if mask[y, x]:
                    pixels[x, y] = (255, 0, 0, 128)  # Red with 50% alpha

        return overlay

    def cleanup(self):
        """Clean up GPU memory."""
        if torch.cuda.is_available():
            torch.cuda.empty_cache()


# Singleton instance
_sam_pipeline: Optional[SAMPipeline] = None


def get_sam_pipeline() -> SAMPipeline:
    """Get SAM pipeline singleton."""
    global _sam_pipeline
    if _sam_pipeline is None:
        _sam_pipeline = SAMPipeline()
    return _sam_pipeline
