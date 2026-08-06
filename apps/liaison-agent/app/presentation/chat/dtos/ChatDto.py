from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class ChatRequest(BaseModel):
    message: str = Field(..., description="User message")
    session_id: Optional[str] = Field(None, description="Session ID to maintain context. If not provided, the backend will try to find the last active session or create a new one.")
    # Required, not optional. It used to default to the literal "default_user",
    # which pooled every caller who omitted it into one identity — and the
    # per-user history filter then treated that pool as a single owner, so one
    # user read another's conversations. The only caller is the backend, which
    # takes this from the authenticated JWT and has always sent it.
    user_id: str = Field(..., min_length=1, description="Authenticated user the session belongs to.")
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

