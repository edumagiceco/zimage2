from sqlalchemy import Column, String, Integer, DateTime, Text, Enum
from sqlalchemy.dialects.postgresql import UUID, JSONB
from datetime import datetime
import uuid
import enum

from app.db.session import Base


class TaskStatus(str, enum.Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class GenerationTask(Base):
    """Image Generation Task model"""

    __tablename__ = "generation_tasks"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    celery_task_id = Column(String(255), nullable=True)

    # Task status
    status = Column(Enum(TaskStatus), default=TaskStatus.PENDING, nullable=False)
    error = Column(Text, nullable=True)

    # Generation parameters
    prompt = Column(Text, nullable=False)
    negative_prompt = Column(Text, nullable=True)
    width = Column(Integer, nullable=False)
    height = Column(Integer, nullable=False)
    num_images = Column(Integer, default=1)
    seed = Column(Integer, nullable=True)

    # Result
    result = Column(JSONB, default=dict)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)

    def __repr__(self):
        return f"<GenerationTask {self.id} - {self.status}>"
