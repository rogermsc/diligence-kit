from .base import BaseAPIException


class DatabaseException(BaseAPIException):
    """Base exception for all database related errors"""
    def __init__(self, detail: str = "Database error"):
        super().__init__(
            status_code=500,
            detail=detail
        )

class DatabaseConnectionError(DatabaseException):
    def __init__(self):
        super().__init__(detail="Could not connect to the database")

class DatabaseAuthenticationError(DatabaseException):
    def __init__(self):
        super().__init__(detail="Database authentication failed")

class DatabaseQueryResultError(DatabaseException):
    def __init__(self, query_info: str = ""):
        super().__init__(detail=f"Error executing database query: {query_info}")

