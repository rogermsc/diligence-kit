import logging
import re
from google.cloud import logging as glogging
from google.cloud.logging import DESCENDING
from typing import List, Dict, Any, Optional
import datetime
from app.domain.interfaces.GoogleLoggingInterface import LogRetriever
from app.core.config.settings import settings

logger = logging.getLogger(__name__)

# Every id reaching this adapter originates from a chat payload, so it is
# attacker-controlled. The Cloud Logging filter language has no parameter binding
# — a value containing a double quote closes the literal and the rest is parsed as
# filter syntax, which reads other tenants' logs. Ids in this system are UUIDs, so
# validating the shape is both sufficient and exact.
_UUID_RE = re.compile(
    r"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$"
)

_VALID_SEVERITIES = frozenset(
    {"DEFAULT", "DEBUG", "INFO", "NOTICE", "WARNING", "ERROR", "CRITICAL", "ALERT", "EMERGENCY"}
)


def _safe_id(value: str, field: str) -> Optional[str]:
    """Return value only if it is a well-formed UUID, else None."""
    if isinstance(value, str) and _UUID_RE.match(value):
        return value
    logger.warning("Rejected malformed %s in log query: %r", field, value)
    return None


def _safe_severity(value: str) -> str:
    """Severity is interpolated unquoted, so it must come from a fixed set."""
    if isinstance(value, str) and value.upper() in _VALID_SEVERITIES:
        return value.upper()
    logger.warning("Rejected unknown severity %r, defaulting to ERROR", value)
    return "ERROR"


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
        safe_automation_id = _safe_id(automation_id, "automation_id")
        if not safe_automation_id:
            return []

        one_day_ago = (datetime.datetime.utcnow() - datetime.timedelta(days=1)).isoformat() + "Z"

        filter_str = (
            f'jsonPayload.automationId="{safe_automation_id}" '
            f'AND severity >= {_safe_severity(severity_min)} '
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
        safe_company_id = _safe_id(company_id, "company_id")
        if not safe_company_id:
            return []

        one_day_ago = (datetime.datetime.utcnow() - datetime.timedelta(days=1)).isoformat() + "Z"

        filter_str = (
            f'jsonPayload.companyId="{safe_company_id}" '
            f'AND severity >= {_safe_severity(severity_min)} '
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
        safe_ids = [i for i in (_safe_id(aid, "automation_id") for aid in automation_ids) if i]
        if not safe_ids:
            return []

        one_day_ago = (datetime.datetime.utcnow() - datetime.timedelta(days=1)).isoformat() + "Z"
        automation_filters = ' OR '.join([f'jsonPayload.automationId="{aid}"' for aid in safe_ids])

        filter_str = (
            f'({automation_filters}) '
            f'AND severity >= {_safe_severity(severity_min)} '
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

