"""How well a fact is tied back to the document it came from.

The extraction prompt asks for a verbatim quote and a location for every fact.
Nothing checked that it got one. A model that paraphrases instead of copying —
the failure that actually happens, and the one hardest to notice by reading the
output — produced a fact indistinguishable from a properly cited one.

Two derived signals, both checkable, neither asked for:

  grounding       whether the model returned a quote and a location at all
  quote_verified  whether that quote occurs in the source text

Deliberately not a model-reported confidence score. Models are badly calibrated
and a fabricated number on an investment memo is worse than no number.
"""

import base64
import re
from typing import Optional

import fitz  # pymupdf

from src.core.logging import get_logger
from src.domain.analyze.entities import PreparedDocument

logger = get_logger(__name__)

GROUNDING_QUOTED = "quoted"
GROUNDING_QUOTED_UNLOCATED = "quoted_unlocated"
GROUNDING_UNQUOTED = "unquoted"

_WHITESPACE = re.compile(r"\s+")


def classify(quote: str, page: str) -> str:
    """A quote with a location beats a quote without one beats neither."""
    if not quote or not quote.strip():
        return GROUNDING_UNQUOTED
    if not page or not page.strip():
        return GROUNDING_QUOTED_UNLOCATED
    return GROUNDING_QUOTED


def pdf_text(data: bytes, label: str = "document") -> Optional[str]:
    """The text layer of a PDF, or None if it has none and None if it will not open.

    A scan carries an image per page and no characters. Returning "" for one
    would mark every fact in the document as a failed quote, which reads as "the
    model made them up" rather than "this is a scan and we cannot check it".
    """
    try:
        with fitz.open(stream=data, filetype="pdf") as pdf:
            text = "\n".join(page.get_text() for page in pdf)
    except Exception as e:
        logger.warning(f"Could not read text from {label} for verification: {e}")
        return None
    return text if text.strip() else None


def source_text(doc: PreparedDocument) -> Optional[str]:
    """The document's text, or None when there is nothing to read.

    None is not a failure to verify — it is the absence of anything to verify
    against, and the two must not collapse into the same answer.

    `source_text` is filled in at Step 0, which is the only place a pre-uploaded
    PDF's bytes exist; by the time it reaches here the document is a bare
    `openai_file_id`. `pdf_data` is the fallback for the paths that skip Step 0.
    """
    if doc.source_text:
        return doc.source_text
    if doc.text_content:
        return doc.text_content
    if doc.pdf_data:
        return pdf_text(base64.b64decode(doc.pdf_data), doc.file_name)
    return None


def verify(quote: str, text: Optional[str]) -> Optional[bool]:
    """Does the quote occur in the source? None when there is no source.

    Whitespace-insensitive because extraction reflows line breaks out of PDFs and
    CSVs, and case-insensitive because it re-cases headings. Anything looser
    would start passing paraphrases, which is the thing this exists to catch.

    ponytail: exact containment after normalising. If real documents turn out to
    fail this too often — ligatures, soft hyphens, smart quotes — normalise those
    too before reaching for fuzzy matching, which cannot tell a near-miss
    transcription from a near-miss invention.
    """
    if text is None:
        return None
    if not quote or not quote.strip():
        return False
    return _normalize(quote) in _normalize(text)


def _normalize(s: str) -> str:
    return _WHITESPACE.sub(" ", s).strip().casefold()
