import asyncio
import json
from typing import List

from openai import AsyncOpenAI

from src.core.config import settings
from src.core.logging import get_logger
from src.domain.analyze.entities import Conflict

logger = get_logger(__name__)

CONFLICT_RESOLUTION_PROMPT = """\
You are a due diligence analyst reviewing potential data conflicts.

For each conflict below, determine if the values are actually the same (just different formatting, \
abbreviation, or punctuation) or genuinely different.

### Version Awareness
Each value may include version and date metadata (e.g. "version=v1.5 date=2023-09-20"). \
When values differ across document versions, this IS a real conflict — mark is_real_conflict=true \
and set preferred_value to the value from the MOST RECENT document (by date first, then version number). \
Explain what changed between versions.

Conflicts:
{conflicts}

Respond with valid JSON:
{{
  "resolutions": [
    {{
      "field": "the field name",
      "is_real_conflict": true/false,
      "reason": "brief explanation",
      "preferred_value": "the value from the newest document version (only when is_real_conflict=true and version info is available, otherwise empty string)"
    }}
  ]
}}\
"""


class ConflictResolutionService:
    def __init__(self):
        self._client = AsyncOpenAI(api_key=settings.openai_api_key)

    async def resolve(self, conflicts: List[Conflict]) -> List[Conflict]:
        """Filter out false-positive conflicts using GPT."""
        if not conflicts:
            return []

        conflicts_text = ""
        for c in conflicts:
            conflicts_text += f"\nField: {c.field}\nValues: {c.values}\n"

        response = await self._client.chat.completions.create(
            model="gpt-5-mini",
            messages=[
                {"role": "user", "content": CONFLICT_RESOLUTION_PROMPT.format(conflicts=conflicts_text)},
            ],
            response_format={"type": "json_object"},
        )

        raw_text = response.choices[0].message.content
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
                # Attach preferred_value from version resolution if available
                preferred = (resolution or {}).get("preferred_value", "")
                if preferred:
                    c.preferred_value = preferred
                    logger.info(f"Conflict on '{c.field}': resolved to newest version")
                real_conflicts.append(c)

        logger.info(f"Conflict resolution: {len(conflicts)} candidates → {len(real_conflicts)} real conflicts")
        return real_conflicts
