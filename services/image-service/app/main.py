from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import logging

from app.config import settings
from app.db.session import engine, Base
from app.api import generate, tasks, gallery

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler"""
    # Startup
    logger.info("Starting Image Service...")

    # Create tables (for development)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    logger.info("Image Service started successfully")

    yield

    # Shutdown
    logger.info("Shutting down Image Service...")
    await engine.dispose()
    logger.info("Image Service shutdown complete")


# Create FastAPI app
app = FastAPI(
    title="Z-Image Image Service",
    description="Image Generation Service",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs" if settings.DEBUG else None,
    redoc_url="/redoc" if settings.DEBUG else None,
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(generate.router, prefix="/api/v1/images", tags=["images"])
app.include_router(tasks.router, prefix="/api/v1/tasks", tags=["tasks"])
app.include_router(gallery.router, prefix="/api/v1/gallery", tags=["gallery"])


# Health check endpoint
@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "service": "image-service"}


# Root endpoint
@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "service": "Z-Image Image Service",
        "version": "1.0.0",
    }
