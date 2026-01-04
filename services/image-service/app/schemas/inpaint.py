from pydantic import BaseModel, Field
from typing import Optional, List
from uuid import UUID
from datetime import datetime


class InpaintRequest(BaseModel):
    """Request schema for image inpainting"""

    original_image_id: UUID = Field(..., description="ID of the original image to edit")
    mask_data: str = Field(..., description="Base64 encoded mask image data")
    prompt: str = Field(..., min_length=1, max_length=2000, description="What to generate in masked area")
    negative_prompt: Optional[str] = Field(None, max_length=1000)
    strength: float = Field(default=0.85, ge=0.0, le=1.0, description="Edit strength")
    guidance_scale: float = Field(default=7.5, ge=1.0, le=20.0)
    num_inference_steps: int = Field(default=30, ge=10, le=100)
    seed: Optional[int] = Field(None, ge=0)


class InpaintResponse(BaseModel):
    """Response schema for inpaint request"""

    task_id: UUID
    status: str
    estimated_time: float


class InpaintImageResult(BaseModel):
    """Schema for individual inpainted image result"""

    id: str
    url: str
    width: int
    height: int
    seed: Optional[int] = None


class InpaintTaskStatusResponse(BaseModel):
    """Response schema for inpaint task status"""

    task_id: UUID
    status: str
    progress: int = 0
    progress_message: Optional[str] = None
    elapsed_seconds: Optional[float] = None
    estimated_seconds: Optional[float] = None
    original_image_url: Optional[str] = None
    images: Optional[List[InpaintImageResult]] = None
    error: Optional[str] = None
    created_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None

    class Config:
        from_attributes = True
