from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from datetime import datetime, timedelta, timezone
import redis
import json
import logging

from app.db.session import get_db
from app.models.image import Image
from app.models.task import GenerationTask
from app.config import settings

logger = logging.getLogger(__name__)
router = APIRouter()

# Redis connection for GPU stats (DB 5 where ml-worker stores stats)
redis_client = redis.Redis.from_url(settings.REDIS_URL.replace("/2", "/5"))
GPU_STATS_KEY = "ml_worker:gpu_stats"

# Korea Standard Time
KST = timezone(timedelta(hours=9))


@router.get("/")
async def get_stats(db: AsyncSession = Depends(get_db)):
    """Get image generation statistics"""

    # Total images
    total_result = await db.execute(select(func.count(Image.id)))
    total_images = total_result.scalar() or 0

    # Use UTC for database queries (timezone-naive)
    now_utc = datetime.utcnow()
    today_start_utc = now_utc.replace(hour=0, minute=0, second=0, microsecond=0)

    # Today's images
    today_result = await db.execute(
        select(func.count(Image.id)).where(Image.created_at >= today_start_utc)
    )
    today_images = today_result.scalar() or 0

    # This week's images
    week_start_utc = today_start_utc - timedelta(days=today_start_utc.weekday())
    week_result = await db.execute(
        select(func.count(Image.id)).where(Image.created_at >= week_start_utc)
    )
    week_images = week_result.scalar() or 0

    # This month's images
    month_start_utc = today_start_utc.replace(day=1)
    month_result = await db.execute(
        select(func.count(Image.id)).where(Image.created_at >= month_start_utc)
    )
    month_images = month_result.scalar() or 0

    # Total tasks
    tasks_result = await db.execute(select(func.count(GenerationTask.id)))
    total_tasks = tasks_result.scalar() or 0

    # Average images per day (last 30 days)
    thirty_days_ago = today_start_utc - timedelta(days=30)
    last_30_result = await db.execute(
        select(func.count(Image.id)).where(Image.created_at >= thirty_days_ago)
    )
    last_30_images = last_30_result.scalar() or 0
    avg_per_day = round(last_30_images / 30, 1)

    return {
        "total_images": total_images,
        "today_images": today_images,
        "week_images": week_images,
        "month_images": month_images,
        "total_tasks": total_tasks,
        "avg_images_per_day": avg_per_day,
        "generated_at": datetime.now(KST).isoformat(),
    }


@router.get("/ml/status")
async def get_ml_status():
    """Get ML worker status with GPU info from Redis"""
    # Get GPU stats from Redis (updated by ml-worker)
    gpu_info = None
    try:
        gpu_data = redis_client.get(GPU_STATS_KEY)
        if gpu_data:
            gpu_info = json.loads(gpu_data)
            logger.debug(f"Got GPU stats from Redis: {gpu_info}")
    except Exception as e:
        logger.warning(f"Failed to get GPU stats from Redis: {e}")

    # Build response
    response = {
        "status": "ready",
        "model": {
            "name": "Z-Image-Turbo",
            "type": "SDXL-Turbo",
            "loaded": True,
        },
        "gpu": None,
    }

    if gpu_info and gpu_info.get("available") and gpu_info.get("primary_gpu"):
        primary_gpu = gpu_info["primary_gpu"]
        response["gpu"] = {
            "name": primary_gpu.get("name", "NVIDIA GPU"),
            "memory_used_gb": primary_gpu.get("memory_used_gb", 0),
            "memory_total_gb": primary_gpu.get("memory_total_gb", 0),
            "memory_free_gb": primary_gpu.get("memory_free_gb", 0),
            "memory_percent": primary_gpu.get("memory_percent", 0),
            "utilization_percent": primary_gpu.get("utilization_percent", 0),
            "temperature_c": primary_gpu.get("temperature_c", 0),
            "power_draw_w": primary_gpu.get("power_draw_w", 0),
            "power_limit_w": primary_gpu.get("power_limit_w", 0),
        }
        response["gpu_count"] = gpu_info.get("gpu_count", 1)
    else:
        response["gpu"] = {
            "name": "NVIDIA GPU",
            "memory_used_gb": 0,
            "memory_total_gb": 0,
            "memory_free_gb": 0,
            "memory_percent": 0,
            "utilization_percent": 0,
            "temperature_c": 0,
            "power_draw_w": 0,
            "power_limit_w": 0,
        }

    return response
