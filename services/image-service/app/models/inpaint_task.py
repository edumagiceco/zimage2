from sqlalchemy import Column, String, Integer, DateTime, Text, Enum, Float
from sqlalchemy.dialects.postgresql import UUID, JSONB
from datetime import datetime
import uuid

from app.db.session import Base
from app.models.task import TaskStatus


class InpaintTask(Base):
    """Image Inpainting Task model"""

    __tablename__ = "inpaint_tasks"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    celery_task_id = Column(String(255), nullable=True)

    # Original image reference
    original_image_id = Column(UUID(as_uuid=True), nullable=False, index=True)

    # Task status
    status = Column(Enum(TaskStatus), default=TaskStatus.PENDING, nullable=False)
    error = Column(Text, nullable=True)

    # Inpainting parameters
    prompt = Column(Text, nullable=False)
    negative_prompt = Column(Text, nullable=True)
    strength = Column(Float, default=0.85)
    guidance_scale = Column(Float, default=7.5)
    num_inference_steps = Column(Integer, default=30)
    seed = Column(Integer, nullable=True)

    # Mask storage path in MinIO
    mask_object_name = Column(String(500), nullable=True)

    # Result (JSONB for multiple images)
    result = Column(JSONB, default=list)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)

    def __repr__(self):
        return f"<InpaintTask {self.id} - {self.status}>"
