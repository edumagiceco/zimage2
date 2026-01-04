"""GPU monitoring module for ML Worker"""

import json
import subprocess
import redis
import logging
from typing import Optional, Dict, Any
from threading import Thread
import time

from app.config import settings

logger = logging.getLogger(__name__)

# Redis connection for GPU stats
redis_client = redis.Redis.from_url(settings.CELERY_BROKER_URL.replace("/3", "/5"))

GPU_STATS_KEY = "ml_worker:gpu_stats"
GPU_STATS_TTL = 30  # Refresh every 30 seconds


def get_gpu_info() -> Dict[str, Any]:
    """Get GPU information using nvidia-smi"""
    try:
        # Query GPU info using nvidia-smi
        result = subprocess.run(
            [
                "nvidia-smi",
                "--query-gpu=name,memory.used,memory.total,memory.free,utilization.gpu,temperature.gpu,power.draw,power.limit",
                "--format=csv,noheader,nounits"
            ],
            capture_output=True,
            text=True,
            timeout=10
        )

        if result.returncode != 0:
            logger.warning(f"nvidia-smi failed: {result.stderr}")
            return {"error": "nvidia-smi failed", "available": False}

        lines = result.stdout.strip().split("\n")
        gpus = []

        for idx, line in enumerate(lines):
            parts = [p.strip() for p in line.split(",")]
            if len(parts) >= 8:
                gpu_info = {
                    "id": idx,
                    "name": parts[0],
                    "memory_used_mb": float(parts[1]),
                    "memory_total_mb": float(parts[2]),
                    "memory_free_mb": float(parts[3]),
                    "memory_used_gb": round(float(parts[1]) / 1024, 2),
                    "memory_total_gb": round(float(parts[2]) / 1024, 2),
                    "memory_free_gb": round(float(parts[3]) / 1024, 2),
                    "memory_percent": round(float(parts[1]) / float(parts[2]) * 100, 1) if float(parts[2]) > 0 else 0,
                    "utilization_percent": float(parts[4]) if parts[4] != "[N/A]" else 0,
                    "temperature_c": float(parts[5]) if parts[5] != "[N/A]" else 0,
                    "power_draw_w": float(parts[6]) if parts[6] != "[N/A]" else 0,
                    "power_limit_w": float(parts[7]) if parts[7] != "[N/A]" else 0,
                }
                gpus.append(gpu_info)

        return {
            "available": True,
            "gpu_count": len(gpus),
            "gpus": gpus,
            "primary_gpu": gpus[0] if gpus else None,
            "timestamp": time.time(),
        }

    except FileNotFoundError:
        logger.warning("nvidia-smi not found")
        return {"error": "nvidia-smi not found", "available": False}
    except subprocess.TimeoutExpired:
        logger.warning("nvidia-smi timeout")
        return {"error": "nvidia-smi timeout", "available": False}
    except Exception as e:
        logger.error(f"Error getting GPU info: {e}")
        return {"error": str(e), "available": False}


def update_gpu_stats():
    """Update GPU stats in Redis"""
    try:
        gpu_info = get_gpu_info()
        redis_client.setex(
            GPU_STATS_KEY,
            GPU_STATS_TTL,
            json.dumps(gpu_info)
        )
        logger.debug(f"Updated GPU stats: {gpu_info}")
    except Exception as e:
        logger.error(f"Failed to update GPU stats: {e}")


def start_gpu_monitor():
    """Start background thread to monitor GPU"""
    def monitor_loop():
        logger.info("Starting GPU monitor thread")
        while True:
            update_gpu_stats()
            time.sleep(10)  # Update every 10 seconds

    thread = Thread(target=monitor_loop, daemon=True)
    thread.start()
    logger.info("GPU monitor thread started")


def get_cached_gpu_stats() -> Optional[Dict[str, Any]]:
    """Get cached GPU stats from Redis"""
    try:
        data = redis_client.get(GPU_STATS_KEY)
        if data:
            return json.loads(data)
        return None
    except Exception as e:
        logger.error(f"Failed to get cached GPU stats: {e}")
        return None
