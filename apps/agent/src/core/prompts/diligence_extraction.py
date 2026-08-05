"""Domain-specific extraction fields and prompts for the 4 diligence domains.

Each domain defines:
- EXTRACTION_FIELDS — domain-specific fields to extract
- FINANCIAL_FIELDS — fields with period suffixes (if applicable)
- INFORMATION_TYPES — relevant document categories
- SYSTEM_PROMPT / USER_PROMPT — extraction instructions
"""

# ---------------------------------------------------------------------------
# Shared prompt templates (same structure as one-pager extraction)
# ---------------------------------------------------------------------------

_SYSTEM_PROMPT_TEMPLATE = """\
You are a due diligence analyst extracting structured facts for a {domain_label} report.

### Target Company
The deal/project is: {{company_name}}
These dataroom documents relate to the target company or its subsidiaries. \
Extract facts about the company described in the documents. \
Ignore details about unrelated third parties (testing labs, law firms, \
regulators, suppliers) unless they describe the target company's \
relationships, risks, or assets.

### Fixed Schema
Extract facts ONLY for these fields. Do NOT invent new field names.

{{fields_schema}}

{financial_convention}

### Rules
1. Extract ONLY facts that match the fields above. Skip irrelevant details.
2. Each fact MUST include a verbatim quote from the document as evidence.
3. Include the page number (for PDFs/docs) or sheet name + row (for spreadsheets).
4. If a value has a unit or currency, include it (e.g. "£3,005,013" not "3005013").
5. For multi-value fields, extract one fact per item.
6. Do NOT invent or infer facts not explicitly stated in the document.
7. If a document is mostly irrelevant to these fields (e.g. third-party test \
reports, supplier terms, regulatory boilerplate), extract only directly relevant \
facts and move on quickly.
8. For EVERY financial fact, classify the source_type:
   - "actual" — from audited financials, management accounts, tax returns, or verified operating results
   - "pro_forma" — from pro forma statements, scenario models, or forward-looking financial models
   - "projection" — from forecasts, business plans, budgets, or scenario analyses
   If the source document title or content includes "Pro Forma", "Forecast", \
"Projected", "Scenario", or "Estimated", classify as "pro_forma" or "projection". \
When uncertain, use "pro_forma" (err on the side of caution). \
For non-financial facts, leave source_type as an empty string.
9. Extract document_version and document_date for provenance:
   - document_version: version identifier from the filename or document header (e.g. "v1.5", "vA1", "Series A1"). Leave empty if none.
   - document_date: the most specific date found in the document (e.g. signing date, effective date, publication date) in YYYY-MM-DD format. Leave empty if none.

### Coverage
After extracting facts, identify which of these information types the document \
covers (even partially):
{{information_types}}

A document "covers" a type if it contains ANY relevant data for that category.\
"""

_FINANCIAL_CONVENTION = """\
### Financial Period Convention
For financial fields, append the period as a suffix (e.g. annual_revenue_fy2024, \
ebitda_h1_2025). If comparative figures exist, extract EACH period as a separate fact. \
If the period is unclear, use the base field name without a suffix."""

_NO_FINANCIAL_CONVENTION = ""

_USER_PROMPT_TEMPLATE = """\
Document: {file_name}

---
{content}
---

Extract facts matching the schema above. Respond with valid JSON:

{{
  "facts": [
    {{
      "field": "string (field name from the schema — no invented names)",
      "value": "string (the extracted value with units/currency)",
      "page": "string (page number, sheet name, or cell reference)",
      "quote": "string (verbatim excerpt from the document proving this fact)",
      "source_type": "string (\"actual\", \"pro_forma\", \"projection\", or \"\" for non-financial facts)",
      "document_version": "string (version from filename/header, e.g. \"v1.5\", or \"\")",
      "document_date": "string (YYYY-MM-DD date from the document, or \"\")"
    }}
  ],
  "coverage": ["string (information type ids from the list above)"]
}}\
"""

# ---------------------------------------------------------------------------
# OPERATIONAL
# ---------------------------------------------------------------------------

