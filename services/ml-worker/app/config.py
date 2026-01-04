from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    """ML Worker Configuration"""

    # Environment
    ENV: str = "development"

    # Celery
    CELERY_BROKER_URL: str = "redis://redis:6379/3"
    CELERY_RESULT_BACKEND: str = "redis://redis:6379/4"

    # MinIO
    MINIO_ENDPOINT: str = "minio:9000"
    MINIO_EXTERNAL_URL: str = "http://192.168.1.81:9020"  # External URL for browser access
    MINIO_ACCESS_KEY: str = "minioadmin"
    MINIO_SECRET_KEY: str = "minioadmin123"
    MINIO_BUCKET: str = "zimage-images"
    MINIO_USE_SSL: bool = False

    # Model
    MODEL_PATH: str = "/models"
    # Using SDXL-Turbo for fast image generation (can change to Z-Image later)
    MODEL_NAME: str = "stabilityai/sdxl-turbo"
    HF_HOME: str = "/models/huggingface"

    # Translation Model (Qwen2.5-3B-Instruct for Korean to English)
    TRANSLATION_MODEL_NAME: str = "Qwen/Qwen2.5-3B-Instruct"
    ENABLE_TRANSLATION: bool = True

    # GPU Settings
    CUDA_VISIBLE_DEVICES: str = "0"

    # Generation Defaults
    DEFAULT_INFERENCE_STEPS: int = 8
    DEFAULT_GUIDANCE_SCALE: float = 3.5

    class Config:
        env_file = ".env"
        extra = "ignore"


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
