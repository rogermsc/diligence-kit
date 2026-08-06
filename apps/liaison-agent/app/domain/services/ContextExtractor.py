from typing import Any, Dict, Optional


class ContextExtractor:
    """
    Domain Service responsible for extracting contextual information
    from structured context data.
    
    Note: Complex extractions (like company_name from natural language)
    are handled by the enrichment_node using LLM.
    """
    
    @staticmethod
    def extract_company_id(context_data: Dict[str, Any]) -> Optional[str]:
        """
        Extracts company_id from context_data if present.
        """
        company_info = context_data.get('company_info', {})
        if isinstance(company_info, dict):
            return company_info.get('id') or company_info.get('company_id')
        return None
