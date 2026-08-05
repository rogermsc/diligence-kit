from pydantic import BaseModel, Field
from typing import Optional

class SessionRequest(BaseModel):
    user_id: str = Field(..., description="User ID to retrieve or create session for")

class SessionResponse(BaseModel):
    session_id: str = Field(..., description="Unique identifier for the chat session")

