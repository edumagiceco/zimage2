from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import logging

from app.config import settings
from app.db.session import engine, Base
from app.api import gallery, folders, tags, templates

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler"""
    # Startup
    logger.info("Starting Gallery Service...")

    # Create tables (for development)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    logger.info("Gallery Service started successfully")

    yield

    # Shutdown
    logger.info("Shutting down Gallery Service...")
    await engine.dispose()
    logger.info("Gallery Service shutdown complete")


# Create FastAPI app
app = FastAPI(
    title="Z-Image Gallery Service",
    description="Gallery and Asset Management Service",
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
app.include_router(gallery.router, prefix="/api/v1/gallery", tags=["gallery"])
app.include_router(folders.router, prefix="/api/v1/folders", tags=["folders"])
app.include_router(tags.router, prefix="/api/v1/tags", tags=["tags"])
app.include_router(templates.router, prefix="/api/v1/templates", tags=["templates"])


# Health check endpoint
@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "service": "gallery-service"}


# Root endpoint
@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "service": "Z-Image Gallery Service",
        "version": "1.0.0",
    }
