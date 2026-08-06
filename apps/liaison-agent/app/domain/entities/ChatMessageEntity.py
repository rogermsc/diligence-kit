from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class ChatMessage(BaseModel):
    """
    Domain Entity representing a chat message.
    It is decoupled from the database model.
    """
    id: Optional[int] = None
    session_id: str
    user_id: str
    user_message: str
    agent_response: str
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True

