import uuid
from typing import Any, Dict, List, Optional

from langchain_core.messages import AIMessage, BaseMessage, HumanMessage

from app.domain.agent.LangGraph.graph import create_graph
from app.domain.entities.ChatMessageEntity import ChatMessage
from app.domain.repositories.ChatRepository import IChatRepository
from app.domain.repositories.CompanyRepository import ICompanyRepository

agent_app = create_graph()

class ChatUseCase:
    def __init__(self, repository: IChatRepository, company_repository: Optional[ICompanyRepository] = None):
        self.repository = repository
        self.company_repository = company_repository

    def _hydrate_history(self, db_messages: List[ChatMessage]) -> List[BaseMessage]:
        """Converts DB entities to LangChain message objects"""
        history: List[BaseMessage] = []
        for msg in db_messages:
            history.append(HumanMessage(content=msg.user_message))
            history.append(AIMessage(content=msg.agent_response))
        return history

    async def execute(
        self,
        user_message: str,
        user_id: str,
        session_id: Optional[str] = None,
        automation_id: Optional[str] = None,
        company_context: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, str]:
        """
        Orchestrates the chat flow: session management, agent execution, and persistence.
        """
        
        if not session_id:
            last_session = await self.repository.get_last_session_by_user(user_id)
            if last_session:
                session_id = last_session
            else:
                session_id = str(uuid.uuid4())
        
        # Scoped to user_id so a supplied session_id cannot load, or be appended
        # to, another user's conversation.
        db_history = await self.repository.get_history_by_session(session_id, user_id, limit=30)
        current_history = self._hydrate_history(db_history)
        
        human_msg = HumanMessage(content=user_message)
        
        context_data = {
            "automation_id": automation_id,
            "company_info": company_context or {}
        }

        inputs = {
            "messages": current_history + [human_msg],
            "session_id": session_id,
            "user_id": user_id,
            "context_data": context_data,
            "current_intent": None, 
            "analysis_context": None,
            "company_repository": self.company_repository
        }
        
        result = await agent_app.ainvoke(inputs)
        
        updated_messages = result["messages"]
        last_message = updated_messages[-1]
        agent_response_text = str(last_message.content)
        
        await self.repository.create_message(ChatMessage(
            session_id=session_id,
            user_id=user_id,
            user_message=user_message,
            agent_response=agent_response_text
        ))
        
        return {
            "response": agent_response_text,
            "session_id": session_id
        }

