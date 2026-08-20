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
import unicodedata
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

    ponytail: exact containment after normalising, and it holds. That used to be
    a hope — the only corpus behind it was written by the same library that reads
    it back, so it could only ever agree. Measured since against 22 SEC annual
    reports this pipeline did not author, and against gpt-5-mini quoting four of
    them: 82 of 87 real model quotes verify, up from 68. See evals/README.md.

    Keep it exact. Fuzzy matching cannot tell a near-miss transcription from a
    near-miss invention, and the discrimination is worth keeping: quotes from a
    different company's report are rejected outright, bar shared auditor's-report
    boilerplate, which is a true match.
    """
    if text is None:
        return None
    if not quote or not quote.strip():
        return False

    source = _normalize(text)
    if _normalize(quote) in source:
        return True

    # A model asked for a verbatim quote will elide the boring middle of a long
    # sentence with "…" and consider that verbatim. Measured against gpt-5-mini
    # on real filings, that is the single largest reason a true quote is
    # rejected — 7 of 19 failures over 87 facts.
    #
    # Every fragment must appear, and each after the one before it. Order is
    # what keeps this honest: it permits the convention without permitting a
    # claim assembled out of phrases collected from three different pages.
    fragments = [f for f in _ELLIPSIS.split(quote) if f.strip()]
    if len(fragments) < 2:
        return False

    at = 0
    for fragment in fragments:
        found = source.find(_normalize(fragment), at)
        if found < 0:
            return False
        at = found + len(_normalize(fragment))
    return True


# A hyphen between two letters, and any whitespace after it. Applied to both
# sides, so it does not matter which of the two a hyphen came from: a word split
# across a line break ("opera-\ntions") and a real compound ("well-known") both
# reduce to the same thing, and the reader's transcription reduces to it too.
#
# Between *letters* only. "2023-2024" and "-310000" are left alone, which
# matters more here than in ordinary prose.
_LINE_HYPHEN = re.compile(r"(?<=[^\W\d_])-\s*(?=[^\W\d_])", re.UNICODE)

_SOFT_HYPHEN = "­"

_ELLIPSIS = re.compile(r"\s*(?:\.\.\.+|…)\s*")

# Typographic variants a model flattens on its way out. The layer holds a
# printer's quote and the model writes an apostrophe; both are the same
# character to a reader, and folding them cannot make an invention match
# something it does not already say.
_TYPOGRAPHY = str.maketrans({
    "‘": "'", "’": "'", "‚": "'", "‛": "'",
    "“": '"', "”": '"', "„": '"', "‟": '"',
    "–": "-", "—": "-", "‒": "-", "―": "-", "−": "-",
})

# Noncharacters and zero-width marks. U+FFFE turns up mid-word in filings
# ("distribu￾tion") where the PDF carries an optional hyphen, and a model
# reading the page copies it straight through.
_INVISIBLE = re.compile(r"[\ufffe\uffff\ufeff\u200b-\u200f\u2028\u2029]")


def _normalize(s: str) -> str:
    """Fold away the differences between a rendered page and its text layer.

    A model quoting a PDF reads the page as drawn; `pdf_text` reads the text
    layer underneath. Measured over 2,640 sentences from 22 SEC annual reports,
    those two disagreed on 2.9% of sentences, and 95% of that was one thing:
    a word broken across a justified line break, which every one of the 22
    documents contains. That is what `_LINE_HYPHEN` is for.

    NFKC covers the rest — a "™" the layer stores as one glyph and a reader may
    write as "TM", fullwidth forms, fractions. Ligatures are *not* on that list:
    `casefold()` already turns "ﬁ" into "fi", which the measurement only showed
    because it was checked rather than assumed.

    Deliberately still exact containment afterwards. Fuzzy matching cannot tell
    a near-miss transcription from a near-miss invention, and at the thresholds
    that would accept a reformatted number it also accepts £3.8M as evidence
    for £3.2M.
    """
    # ponytail: the document side is re-normalised per fact — 19 ms against a
    # 350k-character annual report, so 0.7 s for a 40-fact document, against a
    # pipeline that spends seconds per LLM call. Normalise once per document and
    # pass it down if that ever stops being true.
    s = unicodedata.normalize("NFKC", s).replace(_SOFT_HYPHEN, "")
    s = _INVISIBLE.sub("", s).translate(_TYPOGRAPHY)
    s = _LINE_HYPHEN.sub("", s)
    return _WHITESPACE.sub(" ", s).strip().casefold()
