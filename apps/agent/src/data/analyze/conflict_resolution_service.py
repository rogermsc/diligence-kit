import json
from typing import List

from src.core.llm import complete_json
from src.core.logging import get_logger
from src.domain.analyze.entities import Conflict

logger = get_logger(__name__)

CONFLICT_RESOLUTION_PROMPT = """\
You are a due diligence analyst reviewing potential data conflicts.

For each conflict below, decide one thing only: are these the same figure \
written differently, or do the documents genuinely disagree?

Same figure, written differently — mark is_real_conflict=false:
- formatting, punctuation, abbreviation or rounding ("£3.2M" and "3,200,000")
- one value carrying a label the other omits ("(£0.31M)" and "(£0.31M) FY2024")

A genuine disagreement — mark is_real_conflict=true:
- different amounts for the same thing over the same period
- the same metric measured on a different basis ("52 at year end" and "49 \
  average over the year"). Say which basis each value is on in the reason; \
  both can be correct and the reader needs to know why they differ.

Do NOT choose between the values. Which one prevails is decided by a fixed \
rule — basis of preparation first, then document authority, then recency — \
and that has already been applied before you see this.

Conflicts:
{conflicts}

Respond with valid JSON:
{{
  "resolutions": [
    {{
      "field": "the field name",
      "is_real_conflict": true/false,
      "reason": "brief explanation"
    }}
  ]
}}\
"""


class ConflictResolutionService:
    """Decides which flagged conflicts are real. Not which value wins.

    Telling "£3.2M" from "3,200,000" needs judgement about language, which is
    what a model is good for. Choosing between an audited actual and a
    management run-rate needs a rule you can publish and argue with, which is
    what domain/analyze/authority.py is — and it has already run by the time
    this does.
    """

    async def resolve(self, conflicts: List[Conflict]) -> List[Conflict]:
        """Filter out false-positive conflicts using GPT."""
        if not conflicts:
            return []

        conflicts_text = ""
        for c in conflicts:
            conflicts_text += f"\nField: {c.field}\nValues: {c.values}\n"

        raw_text = await complete_json(
            "conflict_resolution",
            CONFLICT_RESOLUTION_PROMPT.format(conflicts=conflicts_text),
        )
        if not raw_text:
            logger.warning("Empty response from conflict resolution, keeping all conflicts")
            return conflicts

        try:
            data = json.loads(raw_text)
        except json.JSONDecodeError:
            logger.warning("Failed to parse conflict resolution response, keeping all conflicts")
            return conflicts

        real_conflicts = []
        resolutions = {r["field"]: r for r in data.get("resolutions", [])}

        for c in conflicts:
            resolution = resolutions.get(c.field)
            if resolution and not resolution.get("is_real_conflict", True):
                logger.info(f"Conflict resolved (false positive): '{c.field}' — {resolution.get('reason', '')}")
            else:
                # The model's only contribution is whether this is a real
                # disagreement. preferred_value and the rest were settled
                # deterministically in fact_merge and are not touched here.
                real_conflicts.append(c)

        logger.info(f"Conflict resolution: {len(conflicts)} candidates → {len(real_conflicts)} real conflicts")
        return real_conflicts
