import asyncio
import os
import tempfile
from typing import List

from src.core.logging import get_logger
from src.data.analyze.gcs_client import GCSClient
from src.data.analyze.extractors import excel_extractor, vision_extractor
from src.domain.analyze.entities import Document, PreparedDocument

logger = get_logger(__name__)

EXCEL_EXTENSIONS = {".xlsx", ".xls"}

SUPPORTED_EXTENSIONS = EXCEL_EXTENSIONS | {
    ".pdf",
    ".doc", ".docx",
    ".ppt", ".pptx",
    ".png", ".jpg", ".jpeg", ".tiff", ".tif", ".bmp", ".webp",
}


class ExtractionService:
    def __init__(self):
        self._gcs = GCSClient()

    async def prepare_all(self, documents: List[Document]) -> List[PreparedDocument]:
        """Download and prepare all documents in parallel.
        Excel → one PreparedDocument per sheet with CSV text.
        Everything else → one PreparedDocument with whole PDF as base64."""
        semaphore = asyncio.Semaphore(10)

        async def _process(doc: Document) -> List[PreparedDocument]:
            async with semaphore:
                return await asyncio.to_thread(self._prepare_one, doc)

        tasks = [_process(doc) for doc in documents]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        prepared = []
        for doc, result in zip(documents, results):
            if isinstance(result, Exception):
                logger.error(f"Failed to prepare {doc.url}: {result}")
            else:
                prepared.extend(result)

        logger.info(f"Prepared {len(prepared)} items from {len(documents)} documents")
        return prepared

    def _prepare_one(self, doc: Document) -> List[PreparedDocument]:
        url_path = doc.url.split("?")[0]
        file_name = os.path.basename(url_path)

        # Skip macOS resource fork files (._prefix)
        if file_name.startswith("._"):
            logger.info(f"Skipping macOS resource fork file: {file_name}")
            return []

        ext = os.path.splitext(url_path)[1].lower()

        if ext not in SUPPORTED_EXTENSIONS:
            logger.warning(f"Unsupported file type '{ext}': {doc.url}")
            return []

        # Already pre-uploaded to OpenAI Files API — lightweight PreparedDocument
        if doc.openai_file_id:
            return [PreparedDocument(
                document_id=doc.id,
                file_name=file_name,
                openai_file_id=doc.openai_file_id,
            )]

        with tempfile.TemporaryDirectory() as tmp_dir:
            local_path = self._gcs.download(doc.url, tmp_dir)

            if ext in EXCEL_EXTENSIONS:
                sheets = excel_extractor.extract_sheets(local_path)
                if not sheets:
                    logger.warning(f"Empty extraction for {file_name}")
                    return []
                # One PreparedDocument per sheet
                results = []
                for sheet_name, csv_text in sheets:
                    results.append(PreparedDocument(
                        document_id=doc.id,
                        file_name=f"{file_name} ({sheet_name})",
                        text_content=csv_text,
                    ))
                return results
            else:
                # All non-Excel files → convert to PDF if needed → base64
                pdf_b64 = vision_extractor.to_pdf(local_path)
                return [PreparedDocument(
                    document_id=doc.id,
                    file_name=file_name,
                    pdf_data=pdf_b64,
                )]
