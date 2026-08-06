from fastapi import APIRouter, Depends, Security
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.Logs.logging import logger
from app.infra.di.Container import DIContainer, get_container_db
from app.presentation.chat.dtos.ChatDto import (
    ChatHistoryResponse,
    ChatMessageDto,
    ChatRequest,
    ChatResponse,
)
from app.presentation.middleware.security.Auth import verify_service_account
from app.shared.exceptions.base import BaseAPIException
from app.shared.exceptions.common import InternalServerErrorException

router = APIRouter(prefix="/chat", tags=["Chat"])

@router.post("/", response_model=ChatResponse)
async def chat_process(
    request: ChatRequest,
    auth: dict = Security(verify_service_account),
    db: AsyncSession = Depends(get_container_db)
):
    try:
        logger.info(f"ChatController received request: user_id={request.user_id}, session_id={request.session_id}, msg_len={request.message}")
        
        use_case = DIContainer.get_chat_use_case(db)
        
        result = await use_case.execute(
            user_message=request.message,
            session_id=request.session_id,
            user_id=request.user_id,
            automation_id=request.automation_id,
            company_context=request.company_context
        )
        
        return ChatResponse(
            response=result["response"],
            session_id=result["session_id"]
        )
    except BaseAPIException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error in chat endpoint: {e}", exc_info=True)
        raise InternalServerErrorException(
            detail="An unexpected error occurred processing your request."
        ) from e

@router.get("/messages/{session_id}", response_model=ChatHistoryResponse)
async def get_chat_messages(
    session_id: str,
    user_id: str,
    auth: dict = Security(verify_service_account),
    db: AsyncSession = Depends(get_container_db)
):
    """
    Retrieves chat message history for a session, scoped to its owner.

    user_id is a required query parameter — the backend already sends it, and
    without it a session id alone returned any user's conversation.
    """
    try:
        repo = DIContainer.get_chat_repository(db)
        messages = await repo.get_history_by_session(session_id, user_id, limit=50)
        
        return ChatHistoryResponse(
            session_id=session_id,
            messages=[
                ChatMessageDto(
                    user_message=msg.user_message,
                    agent_response=msg.agent_response,
                    created_at=msg.created_at
                ) for msg in messages
            ]
        )
    except Exception as e:
        logger.error(f"Error retrieving chat history: {e}", exc_info=True)
        raise InternalServerErrorException(
            detail="Failed to retrieve chat history"
        ) from e
