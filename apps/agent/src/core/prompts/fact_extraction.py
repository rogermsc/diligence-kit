INFORMATION_TYPES = [
    "one_pager",
    "deck",
    "case_study",
    "contracts_esop",
    "advisors",
    "reference_list",
    "structure_incorporation",
    "shareholder_agreements",
    "client_contracts",
    "pipeline",
    "usage_data",
    "market_research",
    "go_to_market_strategy",
    "cap_table",
    "investment_docs",
    "technology_security_agreements",
    "patents_trademarks",
    "insurance",
    "policies",
    "additional_agreements",
    "quality_of_earnings",
    "working_capital",
    "revenue_analysis",
    "financial_forecasts",
]

# Fixed schema: fields the one-pager actually needs.
# Keys are field names, values are descriptions shown to the LLM.
EXTRACTION_FIELDS = {
    # Company Identity
    "company_name": "Legal or trading name of the target company",
    "industry": "Industry or sector the company operates in",
    "headquarters": "Physical office address or city/country of headquarters (NOT the state of legal incorporation)",
    "founded_year": "Year the company was founded or incorporated",
    "website": "Company website URL",
    # Financials (append period suffix: _fy2024, _h1_2025, etc.)
    "annual_revenue": "Total annual revenue (include currency and period)",
    "ebitda": "EBITDA or adjusted EBITDA (include currency and period)",
    "net_income": "Net income or net profit (include currency and period)",
    "total_assets": "Total assets (include currency and period)",
    "employees": "Number of employees or headcount of the TARGET COMPANY itself (not customers, market size, or third parties)",
    # Business
    "market_position": "Market share, ranking, or competitive position",
    "revenue_streams": "Primary sources of revenue or business lines",
    "geographic_presence": "Countries or regions where the company operates",
    "customer_base": "Customer types, segments, or total count",
    "competitive_advantages": "Key differentiators, moats, or unique capabilities",
    # Transaction & Deal
    "deal_type": "Type of transaction (acquisition, merger, investment, etc.)",
    "transaction_value": "Deal value or enterprise value (include currency)",
    "payment_structure": "Deal structure (cash, equity, earnout, etc.)",
    "transaction_timeline": "Expected close date or timeline milestones",
    # Key Terms
    "closing_conditions": "Conditions precedent to closing",
    "due_diligence_period": "Duration or deadline for due diligence",
    "regulatory_approvals": "Required regulatory or antitrust approvals",
    "financing": "How the transaction is financed",
    # Multi-value (one fact per item)
    "key_person": "Name and role of a key executive, founder, or board member",
    "shareholder": "Shareholder name with ownership percentage or share count",
    "risk_factor": "A specific risk identified in the documents",
    "product": "Product or service name with brief description",
    "certification": "Certification, accreditation, or quality standard held",
    "legal_issue": "Pending litigation, regulatory issue, or compliance concern",
    "patent_trademark": "Patent, trademark, or other IP asset",
}

# Financial fields that use period suffixes (e.g. annual_revenue_fy2024)
FINANCIAL_FIELDS = {"annual_revenue", "ebitda", "net_income", "total_assets"}

FACT_EXTRACTION_SYSTEM_PROMPT = """\
You are a due diligence analyst extracting structured facts from a company document.

### Target Company
The deal/project is: {company_name}
These dataroom documents relate to the target company or its subsidiaries. \
Extract facts about the company described in the documents. \
Ignore details about unrelated third parties (testing labs, law firms, \
regulators, suppliers) unless they describe the target company's \
relationships, risks, or assets.

### Fixed Schema
Extract facts ONLY for these fields. Do NOT invent new field names.

{fields_schema}

### Financial Period Convention
For financial fields (annual_revenue, ebitda, net_income, total_assets), \
append the period as a suffix: annual_revenue_fy2024, ebitda_h1_2025, net_income_fy2023.
If the period is unclear, use the base field name without a suffix.

**Extract EVERY period the document prints, not only the most recent.** A \
comparative statement puts several years in one row:

    Year Ended December 31,      2024       2023       2022
    Total revenue             894,384    914,242  1,655,035

That single row is THREE facts — annual_revenue_fy2024, annual_revenue_fy2023 \
and annual_revenue_fy2022. The same applies to the two columns of a balance \
sheet and to a prior-year column inside a note. Returning only the leftmost \
figure throws away the comparison, which is usually why the statement is being \
read at all.

### Rules
1. Extract ONLY facts that match the fields above. Skip irrelevant details.
2. Each fact MUST include a verbatim quote from the document as evidence.
3. Include the page number (for PDFs/docs) or sheet name + row (for spreadsheets).
4. If a value has a unit or currency, include it (e.g. "£3,005,013" not "3005013").
4b. A financial statement states its scale ONCE, in a column header or caption \
("(in thousands)", "$ in millions"). Carry that scale into EVERY figure you take \
from that table: "$98,011 thousand", never a bare "$98,011". A figure that \
arrives without its scale is read a thousand times too small further down.
5. For multi-value fields (key_person, shareholder, risk_factor, product, \
certification, legal_issue, patent_trademark), extract one fact per item.
6. Do NOT invent or infer facts not explicitly stated in the document.
6b. For multi-value fields, extract a fact ONLY if the document **substantively \
addresses** that topic. Incidental or boilerplate mentions do NOT qualify:
   - A standard IP assignment clause in an employment contract is NOT a \
"patent_trademark" fact — it is context for "contracts_esop".
   - A generic indemnity clause mentioning insurance is NOT an "insurance" fact.
   - A brief mention of a competitor in a pitch deck is NOT a "market_research" fact.
   Ask: "Would a diligence analyst cite THIS document as evidence for this field?" \
If not, do not extract it under that field.
7. If a document is mostly irrelevant to these fields (e.g. third-party test \
reports, supplier terms, regulatory boilerplate), extract only directly relevant \
facts (e.g. a certification name or a risk) and move on quickly.
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

### Coverage Classification
After extracting facts, identify which of these information types the document \
**substantively** covers:
{information_types}

**STRICT RULES for coverage classification:**
- A document covers a type ONLY if it is **primarily about** or **dedicates a \
significant section** to that category.
- Incidental or boilerplate mentions do NOT count. For example:
  - An employment contract with a standard IP assignment clause does NOT cover \
"patents_trademarks" — it covers "contracts_esop".
  - A shareholder agreement mentioning insurance requirements does NOT cover \
"insurance" — it covers "shareholder_agreements".
  - A pitch deck briefly mentioning revenue does NOT cover "revenue_analysis" \
— it covers "deck".
- Ask yourself: "Is this document something a diligence analyst would file \
under this category?" If the answer is no, do NOT include it.
- When in doubt, do NOT include the type. Fewer accurate classifications are \
better than many loose ones.\
"""

FACT_EXTRACTION_USER_PROMPT = """\
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
