from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import logging

from app.config import settings
from app.db.session import engine, Base
from app.api import auth, users

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler"""
    # Startup
    logger.info("Starting Auth Service...")

    # Create tables (for development)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    logger.info("Auth Service started successfully")

    yield

    # Shutdown
    logger.info("Shutting down Auth Service...")
    await engine.dispose()
    logger.info("Auth Service shutdown complete")


# Create FastAPI app
app = FastAPI(
    title="Z-Image Auth Service",
    description="Authentication and Authorization Service",
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
app.include_router(auth.router, prefix="/api/v1/auth", tags=["auth"])
app.include_router(users.router, prefix="/api/v1/users", tags=["users"])


# Health check endpoint
@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "service": "auth-service"}


# Root endpoint
@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "service": "Z-Image Auth Service",
        "version": "1.0.0",
    }
