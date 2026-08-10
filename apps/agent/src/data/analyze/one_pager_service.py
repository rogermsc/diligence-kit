import json
import re
from datetime import date

from src.core.llm import complete_json
from src.core.logging import get_logger
from src.core.prompts.one_pager import ONE_PAGER_SYSTEM_PROMPT, ONE_PAGER_USER_PROMPT
from src.domain.analyze.entities import (
    BusinessMetrics,
    CompanyOverview,
    DealRationale,
    FinancialHighlights,
    KeyTerms,
    MergedFacts,
    OnePager,
    RiskFactor,
    ScorecardCategory,
    SummaryHighlights,
    TransactionStructure,
)

logger = get_logger(__name__)

# A response is allowed to lose a category or two — renormalising over what is
# present beats weighting the rest to zero. Below this, renormalising stops being
# a correction and starts inventing a headline: one recognised category scored
# 5/5 would otherwise print "5.0/5.0" on an investment memorandum computed from
# an eighth of the rubric.
MIN_SCORECARD_COVERAGE = 0.75

CATEGORY_WEIGHTS = {
    "Financial Readiness": 0.20,
    "Product Maturity": 0.15,
    "Go-To-Market Engine": 0.15,
    "Team & Leadership": 0.15,
    "Legal & Compliance": 0.10,
    "Capital Structure": 0.10,
    "Market Positioning": 0.10,
    "ESG & Risk Factors": 0.05,
}


def _describe_conflict(c) -> str:
    """One line per conflict, carrying the decision and the reason for it.

    The rule that settled it is included on purpose. Synthesis is told not to
    re-adjudicate, and the memo has to be able to say why a figure was chosen —
    "the audited accounts are the only actual" is an argument, "the model
    preferred it" is not.
    """
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


class OnePagerService:
    async def generate(self, company_name: str, merged: MergedFacts) -> OnePager:
        """Generate a one-pager from merged facts via a single GPT call."""
        # Build a compact facts representation — deduplicate by value only,
        # keeping one representative source per unique value per field.
        # Include source metadata so the LLM can reason about provenance.
        facts_compact = {}
        for field, fact_list in merged.facts.items():
            seen_values = set()
            entries = []
            for f in fact_list:
                norm = f.value.strip().lower()
                if norm not in seen_values:
                    seen_values.add(norm)
                    entry = {"value": f.value, "source": f.source}
                    if f.source_type:
                        entry["source_type"] = f.source_type
                    if f.document_version:
                        entry["version"] = f.document_version
                    if f.document_date:
                        entry["date"] = f.document_date
                    entries.append(entry)
            facts_compact[field] = entries

        facts_json = json.dumps(facts_compact, indent=2, ensure_ascii=False)

        covered = ", ".join(merged.coverage.keys()) if merged.coverage else "None"
        missing = ", ".join(merged.missing) if merged.missing else "None"
        conflicts = (
            "\n".join(_describe_conflict(c) for c in merged.conflicts)
            if merged.conflicts
            else "No unresolved conflicts."
        )

        today = date.today().isoformat()
        system_prompt = ONE_PAGER_SYSTEM_PROMPT.format(current_date=today)

        user_prompt = ONE_PAGER_USER_PROMPT.format(
            company_name=company_name,
            facts_json=facts_json,
            covered=covered,
            missing=missing,
            conflicts=conflicts,
        )

        logger.info(f"One-pager GPT call started ({len(facts_json)} chars of facts)")

        raw_text = await complete_json(
            "one_pager", user_prompt, system_prompt, volatile=(today,)
        )

        return self._parse_response(raw_text)

    def _parse_response(self, raw_text: str) -> OnePager:
        if not raw_text:
            raise RuntimeError("Empty response from one-pager GPT call")

        data = json.loads(raw_text)

        # Compute scorecard weighted scores and overall score deterministically.
        #
        # The overall is normalised by the weight actually present, not by the
        # full 1.0. A model that renames a category or returns fewer than eight
        # of them would otherwise have those categories weighted 0.0 and drag the
        # headline down silently — one renamed category turned a 4.0 into a 3.2.
        # An unrecognised category still contributes nothing, but it is warned
        # about and no longer distorts the rest.
        scorecard = []
        total_weighted = 0.0
        total_weight = 0.0
        for s in data["scorecard"]:
            category = s["category"]
            score = self._parse_score(s["score"])
            weight = CATEGORY_WEIGHTS.get(category)
            if weight is None:
                logger.warning(
                    f"Scorecard category not recognised: '{category}' — excluded "
                    f"from the overall score. Expected one of: "
                    f"{', '.join(CATEGORY_WEIGHTS)}"
                )
                weight = 0.0
            weighted = score * weight
            total_weighted += weighted
            total_weight += weight
            scorecard.append(ScorecardCategory(
                category=category,
                score=f"{score:.1f}/5",
                weighted_score=f"{weighted:.2f}",
                key_issues=s.get("key_issues", []),
            ))

        if total_weight < MIN_SCORECARD_COVERAGE:
            raise ValueError(
                f"Scorecard covers only {total_weight:.2f} of the 1.0 weight, "
                f"below the {MIN_SCORECARD_COVERAGE} floor. Categories returned: "
                f"{[c.category for c in scorecard]}. Refusing to publish an "
                f"overall score derived from a fraction of the rubric."
            )

        if total_weight < 1.0:
            logger.warning(
                f"Scorecard covers {total_weight:.2f} of the 1.0 weight — "
                f"normalising the overall score over the categories present."
            )

        overall = total_weighted / total_weight
        overall_score = f"{overall:.1f}/5.0"

        fh = data["financial_highlights"]

        return OnePager(
            executive_summary=data["executive_summary"],
            company_overview=CompanyOverview(**data["company_overview"]),
            financial_highlights=FinancialHighlights(
                annual_revenue=fh["annual_revenue"],
                ebitda=fh["ebitda"],
                net_income=fh["net_income"],
                total_assets=fh["total_assets"],
                employees=fh["employees"],
                projections=fh.get("projections", ""),
            ),
            business_metrics=BusinessMetrics(**data["business_metrics"]),
            scorecard=scorecard,
            overall_score=overall_score,
            scorecard_coverage=f"{total_weight:.2f}",
            transaction_structure=TransactionStructure(**data["transaction_structure"]),
            deal_rationale=DealRationale(**data["deal_rationale"]),
            key_terms=KeyTerms(**data["key_terms"]),
            critical_risk_factors=[RiskFactor(**r) for r in data["critical_risk_factors"]],
            key_success_factors=data["key_success_factors"],
            summary_highlights=SummaryHighlights(**data["summary_highlights"]),
        )

    @staticmethod
    def _parse_score(score_str: str) -> float:
        """Parse '3.1/5' or '3.1' into 3.1. Clamp to 1.0-5.0."""
        match = re.search(r"(\d+\.?\d*)", score_str)
        if not match:
            logger.warning(f"Could not parse score: {score_str}, defaulting to 3.0")
            return 3.0
        value = float(match.group(1))
        return max(1.0, min(5.0, value))
