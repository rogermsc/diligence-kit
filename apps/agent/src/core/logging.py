import json
import logging
import sys
from contextvars import ContextVar
from datetime import datetime, timezone
from typing import Optional

from .config import settings

_log_context: ContextVar[dict] = ContextVar("log_context", default={})


def set_log_context(
    company_id: Optional[str] = None, automation_id: Optional[str] = None
):
    _log_context.set(
        {"company_id": company_id or "N/A", "automation_id": automation_id or "N/A"}
    )


def reset_log_context():
    _log_context.set({})


# Map Python log levels to GCP Cloud Logging severity names
_SEVERITY_MAP = {
    "DEBUG": "DEBUG",
    "INFO": "INFO",
    "WARNING": "WARNING",
    "ERROR": "ERROR",
    "CRITICAL": "CRITICAL",
}


class GCPJsonFormatter(logging.Formatter):
    """Outputs structured JSON that GKE parses into jsonPayload.

    Field names use camelCase to match the liaison agent's GCP log queries
    (jsonPayload.automationId, jsonPayload.companyId).
    """

    def format(self, record: logging.LogRecord) -> str:
        entry = {
            "severity": _SEVERITY_MAP.get(record.levelname, record.levelname),
            "message": record.getMessage(),
            "component": record.name,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "automationId": getattr(record, "automation_id", "N/A"),
            "companyId": getattr(record, "company_id", "N/A"),
        }

        if record.exc_info and record.exc_info[0] is not None:
            entry["exception"] = self.formatException(record.exc_info)

        return json.dumps(entry, default=str)


class ContextFilter(logging.Filter):
    def filter(self, record):
        ctx = _log_context.get()
        record.company_id = ctx.get("company_id", "N/A")
        record.automation_id = ctx.get("automation_id", "N/A")
        return True


def setup_logging(level: Optional[str] = None):
    level = level or settings.log_level

    handler = logging.StreamHandler(sys.stdout)
    handler.addFilter(ContextFilter())
    handler.setFormatter(GCPJsonFormatter())

    logging.basicConfig(level=getattr(logging, level.upper()), handlers=[handler])


def get_logger(name: str) -> logging.Logger:
    return logging.getLogger(name)
