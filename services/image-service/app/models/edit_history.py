from sqlalchemy import Column, String, Integer, DateTime, Text, Float, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB
from datetime import datetime
import uuid

from app.db.session import Base


class EditHistory(Base):
    """Edit History model - tracks image editing operations"""

    __tablename__ = "edit_history"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), nullable=False, index=True)

    # Image references
    original_image_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    edited_image_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    inpaint_task_id = Column(UUID(as_uuid=True), ForeignKey("inpaint_tasks.id"), nullable=True)

    # Edit parameters (for replay/reference)
    edit_type = Column(String(50), default="inpaint", nullable=False)  # inpaint, filter, etc.
    prompt = Column(Text, nullable=True)
    negative_prompt = Column(Text, nullable=True)
    strength = Column(Float, nullable=True)

    # Mask storage reference
    mask_object_name = Column(String(500), nullable=True)

    # Thumbnail URLs for quick preview
    original_thumbnail_url = Column(String(500), nullable=True)
    edited_thumbnail_url = Column(String(500), nullable=True)

    # Metadata
    edit_metadata = Column(JSONB, default=dict)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    def __repr__(self):
        return f"<EditHistory {self.id} - {self.edit_type}>"
