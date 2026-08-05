from app.shared.exceptions.base import BaseAPIException

class MissingAPIKeyException(BaseAPIException):
    def __init__(self):
        super().__init__(
            status_code=401,
            detail="Missing X-API-Key header"
        )

class InvalidAPIKeyException(BaseAPIException):
    def __init__(self):
        super().__init__(
            status_code=401,
            detail="Invalid API key"
        )

