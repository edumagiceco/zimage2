from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
import httpx
import logging

from app.config import settings
from app.middleware.rate_limit import RateLimitMiddleware
from app.middleware.auth import AuthMiddleware
from app.routes import proxy

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# HTTP Client
http_client: httpx.AsyncClient = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler"""
    global http_client

    # Startup
    logger.info("Starting API Gateway...")
    http_client = httpx.AsyncClient(timeout=30.0)
    app.state.http_client = http_client
    logger.info("API Gateway started successfully")

    yield

    # Shutdown
    logger.info("Shutting down API Gateway...")
    await http_client.aclose()
    logger.info("API Gateway shutdown complete")


# Create FastAPI app
app = FastAPI(
    title="Z-Image API Gateway",
    description="API Gateway for Z-Image Platform",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs" if settings.DEBUG else None,
    redoc_url="/redoc" if settings.DEBUG else None,
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Rate Limiting Middleware
app.add_middleware(RateLimitMiddleware)

# Include routers
app.include_router(proxy.router, prefix="/v1")


# Health check endpoint
@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "service": "api-gateway"}


# Root endpoint
@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "service": "Z-Image API Gateway",
        "version": "1.0.0",
        "docs": "/docs" if settings.DEBUG else None,
    }


# Global exception handler
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled exception: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"},
    )


# HTTP exception handler
@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail},
    )
