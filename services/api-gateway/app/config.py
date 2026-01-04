from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    """API Gateway Configuration"""

    # Environment
    ENV: str = "development"
    DEBUG: bool = True

    # Service URLs
    AUTH_SERVICE_URL: str = "http://auth-service:8001"
    IMAGE_SERVICE_URL: str = "http://image-service:8002"
    GALLERY_SERVICE_URL: str = "http://gallery-service:8003"

    # Redis
    REDIS_URL: str = "redis://redis:6379/0"

    # JWT
    JWT_SECRET: str = "your-super-secret-jwt-key"
    JWT_ALGORITHM: str = "HS256"

    # Rate Limiting
    RATE_LIMIT_PER_MINUTE: int = 60
    RATE_LIMIT_BURST: int = 10

    # CORS - Allow external access
    CORS_ORIGINS: list[str] = [
        "http://localhost",
        "http://localhost:8090",
        "http://localhost:8091",
        "http://192.168.1.81:8090",
        "http://192.168.1.81:8091",
    ]

    class Config:
        env_file = ".env"
        extra = "ignore"


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
