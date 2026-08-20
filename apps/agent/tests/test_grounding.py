"""A quote the model paraphrased must not read the same as one it copied.

The extraction prompt demands a verbatim quote, and nothing checked that it got
one. These are the cases that decide whether a fact carries a citation an
analyst can follow or one that only looks like it.
"""

import base64

import fitz
import pytest

from src.data.analyze import grounding
from src.domain.analyze.entities import PreparedDocument

SOURCE = "Turnover for the year was  £3.2M\nacross three regions."


def doc(**kw) -> PreparedDocument:
    return PreparedDocument(document_id="d1", file_name="accounts.pdf", **kw)


def pdf_bytes(text: str) -> str:
    with fitz.open() as out:
        page = out.new_page()
        page.insert_text((72, 72), text)
        return base64.b64encode(out.tobytes()).decode()


class TestClassify:
    def test_quote_with_a_location_is_the_strongest(self):
        assert grounding.classify("Turnover £3.2M", "1") == grounding.GROUNDING_QUOTED

    def test_quote_without_a_location_is_weaker(self):
        assert (
            grounding.classify("Turnover £3.2M", "")
            == grounding.GROUNDING_QUOTED_UNLOCATED
        )

    @pytest.mark.parametrize("quote", ["", "   "])
    def test_no_quote_at_all(self, quote):
        assert grounding.classify(quote, "1") == grounding.GROUNDING_UNQUOTED


class TestVerify:
    def test_a_copied_quote_passes(self):
        assert grounding.verify("Turnover for the year was £3.2M", SOURCE) is True

    def test_reflowed_whitespace_still_passes(self):
        # Extraction collapses the double space and the line break; that is a
        # faithful transcription, not a different sentence.
        assert grounding.verify("£3.2M across three regions.", SOURCE) is True

    def test_recased_text_still_passes(self):
        assert grounding.verify("TURNOVER FOR THE YEAR", SOURCE) is True

    def test_a_paraphrase_fails(self):
        # The number is right and the sentence is not in the document. This is
        # the failure the whole module exists to catch.
        assert grounding.verify("Revenue was £3.2 million", SOURCE) is False

    def test_an_empty_quote_fails_rather_than_passing_vacuously(self):
        assert grounding.verify("", SOURCE) is False

    def test_no_source_is_unknown_not_false(self):
        # Distinct from a failed check: nothing was available to check against.
        assert grounding.verify("anything at all", None) is None


class TestSourceText:
    def test_text_documents_are_read_directly(self):
        assert grounding.source_text(doc(text_content=SOURCE)) == SOURCE

    def test_pdf_text_is_extracted(self):
        text = grounding.source_text(doc(pdf_data=pdf_bytes("Turnover £3.2M")))
        assert text is not None and "Turnover" in text

    def test_a_retry_carrying_only_a_file_id_has_no_source(self):
        # The bytes are still at OpenAI. Facts from this run stay unverified
        # rather than being marked wrong.
        assert grounding.source_text(doc(openai_file_id="file-abc")) is None

    def test_a_scan_with_no_text_layer_has_no_source(self):
        # An empty string here would mark every fact in the document as a failed
        # quote, which reads as fabrication rather than "this is a scan".
        with fitz.open() as out:
            out.new_page()
            empty = base64.b64encode(out.tobytes()).decode()
        assert grounding.source_text(doc(pdf_data=empty)) is None

    def test_unreadable_pdf_bytes_do_not_crash_the_run(self):
        assert grounding.source_text(doc(pdf_data=base64.b64encode(b"not a pdf").decode())) is None


class TestARealPdfIsNotTheOneWeGenerated:
    """The text layer and the rendered page are not the same string.

    A model quoting a PDF reads the page as drawn; pdf_text reads the layer
    underneath. Measured over 2,640 sentences from 22 SEC annual reports, they
    disagreed on 2.9% — 95% of it words broken across a line break, present in
    every one of the 22 documents. Before this, each of those was a real fact
    reported as an unverified quote, which reads as fabrication.

    The demo corpus could not have shown this: fixtures/dataroom is written by
    PyMuPDF and read back by PyMuPDF, so it agrees with itself by construction.
    """

    def test_a_word_broken_across_a_line_break_still_verifies(self):
        # What the layer holds after a justified line break, against what a
        # reader of the page writes down.
        assert grounding.verify(
            "our operations expanded", "our opera-\ntions expanded during"
        ) is True

    def test_a_ligature_in_the_layer_still_verifies(self):
        # One glyph, U+FB01, drawn as the two letters a reader transcribes.
        # casefold() already folds this one — pinned because the measurement
        # checked it rather than assuming, and the assumption was wrong.
        assert grounding.verify(
            "financial officer", "the ﬁnancial officer certified"
        ) is True

    def test_a_trademark_sign_verifies_however_the_reader_writes_it(self):
        # The layer holds "™"; a reader may copy the glyph or write TM. NFKC on
        # both sides means it does not matter which.
        assert grounding.verify(
            "Banno Digital Platform™", "our Banno Digital Platform™ and"
        ) is True
        assert grounding.verify(
            "Banno Digital PlatformTM", "our Banno Digital Platform™ and"
        ) is True

    def test_a_real_compound_matches_whether_or_not_it_broke(self):
        assert grounding.verify("well-known brand", "a well-\nknown brand") is True
        assert grounding.verify("well-known brand", "a well-known brand") is True

    def test_a_non_breaking_space_still_verifies(self):
        assert grounding.verify("£3.2M in 2024", "reported £3.2M in 2024") is True

    @pytest.mark.parametrize(
        "quote, text",
        [
            # The failure this exists to catch, at the edge the fix moved.
            ("Turnover £3.8M", "Turnover £3.2M for the year"),
            ("net loss of $3.4 million", "net loss of $3.1 million"),
            ("Revenue grew twelve percent", "Revenue increased 12% to $1.4 billion"),
        ],
    )
    def test_a_near_miss_is_still_not_a_quote(self, quote, text):
        assert grounding.verify(quote, text) is False

    def test_a_year_range_is_not_folded_into_one_number(self):
        # The hyphen rule is letters-only on purpose: financial documents are
        # full of ranges and negative figures.
        assert grounding.verify("2023-2024", "for 2023-2024 the figure") is True
        assert grounding.verify("20232024", "for 2023-2024 the figure") is False


