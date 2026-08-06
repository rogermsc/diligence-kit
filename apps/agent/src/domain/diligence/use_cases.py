"""8-step pipeline for a single diligence domain, mirroring AnalyzeUseCase."""

import asyncio

from src.core.logging import get_logger, set_log_context, reset_log_context
from src.core.prompts.diligence_extraction import DOMAIN_EXTRACTION_CONFIGS
from src.data.analyze.conflict_resolution_service import ConflictResolutionService
from src.data.analyze.extraction_service import ExtractionService
from src.data.analyze.fact_extraction_service import FactExtractionService
from src.data.analyze.file_preparation_service import FilePreparationService
from src.data.storage import get_storage
from src.data.diligence.document_renderer import render_diligence_docx
from src.data.analyze.document_renderer import convert_docx_to_pdf
from src.data.diligence.report_service import DiligenceReportService
from src.domain.analyze.fact_merge import merge_facts
from src.domain.diligence.entities import DiligenceInput

logger = get_logger(__name__)


class DiligenceUseCase:
    def __init__(self, domain: str):
        self._domain = domain
        config = DOMAIN_EXTRACTION_CONFIGS[domain]

        self._extraction_service = ExtractionService()
        self._file_preparation_service = FilePreparationService()
        self._fact_extraction_service = FactExtractionService(
            system_prompt_template=config.system_prompt,
            user_prompt_template=config.user_prompt,
            extraction_fields=config.extraction_fields,
            financial_fields=config.financial_fields,
            information_types=config.information_types,
        )
        self._conflict_resolution_service = ConflictResolutionService()
        self._gcs = get_storage()
        self._report_service = DiligenceReportService()

        # Merge parameters
        self._unique_fields = config.unique_fields
        self._financial_prefixes = config.financial_prefixes
        self._information_types = config.information_types

    async def execute(self, input: DiligenceInput) -> str:
        """Run the full diligence pipeline for one domain. Returns gs:// URL of the PDF."""
        set_log_context(company_id=input.company_id, automation_id=input.automation_id)

        try:
            logger.info(
                f"[{self._domain}] Starting diligence for company '{input.company_name}'"
            )

            # Step 0: Pre-upload any docs missing file_ids (no-op if already uploaded)
            logger.info(
                f"[{self._domain}] Step 0: Pre-uploading documents to Files API"
            )
            input.documents = await self._file_preparation_service.prepare_all(input.documents)

            # Step 1: Download and prepare documents (pre-uploaded → lightweight)
            logger.info(
                f"[{self._domain}] Step 1: Preparing {len(input.documents)} documents"
            )
            prepared = await self._extraction_service.prepare_all(input.documents)

            for doc in prepared:
                if doc.text_content:
                    logger.info(f"  [csv] {doc.file_name}: {len(doc.text_content)} chars")
                else:
                    logger.info(f"  [pdf] {doc.file_name}")

            # Step 2: Extract domain-specific facts
            logger.info(
                f"[{self._domain}] Step 2: Extracting facts from {len(prepared)} documents"
            )
            doc_facts_list = await self._fact_extraction_service.extract_facts_all(
                prepared, input.company_name
            )

            # Step 3: Merge facts
            logger.info(f"[{self._domain}] Step 3: Merging facts")
            merged = merge_facts(
                doc_facts_list,
                unique_fields=self._unique_fields,
                financial_prefixes=self._financial_prefixes,
                information_types=self._information_types,
            )

            # Step 3b: Resolve conflicts
            if merged.conflicts:
                logger.info(
                    f"[{self._domain}] Step 3b: Resolving {len(merged.conflicts)} conflicts"
                )
                merged.conflicts = await self._conflict_resolution_service.resolve(
                    merged.conflicts
                )

            logger.info(
                f"[{self._domain}] Facts complete: "
                f"{sum(len(v) for v in merged.facts.values())} facts, "
                f"{len(merged.coverage)}/{len(self._information_types)} info types covered, "
                f"{len(merged.conflicts)} conflicts"
            )

            # Step 4: Persist domain_facts.json to GCS
            facts_blob_path = (
                f"agent-facts/{input.automation_id}/{self._domain.lower()}_facts.json"
            )
            logger.info(f"[{self._domain}] Step 4: Persisting facts to GCS")
            await asyncio.to_thread(
                self._gcs.upload_json, facts_blob_path, merged.model_dump_json(indent=2)
            )

            # Step 5: Synthesize report via GPT
            logger.info(f"[{self._domain}] Step 5: Generating report")
            report = await self._report_service.generate(
                self._domain, input.company_name, merged
            )

            # Step 6: Persist report JSON to GCS
            report_json_path = (
                f"agent-facts/{input.automation_id}/{self._domain.lower()}_report.json"
            )
            logger.info(f"[{self._domain}] Step 6: Persisting report JSON to GCS")
            await asyncio.to_thread(
                self._gcs.upload_json, report_json_path, report.model_dump_json(indent=2)
            )

            # Step 7: Render DOCX and convert to PDF
            logger.info(f"[{self._domain}] Step 7: Rendering DOCX and converting to PDF")
            docx_bytes = await asyncio.to_thread(
                render_diligence_docx, self._domain, report
            )
            pdf_bytes = await convert_docx_to_pdf(docx_bytes)

            # Step 8: Upload PDF to GCS
            pdf_path = f"reports/{input.automation_id}/{self._domain.lower()}.pdf"
            logger.info(f"[{self._domain}] Step 8: Persisting PDF to GCS")
            await asyncio.to_thread(
                self._gcs.upload_bytes, pdf_path, pdf_bytes, "application/pdf"
            )

            bucket = self._gcs.bucket_name
            pdf_url = f"gs://{bucket}/{pdf_path}"

            logger.info(
                f"[{self._domain}] Pipeline complete for '{input.company_name}': {pdf_url}"
            )
            return pdf_url

        finally:
            reset_log_context()
