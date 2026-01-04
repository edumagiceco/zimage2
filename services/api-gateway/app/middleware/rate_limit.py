from fastapi import Request, HTTPException
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response
import time
from collections import defaultdict
import asyncio

from app.config import settings


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Simple in-memory rate limiting middleware"""

    def __init__(self, app):
        super().__init__(app)
        self.rate_limit = settings.RATE_LIMIT_PER_MINUTE
        self.window = 60  # 1 minute window
        self.requests = defaultdict(list)
        self.lock = asyncio.Lock()

    def _get_client_ip(self, request: Request) -> str:
        """Get client IP from request"""
        forwarded = request.headers.get("X-Forwarded-For")
        if forwarded:
            return forwarded.split(",")[0].strip()
        return request.client.host if request.client else "unknown"

    async def _is_rate_limited(self, client_ip: str) -> bool:
        """Check if client is rate limited"""
        async with self.lock:
            now = time.time()
            window_start = now - self.window

            # Clean old requests
            self.requests[client_ip] = [
                req_time
                for req_time in self.requests[client_ip]
                if req_time > window_start
            ]

            # Check rate limit
            if len(self.requests[client_ip]) >= self.rate_limit:
                return True

            # Add current request
            self.requests[client_ip].append(now)
            return False

    async def dispatch(self, request: Request, call_next) -> Response:
        # Skip rate limiting for health checks
        if request.url.path in ["/health", "/"]:
            return await call_next(request)

        client_ip = self._get_client_ip(request)

        if await self._is_rate_limited(client_ip):
            raise HTTPException(
                status_code=429,
                detail="Rate limit exceeded. Please try again later.",
            )

        response = await call_next(request)

        # Add rate limit headers
        async with self.lock:
            remaining = max(0, self.rate_limit - len(self.requests[client_ip]))

        response.headers["X-RateLimit-Limit"] = str(self.rate_limit)
        response.headers["X-RateLimit-Remaining"] = str(remaining)
        response.headers["X-RateLimit-Reset"] = str(int(time.time()) + self.window)

        return response
