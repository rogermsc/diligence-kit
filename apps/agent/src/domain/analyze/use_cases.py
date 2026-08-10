import asyncio
from typing import List, Tuple

from src.core.logging import get_logger, reset_log_context, set_log_context
from src.data.analyze.conflict_resolution_service import ConflictResolutionService
from src.data.analyze.document_renderer import convert_docx_to_pdf, render_docx
from src.data.analyze.extraction_service import ExtractionService
from src.data.analyze.fact_extraction_service import FactExtractionService
from src.data.analyze.file_preparation_service import FilePreparationService
from src.data.analyze.one_pager_service import OnePagerService
from src.data.storage import get_storage
from src.domain.analyze.entities import AnalyzeInput, Document, MergedFacts, OnePager
from src.domain.analyze.fact_merge import merge_facts

logger = get_logger(__name__)


class AnalyzeUseCase:
    def __init__(self):
        self._extraction_service = ExtractionService()
        self._fact_extraction_service = FactExtractionService()
        self._conflict_resolution_service = ConflictResolutionService()
        self._file_preparation_service = FilePreparationService()
        self._gcs = get_storage()
        self._one_pager_service = OnePagerService()

    async def execute(
        self, input: AnalyzeInput
    ) -> Tuple[str, List[Document], MergedFacts, OnePager]:
        set_log_context(company_id=input.company_id, automation_id=input.automation_id)

        try:
            logger.info(f"Starting analysis for company '{input.company_name}'")

            facts_blob_path = f"agent-facts/{input.automation_id}/facts.json"
            merged = None

            if input.retry:
                logger.info("Retry mode: checking GCS for cached facts")
                has_facts = await asyncio.to_thread(self._gcs.blob_exists, facts_blob_path)

                if has_facts:
                    logger.info("Cached facts found — skipping Steps 1-4")
                    facts_json = await asyncio.to_thread(self._gcs.download_json, facts_blob_path)
                    merged = MergedFacts.model_validate_json(facts_json)
                else:
                    logger.info("No cached facts found — running full pipeline")

            if merged is None:
                # Step 0: Pre-upload PDFs to OpenAI Files API (memory-efficient)
                logger.info(f"Step 0: Pre-uploading {len(input.documents)} documents to Files API")
                input.documents = await self._file_preparation_service.prepare_all(input.documents)

                # Step 1: Download and prepare documents (Excel → CSV, pre-uploaded → lightweight)
                logger.info(f"Step 1: Preparing {len(input.documents)} documents")

                prepared = await self._extraction_service.prepare_all(input.documents)

                for doc in prepared:
                    if doc.text_content:
                        logger.info(f"  [csv] {doc.file_name}: {len(doc.text_content)} chars")
                    else:
                        logger.info(f"  [pdf] {doc.file_name}")

                # Step 2: Extract facts — one GPT call per document
                logger.info(f"Step 2: Extracting facts from {len(prepared)} documents")

                doc_facts_list = await self._fact_extraction_service.extract_facts_all(prepared, input.company_name)

                # Step 3: Deterministic merge — all facts kept, conflicts flagged
                logger.info("Step 3: Merging facts")

                merged = merge_facts(doc_facts_list)

                # Step 3b: Resolve false-positive conflicts via LLM
                if merged.conflicts:
                    logger.info(f"Step 3b: Resolving {len(merged.conflicts)} conflicts")
                    merged.conflicts = await self._conflict_resolution_service.resolve(merged.conflicts)

                logger.info(
                    f"Analysis complete: "
                    f"{sum(len(v) for v in merged.facts.values())} facts, "
                    f"{len(merged.coverage)}/24 info types covered, "
                    f"{len(merged.missing)} missing, "
                    f"{len(merged.conflicts)} conflicts"
                )

                # Step 4: Persist facts.json to GCS
                logger.info("Step 4: Persisting facts to GCS")
                await asyncio.to_thread(
                    self._gcs.upload_json, facts_blob_path, merged.model_dump_json(indent=2)
                )

            # Step 5: One-pager synthesis
            logger.info("Step 5: Generating one-pager")
            one_pager = await self._one_pager_service.generate(input.company_name, merged)

            # Step 6: Persist one-pager JSON to GCS
            logger.info("Step 6: Persisting one-pager JSON to GCS")
            one_pager_path = f"agent-facts/{input.automation_id}/one_pager.json"
            await asyncio.to_thread(
                self._gcs.upload_json, one_pager_path, one_pager.model_dump_json(indent=2)
            )

            # Step 7: Render DOCX and convert to PDF
            logger.info("Step 7: Rendering DOCX and converting to PDF")
            docx_bytes = await asyncio.to_thread(
                render_docx, one_pager, input.company_name, input.automation_id
            )
            pdf_bytes = await convert_docx_to_pdf(docx_bytes)

            # Step 8: Persist PDF to GCS
            logger.info("Step 8: Persisting PDF to GCS")
            pdf_path = f"one-pagers/{input.automation_id}.pdf"
            await asyncio.to_thread(
                self._gcs.upload_bytes, pdf_path, pdf_bytes, "application/pdf"
            )

            bucket = self._gcs.bucket_name
            pdf_url = f"gs://{bucket}/{pdf_path}"

            logger.info(f"Pipeline complete for '{input.company_name}'")
            # The one-pager travels back too. It was built at Step 5, rendered,
            # and then dropped on the floor — the callback carried a URL, so
            # every structured thing the pipeline computed died with the process.
            return pdf_url, input.documents, merged, one_pager
        finally:
            reset_log_context()
