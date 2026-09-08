"""Wiring for the chat and session controllers.

This was a DIContainer class of static factory methods — the only DI registry in
a four-app repo, for two repositories. FastAPI already resolves dependencies;
these are plain functions it can call with Depends, and the session generator it
already knew how to manage.
"""

from typing import AsyncGenerator

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database.connection_database import AsyncSessionLocal
from app.domain.use_cases.ChatUseCase import ChatUseCase
from app.domain.use_cases.SessionUseCase import SessionUseCase
from app.infra.database.repositories.ChatRepositoryImpl import ChatRepositoryImpl
from app.infra.database.repositories.CompanyRepositoryImpl import CompanyRepositoryImpl


async def get_container_db() -> AsyncGenerator[AsyncSession, None]:
    """One session per request, closed when the request ends."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()


def get_chat_repository(
    db: AsyncSession = Depends(get_container_db),
) -> ChatRepositoryImpl:
    return ChatRepositoryImpl(db)


def get_chat_use_case(
    db: AsyncSession = Depends(get_container_db),
) -> ChatUseCase:
    return ChatUseCase(ChatRepositoryImpl(db), CompanyRepositoryImpl(db))


def get_session_use_case(
    db: AsyncSession = Depends(get_container_db),
) -> SessionUseCase:
    return SessionUseCase(ChatRepositoryImpl(db))
