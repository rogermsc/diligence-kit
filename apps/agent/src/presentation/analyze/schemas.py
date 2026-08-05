from typing import List

from pydantic import BaseModel, Field


class DocumentRequest(BaseModel):
    id: str = Field(..., max_length=100, pattern=r"^[a-zA-Z0-9_-]+$")
    url: str = Field(..., max_length=1000)
    openai_file_id: str | None = Field(default=None, max_length=200)


class AnalyzeRequest(BaseModel):
    company_id: str = Field(..., max_length=100, pattern=r"^[a-zA-Z0-9_-]+$")
    company_name: str = Field(..., max_length=200)
    automation_id: str = Field(..., max_length=100, pattern=r"^[a-zA-Z0-9_-]+$")
    documents: List[DocumentRequest] = Field(default=[])
    retry: bool = False


class AnalyzeResponse(BaseModel):
    success: bool
    message: str
    automation_id: str
