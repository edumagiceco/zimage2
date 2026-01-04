from celery import Celery

from app.config import settings

# Create Celery app
celery_app = Celery(
    "ml_worker",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
    include=["app.tasks.image_generation"],
)

# Celery configuration
celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_time_limit=300,  # 5 minutes max
    task_soft_time_limit=240,  # 4 minutes soft limit
    worker_prefetch_multiplier=1,  # Process one task at a time
    task_acks_late=True,
    task_reject_on_worker_lost=True,
    result_expires=3600,  # Results expire after 1 hour
)

# Task routes
celery_app.conf.task_routes = {
    "generate_image": {"queue": "image_generation"},
}
