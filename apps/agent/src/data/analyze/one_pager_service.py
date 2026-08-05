import json
import re
from datetime import date

from openai import AsyncOpenAI

from src.core.config import settings
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


class OnePagerService:
    def __init__(self):
        self._client = AsyncOpenAI(api_key=settings.openai_api_key)

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
            "\n".join(
                f"- {c.field}: {c.values}"
                + (f" → PREFERRED (newest version): {c.preferred_value}" if c.preferred_value else "")
                for c in merged.conflicts
            )
            if merged.conflicts
            else "No unresolved conflicts."
        )

        system_prompt = ONE_PAGER_SYSTEM_PROMPT.format(
            current_date=date.today().isoformat(),
        )

        user_prompt = ONE_PAGER_USER_PROMPT.format(
            company_name=company_name,
            facts_json=facts_json,
            covered=covered,
            missing=missing,
            conflicts=conflicts,
        )

        logger.info(f"One-pager GPT call started ({len(facts_json)} chars of facts)")

        response = await self._client.chat.completions.create(
            model="gpt-5.2",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            response_format={"type": "json_object"},
        )

        raw_text = response.choices[0].message.content
        finish_reason = response.choices[0].finish_reason

        if finish_reason != "stop":
            logger.warning(f"One-pager finish_reason={finish_reason}")

        return self._parse_response(raw_text)

    def _parse_response(self, raw_text: str) -> OnePager:
        if not raw_text:
            raise RuntimeError("Empty response from one-pager GPT call")

        data = json.loads(raw_text)

        # Compute scorecard weighted scores and overall score deterministically
        scorecard = []
        total_weighted = 0.0
        for s in data["scorecard"]:
            category = s["category"]
            score = self._parse_score(s["score"])
            weight = CATEGORY_WEIGHTS.get(category, 0.0)
            weighted = score * weight
            total_weighted += weighted
            scorecard.append(ScorecardCategory(
                category=category,
                score=f"{score:.1f}/5",
                weighted_score=f"{weighted:.2f}",
                key_issues=s.get("key_issues", []),
            ))

        overall_score = f"{total_weighted:.1f}/5.0"

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
