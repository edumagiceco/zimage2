from pydantic import BaseModel
from typing import Optional, List
from uuid import UUID
from datetime import datetime

from app.schemas.image import ImageResponse


class GeneratedImageInfo(BaseModel):
    """Schema for generated image info in task result"""

    id: UUID
    url: str
    thumbnail_url: Optional[str] = None
    width: int
    height: int
    seed: Optional[int] = None


class TaskStatusResponse(BaseModel):
    """Schema for task status response"""

    task_id: UUID
    status: str  # pending, processing, completed, failed
    images: List[GeneratedImageInfo] = []
    error: Optional[str] = None
    created_at: datetime
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None

    # Progress tracking
    progress: Optional[int] = None  # 0-100
    progress_message: Optional[str] = None
    estimated_seconds: Optional[float] = None
    elapsed_seconds: Optional[float] = None

    class Config:
        from_attributes = True