OPERATIONAL_EXTRACTION_FIELDS = {
    # Org structure
    "org_structure": "Organizational structure, hierarchy, or reporting lines",
    "headcount": "Total employee count or headcount of the TARGET COMPANY by department/function (not customers or market size)",
    "key_person": "Name and role of a key executive, founder, or board member",
    "succession_plan": "Succession planning or key-person dependency risk",
    # Technology
    "tech_stack": "Technology platform, stack, or core technical infrastructure",
    "tech_scalability": "Scalability indicators, architecture capacity, or tech debt",
    "tech_security": "Security certifications, practices, or vulnerabilities",
    # Processes
    "process_description": "Key operational process, workflow, or SOP",
    "bottleneck": "Operational bottleneck, inefficiency, or constraint",
    "automation_level": "Degree of automation or manual processes",
    # HR & Compliance
    "hr_policy": "HR policy, employee benefit, or workplace compliance",
    "employee_turnover": "Staff turnover rate, retention metrics, or attrition data",
    "training_program": "Training, development, or onboarding programs",
    # Scalability
    "scalability_indicator": "Evidence of operational scalability or growth capacity",
    "capacity_utilization": "Current capacity utilization or production throughput",
    # Financial Ops
    "opex_breakdown": "Operating expense breakdown or cost structure",
    "capex": "Capital expenditure items or plans",
    # Risk
    "operational_risk": "Specific operational risk or vulnerability identified",
    "certification": "Certification, accreditation, or quality standard held",
    "legal_compliance": "Regulatory compliance status or issue",
}

OPERATIONAL_FINANCIAL_FIELDS = {"opex_breakdown", "capex"}

OPERATIONAL_INFORMATION_TYPES = [
    "one_pager", "deck", "structure_incorporation", "policies",
    "technology_security_agreements", "contracts_esop", "advisors",
    "insurance", "quality_of_earnings", "additional_agreements",
]

OPERATIONAL_SYSTEM_PROMPT = _SYSTEM_PROMPT_TEMPLATE.format(
    domain_label="Operational Due Diligence",
    financial_convention=_FINANCIAL_CONVENTION,
)

OPERATIONAL_USER_PROMPT = _USER_PROMPT_TEMPLATE

# Unique fields for conflict detection
OPERATIONAL_UNIQUE_FIELDS = {
    "headcount", "tech_stack", "automation_level", "capacity_utilization",
}

# ---------------------------------------------------------------------------
# COMMERCIAL
# ---------------------------------------------------------------------------

COMMERCIAL_EXTRACTION_FIELDS = {
    # Market
    "tam": "Total Addressable Market (TAM) size and methodology",
    "sam": "Serviceable Addressable Market (SAM) estimate",
    "som": "Serviceable Obtainable Market (SOM) or current market share",
    "market_growth_rate": "Market growth rate or CAGR",
    "industry_trend": "Key industry trend, shift, or disruption",
    # Customers
    "customer_segment": "Customer segment, persona, or target audience",
    "customer_count": "Total number of customers or accounts",
    "cac": "Customer Acquisition Cost (CAC)",
    "ltv": "Customer Lifetime Value (LTV)",
    "churn_rate": "Customer churn rate or retention rate",
    "nrr": "Net Revenue Retention (NRR) or expansion revenue",
    # Competition
    "competitor": "Competitor name, positioning, or market share",
    "competitive_advantage": "Competitive moat, differentiation, or barrier to entry",
    # Revenue model
    "pricing_model": "Pricing model, tiers, or strategy",
    "revenue_stream": "Revenue stream or business line with contribution",
    "contract_value": "Key contract value, ACV, or deal size",
    "contract_duration": "Contract duration, renewal terms, or lock-in",
    # Go-to-market
    "gtm_strategy": "Go-to-market strategy, channel, or distribution approach",
    "sales_cycle": "Sales cycle length or conversion funnel metrics",
    "partnership": "Strategic partnership, alliance, or distribution agreement",
    # Pipeline
    "pipeline_value": "Sales pipeline value or weighted pipeline",
    "pipeline_stage": "Pipeline stage breakdown or conversion rates",
}

COMMERCIAL_FINANCIAL_FIELDS = {
    "cac", "ltv", "contract_value", "pipeline_value",
}

COMMERCIAL_INFORMATION_TYPES = [
    "one_pager", "deck", "client_contracts", "pipeline", "usage_data",
    "market_research", "go_to_market_strategy", "reference_list",
    "investment_docs", "revenue_analysis",
]

COMMERCIAL_SYSTEM_PROMPT = _SYSTEM_PROMPT_TEMPLATE.format(
    domain_label="Commercial Due Diligence & Market Sizing",
    financial_convention=_FINANCIAL_CONVENTION,
)

COMMERCIAL_USER_PROMPT = _USER_PROMPT_TEMPLATE

COMMERCIAL_UNIQUE_FIELDS = {
    "tam", "sam", "som", "market_growth_rate", "customer_count",
    "churn_rate", "nrr", "pricing_model",
}

# ---------------------------------------------------------------------------
# FINANCIAL
# ---------------------------------------------------------------------------