def test_a_page_full_of_text_with_no_text_layer_is_unverifiable():
    """The safety-critical case, and the one the real-filing study never hit.

    All 22 SEC reports in evals/corpus carried a text layer, so nothing there
    exercised a scan. The existing blank-page test does not either: it proves
    an empty PDF has no text, not that a page *covered in words* can still have
    none to extract.

    This renders a real page to pixels and keeps only the image. A reader sees a
    full page; pdf_text sees nothing. Every fact from it must come back None —
    unverifiable — because False here would report a correctly quoted fact as
    fabricated, on the documents most likely to be scanned in the first place.
    """
    with fitz.open() as src:
        page = src.new_page()
        page.insert_text((72, 100), "Turnover for the year was £3.2M", fontsize=12)
        raster = fitz.open()
        out = raster.new_page(width=page.rect.width, height=page.rect.height)
        out.insert_image(out.rect, pixmap=page.get_pixmap(dpi=150))
        scanned = base64.b64encode(raster.tobytes()).decode()
        raster.close()

    assert grounding.source_text(doc(pdf_data=scanned)) is None
    # and therefore, at the point it matters:
    assert grounding.verify("Turnover for the year was £3.2M", None) is None


class TestWhatARealModelActuallyQuotes:
    """Measured against gpt-5-mini on four real SEC filings, not assumed.

    87 facts, 19 of which failed verification — and not one was a fabrication.
    The model elides, and it flattens typography on the way out. Every failure
    below was a true quote reported as unverified, which on an investment memo
    reads as "the model made this up".

    Fixing these took 78% to 94% on that same live output. The five that still
    fail are meant to: a dropped full stop, a table of dot leaders, a genuinely
    missing fragment, and a sentence whose words are all present in a different
    order.
    """

    SOURCE = ("Revenue rose to £3.2M in FY2024. Costs fell to £1.1M. "
              "The board approved a dividend.")

    def test_a_quote_that_elides_the_middle_is_still_a_quote(self):
        # 7 of the 19, the largest single cause.
        assert grounding.verify(
            "Revenue rose to £3.2M ... The board approved a dividend.", self.SOURCE
        ) is True

    def test_fragments_must_appear_in_the_order_given(self):
        # Order is the whole safeguard: without it, an ellipsis lets a claim be
        # assembled out of phrases collected from anywhere in the document.
        assert grounding.verify(
            "The board approved a dividend ... Revenue rose to £3.2M", self.SOURCE
        ) is False

    @pytest.mark.parametrize("quote", [
        "Revenue rose to £3.2M ... and the CEO resigned",   # invented fragment
        "Revenue rose to £3.8M ... dividend",               # wrong figure in a fragment
        "...",                                              # not a quote at all
        "Revenue rose .. dividend",                         # two dots is not an ellipsis
    ])
    def test_elision_is_not_a_loophole(self, quote):
        assert grounding.verify(quote, self.SOURCE) is False

    def test_a_model_writes_an_apostrophe_where_the_page_has_a_printers_quote(self):
        # The first study assumed models preserve smart quotes. They do not —
        # 2 of the 19 were exactly this.
        assert grounding.verify(
            'artificial intelligence ("AI") available',
            'making digital technology and artificial intelligence (“AI”) available broadly',
        ) is True

    def test_an_en_dash_and_a_hyphen_are_the_same_range(self):
        assert grounding.verify("2023-2024", "for 2023–2024 the figure") is True

    def test_a_noncharacter_inside_a_word_does_not_break_it(self):
        # U+FFFE turns up mid-word in filings where the PDF carries an optional
        # hyphen, and the model copies it through: "distribu￾tion".
        assert grounding.verify(
            "temperature-sensitive distribu￾tion", "time and temperature-sensitive distribution"
        ) is True
