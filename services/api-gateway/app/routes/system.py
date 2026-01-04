from fastapi import APIRouter, Request
from datetime import datetime, timezone, timedelta
import httpx
import logging
import os

from app.config import settings

logger = logging.getLogger(__name__)

router = APIRouter()

# Korea Standard Time (GMT+9)
KST = timezone(timedelta(hours=9))


@router.get("/stats")
async def get_system_stats(request: Request):
    """Get comprehensive system statistics"""
    http_client: httpx.AsyncClient = request.app.state.http_client

    # Current time in KST
    current_time = datetime.now(KST)

    # Initialize stats
    stats = {
        "timestamp": current_time.isoformat(),
        "timezone": "Asia/Seoul (GMT+9)",
        "services": {},
        "images": {
            "total_count": 0,
            "today_count": 0,
        },
        "storage": {
            "used": "N/A",
            "available": "N/A",
            "total": "N/A",
        },
        "model": {
            "name": "Z-Image-Turbo",
            "type": "Stable Diffusion XL Turbo",
            "version": "1.0",
            "status": "unknown",
        },
        "resources": {
            "cpu_percent": 0,
            "memory_percent": 0,
            "memory_used_gb": 0,
            "memory_total_gb": 0,
            "gpu": None,
        },
    }

    # Check service health
    services_to_check = {
        "api-gateway": f"http://localhost:8000/health",
        "auth-service": f"{settings.AUTH_SERVICE_URL}/health",
        "image-service": f"{settings.IMAGE_SERVICE_URL}/health",
        "gallery-service": f"{settings.GALLERY_SERVICE_URL}/health",
    }

    for service_name, health_url in services_to_check.items():
        try:
            if service_name == "api-gateway":
                stats["services"][service_name] = {"status": "healthy", "latency_ms": 0}
            else:
                start = datetime.now()
                response = await http_client.get(health_url, timeout=5.0)
                latency = (datetime.now() - start).total_seconds() * 1000
                if response.status_code == 200:
                    stats["services"][service_name] = {"status": "healthy", "latency_ms": round(latency, 2)}
                else:
                    stats["services"][service_name] = {"status": "unhealthy", "latency_ms": round(latency, 2)}
        except Exception as e:
            logger.warning(f"Failed to check {service_name} health: {e}")
            stats["services"][service_name] = {"status": "unreachable", "error": str(e)}

    # Get image count from image-service
    try:
        response = await http_client.get(
            f"{settings.IMAGE_SERVICE_URL}/api/v1/stats/",
            timeout=5.0
        )
        if response.status_code == 200:
            image_stats = response.json()
            stats["images"]["total_count"] = image_stats.get("total_images", 0)
            stats["images"]["today_count"] = image_stats.get("today_images", 0)
            stats["images"]["week_count"] = image_stats.get("week_images", 0)
            stats["images"]["month_count"] = image_stats.get("month_images", 0)
    except Exception as e:
        logger.warning(f"Failed to get image stats: {e}")

    # Get ML worker status with GPU info
    try:
        response = await http_client.get(
            f"{settings.IMAGE_SERVICE_URL}/api/v1/stats/ml/status",
            timeout=5.0
        )
        if response.status_code == 200:
            ml_status = response.json()
            stats["model"]["status"] = ml_status.get("status", "unknown")
            stats["model"]["loaded"] = ml_status.get("model", {}).get("loaded", False)
            # Get detailed GPU info
            gpu_data = ml_status.get("gpu")
            if gpu_data and gpu_data.get("memory_total_gb", 0) > 0:
                stats["resources"]["gpu"] = {
                    "name": gpu_data.get("name", "NVIDIA GPU"),
                    "memory_used_gb": gpu_data.get("memory_used_gb", 0),
                    "memory_total_gb": gpu_data.get("memory_total_gb", 0),
                    "memory_free_gb": gpu_data.get("memory_free_gb", 0),
                    "memory_percent": gpu_data.get("memory_percent", 0),
                    "utilization_percent": gpu_data.get("utilization_percent", 0),
                    "temperature_c": gpu_data.get("temperature_c", 0),
                    "power_draw_w": gpu_data.get("power_draw_w", 0),
                    "power_limit_w": gpu_data.get("power_limit_w", 0),
                }
    except Exception as e:
        logger.warning(f"Failed to get ML status: {e}")

    # System resources - using /proc for Linux containers
    try:
        # Read CPU usage from /proc/stat
        with open('/proc/loadavg', 'r') as f:
            load_avg = float(f.read().split()[0])
            # Approximate CPU percent from load average
            cpu_count = os.cpu_count() or 1
            stats["resources"]["cpu_percent"] = round(min(load_avg / cpu_count * 100, 100), 1)

        # Read memory from /proc/meminfo
        with open('/proc/meminfo', 'r') as f:
            meminfo = {}
            for line in f:
                parts = line.split(':')
                if len(parts) == 2:
                    key = parts[0].strip()
                    value = int(parts[1].strip().split()[0])  # Value in KB
                    meminfo[key] = value

            total_mem = meminfo.get('MemTotal', 0) / 1024 / 1024  # GB
            free_mem = meminfo.get('MemAvailable', meminfo.get('MemFree', 0)) / 1024 / 1024  # GB
            used_mem = total_mem - free_mem

            stats["resources"]["memory_total_gb"] = round(total_mem, 2)
            stats["resources"]["memory_used_gb"] = round(used_mem, 2)
            stats["resources"]["memory_percent"] = round((used_mem / total_mem) * 100, 1) if total_mem > 0 else 0

        # Read disk usage from /proc/mounts or df
        statvfs = os.statvfs('/')
        total_disk = statvfs.f_blocks * statvfs.f_frsize / (1024**3)
        free_disk = statvfs.f_bavail * statvfs.f_frsize / (1024**3)
        used_disk = total_disk - free_disk

        stats["storage"]["used"] = f"{used_disk:.1f} GB"
        stats["storage"]["available"] = f"{free_disk:.1f} GB"
        stats["storage"]["total"] = f"{total_disk:.1f} GB"
        stats["storage"]["percent"] = round((used_disk / total_disk) * 100, 1) if total_disk > 0 else 0

    except Exception as e:
        logger.warning(f"Failed to get system resources: {e}")

    return stats


