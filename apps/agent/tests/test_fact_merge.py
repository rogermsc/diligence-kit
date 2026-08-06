"""The merge is the one deterministic step between extraction and synthesis.

If it drops a fact or misses a disagreement, the report reads as confident and
sourced while being wrong — the exact failure the pipeline exists to prevent.
"""

from src.domain.analyze.entities import DocumentFacts, Fact
from src.domain.analyze.fact_merge import merge_facts


def fact(field, value, source="deck.pdf", **kw):
    return Fact(field=field, value=value, source=source, page=kw.pop("page", "1"),
                quote=kw.pop("quote", ""), **kw)


def doc(name, facts, coverage=()):
    return DocumentFacts(document_id=name, file_name=name, facts=facts, coverage=list(coverage))


def test_every_fact_survives_the_merge():
    """Facts are evidence. The merge flags disagreement, it never discards."""
    merged = merge_facts([
        doc("a.pdf", [fact("annual_revenue_fy2024", "£3M", "a.pdf")]),
        doc("b.pdf", [fact("annual_revenue_fy2024", "£2.8M", "b.pdf")]),
    ])

    assert len(merged.facts["annual_revenue_fy2024"]) == 2


def test_disagreement_on_a_unique_field_is_a_conflict():
    merged = merge_facts([
        doc("deck.pdf", [fact("headquarters", "London", "deck.pdf")]),
        doc("accounts.pdf", [fact("headquarters", "Manchester", "accounts.pdf")]),
    ])

    assert [c.field for c in merged.conflicts] == ["headquarters"]


def test_agreement_is_not_a_conflict():
    merged = merge_facts([
        doc("a.pdf", [fact("headquarters", "London", "a.pdf")]),
        doc("b.pdf", [fact("headquarters", "  london ", "b.pdf")]),
    ])

    assert merged.conflicts == []


def test_the_same_financial_period_conflicts_but_different_periods_do_not():
    """FY24 revenue disagreeing with FY23 revenue is not a contradiction — it is
    a company growing. Only the same period may conflict."""
    merged = merge_facts([
        doc("a.pdf", [fact("annual_revenue_fy2024", "£3M", "a.pdf"),
                      fact("annual_revenue_fy2023", "£2M", "a.pdf")]),
        doc("b.pdf", [fact("annual_revenue_fy2024", "£5M", "b.pdf")]),
    ])

    assert [c.field for c in merged.conflicts] == ["annual_revenue_fy2024"]


def test_a_conflict_names_its_sources():
    """A conflict the analyst cannot trace back to documents is not actionable."""
    merged = merge_facts([
        doc("deck.pdf", [fact("headquarters", "London", "deck.pdf", page="4")]),
        doc("accounts.pdf", [fact("headquarters", "Manchester", "accounts.pdf", page="12")]),
    ])

    values = " ".join(merged.conflicts[0].values)
    assert "deck.pdf" in values and "accounts.pdf" in values
    assert "London" in values and "Manchester" in values


def test_conflict_values_carry_version_and_date_for_recency_resolution():
    """Downstream picks the newest document version, so the metadata has to reach it."""
    merged = merge_facts([
        doc("v1.pdf", [fact("headquarters", "London", "v1.pdf",
                            document_version="v1.0", document_date="2023-01-01")]),
        doc("v2.pdf", [fact("headquarters", "Leeds", "v2.pdf",
                            document_version="v2.0", document_date="2024-06-01")]),
    ])

    values = " ".join(merged.conflicts[0].values)
    assert "version=v2.0" in values and "date=2024-06-01" in values


def test_multi_value_fields_are_not_treated_as_disagreement():
    """Three named executives are three facts, not a contradiction."""
    merged = merge_facts([
        doc("team.pdf", [fact("key_person", "Ada"), fact("key_person", "Grace"),
                         fact("key_person", "Alan")]),
    ])

    assert merged.conflicts == []
    assert len(merged.facts["key_person"]) == 3


def test_coverage_records_which_document_supplied_each_information_type():
    merged = merge_facts([
        doc("cap.pdf", [], coverage=["cap_table"]),
        doc("deck.pdf", [], coverage=["deck", "cap_table"]),
    ])

    assert sorted(merged.coverage["cap_table"]) == ["cap.pdf", "deck.pdf"]
    assert merged.coverage["deck"] == ["deck.pdf"]


def test_a_document_listing_a_type_twice_is_counted_once():
    merged = merge_facts([doc("deck.pdf", [], coverage=["deck", "deck"])])

    assert merged.coverage["deck"] == ["deck.pdf"]


def test_uncovered_information_types_are_reported_missing():
    """This list is what tells an analyst what to still ask the target for."""
    merged = merge_facts([doc("cap.pdf", [], coverage=["cap_table"])])

    assert "cap_table" not in merged.missing
    assert "insurance" in merged.missing


def test_an_empty_dataroom_is_all_missing_and_no_conflicts():
    merged = merge_facts([])

    assert merged.facts == {} and merged.conflicts == []
    assert len(merged.missing) == 24
