"""Which document wins, and why.

The README points a reader at conflict resolution as the part worth reading. It
used to be an LLM asked to prefer the newest version, and the offline fixture
that proved it worked was a hand-written dict returning "£3.2M" — the flagship
test asserted that a hardcoded string survived a round trip through a hash.

These run the actual rules. No LLM, no fixtures, milliseconds.
"""

import asyncio

import pytest

from src.domain.analyze.authority import authority_of, magnitude_of, parse_amount
from src.domain.analyze.entities import DocumentFacts, Fact
from src.domain.analyze.fact_merge import merge_facts


def fact(value, source, *, source_type="", date="", version="", field="annual_revenue_fy2024"):
    return Fact(
        field=field, value=value, source=source, page="1", quote=value,
        source_type=source_type, document_date=date, document_version=version,
    )


def conflict_over(*facts, field="annual_revenue_fy2024"):
    merged = merge_facts([DocumentFacts(
        document_id="d", file_name="d", facts=list(facts), coverage=[],
    )])
    return next((c for c in merged.conflicts if c.field == field), None)


class TestBasisOfPreparation:
    def test_an_audited_actual_beats_two_pro_formas(self):
        # The planted disagreement in the demo dataroom, settled with no model
        # call at all: two of the three are pro-forma, one is what happened.
        c = conflict_over(
            fact("£4.1M", "01_pitch_deck.pdf", source_type="pro_forma"),
            fact("£3.8M", "02_financial_model.xlsx", source_type="pro_forma"),
            fact("£3.2M", "04_audited_accounts.pdf", source_type="actual", date="2024-12-31"),
        )
        assert c.preferred_value == "£3.2M"
        assert c.preferred_source == "04_audited_accounts.pdf"
        assert c.resolution_basis == "source_type"
        assert c.confidence == 1.0
        assert "actual beats pro_forma" in c.rationale

    def test_an_actual_beats_a_newer_projection(self):
        # Recency is not the same virtue as being what happened. A 2026 forecast
        # does not overrule 2024's audited accounts.
        c = conflict_over(
            fact("£9.0M", "02_financial_model.xlsx", source_type="projection", date="2026-01-01"),
            fact("£3.2M", "04_audited_accounts.pdf", source_type="actual", date="2024-12-31"),
        )
        assert c.preferred_value == "£3.2M"
        assert c.resolution_basis == "source_type"

    def test_an_actual_from_a_weak_document_is_not_full_confidence(self):
        # Sole actual, but it is the seller's own deck saying so.
        c = conflict_over(
            fact("£4.1M", "01_pitch_deck.pdf", source_type="actual"),
            fact("£3.8M", "04_audited_accounts.pdf", source_type="pro_forma"),
        )
        assert c.preferred_value == "£4.1M"
        assert c.confidence == 0.8


class TestDocumentAuthority:
    def test_audited_accounts_outrank_a_pitch_deck_on_equal_basis(self):
        c = conflict_over(
            fact("52", "01_pitch_deck.pdf", field="employees"),
            fact("49", "04_audited_accounts.pdf", field="employees"),
            field="employees",
        )
        assert c.preferred_value == "49"
        assert c.resolution_basis == "document_authority"
        assert c.confidence == 0.6
        assert "audited accounts" in c.rationale

    def test_the_ranking_is_by_filename_and_falls_back_to_unclassified(self):
        assert authority_of("04_audited_accounts.pdf")[0] > authority_of("02_financial_model.xlsx")[0]
        assert authority_of("02_financial_model.xlsx")[0] > authority_of("01_pitch_deck.pdf")[0]
        assert authority_of("scan_0042.pdf") == (0, "unclassified document")


class TestRecency:
    def test_the_dated_document_wins_when_nothing_else_separates_them(self):
        c = conflict_over(
            fact("£3.5M", "notes_a.pdf"),
            fact("£3.2M", "notes_b.pdf", date="2024-12-31"),
        )
        assert c.preferred_value == "£3.2M"
        assert c.resolution_basis == "recency"
        assert c.confidence == 0.4

    def test_the_newer_of_two_dated_documents_wins(self):
        c = conflict_over(
            fact("£3.5M", "notes_a.pdf", date="2023-12-31"),
            fact("£3.2M", "notes_b.pdf", date="2024-12-31"),
        )
        assert c.preferred_value == "£3.2M"
        assert c.resolution_basis == "recency"


