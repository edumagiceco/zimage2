from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    """Auth Service Configuration"""

    # Environment
    ENV: str = "development"
    DEBUG: bool = True

    # Database
    DATABASE_URL: str = "postgresql+asyncpg://zimage:zimage_secret@postgres:5432/zimage"

    # Redis
    REDIS_URL: str = "redis://redis:6379/1"

    # JWT
    JWT_SECRET: str = "your-super-secret-jwt-key"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    class Config:
        env_file = ".env"
        extra = "ignore"


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
