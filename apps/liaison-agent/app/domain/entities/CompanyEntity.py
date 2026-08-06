from uuid import UUID

from pydantic import BaseModel


class Company(BaseModel):
    """
    Domain Entity representing a Company.
    Minimal representation for log retrieval purposes.
    """
    id: UUID
    name: str

    class Config:
        from_attributes = True
