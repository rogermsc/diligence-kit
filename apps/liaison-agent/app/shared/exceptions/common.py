from typing import Any, Dict, Optional

from .base import BaseAPIException


class InternalServerErrorException(BaseAPIException):
    def __init__(self, detail: str = "Internal Server Error"):
        super().__init__(
            status_code=500,
            detail=detail
        )

class NotFoundException(BaseAPIException):
    def __init__(self, resource: str = "Resource"):
        super().__init__(
            status_code=404,
            detail=f"{resource} not found"
        )

class BadRequestException(BaseAPIException):
    def __init__(self, detail: str = "Bad Request"):
        super().__init__(
            status_code=400,
            detail=detail
        )

class ValidationException(BaseAPIException):
    """
    Exception for data validation errors.
    Useful when Pydantic validation is not enough or for custom business rules validation.
    """
    def __init__(self, detail: str = "Validation error", errors: Optional[Dict[str, Any]] = None):
        super().__init__(
            status_code=422,
            detail=detail
        )

        self.errors = errors

