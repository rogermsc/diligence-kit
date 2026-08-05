from typing import Literal
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_ignore_empty=True,
        extra="ignore"
    )

    ENV: Literal["dev", "prod", "test"] = "dev"
    LOG_LEVEL: Literal["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"] = "INFO"
    API_KEY: str
    GOOGLE_CLOUD_PROJECT_ID: str
    GOOGLE_CLOUD_LOCATION: str = "us-central1"
    DATABASE_URL: str
    HOST: str = "0.0.0.0"
    PORT: int = 8000

settings = Settings()

