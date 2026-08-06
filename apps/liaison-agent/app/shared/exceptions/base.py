from typing import Any, Dict, Optional

from fastapi import HTTPException


class BaseAPIException(HTTPException):
    """
    Base class for all API exceptions.
    Inherits from FastAPI's HTTPException to ensure compatibility with
    FastAPI's exception handling mechanism.
    """
    def __init__(
        self,
        status_code: int,
        detail: Any = None,
        headers: Optional[Dict[str, str]] = None,
    ):
        super().__init__(status_code=status_code, detail=detail, headers=headers)

