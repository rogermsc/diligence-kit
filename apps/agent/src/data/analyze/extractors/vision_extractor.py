"""Converts non-Excel documents to PDF for GPT extraction via Files API."""

import base64
import os
import subprocess

import fitz  # pymupdf

from src.core import soffice
from src.core.logging import get_logger

logger = get_logger(__name__)

CONVERT_TO_PDF = {".doc", ".docx", ".ppt", ".pptx"}
IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".tiff", ".tif", ".bmp", ".webp"}


def to_pdf(file_path: str) -> str:
    """Convert a file to PDF (if needed) and return the whole PDF as base64."""
    ext = os.path.splitext(file_path)[1].lower()

    if ext in CONVERT_TO_PDF:
        file_path = _convert_to_pdf(file_path)
    elif ext in IMAGE_EXTENSIONS:
        file_path = _image_to_pdf(file_path)
    # .pdf files pass through unchanged

    with open(file_path, "rb") as f:
        pdf_b64 = base64.b64encode(f.read()).decode("utf-8")

    logger.info(f"Prepared PDF: {file_path}")
    return pdf_b64


def _convert_to_pdf(file_path: str) -> str:
    """Convert DOC/DOCX/PPT/PPTX to PDF using LibreOffice headless."""
    output_dir = os.path.dirname(file_path)
    # Writable per-call LibreOffice profile — the container's non-root user has a
    # non-writable HOME, so LO otherwise fails to create its user installation.
    lo_profile = os.path.join(output_dir, "lo_profile")
    result = subprocess.run(
        [soffice.binary(), f"-env:UserInstallation=file://{lo_profile}",
         "--headless", "--convert-to", "pdf", file_path, "--outdir", output_dir],
        capture_output=True,
        timeout=60,
    )
    pdf_path = os.path.splitext(file_path)[0] + ".pdf"
    if not os.path.exists(pdf_path):
        raise RuntimeError(f"LibreOffice conversion failed: {result.stderr.decode()}")
    logger.info(f"Converted to PDF: {pdf_path}")
    return pdf_path


def _image_to_pdf(file_path: str) -> str:
    """Embed an image into a single-page PDF."""
    img_doc = fitz.open(file_path)
    pdf_doc = fitz.open()
    pdf_doc.insert_pdf(fitz.open("pdf", img_doc.convert_to_pdf()))
    pdf_path = os.path.splitext(file_path)[0] + ".pdf"
    pdf_doc.save(pdf_path)
    pdf_doc.close()
    img_doc.close()
    logger.info(f"Image converted to PDF: {pdf_path}")
    return pdf_path
