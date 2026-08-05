"""Synthesize a diligence report from merged facts via GPT, one call per domain."""

import json
from datetime import date

from openai import AsyncOpenAI

from src.core.config import settings
from src.core.logging import get_logger
from src.core.prompts.diligence_synthesis import DOMAIN_SYNTHESIS_PROMPTS
from src.domain.analyze.entities import MergedFacts
from src.domain.diligence.entities import DOMAIN_REPORT_MODELS, DiligenceReport

logger = get_logger(__name__)


class DiligenceReportService:
    def __init__(self):
        self._client = AsyncOpenAI(api_key=settings.openai_api_key)

    async def generate(
        self, domain: str, company_name: str, merged: MergedFacts
    ) -> DiligenceReport:
        """Generate a domain-specific diligence report from merged facts."""

        system_template, user_template = DOMAIN_SYNTHESIS_PROMPTS[domain]
        model_cls = DOMAIN_REPORT_MODELS[domain]

        # Build compact facts (deduplicated by value) with source metadata
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

        system_prompt = system_template.format(current_date=date.today().isoformat())
        user_prompt = user_template.format(
            company_name=company_name,
            facts_json=facts_json,
            covered=covered,
            missing=missing,
            conflicts=conflicts,
        )

        logger.info(
            f"[{domain}] Diligence synthesis GPT call started ({len(facts_json)} chars of facts)"
        )

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
            logger.warning(f"[{domain}] Synthesis finish_reason={finish_reason}")

        if not raw_text:
            raise RuntimeError(f"Empty response from {domain} synthesis GPT call")

        data = json.loads(raw_text)
        report = model_cls(**data)

        logger.info(f"[{domain}] Synthesis complete")
        return report
