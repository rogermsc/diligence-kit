import operator
from typing import Annotated, Any, Dict, List, Optional, TypedDict

from langchain_core.messages import BaseMessage

from app.domain.entities.AnalysisResultEntity import AnalysisResult
from app.domain.entities.IntentEntity import Intent
from app.domain.repositories.CompanyRepository import ICompanyRepository


class AgentState(TypedDict):
    """
    Agent Liaison state.
    """
    messages: Annotated[List[BaseMessage], operator.add]
    session_id: str
    # The authenticated caller. Company lookups are scoped to it.
    user_id: str
    context_data: Dict[str, Any]
    current_intent: Optional[Intent]
    analysis_context: Optional[AnalysisResult]
    company_repository: Optional[ICompanyRepository]