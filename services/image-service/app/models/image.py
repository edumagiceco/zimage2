from sqlalchemy import Column, String, Integer, Boolean, DateTime, Text, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB
from datetime import datetime
import uuid

from app.db.session import Base


class Image(Base):
    """Generated Image model"""

    __tablename__ = "images"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    task_id = Column(UUID(as_uuid=True), ForeignKey("generation_tasks.id"), nullable=True)

    # Image data
    url = Column(String(500), nullable=False)
    thumbnail_url = Column(String(500), nullable=True)
    object_name = Column(String(255), nullable=False)

    # Generation parameters
    prompt = Column(Text, nullable=False)
    negative_prompt = Column(Text, nullable=True)
    width = Column(Integer, nullable=False)
    height = Column(Integer, nullable=False)
    seed = Column(Integer, nullable=True)

    # Metadata
    is_favorite = Column(Boolean, default=False)
    folder_id = Column(UUID(as_uuid=True), nullable=True)
    image_metadata = Column(JSONB, default=dict)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    def __repr__(self):
        return f"<Image {self.id}>"
