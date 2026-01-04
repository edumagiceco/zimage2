from celery import Celery
from celery.signals import worker_ready

from app.config import settings

# Create Celery app
celery_app = Celery(
    "ml_worker",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
    include=[
        "app.tasks.image_generation",
        "app.tasks.inpainting",
        "app.tasks.sam_segmentation",
        "app.tasks.background_removal",
        "app.tasks.style_transfer",
    ],
)


@worker_ready.connect
def on_worker_ready(**kwargs):
    """Start GPU monitor when worker is ready"""
    from app.gpu_monitor import start_gpu_monitor, update_gpu_stats
    # Initial update
    update_gpu_stats()
    # Start background monitoring
    start_gpu_monitor()

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
    "inpaint_image": {"queue": "image_generation"},
    "segment_point": {"queue": "image_generation"},
    "segment_box": {"queue": "image_generation"},
    "segment_auto": {"queue": "image_generation"},
    "remove_background": {"queue": "image_generation"},
    "replace_background": {"queue": "image_generation"},
    "replace_background_color": {"queue": "image_generation"},
    "get_background_mask": {"queue": "image_generation"},
    "apply_style": {"queue": "image_generation"},
    "list_styles": {"queue": "image_generation"},
}
