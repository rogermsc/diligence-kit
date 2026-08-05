import secrets

from fastapi import HTTPException, Security
from fastapi.security import APIKeyHeader

from src.core.config import settings

_api_key_header = APIKeyHeader(name="X-API-Key", auto_error=True)


def verify_api_key(api_key: str = Security(_api_key_header)) -> None:
    if not secrets.compare_digest(api_key, settings.api_key):
        raise HTTPException(status_code=401, detail="Unauthorized")
