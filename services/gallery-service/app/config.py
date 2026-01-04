from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    """Gallery Service Configuration"""

    # Environment
    ENV: str = "development"
    DEBUG: bool = True

    # Database
    DATABASE_URL: str = "postgresql+asyncpg://zimage:zimage_secret@postgres:5432/zimage"

    # Redis
    REDIS_URL: str = "redis://redis:6379/5"

    # MinIO
    MINIO_ENDPOINT: str = "minio:9000"
    MINIO_ACCESS_KEY: str = "minioadmin"
    MINIO_SECRET_KEY: str = "minioadmin123"
    MINIO_BUCKET: str = "zimage-images"
    MINIO_USE_SSL: bool = False

    class Config:
        env_file = ".env"
        extra = "ignore"


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
