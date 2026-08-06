"""Pre-uploads non-Excel documents to OpenAI Files API (Step 0).

Downloads each document from GCS, converts to PDF if needed, uploads to
OpenAI Files API, and returns the document with openai_file_id attached.
Base64 data is released immediately after upload — only the small file_id
string survives in memory.
"""

import asyncio
import base64
import os
from typing import List

from src.core.llm import upload_file
from src.core.logging import get_logger
from src.data.analyze.extraction_service import EXCEL_EXTENSIONS, ExtractionService
from src.domain.analyze.entities import Document

logger = get_logger(__name__)


class FilePreparationService:
    """Pre-uploads non-Excel docs to OpenAI Files API. Semaphore(30)."""

    def __init__(self):
        self._extraction_service = ExtractionService()

    async def prepare_all(self, documents: List[Document]) -> List[Document]:
        """Returns documents with openai_file_id set for non-Excel files."""
        semaphore = asyncio.Semaphore(30)

        async def _process(doc: Document) -> Document:
            if doc.openai_file_id:
                return doc  # Already has file_id (diligence stage or retry)

            url_path = doc.url.split("?")[0]
            file_name_check = os.path.basename(url_path)
            if file_name_check.startswith("._"):
                logger.info(f"Skipping macOS resource fork file: {file_name_check}")
                return doc

            ext = os.path.splitext(url_path)[1].lower()
            if ext in EXCEL_EXTENSIONS:
                return doc  # Excel — handled by ExtractionService directly

            async with semaphore:
                try:
                    # Download from GCS + convert to PDF (reuse existing logic)
                    prepared_list = await asyncio.to_thread(
                        self._extraction_service._prepare_one, doc
                    )
                    if not prepared_list or not prepared_list[0].pdf_data:
                        logger.warning(f"No PDF data for {doc.url}, skipping pre-upload")
                        return doc

                    pdf_b64 = prepared_list[0].pdf_data
                    file_name = prepared_list[0].file_name

                    # Upload to OpenAI Files API
                    pdf_bytes = base64.b64decode(pdf_b64)
                    upload_name = file_name if file_name.endswith(".pdf") else file_name + ".pdf"
                    file_id = await upload_file(upload_name, pdf_bytes)
                    logger.info(f"Pre-uploaded {file_name} to Files API: {file_id}")

                    # pdf_bytes and pdf_b64 go out of scope → GC'd
                    return doc.model_copy(update={"openai_file_id": file_id})

                except Exception as e:
                    logger.error(f"Pre-upload failed for {doc.url}: {e}")
                    return doc  # Fallback: will be handled by existing on-the-fly upload

        tasks = [_process(doc) for doc in documents]
        results = await asyncio.gather(*tasks)

        uploaded_count = sum(1 for d in results if d.openai_file_id)
        logger.info(
            f"Pre-upload complete: {uploaded_count}/{len(documents)} documents uploaded to Files API"
        )
        return results
