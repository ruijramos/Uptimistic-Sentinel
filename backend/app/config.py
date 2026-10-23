import os
from typing import List, Optional
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class AppSettings(BaseSettings):
    """
    Application Settings strictly loaded from Environment Variables (.env).
    Note: Operational rules (recipients, intervals, thresholds) are stored in the DB.
    """
    model_config = SettingsConfigDict(
        env_file=os.getenv("ENV_FILE", ".env"),
        env_file_encoding="utf-8",
        extra="ignore"
    )

    # Flask App
    FLASK_ENV: str = Field(default="production")
    FLASK_DEBUG: bool = Field(default=False)
    FLASK_SECRET_KEY: str = Field(default="dev-insecure-key-change-in-production")
    API_PORT: int = Field(default=5000)
    CORS_ORIGINS: str = Field(default="http://localhost:4200,http://localhost:80,http://localhost")

    # Database
    DATABASE_URL: str = Field(
        default="postgresql+psycopg2://sentinel:sentinel_secure_pass@localhost:5432/uptimistic_sentinel"
    )

    # SMTP Infrastructure
    SMTP_HOST: str = Field(default="localhost")
    SMTP_PORT: int = Field(default=587)
    SMTP_USERNAME: Optional[str] = Field(default=None)
    SMTP_PASSWORD: Optional[str] = Field(default=None)
    SMTP_USE_TLS: bool = Field(default=True)
    SMTP_USE_SSL: bool = Field(default=False)
    SMTP_DEFAULT_FROM: str = Field(default="Uptimistic Sentinel <alerts@example.com>")

    @property
    def cors_origin_list(self) -> List[str]:
        if not self.CORS_ORIGINS:
            return ["*"]
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]


# Cached settings instance
settings = AppSettings()
