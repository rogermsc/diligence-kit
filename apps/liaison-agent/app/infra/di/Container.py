from contextlib import asynccontextmanager
from typing import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database.connection_database import AsyncSessionLocal
from app.domain.repositories.ChatRepository import IChatRepository
from app.domain.repositories.CompanyRepository import ICompanyRepository
from app.domain.use_cases.ChatUseCase import ChatUseCase
from app.domain.use_cases.SessionUseCase import SessionUseCase
from app.infra.database.repositories.ChatRepositoryImpl import ChatRepositoryImpl
from app.infra.database.repositories.CompanyRepositoryImpl import CompanyRepositoryImpl


class DIContainer:
    """
    Dependency Injection Container.
    Centralizes the creation of all dependencies (Repositories, Services, Use Cases).
    """
    
    @staticmethod
    @asynccontextmanager
    async def get_db_session() -> AsyncGenerator[AsyncSession, None]:
        """Provide a transactional database session."""
        async with AsyncSessionLocal() as session:
            try:
                yield session
            finally:
                await session.close()

    @staticmethod
    def get_chat_repository(db: AsyncSession) -> IChatRepository:
        return ChatRepositoryImpl(db)

    @staticmethod
    def get_company_repository(db: AsyncSession) -> ICompanyRepository:
        return CompanyRepositoryImpl(db)

    @classmethod
    def get_chat_use_case(cls, db: AsyncSession) -> ChatUseCase:
        repo = cls.get_chat_repository(db)
        company_repo = cls.get_company_repository(db)
        return ChatUseCase(repo, company_repo)

    @classmethod
    def get_session_use_case(cls, db: AsyncSession) -> SessionUseCase:
        repo = cls.get_chat_repository(db)
        return SessionUseCase(repo)

async def get_container_db() -> AsyncGenerator[AsyncSession, None]:
    async with DIContainer.get_db_session() as session:
        yield session