class TestUnresolved:
    def test_three_forecasts_that_disagree_are_left_unresolved(self):
        # The honest answer. Picking one would be a guess wearing a citation,
        # and the one-pager prompt is told to report all three and say so.
        c = conflict_over(
            fact("£7.0M", "model_a.pdf", source_type="projection"),
            fact("£9.0M", "model_b.pdf", source_type="projection"),
        )
        assert c.preferred_value == ""
        assert c.resolution_basis == "unresolved"
        assert c.confidence == 0.0
        assert "No rule separated these" in c.rationale

    def test_two_equally_ranked_undated_documents_are_left_unresolved(self):
        c = conflict_over(fact("£3.5M", "scan_a.pdf"), fact("£3.2M", "scan_b.pdf"))
        assert c.resolution_basis == "unresolved"


class TestMagnitude:
    def test_the_demo_disagreement_is_28_percent(self):
        # "Three documents disagree" is the claim; this is what makes it a
        # finding someone has to act on.
        assert magnitude_of(["£4.1M", "£3.8M", "£3.2M"]) == "28% spread, £3.2M to £4.1M"

    def test_accountants_parentheses_are_negative(self):
        assert parse_amount("(£0.31M)") == -310000

    @pytest.mark.parametrize(
        "raw, expected",
        [("£3.2M", 3_200_000), ("1,950,000", 1_950_000), ("52", 52), ("$1.5B", 1_500_000_000)],
    )
    def test_amounts_parse(self, raw, expected):
        assert parse_amount(raw) == expected

    def test_unparseable_values_produce_no_line_rather_than_a_wrong_one(self):
        assert magnitude_of(["a range of things", "something else"]) == ""

    def test_identical_amounts_written_differently_produce_no_line(self):
        assert magnitude_of(["£3.2M", "3,200,000"]) == ""


class TestTheModelCannotDeleteASettledConflict:
    """The one call left to a model here answers one question: are these the
    same figure written differently? A numeric spread is deterministic proof
    they are not, and the answer is then wrong rather than debatable.

    Without this, `is_real_conflict: false` deletes the finding outright — the
    three-way revenue disagreement the README is built around, settled by a
    stated rule at confidence 1.0, discarded by the call that was demoted for
    exactly this reason.
    """

    @staticmethod
    def _resolve(conflicts, monkeypatch, *, is_real):
        import json as _json

        from src.data.analyze import conflict_resolution_service as mod

        async def fake(_purpose, _prompt):
            return _json.dumps({"resolutions": [
                {"field": c.field, "is_real_conflict": is_real, "reason": "same figure"}
                for c in conflicts
            ]})

        monkeypatch.setattr(mod, "complete_json", fake)
        return asyncio.run(mod.ConflictResolutionService().resolve(conflicts))

    def test_a_numeric_disagreement_survives_the_model_calling_it_a_duplicate(self, monkeypatch):
        c = conflict_over(
            fact("£4.1M", "01_pitch_deck.pdf", source_type="pro_forma"),
            fact("£3.2M", "04_audited_accounts.pdf", source_type="actual", date="2024-12-31"),
        )
        assert c.magnitude, "precondition: the amounts differ, so a magnitude exists"

        kept = self._resolve([c], monkeypatch, is_real=False)

        assert [k.field for k in kept] == ["annual_revenue_fy2024"]
        assert kept[0].preferred_value == "£3.2M"

    def test_a_formatting_variant_is_still_suppressed(self):
        # The guard must not cost the model the judgement it is actually good
        # at. Identical amounts produce no magnitude, so nothing protects them.
        c = conflict_over(
            fact("£3.2M", "04_audited_accounts.pdf", source_type="actual"),
            fact("3,200,000", "05_summary.pdf", source_type="actual"),
        )
        assert c is None or not c.magnitude

    def test_a_basis_of_measurement_difference_is_still_the_models_call(self, monkeypatch):
        # 52 at year end against 49 on average is settled on document authority,
        # not on basis of preparation. Both are true, and the guard deliberately
        # does not reach it.
        c = conflict_over(
            fact("52", "01_pitch_deck.pdf", field="employees"),
            fact("49", "04_audited_accounts.pdf", field="employees", date="2024-12-31"),
            field="employees",
        )
        assert c.magnitude and c.resolution_basis != "source_type"

        assert self._resolve([c], monkeypatch, is_real=False) == []

    def test_a_non_numeric_disagreement_is_still_the_models_call(self, monkeypatch):
        c = conflict_over(
            fact("London", "01_pitch_deck.pdf", field="headquarters"),
            fact("London, UK", "04_audited_accounts.pdf", field="headquarters"),
            field="headquarters",
        )
        assert c is not None and not c.magnitude

        assert self._resolve([c], monkeypatch, is_real=False) == []
