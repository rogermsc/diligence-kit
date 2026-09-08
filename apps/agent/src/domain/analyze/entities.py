from typing import Dict, List, Optional

from pydantic import BaseModel


class Document(BaseModel):
    id: str
    url: str
    openai_file_id: str | None = None
    # The document's text layer, captured at Step 0 while its bytes are in hand.
    # Once uploaded, only the file_id survives, and quote verification would have
    # nothing to check a PDF against.
    source_text: str | None = None


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
    source_text: Optional[str] = None  # text layer carried over from Step 0


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

    # How well this fact is tied back to its document. Both are derived from what
    # came back, not asked of the model — see data/analyze/grounding.py.
    grounding: str = ""  # "quoted", "quoted_unlocated", or "unquoted"
    # True/False once checked against the source text; None when there was no
    # source text to check — a retry carrying only an openai_file_id, or a scan
    # with no text layer. "Could not check" is not "failed the check".
    quote_verified: Optional[bool] = None

    # Does the cited spreadsheet row actually hold this figure? Three states for
    # the same reason as quote_verified: None means the question does not apply
    # or could not be answered — a PDF page reference reaches this code too.
    # See domain/analyze/cells.py. The row is the unit; the column is
    # deliberately unchecked, because citing a row's label cell is reasonable.
    cell_verified: Optional[bool] = None

    # False when a financial figure states no scale, so "$ 98,011" cannot be
    # told from ninety-eight thousand. None when the question does not apply —
    # headcount is exempt. Carried rather than dropped: an unscaled figure can
    # fabricate a thousand-fold conflict, and a reader has to be able to see
    # that is what happened.
    unit_stated: Optional[bool] = None


class DocumentFacts(BaseModel):
    document_id: str
    file_name: str
    facts: List[Fact]
    coverage: List[str]  # which of the 23 information types this doc covers


class Conflict(BaseModel):
    field: str
    values: List[str]  # e.g. ["£3M (financials.pdf p.3)", "£2.8M (projections.xlsx)"]

    # How the disagreement was settled. Derived by a stated rule in
    # domain/analyze/authority.py, not asked of a model — a reader can disagree
    # with the rule, which they cannot do with a preference.
    preferred_value: str = ""
    preferred_source: str = ""  # the document the preferred value came from
    resolution_basis: str = ""  # source_type | document_authority | recency | unresolved
    rationale: str = ""  # one sentence naming the rule that decided it
    # 0.0 when nothing resolved it. Derived from which rule fired and how
    # authoritative the winner was; never a number a model produced.
    confidence: float = 0.0
    magnitude: str = ""  # e.g. "28% spread, £3.2M to £4.1M"; "" if unparseable


class SuppressedConflict(BaseModel):
    """A flagged disagreement the model judged was not a real one, and why.

    fact_merge flags a contradiction deterministically; a model then gets one
    say — is this the same figure written two ways? When it answers yes the
    conflict is dropped, and that used to leave no trace anywhere but a log
    line. A dataroom where a disagreement was raised and dismissed is not the
    same as one where nothing disagreed, and a reader is entitled to the
    difference.
    """

    conflict: Conflict
    reason: str  # the model's stated reason for calling it a false positive


class MergedFacts(BaseModel):
    facts: Dict[str, List[Fact]]  # field -> all facts (may have multiple sources)
    coverage: Dict[str, List[str]]  # info_type -> list of source file names
    missing: List[str]  # info types not covered by any document
    conflicts: List[Conflict]
    # Raised, then dismissed. Never silently: see SuppressedConflict.
    suppressed_conflicts: List[SuppressedConflict] = []


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

    # Headline lines that print a figure the rule rejected and not the one it
    # chose. This is the worst outcome the pipeline can produce — the
    # reconciliation was right and the memorandum does not reflect it — and it
    # used to exist only as a log line, so the PDF shipped and every caller
    # reported success. Empty on a healthy run.
    adjudication_mismatches: List[str] = []
