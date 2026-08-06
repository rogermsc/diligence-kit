import logging

from langchain_core.messages import HumanMessage, SystemMessage
from langchain_google_vertexai import ChatVertexAI

from app.core.config.settings import settings
from app.core.prompts import ENRICHMENT_SYSTEM_PROMPT
from app.domain.agent.LangGraph.state import AgentState

logger = logging.getLogger(__name__)

try:
    llm = ChatVertexAI(
        model_name="gemini-2.5-flash",
        project=settings.GOOGLE_CLOUD_PROJECT_ID,
        location=settings.GOOGLE_CLOUD_LOCATION,
        temperature=0.0
    )
except Exception:
    llm = None

def _build_conversation_history(messages, max_turns: int = 5) -> str:
    """Build a summary of recent conversation turns for context."""
    if len(messages) <= 1:
        return "No previous conversation."

    recent = messages[-(max_turns * 2 + 1):-1]
    if not recent:
        return "No previous conversation."

    lines = []
    for msg in recent:
        role = "User" if msg.type == "human" else "Assistant"
        content = msg.content[:200] if msg.content else ""
        lines.append(f"{role}: {content}")

    return "\n".join(lines)


async def _resolve_company_by_name(name: str, state: AgentState, context: dict) -> dict:
    """Query DB for a company name and return updated context if found."""
    company_repo = state.get('company_repository')
    if not company_repo:
        logger.error("CompanyRepository not found in AgentState! Context enrichment failed.")
        return {}

    owner_id = state.get('user_id')
    if not owner_id:
        logger.error("No user_id in AgentState; refusing an unscoped company lookup.")
        return {}

    logger.info(f"Enrichment Node: Querying DB for company: '{name}'")
    company = await company_repo.get_company_by_name(name, owner_id)

    if company:
        updated_context = context.copy()
        if 'company_info' not in updated_context:
            updated_context['company_info'] = {}
        updated_context['company_info']['id'] = str(company.id)
        updated_context['company_info']['name'] = company.name

        logger.info(f"Context enriched: company_name='{name}' -> company_id={company.id}")
        return {"context_data": updated_context}

    logger.warning(f"Company '{name}' extracted but not found in DB")
    return {}


async def enrichment_node(state: AgentState):
    """
    Node responsible for enriching context with company_id when not provided.
    Uses LLM to extract company_name from user message and conversation history, then queries DB.
    Also handles company_context passed from the frontend (name without id).
    """
    context = state.get('context_data', {})
    all_messages = state['messages']
    last_message = all_messages[-1]

    company_info = context.get('company_info', {})
    if isinstance(company_info, dict):
        existing_company_id = company_info.get('id') or company_info.get('company_id')
        if existing_company_id:
            return {}

        # Frontend may pass company_context with name but no id — resolve it
        existing_name = company_info.get('name')
        if existing_name:
            logger.info(f"Enrichment Node: company_info has name '{existing_name}' but no id, resolving via DB")
            return await _resolve_company_by_name(existing_name, state, context)

    if context.get('automation_id'):
        return {}

    if not llm:
        logger.warning("LLM not available for context enrichment")
        return {}

    try:
        user_msg_content = last_message.content if last_message.content else ""
        if not user_msg_content:
            logger.warning("Empty user message content in enrichment node")
            return {}

        conversation_history = _build_conversation_history(all_messages)

        # Format the prompt with conversation history and current message
        formatted_prompt = ENRICHMENT_SYSTEM_PROMPT.format(
            conversation_history=conversation_history,
            user_message=user_msg_content
        )

        messages = [
            SystemMessage(content=formatted_prompt),
            HumanMessage(content=user_msg_content)
        ]

        extraction_result = await llm.ainvoke(messages)

        company_name = extraction_result.content.strip()

        logger.info(f"Enrichment Node: Extracted company name via LLM: '{company_name}'")

        if company_name and company_name != "NOT_FOUND":
            return await _resolve_company_by_name(company_name, state, context)

        return {}

    except Exception as e:
        logger.error(f"Error in Enrichment Node: {e}")
        return {}
