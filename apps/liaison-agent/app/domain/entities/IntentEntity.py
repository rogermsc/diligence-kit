from typing import Literal, Optional, Dict, Any
from pydantic import BaseModel, Field

class Intent(BaseModel):
    """
    Represents the classified intent of the user.
    """
    category: Literal["ERROR_REPORT", "HOW_TO", "CHITCHAT"] = Field(
        ..., 
        description="Intent category: ERROR_REPORT (technical problems), HOW_TO (usage questions), CHITCHAT (chit-chat)"
    )
    confidence: float = Field(..., description="Confidence level of the classification (0.0 to 1.0)")
    extracted_entities: Dict[str, Any] = Field(
        default_factory=dict, 
        description="Extracted entities, ex: {'automation_id': 'uuid', 'document_type': 'pdf'}"
    )


