from fastapi.security import APIKeyHeader
from fastapi import Security
from typing import Optional
from app.core.config.settings import settings
from app.shared.exceptions import MissingAPIKeyException, InvalidAPIKeyException

api_key_schema = APIKeyHeader(name="X-API-Key", auto_error=False)

class APIKeyAuth:
    def __init__(self):
        self.api_key = settings.API_KEY
        if not self.api_key:
            raise ValueError("API_KEY environment variable not set")
    
    async def verify_api_key(self, x_api_key: Optional[str] = Security(api_key_schema)) -> dict:
        """
        Validate the API Key received in the X-API-Key header.
        The use of Security(api_key_schema) integrates this validation into the OpenAPI security system.
        """
        if not x_api_key:
            raise MissingAPIKeyException()
        
        if x_api_key != self.api_key:
            raise InvalidAPIKeyException()
        
        return {"authenticated": True}

api_key_auth = APIKeyAuth()

async def verify_service_account(auth: dict = Security(api_key_auth.verify_api_key)) -> dict:
    """
    Reusable dependency to protect routes.
    Returns the authentication status if successful.
    """
    return auth
