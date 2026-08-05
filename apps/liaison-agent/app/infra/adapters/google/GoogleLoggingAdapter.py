import logging
from google.cloud import logging as glogging
from google.cloud.logging import DESCENDING
from typing import List, Dict, Any
import datetime
from app.domain.interfaces.GoogleLoggingInterface import LogRetriever
from app.core.config.settings import settings

logger = logging.getLogger(__name__)

class GoogleCloudLogRetriever(LogRetriever):
    def __init__(self):
        self.client = glogging.Client(project=settings.GOOGLE_CLOUD_PROJECT_ID)

    async def get_logs_by_automation_id(
        self, 
        automation_id: str, 
        severity_min: str = "ERROR"
    ) -> List[Dict[str, Any]]:
        """
        Search logs in Google Cloud filtering by jsonPayload.automationId.
        """
        if not automation_id:
            return []

        one_day_ago = (datetime.datetime.utcnow() - datetime.timedelta(days=1)).isoformat() + "Z"
        
        filter_str = (
            f'jsonPayload.automationId="{automation_id}" '
            f'AND severity >= {severity_min} '
            f'AND timestamp >= "{one_day_ago}"'
        )

        return await self._fetch_logs(filter_str)

    async def get_logs_by_company_id(
        self, 
        company_id: str, 
        severity_min: str = "ERROR"
    ) -> List[Dict[str, Any]]:
        """
        Search logs in Google Cloud filtering by jsonPayload.companyId.
        """
        if not company_id:
            return []

        one_day_ago = (datetime.datetime.utcnow() - datetime.timedelta(days=1)).isoformat() + "Z"
        
        filter_str = (
            f'jsonPayload.companyId="{company_id}" '
            f'AND severity >= {severity_min} '
            f'AND timestamp >= "{one_day_ago}"'
        )

        return await self._fetch_logs(filter_str)

    async def get_logs_by_multiple_automations(
        self, 
        automation_ids: List[str], 
        severity_min: str = "ERROR"
    ) -> List[Dict[str, Any]]:
        """
        Search logs for multiple automation IDs.
        """
        if not automation_ids:
            return []

        one_day_ago = (datetime.datetime.utcnow() - datetime.timedelta(days=1)).isoformat() + "Z"
        automation_filters = ' OR '.join([f'jsonPayload.automationId="{aid}"' for aid in automation_ids])
        
        filter_str = (
            f'({automation_filters}) '
            f'AND severity >= {severity_min} '
            f'AND timestamp >= "{one_day_ago}"'
        )

        return await self._fetch_logs(filter_str)

    async def _fetch_logs(self, filter_str: str) -> List[Dict[str, Any]]:
        """
        Internal method to fetch logs from GCP with a given filter.
        """
        try:
            logger.info(f"GoogleLoggingAdapter: Fetching logs with filter: {filter_str}")
            
            entries = self.client.list_entries(
                filter_=filter_str,
                order_by=DESCENDING,
                page_size=50
            )

            logs = []
            for entry in entries:
                log_data = {
                    "timestamp": entry.timestamp.isoformat() if entry.timestamp else None,
                    "severity": entry.severity,
                    "message": entry.payload.get("message") if isinstance(entry.payload, dict) else str(entry.payload),
                    "component": entry.payload.get("component", "unknown") if isinstance(entry.payload, dict) else "unknown",
                    "automation_id": entry.payload.get("automationId") if isinstance(entry.payload, dict) else None,
                }
                logs.append(log_data)
            
            logger.info(f"GoogleLoggingAdapter: Found {len(logs)} logs.")
            if logs:
                logger.debug(f"GoogleLoggingAdapter: First log sample: {logs[0]}")
            
            return logs

        except Exception as e:
            logger.error(f"Error searching logs in GCP: {e}")
            return []

