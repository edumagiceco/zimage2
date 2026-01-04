from fastapi import APIRouter, Request, HTTPException
from fastapi.responses import StreamingResponse
import httpx
import logging

from app.config import settings

logger = logging.getLogger(__name__)

router = APIRouter()

# Service routing map
SERVICE_ROUTES = {
    "/auth": settings.AUTH_SERVICE_URL,
    "/images": settings.IMAGE_SERVICE_URL,
    "/tasks": settings.IMAGE_SERVICE_URL,
    "/gallery": settings.IMAGE_SERVICE_URL,  # Gallery is now in image-service
    "/folders": settings.GALLERY_SERVICE_URL,
    "/tags": settings.GALLERY_SERVICE_URL,
    "/templates": settings.GALLERY_SERVICE_URL,
}


async def proxy_request(
    request: Request,
    target_url: str,
    path: str,
) -> StreamingResponse:
    """Proxy request to target service"""
    http_client: httpx.AsyncClient = request.app.state.http_client

    # Build target URL
    url = f"{target_url}/api/v1{path}"

    # Forward headers (excluding host)
    headers = dict(request.headers)
    headers.pop("host", None)

    # Add user info if authenticated
    if hasattr(request.state, "user_id"):
        headers["X-User-ID"] = request.state.user_id
        headers["X-User-Role"] = getattr(request.state, "user_role", "user")

    try:
        # Make proxied request
        response = await http_client.request(
            method=request.method,
            url=url,
            headers=headers,
            params=request.query_params,
            content=await request.body() if request.method in ["POST", "PUT", "PATCH"] else None,
        )

        # Return streaming response
        return StreamingResponse(
            content=response.iter_bytes(),
            status_code=response.status_code,
            headers=dict(response.headers),
            media_type=response.headers.get("content-type"),
        )

    except httpx.ConnectError:
        logger.error(f"Failed to connect to service: {target_url}")
        raise HTTPException(status_code=503, detail="Service unavailable")
    except httpx.TimeoutException:
        logger.error(f"Request timeout to service: {target_url}")
        raise HTTPException(status_code=504, detail="Service timeout")
    except Exception as e:
        logger.error(f"Proxy error: {e}")
        raise HTTPException(status_code=500, detail="Internal proxy error")


def get_target_service(path: str) -> tuple[str, str]:
    """Get target service URL and remaining path"""
    for prefix, url in SERVICE_ROUTES.items():
        if path.startswith(prefix):
            return url, path
    raise HTTPException(status_code=404, detail="Route not found")


# Auth routes
@router.api_route("/auth/{path:path}", methods=["GET", "POST", "PUT", "DELETE"])
async def proxy_auth(request: Request, path: str):
    return await proxy_request(request, settings.AUTH_SERVICE_URL, f"/auth/{path}")


# Image generation routes
@router.api_route("/images/{path:path}", methods=["GET", "POST", "PUT", "DELETE"])
async def proxy_images(request: Request, path: str):
    return await proxy_request(request, settings.IMAGE_SERVICE_URL, f"/images/{path}")


@router.api_route("/tasks/{path:path}", methods=["GET"])
async def proxy_tasks(request: Request, path: str):
    return await proxy_request(request, settings.IMAGE_SERVICE_URL, f"/tasks/{path}")


# Gallery routes (now served by image-service)
@router.api_route("/gallery/{path:path}", methods=["GET", "POST", "PUT", "DELETE"])
async def proxy_gallery(request: Request, path: str):
    return await proxy_request(request, settings.IMAGE_SERVICE_URL, f"/gallery/{path}")


@router.api_route("/folders/{path:path}", methods=["GET", "POST", "PUT", "DELETE"])
async def proxy_folders(request: Request, path: str):
    return await proxy_request(request, settings.GALLERY_SERVICE_URL, f"/folders/{path}")


@router.api_route("/tags/{path:path}", methods=["GET", "POST", "PUT", "DELETE"])
async def proxy_tags(request: Request, path: str):
    return await proxy_request(request, settings.GALLERY_SERVICE_URL, f"/tags/{path}")


@router.api_route("/templates/{path:path}", methods=["GET", "POST", "PUT", "DELETE"])
async def proxy_templates(request: Request, path: str):
    return await proxy_request(request, settings.GALLERY_SERVICE_URL, f"/templates/{path}")
