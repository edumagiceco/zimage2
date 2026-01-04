from fastapi import Request, HTTPException
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response
from jose import JWTError, jwt
import logging

from app.config import settings

logger = logging.getLogger(__name__)

# Paths that don't require authentication
PUBLIC_PATHS = [
    "/",
    "/health",
    "/docs",
    "/redoc",
    "/openapi.json",
    "/v1/auth/login",
    "/v1/auth/register",
    "/v1/auth/refresh",
]


class AuthMiddleware(BaseHTTPMiddleware):
    """JWT Authentication Middleware"""

    async def dispatch(self, request: Request, call_next) -> Response:
        # Skip auth for public paths
        path = request.url.path
        if any(path.startswith(p) for p in PUBLIC_PATHS):
            return await call_next(request)

        # Get token from header
        auth_header = request.headers.get("Authorization")
        if not auth_header or not auth_header.startswith("Bearer "):
            raise HTTPException(
                status_code=401,
                detail="Missing or invalid authorization header",
            )

        token = auth_header.split(" ")[1]

        try:
            # Decode JWT
            payload = jwt.decode(
                token,
                settings.JWT_SECRET,
                algorithms=[settings.JWT_ALGORITHM],
            )

            # Add user info to request state
            request.state.user_id = payload.get("sub")
            request.state.user_role = payload.get("role", "user")

        except JWTError as e:
            logger.warning(f"JWT validation failed: {e}")
            raise HTTPException(
                status_code=401,
                detail="Invalid or expired token",
            )

        return await call_next(request)


def get_current_user_id(request: Request) -> str:
    """Dependency to get current user ID from request state"""
    user_id = getattr(request.state, "user_id", None)
    if not user_id:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user_id


def require_admin(request: Request) -> str:
    """Dependency to require admin role"""
    user_id = get_current_user_id(request)
    user_role = getattr(request.state, "user_role", "user")
    if user_role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user_id
