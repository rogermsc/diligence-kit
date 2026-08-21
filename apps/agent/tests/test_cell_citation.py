"""A spreadsheet citation nobody checks is decoration.

Quote verification cannot see this class of error at all. A sheet reaches
`verify()` as one blob of text, so a quote lifted from row 5 verifies perfectly
against a fact that cites row 12 — the value is on the sheet either way. The
last version of this bug, facts attributed to the wrong sheet outright, reached
`main`; a test caught it, nothing in the pipeline did.
"""

import pytest

from src.domain.analyze.cells import cited_row, cites_its_own_row

GRID = "\n".join([
    "[sheet: Summary] columns: A,B,C,D,E",
    "5,Revenue (GBP),1950000,3800000,7400000,12900000",
    "7,EBITDA (GBP),-820000,-310000,450000,2600000",
    "8,Headcount,31,52,78,104",
    '10,Note,"FY2024 revenue, on a run-rate basis, was £3.8M"',
])


def test_a_fact_citing_the_wrong_row_is_caught():
    """The whole point. Every other check in the pipeline passes this fact:
    the value is real, the sheet is right, and £1.95M is on the sheet — just
    not on row 7."""
    assert cites_its_own_row("£1.95M", "", "Summary!B7", GRID) is False


@pytest.mark.parametrize("reference", ["Summary!B5", "Summary!C5", "Summary!A5"])
def test_any_column_of_the_right_row_is_accepted(reference):
    """The row is the unit of provenance, deliberately.

    Citing the label cell rather than the figure — A5 for the revenue on row 5
    — is a reasonable thing to do and lands an analyst in the right place.
    Flagging it would bury the failure that matters in noise.
    """
    assert cites_its_own_row("£1.95M", "", reference, GRID) is True


def test_a_figure_written_the_way_a_reader_writes_it_still_matches():
    # The cell holds -310000; the fact says what a memo would say.
    assert cites_its_own_row("(£0.31M) FY2024", "", "Summary!C7", GRID) is True


def test_the_quote_counts_as_well_as_the_value():
    assert cites_its_own_row("52", "Headcount 52", "Summary!B8", GRID) is True


def test_a_cell_holding_a_comma_does_not_shift_the_row():
    """The renderer quotes cells now, so a comma inside one stays inside it.
    Before that, this row parsed as four cells and the reference was read
    against the wrong one."""
    assert cited_row(GRID, "Summary!B10") == [
        "Note", "FY2024 revenue, on a run-rate basis, was £3.8M"]
    assert cites_its_own_row("£3.8M", "", "Summary!B10", GRID) is True


@pytest.mark.parametrize("reference", ["Summary!B99", "4", "", "page 3", "Summary!"])
def test_unanswerable_is_none_and_never_false(reference):
    """Same discipline as quote verification: "we cannot check this" must not
    be reported as "this is wrong". A PDF's page number reaches here too."""
    assert cites_its_own_row("52", "", reference, GRID) is None


def test_no_grid_is_unanswerable_rather_than_a_failure():
    assert cites_its_own_row("52", "", "Summary!B8", "") is None


def test_the_pipeline_says_so_when_a_fact_cites_the_wrong_row(caplog):
    """A check that never runs is not a check.

    This drives the real parser, so it fails if the wiring is dropped as well
    as if the rule is.
    """
    import json

    from src.data.analyze.fact_extraction_service import FactExtractionService
    from src.domain.analyze.entities import PreparedDocument

    doc = PreparedDocument(document_id="d1", file_name="model.xlsx (Summary)",
                           text_content=GRID)
    response = json.dumps({"facts": [
        {"field": "annual_revenue_fy2023", "value": "£1.95M",
         "quote": "Revenue (GBP) 1950000", "page": "Summary!B7"},
        {"field": "employees", "value": "52", "quote": "Headcount 52",
         "page": "Summary!C8"},
    ], "coverage": []})

    with caplog.at_level("WARNING"):
        facts = FactExtractionService()._parse_response(response, doc)

    assert len(facts.facts) == 2, "the fact is kept; this signal is advisory"
    warning = [r.message for r in caplog.records if "cite a row" in r.message]
    assert warning, f"no warning raised; log was {[r.message for r in caplog.records]}"
    assert "annual_revenue_fy2023@Summary!B7" in warning[0]
    assert "employees" not in warning[0], "the correctly cited fact is not named"
