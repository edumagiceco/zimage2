"""
Schemas for Phase 5 advanced image editing features.
"""
from pydantic import BaseModel, Field
from typing import Optional, List, Tuple
from uuid import UUID


# SAM Segmentation Schemas
class SAMPointRequest(BaseModel):
    """Request for SAM point-based segmentation."""
    image_id: UUID = Field(..., description="ID of image to segment")
    point_coords: List[List[int]] = Field(..., description="List of [x, y] coordinates")
    point_labels: List[int] = Field(..., description="List of labels (1=foreground, 0=background)")


class SAMBoxRequest(BaseModel):
    """Request for SAM box-based segmentation."""
    image_id: UUID = Field(..., description="ID of image to segment")
    box: List[int] = Field(..., description="[x1, y1, x2, y2] bounding box")


class SAMAutoRequest(BaseModel):
    """Request for SAM automatic segmentation."""
    image_id: UUID = Field(..., description="ID of image to segment")


class SAMResponse(BaseModel):
    """Response for SAM segmentation."""
    task_id: UUID
    status: str
    estimated_time: float = 5.0


class SAMTaskStatusResponse(BaseModel):
    """Status response for SAM task."""
    task_id: UUID
    status: str
    mask_url: Optional[str] = None
    mask_base64: Optional[str] = None
    masks: Optional[List[dict]] = None
    error: Optional[str] = None


# Background Removal Schemas
class BackgroundRemoveRequest(BaseModel):
    """Request for background removal."""
    image_id: UUID = Field(..., description="ID of image")
    alpha_matting: bool = Field(True, description="Use alpha matting for better edges")


class BackgroundReplaceImageRequest(BaseModel):
    """Request for background replacement with image."""
    image_id: UUID = Field(..., description="ID of foreground image")
    background_image_id: UUID = Field(..., description="ID of new background image")
    alpha_matting: bool = True


class BackgroundReplaceColorRequest(BaseModel):
    """Request for background replacement with solid color."""
    image_id: UUID = Field(..., description="ID of foreground image")
    color: List[int] = Field(..., description="RGB color [r, g, b]")
    alpha_matting: bool = True


class BackgroundMaskRequest(BaseModel):
    """Request for getting foreground mask."""
    image_id: UUID = Field(..., description="ID of image")


class BackgroundResponse(BaseModel):
    """Response for background operations."""
    task_id: UUID
    status: str
    estimated_time: float = 5.0


class BackgroundTaskStatusResponse(BaseModel):
    """Status response for background task."""
    task_id: UUID
    status: str
    image: Optional[dict] = None
    mask_url: Optional[str] = None
    mask_base64: Optional[str] = None
    error: Optional[str] = None


# Style Transfer Schemas
class StyleTransferRequest(BaseModel):
    """Request for style transfer."""
    image_id: UUID = Field(..., description="ID of image to style")
    style: str = Field(..., description="Style preset name")
    prompt: str = Field("", description="Optional additional prompt")
    strength: Optional[float] = Field(None, description="Override style strength (0.0-1.0)")
    seed: Optional[int] = Field(None, description="Random seed for reproducibility")


class StyleTransferResponse(BaseModel):
    """Response for style transfer."""
    task_id: UUID
    status: str
    estimated_time: float = 10.0


class StyleTaskStatusResponse(BaseModel):
    """Status response for style task."""
    task_id: UUID
    status: str
    style: Optional[str] = None
    image: Optional[dict] = None
    error: Optional[str] = None


class StylePreset(BaseModel):
    """Style preset info."""
    id: str
    name: str
    description: str


class StylePresetsResponse(BaseModel):
    """Response with available style presets."""
    styles: List[StylePreset]
