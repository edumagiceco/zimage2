# Tasks package
from app.tasks.image_generation import generate_image
from app.tasks.inpainting import inpaint_image
from app.tasks.sam_segmentation import segment_point, segment_box, segment_auto
from app.tasks.background_removal import (
    remove_background,
    replace_background,
    replace_background_color,
    get_background_mask,
)
from app.tasks.style_transfer import apply_style, list_styles

__all__ = [
    "generate_image",
    "inpaint_image",
    "segment_point",
    "segment_box",
    "segment_auto",
    "remove_background",
    "replace_background",
    "replace_background_color",
    "get_background_mask",
    "apply_style",
    "list_styles",
]
