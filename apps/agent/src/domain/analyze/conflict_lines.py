"""How a settled conflict is described to a synthesis prompt.

One definition, shared by the one-pager and the four domain reports. It used to
live in `one_pager_service` alone, and the diligence path wrote its own line
that named the wrong rule: every conflict was labelled "PREFERRED (newest
version)" regardless of what actually decided it, while
`authority.py` resolves on basis of preparation first and reaches recency only
when nothing else separates the documents. So four of the five deliverables told
the model that an audited figure won for being recent.

The rule that settled it is included on purpose. Synthesis is told not to
re-adjudicate, and a report has to be able to say why a figure was chosen — "the
audited accounts are the only actual" is an argument, "the model preferred it"
is not.
"""

from src.domain.analyze.entities import Conflict


def describe_conflict(c: Conflict) -> str:
    """One line per conflict, carrying the decision and the reason for it."""
    line = f"- {c.field}: {c.values}"
    if c.magnitude:
        line += f" [{c.magnitude}]"
    if c.preferred_value:
        line += (
            f" -> USE {c.preferred_value} (from {c.preferred_source}; "
            f"{c.resolution_basis}: {c.rationale})"
        )
    elif c.resolution_basis == "unresolved":
        line += " -> UNRESOLVED: no rule separated these. Report every value and say the dataroom does not settle it."
    return line
