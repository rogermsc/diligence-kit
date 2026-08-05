from functools import lru_cache
from typing import Optional

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # API
    api_host: str = "0.0.0.0"
    api_port: int = 8000
    api_reload: bool = False

    # OpenAI
    openai_api_key: str = ""

    # Google Cloud
    google_cloud_project_id: Optional[str] = None
    google_cloud_bucket_name: Optional[str] = None
    google_cloud_credentials: Optional[str] = None

    # Backend
    backend_base_url: str = ""

    # JWT (user auth — not used by agent currently)
    jwt_secret: str = ""
    jwt_algorithm: str = "HS256"

    # Agent secret (service-to-service auth — outbound JWT signing)
    agent_secret: str = ""

    # Webhook secret (HMAC-SHA256 payload signing for backend callbacks)
    webhook_secret: str = ""

    # API key (inbound request authentication)
    api_key: str = ""

    # CORS
    cors_origins: str = ""

    # Logging
    log_level: str = "INFO"

    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore"
    )

    @model_validator(mode="after")
    def validate_required_secrets(self) -> "Settings":
        errors = []
        if not self.openai_api_key:
            errors.append("OPENAI_API_KEY is required")
        if not self.agent_secret:
            errors.append("AGENT_SECRET is required")
        elif len(self.agent_secret) < 32:
            errors.append("AGENT_SECRET must be at least 32 characters")
        if not self.webhook_secret:
            errors.append("WEBHOOK_SECRET is required")
        elif len(self.webhook_secret) < 32:
            errors.append("WEBHOOK_SECRET must be at least 32 characters")
        if not self.api_key:
            errors.append("API_KEY is required")
        elif len(self.api_key) < 32:
            errors.append("API_KEY must be at least 32 characters")
        if not self.backend_base_url:
            errors.append("BACKEND_BASE_URL is required")
        if not self.google_cloud_bucket_name:
            errors.append("GOOGLE_CLOUD_BUCKET_NAME is required")
        if errors:
            raise ValueError("Missing or invalid configuration:\n" + "\n".join(f"  - {e}" for e in errors))
        return self


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
