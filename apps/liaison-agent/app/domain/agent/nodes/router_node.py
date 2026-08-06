import logging

from langchain_core.prompts import ChatPromptTemplate
from langchain_google_vertexai import ChatVertexAI

from app.core.config.settings import settings
from app.core.prompts import ROUTER_SYSTEM_PROMPT
from app.domain.agent.LangGraph.state import AgentState
from app.domain.entities.IntentEntity import Intent

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

    # Take the last N messages before the current one
    recent = messages[-(max_turns * 2 + 1):-1]
    if not recent:
        return "No previous conversation."

    lines = []
    for msg in recent:
        role = "User" if msg.type == "human" else "Assistant"
        content = msg.content[:200] if msg.content else ""
        lines.append(f"{role}: {content}")

    return "\n".join(lines)


async def router_node(state: AgentState):
    messages = state['messages']
    last_message = messages[-1]

    context = state.get('context_data', {})
    has_automation_id = bool(context.get('automation_id'))
    conversation_history = _build_conversation_history(messages)

    if not llm:
        return {"current_intent": Intent(category="CHITCHAT", confidence=1.0)}

    try:
        structured_llm = llm.with_structured_output(Intent)

        prompt = ChatPromptTemplate.from_messages([
            ("system", ROUTER_SYSTEM_PROMPT),
            ("user", "{input}")
        ])

        chain = prompt | structured_llm
        intent: Intent = await chain.ainvoke({
            "input": last_message.content,
            "has_automation_id": has_automation_id,
            "conversation_history": conversation_history
        })

        return {"current_intent": intent}

    except Exception as e:
        logger.error(f"Error in Router Node: {e}")
        return {"current_intent": Intent(category="CHITCHAT", confidence=0.0)}
