import logging

from langchain_core.prompts import ChatPromptTemplate
from langchain_google_vertexai import ChatVertexAI

from app.core.config.settings import settings
from app.core.prompts import ANALYZER_SYSTEM_PROMPT
from app.domain.agent.LangGraph.state import AgentState
from app.domain.entities.AnalysisResultEntity import AnalysisResult
from app.domain.services.ContextExtractor import ContextExtractor
from app.infra.adapters.google.GoogleLoggingAdapter import GoogleCloudLogRetriever

logger = logging.getLogger(__name__)

try:
    llm = ChatVertexAI(
        model_name="gemini-2.5-pro",
        project=settings.GOOGLE_CLOUD_PROJECT_ID,
        location=settings.GOOGLE_CLOUD_LOCATION,
        temperature=0.0
    )
except Exception:
    llm = None

log_retriever = GoogleCloudLogRetriever()

async def ombudsman_node(state: AgentState):
    """
    Node responsible for Technical Ombudsman.
    Expects context to be already enriched by enrichment_node.
    Implements cascading logic: company_id -> automation_id.
    """
    context = state.get('context_data', {})
    
    company_id = ContextExtractor.extract_company_id(context)
    automation_id = context.get('automation_id')
    
    logs = []
    search_strategy = ""
    
    try:
        if company_id:
            search_strategy = f"company_id={company_id}"
            logs = await log_retriever.get_logs_by_company_id(company_id, severity_min="ERROR")
        
        elif automation_id:
            search_strategy = f"automation_id={automation_id}"
            logs = await log_retriever.get_logs_by_automation_id(automation_id, severity_min="ERROR")
        
        else:
            return {
                "analysis_context": AnalysisResult(
                    summary="I could not identify the company or automation to search for logs. Please provide more context about which automation or company you're referring to.",
                    source="NONE"
                )
            }
        
        if not logs:
            return {
                "analysis_context": AnalysisResult(
                    summary=f"No error logs found for the specified criteria ({search_strategy}) in the last 24 hours. The automation may have completed successfully or the errors occurred earlier.",
                    source="LOGS"
                )
            }
            
    except Exception as e:
        logger.error(f"Error searching logs: {e}")
        return {
            "analysis_context": AnalysisResult(
                summary="Internal connection error with the log system.",
                source="NONE"
            )
        }

    if not llm:
        return {
            "analysis_context": AnalysisResult(
                summary="Logs retrieved (analysis unavailable at the moment).",
                details={"logs_count": len(logs)},
                source="LOGS"
            )
        }

    try:
        logs_text = "\n\n".join([
            f"[{log.get('timestamp')}] {log.get('severity')} - {log.get('component')}: {log.get('message')}"
            for log in logs[:30]
        ])
        
        prompt = ChatPromptTemplate.from_messages([
            ("system", ANALYZER_SYSTEM_PROMPT)
        ])
        
        chain = prompt | llm
        
        analysis_msg = await chain.ainvoke({
            "logs": logs_text,
            "search_strategy": search_strategy
        })
        
        return {
            "analysis_context": AnalysisResult(
                summary=analysis_msg.content,
                details={"logs_count": len(logs), "search_strategy": search_strategy},
                source="LOGS"
            )
        }
        
    except Exception as e:
        logger.error(f"Error in AI analysis: {e}")
        return {
            "analysis_context": AnalysisResult(
                summary="Failure to analyze the logs.",
                source="LOGS"
            )
        }
