import logging

from langchain_core.prompts import ChatPromptTemplate
from langchain_google_vertexai import ChatVertexAI

from app.core.config.settings import settings
from app.core.prompts import SUPPORT_SYSTEM_PROMPT
from app.domain.agent.LangGraph.state import AgentState
from app.domain.entities.AnalysisResultEntity import AnalysisResult

logger = logging.getLogger(__name__)

try:
    with open("Docs/SYSTEM_USER_GUIDE.md", "r", encoding="utf-8") as f:
        guide_content = f.read()
except Exception as e:
    logger.error(f"Error loading SYSTEM_USER_GUIDE.md: {e}")
    guide_content = "Error loading system guide."

try:
    llm = ChatVertexAI(
        model_name="gemini-2.5-flash",
        project=settings.GOOGLE_CLOUD_PROJECT_ID,
        location=settings.GOOGLE_CLOUD_LOCATION,
        temperature=0.2
    )
except Exception:
    llm = None

async def support_node(state: AgentState):
    """
    Node responsible for Support (RAG/Docs).
    Uses the loaded Markdown guide as context.
    """
    messages = state['messages']
    last_message = messages[-1]
    
    if not llm:
        return {
            "analysis_context": AnalysisResult(
                summary="Support system unavailable (LLM not initialized).",
                source="SYSTEM"
            )
        }

    try:
        # Injeta o conteúdo do guia no prompt
        prompt = ChatPromptTemplate.from_messages([
            ("system", SUPPORT_SYSTEM_PROMPT.format(user_guide_content=guide_content)),
            ("user", "{input}")
        ])
        
        chain = prompt | llm
        response = await chain.ainvoke({"input": last_message.content})
        
        return {
            "analysis_context": AnalysisResult(
                summary=response.content,
                source="DOCS"
            )
        }
        
    except Exception as e:
        logger.error(f"Error in Support Node: {e}")
        return {
            "analysis_context": AnalysisResult(
                summary="I encountered an error while consulting the support guide.",
                source="NONE"
            )
        }

