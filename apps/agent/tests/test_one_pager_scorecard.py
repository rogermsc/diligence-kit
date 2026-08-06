"""The scorecard is the headline number a reader anchors on.

It is computed in Python rather than trusted from the model, so the arithmetic
here is the last thing standing between a model's guess and an investment
readout. These cover the ways it can be quietly wrong.
"""

import pytest

from src.data.analyze.one_pager_service import CATEGORY_WEIGHTS, OnePagerService

BLANK_SECTIONS = {
    "executive_summary": "",
    "company_overview": {"name": "", "industry": "", "headquarters": "", "founded": "", "website": ""},
    "financial_highlights": {"annual_revenue": "", "ebitda": "", "net_income": "",
                             "total_assets": "", "employees": ""},
    "business_metrics": {"market_position": "", "primary_revenue_streams": "",
                         "geographic_presence": "", "customer_base": "",
                         "competitive_advantages": ""},
    "transaction_structure": {"category": "", "value": "", "payment": "", "timeline": ""},
    "deal_rationale": {"strategic_objectives": "", "synergies_expected": "", "market_rationale": ""},
    "key_terms": {"closing_conditions": "", "due_diligence_period": "",
                  "regulatory_approvals": "", "financing": ""},
    "critical_risk_factors": [],
    "key_success_factors": [],
    "summary_highlights": {"primary_risk_areas": "", "key_strengths": ""},
}


def build(scorecard):
    return OnePagerService()._parse_response(
        __import__("json").dumps({**BLANK_SECTIONS, "scorecard": scorecard})
    )


def all_categories(score):
    return [{"category": c, "score": f"{score}/5", "key_issues": []} for c in CATEGORY_WEIGHTS]


def test_weights_sum_to_one():
    """Any drift here silently rescales every score ever produced."""
    assert sum(CATEGORY_WEIGHTS.values()) == pytest.approx(1.0)


def test_a_full_scorecard_of_fives_scores_five():
    assert build(all_categories(5)).overall_score == "5.0/5.0"


def test_a_full_scorecard_of_ones_scores_one():
    assert build(all_categories(1)).overall_score == "1.0/5.0"


def test_an_unrecognised_category_does_not_silently_score_zero():
    """A model that renames a category — "Team and Leadership" for "Team &
    Leadership" — used to be weighted 0.0, dragging the headline down with no
    warning. The remaining weights must renormalise instead."""
    scorecard = all_categories(4)
    scorecard[0] = {**scorecard[0], "category": "Financial Readiness (revised)"}

    assert build(scorecard).overall_score == "4.0/5.0"


def test_a_partial_scorecard_renormalises_rather_than_understating():
    """Six categories of 4/5 is a 4.0, not a 4.0 scaled by the missing weight."""
    scorecard = all_categories(4)[:6]

    assert build(scorecard).overall_score == "4.0/5.0"


def test_an_empty_scorecard_does_not_divide_by_zero():
    assert build([]).overall_score == "0.0/5.0"


def test_relative_weighting_still_applies():
    """Renormalisation must not flatten the weights into a plain average.
    Financial Readiness is 0.20 and ESG is 0.05 — a 5 on the first with a 1 on
    the second must beat the reverse."""
    heavy = [{"category": "Financial Readiness", "score": "5/5", "key_issues": []},
             {"category": "ESG & Risk Factors", "score": "1/5", "key_issues": []}]
    light = [{"category": "Financial Readiness", "score": "1/5", "key_issues": []},
             {"category": "ESG & Risk Factors", "score": "5/5", "key_issues": []}]

    assert build(heavy).overall_score > build(light).overall_score


@pytest.mark.parametrize(
    "raw,expected",
    [
        ("3.1/5", 3.1),
        ("3.1", 3.1),
        ("4/5", 4.0),
        ("9/5", 5.0),      # clamped: a model cannot invent a 9
        ("-2/5", 2.0),     # the sign is not parsed; magnitude is clamped into range
        ("", 3.0),         # unparseable falls back to the midpoint
        ("N/A", 3.0),
    ],
)
def test_score_parsing_is_clamped_to_the_scale(raw, expected):
    assert OnePagerService._parse_score(raw) == pytest.approx(expected)


def test_per_category_weighted_scores_are_reported():
    """The DOCX prints each weighted contribution, so they have to be present."""
    result = build(all_categories(4))

    assert len(result.scorecard) == len(CATEGORY_WEIGHTS)
    assert all(c.weighted_score for c in result.scorecard)
    assert result.scorecard[0].score == "4.0/5"
