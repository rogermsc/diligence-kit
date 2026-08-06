from typing import Any, Dict, Literal, Optional

from pydantic import BaseModel, Field


class AnalysisResult(BaseModel):
    """
    Technical analysis or document query result.
    """
    summary: str = Field(..., description="Technical summary of what was found")
    details: Optional[Dict[str, Any]] = Field(default=None, description="Raw technical details (ex: logs)")
    source: Literal["LOGS", "DOCS", "NONE"] = Field(..., description="Information source")