@router.get("/services")
async def get_services_status(request: Request):
    """Get detailed status of all services"""
    http_client: httpx.AsyncClient = request.app.state.http_client

    services = []

    service_configs = [
        {"name": "API Gateway", "id": "api-gateway", "port": 8100, "url": "http://localhost:8000/health"},
        {"name": "Auth Service", "id": "auth-service", "port": 8201, "url": f"{settings.AUTH_SERVICE_URL}/health"},
        {"name": "Image Service", "id": "image-service", "port": 8202, "url": f"{settings.IMAGE_SERVICE_URL}/health"},
        {"name": "Gallery Service", "id": "gallery-service", "port": 8203, "url": f"{settings.GALLERY_SERVICE_URL}/health"},
    ]

    for config in service_configs:
        service_info = {
            "name": config["name"],
            "id": config["id"],
            "port": config["port"],
            "status": "unknown",
            "uptime": "N/A",
        }

        try:
            if config["id"] == "api-gateway":
                service_info["status"] = "running"
            else:
                response = await http_client.get(config["url"], timeout=5.0)
                if response.status_code == 200:
                    service_info["status"] = "running"
                else:
                    service_info["status"] = "unhealthy"
        except Exception:
            service_info["status"] = "stopped"

        services.append(service_info)

    return {"services": services}


@router.get("/config")
async def get_system_config():
    """Get system configuration"""
    return {
        "timezone": "Asia/Seoul (GMT+9)",
        "model": {
            "name": "Z-Image-Turbo",
            "base": "Stable Diffusion XL Turbo",
            "version": "1.0",
            "max_resolution": "2048x2048",
            "supported_formats": ["PNG", "JPEG", "WebP"],
        },
        "limits": {
            "max_images_per_request": 4,
            "max_prompt_length": 2000,
            "rate_limit": "60 requests/minute",
        },
        "storage": {
            "type": "MinIO (S3 Compatible)",
            "bucket": "zimage-images",
        },
        "features": {
            "image_generation": True,
            "gallery": True,
            "templates": True,
            "favorites": True,
        },
    }
