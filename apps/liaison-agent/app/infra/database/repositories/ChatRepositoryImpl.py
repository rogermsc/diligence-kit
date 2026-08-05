from typing import List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.infra.database.models.ChatModel import ChatMessageModel
from app.domain.entities.ChatMessageEntity import ChatMessage
from app.domain.repositories.ChatRepository import IChatRepository

class ChatRepositoryImpl(IChatRepository):
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create_message(self, message: ChatMessage) -> ChatMessage:
        db_message = ChatMessageModel(
            session_id=message.session_id,
            user_id=message.user_id,
            user_message=message.user_message,
            agent_response=message.agent_response
        )
        self.db.add(db_message)
        await self.db.commit()
        await self.db.refresh(db_message)
        return ChatMessage.model_validate(db_message)

    async def get_history_by_session(self, session_id: str, user_id: str, limit: int = 30) -> List[ChatMessage]:
        result = await self.db.execute(
            select(ChatMessageModel)
            .filter(
                ChatMessageModel.session_id == session_id,
                ChatMessageModel.user_id == user_id,
            )
            .order_by(ChatMessageModel.created_at.desc())
            .limit(limit)
        )
        db_messages = result.scalars().all()
        return [ChatMessage.model_validate(msg) for msg in reversed(db_messages)]

    async def get_last_session_by_user(self, user_id: str) -> str | None:
        result = await self.db.execute(
            select(ChatMessageModel.session_id)
            .filter(ChatMessageModel.user_id == user_id)
            .order_by(ChatMessageModel.created_at.desc())
            .limit(1)
        )
        return result.scalar_one_or_none()

