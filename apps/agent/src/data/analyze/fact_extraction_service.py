import asyncio
import base64
import json
import re
from typing import List

from src.core.llm import respond_json, upload_file
from src.core.logging import get_logger
from src.core.prompts.fact_extraction import (
    EXTRACTION_FIELDS as DEFAULT_EXTRACTION_FIELDS,
    FACT_EXTRACTION_SYSTEM_PROMPT as DEFAULT_SYSTEM_PROMPT,
    FACT_EXTRACTION_USER_PROMPT as DEFAULT_USER_PROMPT,
    FINANCIAL_FIELDS as DEFAULT_FINANCIAL_FIELDS,
    INFORMATION_TYPES as DEFAULT_INFORMATION_TYPES,
)
from src.data.analyze import grounding
from src.domain.analyze.entities import DocumentFacts, Fact, PreparedDocument

logger = get_logger(__name__)

# A figure carries its own scale, or it does not: "£3.2M", "$281.7 billion" and
# "963,708 (in thousands)" all do; "$ 98,011" does not.
_UNIT = re.compile(r"\d\s*[kmb]\b|thousand|million|billion|%", re.IGNORECASE)


def _has_no_unit(value: str) -> bool:
    return bool(re.search(r"\d", value or "")) and not _UNIT.search(value or "")

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
        for doc, result in zip(documents, results, strict=True):
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

        # Nothing downstream compares what was uploaded against what was read, so
        # a run where every extraction failed used to continue through synthesis,
        # render and upload, and report success. The deliverable was a clean,
        # empty due-diligence memo — the worst possible failure for this product.
        if documents and not extracted:
            raise RuntimeError(
                f"Fact extraction produced nothing from {len(documents)} "
                f"document(s). Refusing to synthesise a report from no facts."
            )

        if len(extracted) < len(documents):
            logger.error(
                f"Analysing {len(extracted)} of {len(documents)} documents — "
                f"{len(documents) - len(extracted)} could not be read."
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

        raw_text = await respond_json(
            "fact_extraction",
            system_prompt,
            user_content,
            # Two documents in different folders share a basename, and the
            # basename is the only per-document text in this prompt.
            document_key=doc.document_id,
        )

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
        file_id = await upload_file(upload_name, pdf_bytes)
        logger.info(f"Uploaded {doc.file_name} to Files API: {file_id}")

        return [
            {"type": "input_file", "file_id": file_id},
            {"type": "input_text", "text": user_prompt},
        ]

    def _is_financial_field(self, field: str) -> bool:
        return any(field.startswith(prefix) for prefix in self._financial_fields)

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

        # Read once per document, not once per fact: for a PDF this parses the
        # whole file. None means there is nothing to check against.
        text = grounding.source_text(doc)

        facts = []
        dropped = 0
        for f in data.get("facts", []):
            field = f.get("field", "unknown")
            if not self._is_valid_field(field):
                dropped += 1
                continue
            quote = f.get("quote", "")
            page = f.get("page", "")
            facts.append(
                Fact(
                    field=field,
                    value=f.get("value", ""),
                    source=doc.file_name,
                    page=page,
                    quote=quote,
                    source_type=f.get("source_type", ""),
                    document_version=f.get("document_version", ""),
                    document_date=f.get("document_date", ""),
                    grounding=grounding.classify(quote, page),
                    quote_verified=grounding.verify(quote, text),
                )
            )

        if dropped:
            logger.warning(f"{doc.file_name}: dropped {dropped} facts with unknown fields")

        # A money figure whose scale is stated somewhere else on the page comes
        # back as "$ 98,011", and nothing downstream can tell that from ninety-
        # eight thousand dollars. authority.parse_amount reads it literally, so
        # the same revenue quoted "in thousands" by one document and "$98.0M" by
        # another looks like a thousand-fold disagreement rather than agreement.
        # Measured on ten real filings: 4 of 57 headline figures, all from the
        # one filer whose statements put the unit in a column header.
        ambiguous = [f for f in facts
                     if self._is_financial_field(f.field) and _has_no_unit(f.value)]
        if ambiguous:
            logger.warning(
                f"{doc.file_name}: {len(ambiguous)} financial facts state no unit — "
                f"{', '.join(f'{f.field}={f.value.strip()}' for f in ambiguous[:3])}"
                f"{' …' if len(ambiguous) > 3 else ''}"
            )

        if text is None:
            logger.info(
                f"{doc.file_name}: no readable text, {len(facts)} facts left unverified"
            )
        else:
            unverified = [f for f in facts if f.quote_verified is False]
            if unverified:
                # Worth a warning rather than a debug line: a quote that is not in
                # the document is the model having written prose instead of copying,
                # and every downstream citation of that fact inherits it.
                logger.warning(
                    f"{doc.file_name}: {len(unverified)}/{len(facts)} quotes not found "
                    f"in the source ({', '.join(f.field for f in unverified[:5])})"
                )

        coverage = [c for c in data.get("coverage", []) if c in self._information_types]

        return DocumentFacts(
            document_id=doc.document_id,
            file_name=doc.file_name,
            facts=facts,
            coverage=coverage,
        )
