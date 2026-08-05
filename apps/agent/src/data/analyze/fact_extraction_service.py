import asyncio
import base64
import json
from typing import List

import httpx
from openai import AsyncOpenAI

from src.core.config import settings
from src.core.logging import get_logger
from src.core.prompts.fact_extraction import (
    EXTRACTION_FIELDS as DEFAULT_EXTRACTION_FIELDS,
    FACT_EXTRACTION_SYSTEM_PROMPT as DEFAULT_SYSTEM_PROMPT,
    FACT_EXTRACTION_USER_PROMPT as DEFAULT_USER_PROMPT,
    FINANCIAL_FIELDS as DEFAULT_FINANCIAL_FIELDS,
    INFORMATION_TYPES as DEFAULT_INFORMATION_TYPES,
)
from src.domain.analyze.entities import DocumentFacts, Fact, PreparedDocument

logger = get_logger(__name__)

MAX_CONTENT_CHARS = 100_000


class FactExtractionService:
    def __init__(
        self,
        system_prompt_template: str = None,
        user_prompt_template: str = None,
        extraction_fields: dict = None,
        financial_fields: set = None,
        information_types: list = None,
    ):
        self._client = AsyncOpenAI(
            api_key=settings.openai_api_key,
            timeout=httpx.Timeout(180.0, connect=10.0),
            http_client=httpx.AsyncClient(
                limits=httpx.Limits(
                    max_connections=100,
                    max_keepalive_connections=50,
                ),
                timeout=httpx.Timeout(180.0, connect=10.0),
            ),
        )
        self._extraction_fields = extraction_fields or DEFAULT_EXTRACTION_FIELDS
        self._financial_fields = financial_fields or DEFAULT_FINANCIAL_FIELDS
        self._information_types = information_types or DEFAULT_INFORMATION_TYPES
        self._system_prompt_template = system_prompt_template or DEFAULT_SYSTEM_PROMPT
        self._user_prompt_template = user_prompt_template or DEFAULT_USER_PROMPT
        self._valid_fields = set(self._extraction_fields.keys())

    async def extract_facts_all(
        self, documents: List[PreparedDocument], company_name: str
    ) -> List[DocumentFacts]:
        """Extract facts from all documents in parallel. One GPT call per document."""
        semaphore = asyncio.Semaphore(50)

        async def _process(doc: PreparedDocument) -> DocumentFacts:
            async with semaphore:
                return await self._extract_facts_one(doc, company_name)

        tasks = [_process(doc) for doc in documents]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        extracted = []
        failed = []
        for doc, result in zip(documents, results):
            if isinstance(result, Exception):
                logger.warning(f"Fact extraction failed for {doc.file_name}: {result}. Will retry.")
                failed.append(doc)
            else:
                extracted.append(result)

        # Retry failed docs sequentially (less contention)
        for doc in failed:
            try:
                result = await self._extract_facts_one(doc, company_name)
                extracted.append(result)
                logger.info(f"Retry succeeded for {doc.file_name}")
            except Exception as e:
                logger.error(f"Retry also failed for {doc.file_name}: {e}")

        total_facts = sum(len(df.facts) for df in extracted)
        logger.info(
            f"Fact extraction complete: {len(extracted)}/{len(documents)} docs, {total_facts} total facts"
        )
        return extracted

    async def _extract_facts_one(self, doc: PreparedDocument, company_name: str) -> DocumentFacts:
        """Extract facts from a single document via GPT Responses API."""
        logger.info(f"GPT call started: {doc.file_name}")

        fields_schema = "\n".join(
            f"- {name}: {desc}" for name, desc in self._extraction_fields.items()
        )
        info_types_str = "\n".join(f"- {t}" for t in self._information_types)
        safe_company_name = "".join(
            c for c in company_name[:200] if c.isprintable() and c not in "\r\n\t"
        )
        system_prompt = self._system_prompt_template.format(
            company_name=safe_company_name,
            fields_schema=fields_schema,
            information_types=info_types_str,
        )

        user_content = await self._build_user_content(doc)

        response = await self._client.responses.create(
            model="gpt-5-mini",
            instructions=system_prompt,
            input=[{
                "role": "user",
                "content": user_content,
            }],
            text={"format": {"type": "json_object"}},
        )

        raw_text = response.output_text

        parsed = self._parse_response(raw_text, doc)

        logger.info(
            f"{doc.file_name}: {len(parsed.facts)} facts, coverage: {parsed.coverage}"
        )
        return parsed

    async def _build_user_content(self, doc: PreparedDocument) -> list:
        if doc.text_content:
            content = doc.text_content
            if len(content) > MAX_CONTENT_CHARS:
                logger.warning(f"{doc.file_name}: truncating to {MAX_CONTENT_CHARS} chars")
                content = content[:MAX_CONTENT_CHARS]

            user_prompt = self._user_prompt_template.format(
                file_name=doc.file_name, content=content
            )
            return [{"type": "input_text", "text": user_prompt}]

        # PDF document
        user_prompt = self._user_prompt_template.format(
            file_name=doc.file_name, content="[See attached PDF file]"
        )

        # Pre-uploaded — use cached file_id directly (no base64, no upload)
        if doc.openai_file_id:
            return [
                {"type": "input_file", "file_id": doc.openai_file_id},
                {"type": "input_text", "text": user_prompt},
            ]

        # Fallback: upload on the fly (shouldn't happen after Step 0)
        pdf_bytes = base64.b64decode(doc.pdf_data)
        upload_name = doc.file_name if doc.file_name.endswith(".pdf") else doc.file_name + ".pdf"
        file = await self._client.files.create(
            file=(upload_name, pdf_bytes),
            purpose="user_data",
        )
        logger.info(f"Uploaded {doc.file_name} to Files API: {file.id}")

        return [
            {"type": "input_file", "file_id": file.id},
            {"type": "input_text", "text": user_prompt},
        ]

    def _is_valid_field(self, field: str) -> bool:
        """Check if a field name matches the fixed schema."""
        if field in self._valid_fields:
            return True
        # Financial fields with period suffix (e.g. annual_revenue_fy2024)
        for prefix in self._financial_fields:
            if field.startswith(prefix + "_"):
                return True
        return False

    def _parse_response(self, raw_text: str, doc: PreparedDocument) -> DocumentFacts:
        if not raw_text:
            logger.error(f"Empty response for {doc.file_name}")
            return DocumentFacts(
                document_id=doc.document_id,
                file_name=doc.file_name,
                facts=[],
                coverage=[],
            )

        try:
            data = json.loads(raw_text)
        except json.JSONDecodeError:
            logger.error(f"Failed to parse JSON for {doc.file_name}. Response length: {len(raw_text)}")
            return DocumentFacts(
                document_id=doc.document_id,
                file_name=doc.file_name,
                facts=[],
                coverage=[],
            )

        facts = []
        dropped = 0
        for f in data.get("facts", []):
            field = f.get("field", "unknown")
            if not self._is_valid_field(field):
                dropped += 1
                continue
            facts.append(
                Fact(
                    field=field,
                    value=f.get("value", ""),
                    source=doc.file_name,
                    page=f.get("page", ""),
                    quote=f.get("quote", ""),
                    source_type=f.get("source_type", ""),
                    document_version=f.get("document_version", ""),
                    document_date=f.get("document_date", ""),
                )
            )

        if dropped:
            logger.warning(f"{doc.file_name}: dropped {dropped} facts with unknown fields")

        coverage = [c for c in data.get("coverage", []) if c in self._information_types]

        return DocumentFacts(
            document_id=doc.document_id,
            file_name=doc.file_name,
            facts=facts,
            coverage=coverage,
        )
