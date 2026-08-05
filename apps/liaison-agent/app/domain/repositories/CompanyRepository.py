from abc import ABC, abstractmethod
from typing import Optional
from app.domain.entities.CompanyEntity import Company

class ICompanyRepository(ABC):
    """
    Interface for Company Repository.
    Used to lookup company information for log retrieval.
    """
    
    @abstractmethod
    async def get_company_by_name(self, name: str) -> Optional[Company]:
        """Finds a company by name (case-insensitive, partial match)"""
        pass

    @abstractmethod
    async def get_company_by_id(self, company_id: str) -> Optional[Company]:
        """Finds a company by ID"""
        pass
