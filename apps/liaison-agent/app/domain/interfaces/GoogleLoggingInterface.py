from abc import ABC, abstractmethod
from typing import Any, Dict, List


class LogRetriever(ABC):
    """
    Interface for log retrieval in the observability system.
    """
    @abstractmethod
    async def get_logs_by_automation_id(
        self, 
        automation_id: str, 
        severity_min: str = "ERROR"
    ) -> List[Dict[str, Any]]:
        """Search logs related to a specific automation_id with minimum severity filter."""
        pass

    @abstractmethod
    async def get_logs_by_company_id(
        self, 
        company_id: str, 
        severity_min: str = "ERROR"
    ) -> List[Dict[str, Any]]:
        """Search logs related to a specific company_id with minimum severity filter."""
        pass

    @abstractmethod
    async def get_logs_by_multiple_automations(
        self, 
        automation_ids: List[str], 
        severity_min: str = "ERROR"
    ) -> List[Dict[str, Any]]:
        """Search logs for multiple automation_ids with minimum severity filter."""
        pass