FINANCIAL_EXTRACTION_FIELDS = {
    # Revenue
    "annual_revenue": "Total annual revenue (include currency and period)",
    "revenue_breakdown": "Revenue breakdown by segment, product, or geography",
    "revenue_recognition": "Revenue recognition policy or method",
    "recurring_revenue": "Recurring revenue %, ARR, or MRR",
    # Profitability
    "cogs": "Cost of goods sold or cost of revenue",
    "gross_margin": "Gross margin or gross profit (include currency and period)",
    "ebitda": "EBITDA or adjusted EBITDA (include currency and period)",
    "net_income": "Net income or net profit (include currency and period)",
    "operating_expenses": "Operating expense total or breakdown by category",
    # Cash flow
    "operating_cash_flow": "Operating cash flow (include currency and period)",
    "free_cash_flow": "Free cash flow (include currency and period)",
    "burn_rate": "Monthly burn rate or runway",
    "capex": "Capital expenditure (include currency and period)",
    # Balance sheet
    "total_assets": "Total assets (include currency and period)",
    "total_liabilities": "Total liabilities (include currency and period)",
    "cash_position": "Cash and cash equivalents (include currency and period)",
    "working_capital": "Working capital or net current assets",
    "dso": "Days Sales Outstanding (DSO)",
    "dpo": "Days Payable Outstanding (DPO)",
    "inventory_days": "Inventory days or turnover",
    # Debt
    "debt_total": "Total debt or borrowings (include currency)",
    "debt_instrument": "Specific debt instrument, facility, or covenant",
    "interest_expense": "Interest expense (include currency and period)",
    # Tax
    "tax_rate": "Effective tax rate or tax provision",
    "tax_issue": "Tax dispute, contingent liability, or compliance issue",
    # Forecasts
    "forecast_revenue": "Projected or forecasted revenue (include period)",
    "forecast_ebitda": "Projected or forecasted EBITDA (include period)",
    "forecast_assumption": "Key assumption underlying financial forecasts",
    # Quality of earnings
    "adjustment": "Quality of earnings adjustment or normalisation item",
    "one_off_item": "One-off, non-recurring, or exceptional item",
}

FINANCIAL_FINANCIAL_FIELDS = {
    "annual_revenue", "cogs", "gross_margin", "ebitda", "net_income",
    "operating_expenses", "operating_cash_flow", "free_cash_flow", "capex",
    "total_assets", "total_liabilities", "cash_position", "working_capital",
    "debt_total", "interest_expense", "forecast_revenue", "forecast_ebitda",
}

FINANCIAL_INFORMATION_TYPES = [
    "quality_of_earnings", "working_capital", "revenue_analysis",
    "financial_forecasts", "one_pager", "deck", "investment_docs",
    "cap_table", "insurance", "additional_agreements",
]

FINANCIAL_SYSTEM_PROMPT = _SYSTEM_PROMPT_TEMPLATE.format(
    domain_label="Financial Due Diligence",
    financial_convention=_FINANCIAL_CONVENTION,
)

FINANCIAL_USER_PROMPT = _USER_PROMPT_TEMPLATE

FINANCIAL_UNIQUE_FIELDS = {
    "revenue_recognition", "recurring_revenue", "burn_rate",
    "dso", "dpo", "inventory_days", "tax_rate",
}

# ---------------------------------------------------------------------------
# CAP TABLE & LEGAL
# ---------------------------------------------------------------------------

CAP_TABLE_LEGAL_EXTRACTION_FIELDS = {
    # Cap table
    "share_class": "Share class name, rights, preferences, and number of shares",
    "shareholder": "Shareholder name with ownership percentage or share count",
    "option_pool": "Option pool size, allocated vs unallocated, vesting terms",
    "safe_note": "SAFE or convertible note terms (cap, discount, amount)",
    "warrant": "Warrant terms, exercise price, and expiry",
    # Investor rights
    "investor_right": "Investor right (anti-dilution, pro-rata, drag-along, etc.)",
    "board_seat": "Board composition, observer rights, or governance terms",
    "liquidation_preference": "Liquidation preference multiple and type (participating/non)",
    "side_letter": "Side letter provision or special term for specific investor",
    # Legal
    "incorporation_doc": "Articles, bylaws, or certificate of incorporation details",
    "legal_filing": "Government filing, registration, or statutory compliance",
    "litigation": "Pending or threatened litigation, arbitration, or dispute",
    "regulatory_issue": "Regulatory investigation, enforcement, or compliance gap",
    # IP
    "ip_assignment": "IP assignment agreement status (founders, employees, contractors)",
    "patent_trademark": "Patent, trademark, or other registered IP asset",
    "license_agreement": "IP license, technology license, or open-source dependency",
    # Compliance
    "data_privacy": "Data privacy compliance (GDPR, CCPA, etc.) status or gap",
    "employment_compliance": "Employment law compliance, contractor misclassification risk",
    "insurance_coverage": "Insurance policy type, coverage amount, or gap",
    # Agreements
    "shareholder_agreement": "Key term from shareholder or stockholder agreement",
    "key_contract_risk": "Material contract with unusual terms, change-of-control, or risk",
}

