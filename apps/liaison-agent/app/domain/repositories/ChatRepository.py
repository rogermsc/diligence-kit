from typing import List
from app.domain.entities.ChatMessageEntity import ChatMessage
from abc import ABC, abstractmethod
from typing import Optional

class IChatRepository(ABC):
    """
    Interface for Chat Repository.
    This ensures dependency inversion: The domain defines the contract,
    and the infrastructure implements it.
    """
    
    @abstractmethod
    async def create_message(self, message: ChatMessage) -> ChatMessage:
        """Persists a new chat message"""
        pass

    @abstractmethod
    async def get_history_by_session(self, session_id: str, limit: int = 30) -> List[ChatMessage]:
        """Retrieves chat history for a specific session with a limit (default 30)"""
        pass

    @abstractmethod
    async def get_last_session_by_user(self, user_id: str) -> Optional[str]:
        """Retrieves the last session ID for a given user"""
        pass
