from collections import defaultdict
from typing import List

from src.core.logging import get_logger
from src.core.prompts.fact_extraction import INFORMATION_TYPES
from src.domain.analyze.authority import authority_of, magnitude_of, source_type_rank
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
    """Flag a field stated more than one way, and say which way wins.

    Resolution is a stated order of rules rather than a model's preference, so
    a reader can argue with the rule instead of the output:

      1. source_type — actual beats pro_forma beats projection. Primary, not a
         tiebreak: an audited actual beats a forecast from a newer document,
         because recency is not the same virtue as being what happened.
      2. document authority — audited accounts down to pitch deck.
      3. recency — document_date, then document_version.

    Nothing else fires, and the conflict is reported unresolved. Silence is the
    honest answer when three forecasts disagree; picking one would be a guess
    wearing a citation.
    """
    if not entries:
        return None

    # One representative fact per distinct value, first occurrence wins.
    seen: set[str] = set()
    candidates: List[Fact] = []
    value_sources: List[str] = []
    for f in entries:
        normalized = f.value.strip().lower()
        if normalized in seen:
            continue
        seen.add(normalized)
        candidates.append(f)
        parts = [f.value, f"({f.source} {f.page}"]
        if f.document_version:
            parts.append(f"version={f.document_version}")
        if f.document_date:
            parts.append(f"date={f.document_date}")
        if f.source_type:
            parts.append(f"type={f.source_type}")
        value_sources.append(" ".join(parts) + ")")

    if len(candidates) < 2:
        return None

    conflict = Conflict(field=field, values=value_sources)
    _resolve(conflict, candidates)
    conflict.magnitude = magnitude_of([f.value for f in candidates])
    return conflict


def _resolve(conflict: Conflict, candidates: List[Fact]) -> None:
    """Apply the rules in order and record which one decided it."""

    def win(fact: Fact, basis: str, rationale: str, confidence: float) -> None:
        conflict.preferred_value = fact.value
        conflict.preferred_source = fact.source
        conflict.resolution_basis = basis
        conflict.rationale = rationale
        conflict.confidence = round(confidence, 2)

    # 1. Basis of preparation.
    ranks = [source_type_rank(f.source_type) for f in candidates]
    best = max(ranks)
    if best > 0 and ranks.count(best) == 1:
        winner = candidates[ranks.index(best)]
        others = sorted({f.source_type or "unlabelled" for f in candidates if f is not winner})
        authority_rank, authority_label = authority_of(winner.source)
        # Full marks only when the sole actual is also the most authoritative
        # document in the set; an actual from a deck is still a claim.
        top = authority_rank >= max(authority_of(f.source)[0] for f in candidates)
        win(
            winner,
            "source_type",
            f"{winner.source_type} beats {', '.join(others)}; "
            f"only {winner.source} states this on an {winner.source_type} basis "
            f"({authority_label})",
            1.0 if top else 0.8,
        )
        return

    # 2. Document authority, among those tied on basis.
    tied = [f for f, r in zip(candidates, ranks, strict=True) if r == best]
    authorities = [authority_of(f.source) for f in tied]
    best_authority = max(rank for rank, _ in authorities)
    if best_authority > 0 and [rank for rank, _ in authorities].count(best_authority) == 1:
        index = [rank for rank, _ in authorities].index(best_authority)
        winner = tied[index]
        beaten = ", ".join(sorted({label for rank, label in authorities if rank != best_authority}))
        win(
            winner,
            "document_authority",
            f"{authorities[index][1]} outranks {beaten or 'the other sources'}",
            0.6,
        )
        return

    # 3. Recency, among those still tied.
    dated = [f for f in tied if f.document_date or f.document_version]
    if len(dated) == 1:
        winner = dated[0]
        stamp = winner.document_date or winner.document_version
        win(
            winner,
            "recency",
            f"only {winner.source} is dated ({stamp}); the others carry no date or version",
            0.4,
        )
        return
    if len(dated) > 1:
        newest = max(dated, key=lambda f: (f.document_date, f.document_version))
        rest = [f for f in dated if f is not newest]
        if all((newest.document_date, newest.document_version) > (f.document_date, f.document_version) for f in rest):
            stamp = newest.document_date or newest.document_version
            win(
                newest,
                "recency",
                f"{newest.source} is the most recent ({stamp}); same basis and authority as the others",
                0.4,
            )
            return

    conflict.resolution_basis = "unresolved"
    conflict.rationale = (
        "No rule separated these. They share a basis of preparation, no document "
        "outranks the others, and none is more recent — all values are carried "
        "forward unresolved."
    )
    conflict.confidence = 0.0
