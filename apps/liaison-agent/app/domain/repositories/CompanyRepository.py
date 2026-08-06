from abc import ABC, abstractmethod
from typing import Optional

from app.domain.entities.CompanyEntity import Company


class ICompanyRepository(ABC):
    """
    Interface for Company Repository.
    Used to lookup company information for log retrieval.
    """
    
    @abstractmethod
    async def get_company_by_name(self, name: str, owner_id: str) -> Optional[Company]:
        """Finds one of `owner_id`'s companies by name (case-insensitive, partial).

        `owner_id` is required rather than optional so that a caller cannot
        accidentally search every tenant's companies — the name being matched
        comes out of a chat message, so an unscoped match is a cross-tenant read.
        """
        pass

    @abstractmethod
    async def get_company_by_id(self, company_id: str, owner_id: str) -> Optional[Company]:
        """Finds one of `owner_id`'s companies by id."""
        pass
