from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    """Image Service Configuration"""

    # Environment
    ENV: str = "development"
    DEBUG: bool = True

    # Database
    DATABASE_URL: str = "postgresql+asyncpg://zimage:zimage_secret@postgres:5432/zimage"

    # Redis
    REDIS_URL: str = "redis://redis:6379/2"

    # Celery
    CELERY_BROKER_URL: str = "redis://redis:6379/3"
    CELERY_RESULT_BACKEND: str = "redis://redis:6379/4"

    # MinIO
    MINIO_ENDPOINT: str = "minio:9000"
    MINIO_ACCESS_KEY: str = "minioadmin"
    MINIO_SECRET_KEY: str = "minioadmin123"
    MINIO_BUCKET: str = "zimage-images"
    MINIO_USE_SSL: bool = False

    # Image Generation Defaults
    DEFAULT_WIDTH: int = 1024
    DEFAULT_HEIGHT: int = 1024
    DEFAULT_NUM_IMAGES: int = 1
    MAX_NUM_IMAGES: int = 4
    DEFAULT_INFERENCE_STEPS: int = 8
    DEFAULT_GUIDANCE_SCALE: float = 3.5

    class Config:
        env_file = ".env"
        extra = "ignore"


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