CAP_TABLE_LEGAL_FINANCIAL_FIELDS = set()  # No financial period fields

CAP_TABLE_LEGAL_INFORMATION_TYPES = [
    "cap_table", "investment_docs", "shareholder_agreements",
    "contracts_esop", "structure_incorporation", "patents_trademarks",
    "insurance", "policies", "additional_agreements", "advisors",
]

CAP_TABLE_LEGAL_SYSTEM_PROMPT = _SYSTEM_PROMPT_TEMPLATE.format(
    domain_label="Cap Table & Legal Document Review",
    financial_convention=_NO_FINANCIAL_CONVENTION,
)

CAP_TABLE_LEGAL_USER_PROMPT = _USER_PROMPT_TEMPLATE

CAP_TABLE_LEGAL_UNIQUE_FIELDS = {
    "option_pool", "liquidation_preference",
}

# ---------------------------------------------------------------------------
# Domain config registry
# ---------------------------------------------------------------------------


class DomainExtractionConfig:
    """Holds all extraction configuration for a single diligence domain."""

    def __init__(
        self,
        extraction_fields: dict,
        financial_fields: set,
        information_types: list,
        system_prompt: str,
        user_prompt: str,
        unique_fields: set,
        financial_prefixes: set,
    ):
        self.extraction_fields = extraction_fields
        self.financial_fields = financial_fields
        self.information_types = information_types
        self.system_prompt = system_prompt
        self.user_prompt = user_prompt
        self.unique_fields = unique_fields
        self.financial_prefixes = financial_prefixes


DOMAIN_EXTRACTION_CONFIGS = {
    "OPERATIONAL": DomainExtractionConfig(
        extraction_fields=OPERATIONAL_EXTRACTION_FIELDS,
        financial_fields=OPERATIONAL_FINANCIAL_FIELDS,
        information_types=OPERATIONAL_INFORMATION_TYPES,
        system_prompt=OPERATIONAL_SYSTEM_PROMPT,
        user_prompt=OPERATIONAL_USER_PROMPT,
        unique_fields=OPERATIONAL_UNIQUE_FIELDS,
        financial_prefixes=OPERATIONAL_FINANCIAL_FIELDS,
    ),
    "COMMERCIAL": DomainExtractionConfig(
        extraction_fields=COMMERCIAL_EXTRACTION_FIELDS,
        financial_fields=COMMERCIAL_FINANCIAL_FIELDS,
        information_types=COMMERCIAL_INFORMATION_TYPES,
        system_prompt=COMMERCIAL_SYSTEM_PROMPT,
        user_prompt=COMMERCIAL_USER_PROMPT,
        unique_fields=COMMERCIAL_UNIQUE_FIELDS,
        financial_prefixes=COMMERCIAL_FINANCIAL_FIELDS,
    ),
    "FINANCIAL": DomainExtractionConfig(
        extraction_fields=FINANCIAL_EXTRACTION_FIELDS,
        financial_fields=FINANCIAL_FINANCIAL_FIELDS,
        information_types=FINANCIAL_INFORMATION_TYPES,
        system_prompt=FINANCIAL_SYSTEM_PROMPT,
        user_prompt=FINANCIAL_USER_PROMPT,
        unique_fields=FINANCIAL_UNIQUE_FIELDS,
        financial_prefixes=FINANCIAL_FINANCIAL_FIELDS,
    ),
    "CAP_TABLE_AND_LEGAL_REVIEW": DomainExtractionConfig(
        extraction_fields=CAP_TABLE_LEGAL_EXTRACTION_FIELDS,
        financial_fields=CAP_TABLE_LEGAL_FINANCIAL_FIELDS,
        information_types=CAP_TABLE_LEGAL_INFORMATION_TYPES,
        system_prompt=CAP_TABLE_LEGAL_SYSTEM_PROMPT,
        user_prompt=CAP_TABLE_LEGAL_USER_PROMPT,
        unique_fields=CAP_TABLE_LEGAL_UNIQUE_FIELDS,
        financial_prefixes=CAP_TABLE_LEGAL_FINANCIAL_FIELDS,
    ),
}
