import logging
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.domain.entities.CompanyEntity import Company
from app.domain.repositories.CompanyRepository import ICompanyRepository
from app.infra.database.models.CompanyModel import CompanyModel

logger = logging.getLogger(__name__)

class CompanyRepositoryImpl(ICompanyRepository):
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_company_by_name(self, name: str) -> Optional[Company]:
        """
        Finds a company by name using case-insensitive partial match.
        """
        try:
            query = select(CompanyModel).filter(CompanyModel.name.ilike(f"%{name}%")).limit(1)
            logger.info(f"CompanyRepo: Executing query for name like '%{name}%'")
            
            result = await self.db.execute(query)
            db_company = result.scalar_one_or_none()
            
            if db_company:
                logger.info(f"CompanyRepo: Found company ID {db_company.id}")
                return Company.model_validate(db_company)
            
            logger.info("CompanyRepo: No company found.")
            return None
        except Exception as e:
            logger.error(f"CompanyRepo Error: {e}")
            return None

    async def get_company_by_id(self, company_id: str) -> Optional[Company]:
        """
        Finds a company by ID.
        """
        result = await self.db.execute(
            select(CompanyModel)
            .filter(CompanyModel.id == company_id)
        )
        db_company = result.scalar_one_or_none()
        
        if db_company:
            return Company.model_validate(db_company)
        return None
