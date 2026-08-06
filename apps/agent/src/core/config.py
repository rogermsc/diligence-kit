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
    # Any OpenAI-compatible endpoint (Azure, vLLM, OpenRouter, a local server).
    openai_base_url: Optional[str] = None

    # LLM driver: "openai" calls the API, "replay" serves recorded responses from
    # llm_fixture_dir so the pipeline runs offline for demos, tests and evals.
    llm_driver: str = "openai"
    llm_fixture_dir: str = "fixtures/llm"
    # With llm_driver="openai", write every response into llm_fixture_dir so a
    # live run can be replayed later.
    llm_record: bool = False

    # Model per purpose. Kept here rather than inline at the call sites so a
    # provider or tier change is one edit, and so evals can pin a version.
    llm_model_fact_extraction: str = "gpt-5-mini"
    llm_model_conflict_resolution: str = "gpt-5-mini"
    llm_model_one_pager: str = "gpt-5.2"
    llm_model_diligence_report: str = "gpt-5.2"

    # Google Cloud
    google_cloud_project_id: Optional[str] = None
    google_cloud_bucket_name: Optional[str] = None
    google_cloud_credentials: Optional[str] = None

    # Storage driver: "gcs" or "local"
    storage_driver: str = "gcs"
    storage_local_root: str = ".data/storage"

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
        if not self.openai_api_key and self.llm_driver != "replay":
            errors.append("OPENAI_API_KEY is required (unless LLM_DRIVER=replay)")
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
        if not self.google_cloud_bucket_name and self.storage_driver != "local":
            errors.append("GOOGLE_CLOUD_BUCKET_NAME is required (unless STORAGE_DRIVER=local)")
        if errors:
            raise ValueError("Missing or invalid configuration:\n" + "\n".join(f"  - {e}" for e in errors))
        return self


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
