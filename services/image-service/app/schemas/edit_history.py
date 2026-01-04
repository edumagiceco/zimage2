from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from uuid import UUID
from datetime import datetime


class EditHistoryItem(BaseModel):
    """Single edit history entry"""
    id: UUID
    user_id: UUID
    original_image_id: UUID
    edited_image_id: UUID
    inpaint_task_id: Optional[UUID] = None
    edit_type: str
    prompt: Optional[str] = None
    negative_prompt: Optional[str] = None
    strength: Optional[float] = None
    original_thumbnail_url: Optional[str] = None
    edited_thumbnail_url: Optional[str] = None
    edit_metadata: Dict[str, Any] = {}
    created_at: datetime

    class Config:
        from_attributes = True


class EditHistoryListResponse(BaseModel):
    """Response for listing edit history"""
    items: List[EditHistoryItem]
    total: int
    page: int
    page_size: int
    has_more: bool


class CreateEditHistoryRequest(BaseModel):
    """Request to create edit history entry (internal use)"""
    original_image_id: UUID
    edited_image_id: UUID
    inpaint_task_id: Optional[UUID] = None
    edit_type: str = "inpaint"
    prompt: Optional[str] = None
    negative_prompt: Optional[str] = None
    strength: Optional[float] = None
    mask_object_name: Optional[str] = None
    original_thumbnail_url: Optional[str] = None
    edited_thumbnail_url: Optional[str] = None
    edit_metadata: Dict[str, Any] = {}
