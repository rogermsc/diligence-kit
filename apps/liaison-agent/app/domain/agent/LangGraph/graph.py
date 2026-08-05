from langgraph.graph import StateGraph, END
from app.domain.agent.LangGraph.state import AgentState
from app.domain.agent.nodes.router_node import router_node
from app.domain.agent.nodes.enrichment_node import enrichment_node
from app.domain.agent.nodes.ombudsman_node import ombudsman_node
from app.domain.agent.nodes.support_node import support_node
from app.domain.agent.nodes.response_node import response_node
from app.domain.entities.IntentEntity import Intent

def route_decision(state: AgentState):
    """
    Conditional function to decide the next node based on the intent.
    """
    intent: Intent = state.get('current_intent')
    
    if not intent:
        return "response"
        
    if intent.category == "ERROR_REPORT":
        return "enrichment"
    elif intent.category == "HOW_TO":
        return "support"
    else:
        return "response"

def create_graph():
    """
    Create and compile the multi-stage agent graph.
    """
    workflow = StateGraph(AgentState)
    
    workflow.add_node("router", router_node)
    workflow.add_node("enrichment", enrichment_node)
    workflow.add_node("ombudsman", ombudsman_node)
    workflow.add_node("support", support_node)
    workflow.add_node("response", response_node)
    
    workflow.set_entry_point("router")
    
    workflow.add_conditional_edges(
        "router",
        route_decision,
        {
            "enrichment": "enrichment",  
            "support": "support",
            "response": "response"
        }
    )
    
    workflow.add_edge("enrichment", "ombudsman")
    workflow.add_edge("ombudsman", "response")
    workflow.add_edge("support", "response")
    
    workflow.add_edge("response", END)
    
    app = workflow.compile()
    return app
