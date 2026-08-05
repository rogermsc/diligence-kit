from collections import defaultdict
from typing import List

from src.core.logging import get_logger
from src.core.prompts.fact_extraction import INFORMATION_TYPES
from src.domain.analyze.entities import Conflict, DocumentFacts, Fact, MergedFacts

logger = get_logger(__name__)

# Single-value fields: exact match, should have one unique value
UNIQUE_FIELDS = {
    "company_name", "industry", "headquarters", "founded_year", "website",
    "employees", "market_position", "revenue_streams", "geographic_presence",
    "customer_base", "competitive_advantages",
    "deal_type", "transaction_value", "payment_structure", "transaction_timeline",
    "closing_conditions", "due_diligence_period", "regulatory_approvals", "financing",
}

# Financial fields: prefix match (e.g. annual_revenue_fy2024), same period should have one value
FINANCIAL_PREFIXES = {
    "annual_revenue", "ebitda", "net_income", "total_assets",
}

# Multi-value fields: multiple entries expected, no conflict detection
# key_person, shareholder, risk_factor, product, certification, legal_issue, patent_trademark


def merge_facts(
    doc_facts_list: List[DocumentFacts],
    unique_fields: set = None,
    financial_prefixes: set = None,
    information_types: list = None,
) -> MergedFacts:
    """Deterministic merge of per-document facts. No LLM, no confidence scoring.
    All facts are kept. Conflicts on unique fields are flagged."""

    _unique_fields = unique_fields if unique_fields is not None else UNIQUE_FIELDS
    _financial_prefixes = financial_prefixes if financial_prefixes is not None else FINANCIAL_PREFIXES
    _information_types = information_types if information_types is not None else INFORMATION_TYPES

    facts_by_field = defaultdict(list)
    coverage_by_type = defaultdict(list)

    for doc_facts in doc_facts_list:
        for fact in doc_facts.facts:
            facts_by_field[fact.field].append(fact)

        for info_type in doc_facts.coverage:
            if doc_facts.file_name not in coverage_by_type[info_type]:
                coverage_by_type[info_type].append(doc_facts.file_name)

    conflicts = []

    # Check identity fields (exact match)
    for field in _unique_fields:
        conflict = _check_conflict(field, facts_by_field.get(field, []))
        if conflict:
            conflicts.append(conflict)

    # Check financial fields (prefix match, group by full field name)
    for field_name in facts_by_field:
        for prefix in _financial_prefixes:
            if field_name.startswith(prefix):
                conflict = _check_conflict(field_name, facts_by_field[field_name])
                if conflict:
                    conflicts.append(conflict)
                break

    # Missing information types
    missing = [t for t in _information_types if t not in coverage_by_type]

    for c in conflicts:
        logger.warning(f"Conflict on '{c.field}': {c.values}")

    logger.info(
        f"Merge complete: {sum(len(v) for v in facts_by_field.values())} facts, "
        f"{len(coverage_by_type)}/{len(INFORMATION_TYPES)} info types covered, "
        f"{len(conflicts)} conflicts"
    )

    return MergedFacts(
        facts=dict(facts_by_field),
        coverage=dict(coverage_by_type),
        missing=missing,
        conflicts=conflicts,
    )


def _check_conflict(field: str, entries: List[Fact]) -> Conflict | None:
    """Check if a field has multiple distinct values.

    Includes version/date metadata in the conflict description so the
    conflict-resolution LLM (and synthesis prompts) can prefer the
    most recent document version.
    """
    if not entries:
        return None

    distinct_values = set()
    value_sources = []
    for f in entries:
        normalized = f.value.strip().lower()
        if normalized not in distinct_values:
            distinct_values.add(normalized)
            # Build a rich source label with version/date when available
            parts = [f.value, f"({f.source} {f.page}"]
            if f.document_version:
                parts.append(f"version={f.document_version}")
            if f.document_date:
                parts.append(f"date={f.document_date}")
            if f.source_type:
                parts.append(f"type={f.source_type}")
            value_sources.append(" ".join(parts) + ")")

    if len(distinct_values) > 1:
        return Conflict(field=field, values=value_sources)
    return None
