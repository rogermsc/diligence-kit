from typing import Dict, List

from pydantic import BaseModel

from src.domain.analyze.entities import Document


class DiligenceInput(BaseModel):
    company_id: str
    company_name: str
    automation_id: str
    domain: str  # OPERATIONAL, COMMERCIAL, FINANCIAL, CAP_TABLE_AND_LEGAL_REVIEW
    documents: List[Document] = []


# ---------------------------------------------------------------------------
# Domain report models — flat string fields matching DOCX template variables
# ---------------------------------------------------------------------------


class OperationalReport(BaseModel):
    executive_summary: str
    company_overview: str
    org_structure: str
    hr_talent: str
    tech_infrastructure: str
    process_systems: str
    gtm_execution: str
    financial_ops: str
    legal_risk: str
    scalability: str
    key_risks: str
    recommendations: str


class CommercialReport(BaseModel):
    executive_summary: str
    business_overview: str
    market_overview: str
    industry_trends: str
    competitive_landscape: str
    customer_analysis: str
    gtm_strategy: str
    revenue_quality: str
    key_contracts: str
    risks_mitigation: str
    recommendations: str


class FinancialReport(BaseModel):
    executive_summary: str
    company_overview: str
    income_statement: str
    quality_of_earnings: str
    revenue_recognition: str
    gross_margin_cost: str
    working_capital: str
    cash_flow: str
    balance_sheet: str
    debt_items: str
    tax_matters: str
    forecast_budget: str
    key_risks: str
    recommendations: str


class CapTableReport(BaseModel):
    executive_summary: str
    company_structure: str
    cap_table_overview: str
    convertible_instruments: str
    equity_grant_docs: str
    legal_compliance: str
    investor_rights: str
    side_letters: str
    option_pool_analysis: str
    key_risks: str
    recommendations: str


# Union type for convenience
DiligenceReport = OperationalReport | CommercialReport | FinancialReport | CapTableReport

DOMAIN_REPORT_MODELS: Dict[str, type] = {
    "OPERATIONAL": OperationalReport,
    "COMMERCIAL": CommercialReport,
    "FINANCIAL": FinancialReport,
    "CAP_TABLE_AND_LEGAL_REVIEW": CapTableReport,
}
