"""Cloud Logging filters are built by string concatenation.

There is no parameter binding in the Logging API, so an id that reaches a filter
unchecked can close its own quoted literal and append clauses — reading log
entries for automations and companies the caller has nothing to do with. These
guards are the whole defence, so they are the thing to test.
"""

import pytest

from app.infra.adapters.google.GoogleLoggingAdapter import (
    _safe_id,
    _safe_severity,
)


def test_a_uuid_passes_through():
    value = "3f2504e0-4f89-41d3-9a0c-0305e82c3301"

    assert _safe_id(value, "automation_id") == value


def test_case_is_preserved_not_normalised_away():
    value = "3F2504E0-4F89-41D3-9A0C-0305E82C3301"

    assert _safe_id(value, "automation_id") == value


@pytest.mark.parametrize(
    "attack",
    [
        '" OR severity="DEBUG',                       # closes the literal
        '3f2504e0-4f89-41d3-9a0c-0305e82c3301" OR "1"="1',
        'x" AND jsonPayload.companyId="victim',
        "'; DROP TABLE logs; --",
        "..",
        "*",
        "",
        "   ",
    ],
)
def test_anything_that_is_not_a_uuid_is_refused(attack):
    assert _safe_id(attack, "automation_id") is None


def test_none_is_refused_rather_than_stringified():
    assert _safe_id(None, "automation_id") is None


@pytest.mark.parametrize("value", ["ERROR", "WARNING", "INFO", "DEBUG", "CRITICAL"])
def test_known_severities_are_accepted(value):
    assert _safe_severity(value) == value


def test_severity_is_accepted_case_insensitively():
    assert _safe_severity("error") == "ERROR"


@pytest.mark.parametrize(
    "attack",
    ['ERROR" OR severity="DEBUG', "NOT_A_SEVERITY", "", None, 42],
)
def test_an_unknown_severity_falls_back_rather_than_interpolating(attack):
    # Falling back to ERROR is safe: it is the narrowest useful level, so a bad
    # value shows less than intended rather than more.
    assert _safe_severity(attack) == "ERROR"
