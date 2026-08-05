from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List
from datetime import datetime

class ChatRequest(BaseModel):
    message: str = Field(..., description="User message")
    session_id: Optional[str] = Field(None, description="Session ID to maintain context. If not provided, the backend will try to find the last active session or create a new one.")
    user_id: Optional[str] = Field(None, description="User ID to link the session. Required if session_id is missing.")
    automation_id: Optional[str] = Field(None, description="UUID of the automation related to the chat")
    company_context: Optional[Dict[str, Any]] = Field(
        default=None, 
        description="Extra company data (ex: name, sector) to enrich the response"
    )

class ChatResponse(BaseModel):
    response: str = Field(..., description="Agent response")
    session_id: str = Field(..., description="Session ID")

class ChatMessageDto(BaseModel):
    user_message: str
    agent_response: str
    created_at: datetime

class ChatHistoryResponse(BaseModel):
    session_id: str
    messages: List[ChatMessageDto]

