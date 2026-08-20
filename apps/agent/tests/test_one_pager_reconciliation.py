"""The memorandum has to say where the documents disagreed.

Everything upstream of the DOCX was careful about this: facts carry provenance,
`authority.py` settles a disagreement by a written rule, the conflicts view
shows the losing values. Then the memorandum — the one artefact that leaves the
building and reaches an investment committee — printed £3.2M and nothing else.
The conflicts were fed to synthesis as prompt context, so whether any of it
survived into the page depended on what the model felt like writing.

These render the real template and read the text back out.
"""

import docx
import pytest

from src.data.analyze.document_renderer import reconciliation_lines, render_docx
from src.domain.analyze.entities import (
    BusinessMetrics,
    CompanyOverview,
    Conflict,
    DealRationale,
    FinancialHighlights,
    KeyTerms,
    OnePager,
    RiskFactor,
    ScorecardCategory,
    SummaryHighlights,
    TransactionStructure,
)

REVENUE = Conflict(
    field="annual_revenue_fy2024",
    values=[
        "£4.1M (01_pitch_deck.pdf p.4)",
        "£3.8M (03_financial_model.xlsx Summary!B10)",
        "£3.2M (04_audited_accounts.pdf p.2)",
    ],
    preferred_value="£3.2M",
    preferred_source="04_audited_accounts.pdf",
    resolution_basis="source_type",
    rationale="the audited accounts state an actual; the other two are pro forma.",
    confidence=1.0,
    magnitude="28% spread, £3.2M to £4.1M",
)

HEADCOUNT = Conflict(
    field="employees",
    values=["52 (02_hr_pack.pdf p.1)", "49 (01_pitch_deck.pdf p.9)"],
    resolution_basis="unresolved",
    magnitude="6% spread, 49 to 52",
)


def one_pager() -> OnePager:
    return OnePager(
        executive_summary="A summary.",
        company_overview=CompanyOverview(
            name="Northwind", industry="SaaS", headquarters="London",
            founded="2019", website="northwind.example",
        ),
        financial_highlights=FinancialHighlights(
            annual_revenue="£3.2M", ebitda="£0.4M", net_income="£0.2M",
            total_assets="£7.4M", employees="52",
        ),
        business_metrics=BusinessMetrics(
            market_position="", primary_revenue_streams="", geographic_presence="",
            customer_base="", competitive_advantages="",
        ),
        scorecard=[ScorecardCategory(
            category="Financial Readiness", score="3.0/5", weighted_score="0.60", key_issues=[],
        )],
        overall_score="3.0/5.0",
        transaction_structure=TransactionStructure(category="", value="", payment="", timeline=""),
        deal_rationale=DealRationale(
            strategic_objectives="", synergies_expected="", market_rationale="",
        ),
        key_terms=KeyTerms(
            closing_conditions="", due_diligence_period="",
            regulatory_approvals="", financing="",
        ),
        critical_risk_factors=[RiskFactor(risk="r", mitigation="m")],
        key_success_factors=["k"],
        summary_highlights=SummaryHighlights(primary_risk_areas="", key_strengths=""),
    )


def rendered_text(conflicts) -> str:
    import io
    document = docx.Document(io.BytesIO(
        render_docx(one_pager(), "Northwind", "auto-1", conflicts)))
    return "\n".join(p.text for p in document.paragraphs)


def test_the_rejected_figures_reach_the_page():
    """The point of the product is the two values that did not win."""
    text = rendered_text([REVENUE])

    assert "£3.2M" in text
    for rejected in ("£4.1M", "£3.8M"):
        assert rejected in text, (
            f"the memorandum prints the winner and never mentions {rejected}, "
            f"which is the disagreement it exists to report"
        )
    assert "01_pitch_deck.pdf" in text and "04_audited_accounts.pdf" in text


def test_the_rule_that_decided_it_is_printed_not_a_preference():
    text = rendered_text([REVENUE])
    assert "source_type" in text
    assert "the audited accounts state an actual" in text
    assert "28% spread" in text


def test_an_unresolved_disagreement_says_so_rather_than_picking_one():
    text = rendered_text([HEADCOUNT])
    assert "not settled by the dataroom" in text
    assert "52" in text and "49" in text
    assert "unreconciled" in text


def test_silence_is_never_reported_as_agreement():
    """No conflicts is not "the documents agreed" — with one document there is
    nothing to agree with, and a memo saying otherwise overstates the check."""
    line = reconciliation_lines([])
    assert line == ["No figure was stated differently by two documents."]
    assert "agree" not in line[0]


def test_conflicts_cannot_be_omitted_by_a_caller():
    """A default would publish "nothing was disputed" for a caller that forgot."""
    with pytest.raises(TypeError):
        render_docx(one_pager(), "Northwind", "auto-1")


def test_a_field_name_reads_like_a_memorandum():
    lines = reconciliation_lines([REVENUE])
    assert lines[0].startswith("Annual revenue FY2024:")
