import logging
from langchain_google_vertexai import ChatVertexAI
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from app.domain.agent.LangGraph.state import AgentState
from app.domain.entities.AnalysisResultEntity import AnalysisResult
from app.domain.entities.IntentEntity import Intent
from app.core.config.settings import settings
from app.core.prompts import RESPONSE_SYSTEM_PROMPT

logger = logging.getLogger(__name__)

try:
    llm = ChatVertexAI(
        model_name="gemini-2.5-flash",
        project=settings.GOOGLE_CLOUD_PROJECT_ID,
        location=settings.GOOGLE_CLOUD_LOCATION,
        temperature=0.4
    )
except Exception:
    llm = None

async def response_node(state: AgentState):
    """
    Final node that synthesizes the response for the user.
    """
    messages = state['messages']
    intent = state.get('current_intent')
    analysis = state.get('analysis_context')
    
    analysis_summary = analysis.summary if analysis else "No specific technical analysis is required."
    intent_category = intent.category if intent else "GENERAL"
    
    if not llm:
        return {"messages": [("ai", f"Response (No LLM): {analysis_summary}")]}

    try:
        prompt = ChatPromptTemplate.from_messages([
            ("system", RESPONSE_SYSTEM_PROMPT),
            MessagesPlaceholder(variable_name="messages"),
        ])
        
        chain = prompt | llm
        
        response = await chain.ainvoke({
            "messages": messages,
            "analysis_summary": analysis_summary,
            "intent": intent_category
        })
        
        return {"messages": [response]}
        
    except Exception as e:
        logger.error(f"Error generating final response: {e}")
        return {"messages": [("ai", "Sorry, I had a problem generating my final response.")]}

