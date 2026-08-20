# Does the quote check survive a PDF we did not write?

`verify()` asks whether a fact's quote occurs in the document it cites. Until
now the only evidence that it worked came from `fixtures/dataroom`, and that
corpus cannot supply any: `scripts/make_demo_dataroom.py` writes those PDFs with
PyMuPDF and `grounding.pdf_text` reads them back with PyMuPDF. The writer and
the reader are the same library, so they agree by construction. 35 of 35 quotes
verify there and would have whatever the verifier did.

The open question was what happens on a real document — the one thing a corpus
we generate can never answer, and the one
[OCR Hinders RAG](https://arxiv.org/abs/2412.02592) (ICCV 2025) says to expect
trouble on: every OCR/parse path it tested cost at least 14% F1 end to end.

## What was measured

22 annual reports filed with the SEC as PDFs (form ARS) — 2,140 pages, ~6.9M
characters, typeset by someone else, with justified columns, tables and
footnotes. From each, 120 sentences of quote-like length were sampled, and each
was put through `verify()` as a page-reader would have transcribed it.

That last step is the assumption in the method, so it is mechanical and stated:
a word split across a line break is one word on the page, a soft hyphen is not a
character, and NFKC-equivalent glyphs are what they are drawn as. Nothing else
is changed — smart quotes and dashes are left alone, because they render as
themselves and a verbatim quote should keep them.

**No model runs in this study.** It isolates the verifier, which was the open
question. It says nothing about how accurately a model reads a document.

## Result

| | sentences | verified | failed |
|---|---|---|---|
| before | 2,640 | 2,564 | **76 (2.9%)** |
| after | 2,640 | **2,640 (100%)** | 0 |

Exact containment survives real typeset PDFs. It did not collapse, and it did
not need fuzzy matching — the residual was two mechanical differences between a
rendered page and its text layer:

- **Words broken across a justified line break — 72 of the 76 failures, and
  present in all 22 documents.** The layer holds `opera-\ntions`; the page shows
  one word. One report (Golden Telecom, 2005) failed 27 of 120 sentences on this
  alone. Fixed by folding a hyphen between two letters on both sides, so a line
  break and a real compound (`well-known`) reduce to the same thing. Letters
  only — `2023-2024` and `-310000` are left intact, which matters more in a
  filing than in prose.
- **The trademark sign — the other 4.** The layer stores one `™` glyph; a reader
  may write `TM`. NFKC on both sides makes it not matter which.

**Ligatures were not a problem, though we assumed they would be.** `casefold()`
already turns `ﬁ` into `fi`. Three documents contain ligatures — one has 771 —
and none of them failed for that reason. The measurement is the only reason we
know; the original code comment named ligatures first among the things to fix.

Non-breaking spaces were likewise already handled: Python's `\s` matches
U+00A0 and U+202F, checked rather than assumed.

## The check still discriminates

A normalisation loose enough to fix a metric can also break it, so the same
corpus was run backwards: 1,320 quotes taken from a *different company's* report
and checked against each document.

Every one was rejected except six, and all six are auditor's-report boilerplate
that genuinely appears verbatim in both documents — *"We believe that our audit
provides a reasonable basis for our opinion"*, PCAOB standard language, the
10-K cover-page checkbox. Those are true matches, not false accepts.

Paraphrases are still rejected, and so is `£3.8M` against a document that says
`£3.2M`. That is the property worth protecting: at any fuzzy threshold loose
enough to accept a reformatted number, `£3.8M` also passes as evidence for
`£3.2M`, and the three-way revenue disagreement this product exists to surface
stops being visible. Hence exact containment, after normalising.

## What this does not cover

- **No scanned document appeared in the sample.** All 22 had text layers, so
  nothing here exercised the `unverifiable` path — `verify()` returning `None`
  rather than `False`, so a scan never reads as fabrication. That case is
  covered instead by a unit test that renders a page of figures to pixels and
  keeps only the image, which is the closest thing to a scan we can commit.
- **No model was involved**, so the reader model above stands in for one. It is
  conservative, but it is an assumption.
- **n = 2,640 sentences from 22 documents, all US annual reports.** Enough to
  find a defect present in every document; not enough to put a percentage on a
  dataroom of contracts, board minutes and spreadsheets.

## Reproducing

```bash
cd apps/agent
python -m evals.grounding_study --fetch   # ~22 filings, ~160 MB, into evals/corpus/
python -m evals.grounding_study
```

The corpus is not committed — it is third-party documents, and the finding is
the artefact worth keeping. `evals/corpus/` is gitignored.
