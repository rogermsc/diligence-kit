from typing import Dict, List, Optional

from pydantic import BaseModel


class Document(BaseModel):
    id: str
    url: str
    openai_file_id: str | None = None


class AnalyzeInput(BaseModel):
    company_id: str
    company_name: str
    automation_id: str
    documents: List[Document] = []
    retry: bool = False


class PreparedDocument(BaseModel):
    document_id: str
    file_name: str
    text_content: Optional[str] = None  # Excel CSVs
    pdf_data: Optional[str] = None  # base64 whole PDF (uploaded to OpenAI Files API)
    openai_file_id: Optional[str] = None  # Pre-uploaded OpenAI file_id (skip re-upload)


# --- Fact extraction entities ---


class Fact(BaseModel):
    field: str
    value: str
    source: str  # file name
    page: str  # page number, sheet name, or cell reference
    quote: str  # verbatim excerpt from the document
    source_type: str = ""  # "actual", "pro_forma", "projection", or ""
    document_version: str = ""  # e.g. "v1.5", "vA1"
    document_date: str = ""  # e.g. "2023-09-20"


class DocumentFacts(BaseModel):
    document_id: str
    file_name: str
    facts: List[Fact]
    coverage: List[str]  # which of the 23 information types this doc covers


class Conflict(BaseModel):
    field: str
    values: List[str]  # e.g. ["£3M (financials.pdf p.3)", "£2.8M (projections.xlsx)"]
    preferred_value: str = ""  # resolved preferred value from newest document version


class MergedFacts(BaseModel):
    facts: Dict[str, List[Fact]]  # field -> all facts (may have multiple sources)
    coverage: Dict[str, List[str]]  # info_type -> list of source file names
    missing: List[str]  # info types not covered by any document
    conflicts: List[Conflict]


# --- One-pager entities ---


class CompanyOverview(BaseModel):
    name: str
    industry: str
    headquarters: str
    founded: str
    website: str


class FinancialHighlights(BaseModel):
    annual_revenue: str
    ebitda: str
    net_income: str
    total_assets: str
    employees: str
    projections: str = ""


class BusinessMetrics(BaseModel):
    market_position: str
    primary_revenue_streams: str
    geographic_presence: str
    customer_base: str
    competitive_advantages: str


class ScorecardCategory(BaseModel):
    category: str
    score: str  # e.g. "2.5/5"
    weighted_score: str  # e.g. "0.50"
    key_issues: List[str]


class RiskFactor(BaseModel):
    risk: str
    mitigation: str


class TransactionStructure(BaseModel):
    category: str
    value: str
    payment: str
    timeline: str


class DealRationale(BaseModel):
    strategic_objectives: str
    synergies_expected: str
    market_rationale: str


class KeyTerms(BaseModel):
    closing_conditions: str
    due_diligence_period: str
    regulatory_approvals: str
    financing: str


class SummaryHighlights(BaseModel):
    primary_risk_areas: str
    key_strengths: str


class OnePager(BaseModel):
    executive_summary: str
    company_overview: CompanyOverview
    financial_highlights: FinancialHighlights
    business_metrics: BusinessMetrics
    scorecard: List[ScorecardCategory]
    overall_score: str  # e.g. "2.6/5.0"
    # Fraction of the 1.0 rubric the scorecard actually covered. The overall is
    # normalised over it, so without this a headline from a partial scorecard is
    # indistinguishable from one computed over the whole thing.
    scorecard_coverage: str = "1.00"
    transaction_structure: TransactionStructure
    deal_rationale: DealRationale
    key_terms: KeyTerms
    critical_risk_factors: List[RiskFactor]
    key_success_factors: List[str]
    summary_highlights: SummaryHighlights
