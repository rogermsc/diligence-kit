import asyncio
import os
import pathlib
import tempfile
from typing import List

from src.core.logging import get_logger
from src.data.analyze.extractors import excel_extractor, vision_extractor
from src.data.storage import get_storage
from src.domain.analyze.entities import Document, PreparedDocument

logger = get_logger(__name__)

EXCEL_EXTENSIONS = {".xlsx", ".xls"}

# Read as text rather than rendered to PDF. The upload path has always accepted
# these (apps/web/src/lib/zipFileFilter.ts), but they were absent here, so they
# uploaded successfully and were then discarded with only a log line — a
# dataroom of CSV exports analysed as an empty dataroom.
TEXT_EXTENSIONS = {".csv", ".txt"}

SUPPORTED_EXTENSIONS = EXCEL_EXTENSIONS | TEXT_EXTENSIONS | {
    ".pdf",
    ".doc", ".docx",
    ".ppt", ".pptx",
    ".png", ".jpg", ".jpeg", ".tiff", ".tif", ".bmp", ".webp",
}


def _read_text(path: str) -> str:
    """Decode a text document without failing on an unexpected encoding.

    Datarooms carry exports from every locale; a UnicodeDecodeError here would
    lose the whole document rather than a few characters.
    """
    raw = pathlib.Path(path).read_bytes()
    # utf-8-sig before utf-8: plain utf-8 decodes a BOM-prefixed file happily and
    # leaves the BOM glued to the first character, so a CSV exported from Excel
    # would arrive with its first column named "\ufeffperiod".
    for encoding in ("utf-8-sig", "cp1252", "latin-1"):
        try:
            return raw.decode(encoding)
        except UnicodeDecodeError:
            continue
    return raw.decode("utf-8", errors="replace")


class ExtractionService:
    def __init__(self):
        self._gcs = get_storage()

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
        for doc, result in zip(documents, results, strict=True):
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

            if ext in TEXT_EXTENSIONS:
                text = _read_text(local_path)
                if not text.strip():
                    logger.warning(f"Empty extraction for {file_name}")
                    return []
                return [PreparedDocument(
                    document_id=doc.id,
                    file_name=file_name,
                    text_content=text,
                )]

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
