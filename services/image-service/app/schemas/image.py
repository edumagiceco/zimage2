from pydantic import BaseModel, Field
from typing import Optional
from uuid import UUID
from datetime import datetime


class ImageGenerateRequest(BaseModel):
    """Request schema for image generation"""

    prompt: str = Field(..., min_length=1, max_length=2000)
    negative_prompt: Optional[str] = Field(None, max_length=1000)
    width: int = Field(default=1024, ge=256, le=2048)
    height: int = Field(default=1024, ge=256, le=2048)
    num_images: int = Field(default=1, ge=1, le=4)
    seed: Optional[int] = Field(None, ge=0)


class ImageGenerateResponse(BaseModel):
    """Response schema for image generation request"""

    task_id: UUID
    status: str
    estimated_time: float


class ImageResponse(BaseModel):
    """Schema for image response"""

    id: UUID
    url: str
    thumbnail_url: Optional[str] = None
    prompt: str
    negative_prompt: Optional[str] = None
    width: int
    height: int
    seed: Optional[int] = None
    is_favorite: bool = False
    created_at: datetime

    class Config:
        from_attributes = True


class ImageListResponse(BaseModel):
    """Schema for image list response"""

    images: list[ImageResponse]
    total: int
    page: int
    limit: int
