from typing import List, Literal

from pydantic import BaseModel, Field


class DiligenceDocumentRequest(BaseModel):
    id: str = Field(..., max_length=100, pattern=r"^[a-zA-Z0-9_-]+$")
    url: str = Field(..., max_length=1000)
    openai_file_id: str | None = Field(default=None, max_length=200)


class DiligenceAutomation(BaseModel):
    automation_id: str = Field(..., max_length=100, pattern=r"^[a-zA-Z0-9_-]+$")
    company_id: str = Field(..., max_length=100, pattern=r"^[a-zA-Z0-9_-]+$")
    company_name: str = Field(..., max_length=200)
    domain: Literal["OPERATIONAL", "COMMERCIAL", "FINANCIAL", "CAP_TABLE_AND_LEGAL_REVIEW"]
    documents: List[DiligenceDocumentRequest] = Field(default=[])


class DiligenceRequest(BaseModel):
    automations: List[DiligenceAutomation] = Field(..., max_length=10)


class DiligenceResponse(BaseModel):
    success: bool
    message: str
