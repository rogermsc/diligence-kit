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

> That last clause was wrong, and the live arm below caught it. A real model
> writes `("AI")` where the page shows `(“AI”)`. The verifier now folds those;
> this arm still leaves them alone, which is why its number did not move.

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

## A second arm: a real reader, not a modelled one

The result above has a flaw worth naming. `transcribe()` derives its text *from*
the text layer, so its word order always matches the layer by construction. That
flatters exact containment, because the one thing it can never disagree about is
the sequence.

So the same question was put to a reader that owes the layer nothing: render the
page to an image and OCR it with tesseract (`--ocr`). 161 sentences over 24 pages
of 8 filings.

| OCR fidelity to the layer | verified | failed | pass |
|---|---|---|---|
| ≥ 0.97 (faithful) | 92 | 10 | **90.2%** |
| 0.85–0.97 (lossy) | 13 | 18 | 41.9% |
| < 0.85 (poor) | 2 | 26 | 7.1% |

Pass rate tracks the **reader's** fidelity, not the verifier — which is
OHR-Bench's finding restated on this pipeline. Of the 54 failures:

- **39 contained a word that appears nowhere in the document** — `ofthe`,
  `eachofthe`, `2020.~`. Tesseract merged or invented them. Rejecting those is
  correct; they are not verbatim quotes.
- **15 had every word present but in a different sequence.** OCR read a
  multi-column or tabular page in a different order than the text layer stores
  it. This is the real limit of exact containment, and it is not fixable by
  normalising: matching a reordered sentence means bag-of-words, which would
  also accept a reordered *invention*.

Tesseract is a pessimistic stand-in — a capable vision model transcribes far
better and would not produce `ofthe` — so read this as a lower bound and read
the bands rather than the 66.5% headline.

## A third arm: the model itself

Both arms above measure whether the verifier accepts a *faithful* transcription.
Neither says what a real model actually sends. This one does: the production
extraction prompt, `gpt-5-mini`, and six-page excerpts of four filings — real
pages copied rather than re-rendered, so the typography is the filing's own.

**87 facts. 68 verified — 78%.** Nineteen quotes failed, and not one was a
fabrication. Every one was a true quote the verifier called unverified, which on
an investment memo reads as "the model made this up".

| why the quote failed | n |
|---|---|
| elided with `...`, every fragment present **in order** | 7 |
| elided, a fragment genuinely missing | 3 |
| dot-leader table read in a different sequence | 2 |
| smart quotes flattened — `(“AI”)` quoted as `("AI")` | 2 |
| U+FFFE noncharacter mid-word — `distribu￾tion` | 2 |
| em-dash spacing, dropped full stop | 2 |
| paraphrase around a real figure | 1 |

The first is the big one and the most interesting: asked for a verbatim quote, a
model elides the boring middle of a long sentence and considers that verbatim.
So `verify()` now accepts an elided quote **provided every fragment appears and
each one after the one before it**. Order is the entire safeguard — it permits
the convention without permitting a claim assembled from phrases collected on
three different pages. Typographic quotes and dashes are folded, and Unicode
noncharacters stripped.

**Re-run against the same saved model output: 82 of 87, 94%.** The five that
still fail are meant to — a dropped full stop, a table of dot leaders, a
genuinely missing fragment, and a sentence whose words are all present in a
different order.

Cost of the whole arm: about 60k tokens on `gpt-5-mini`.

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

- **No scanned document appeared — in 41 filings, not just the 22.** A further
  19 PDFs were fetched from EDGAR specifically looking for scans, biased towards
  2001–2008, and every one carried a text layer. Filed annual reports are
  born-digital; a private dataroom, full of photographed board minutes and
  signed contracts, is where scans actually live. So nothing here exercised the
  `unverifiable` path — `verify()` returning `None`
  rather than `False`, so a scan never reads as fabrication. That case is
  covered instead by a unit test that renders a page of figures to pixels and
  keeps only the image, which is the closest thing to a scan we can commit.
- **Nothing here measures whether the model read the document *correctly*.**
  The third arm measures whether its quotes are real, not whether the values it
  attached to them are right. A model can quote an audited revenue line
  perfectly and still file it under the wrong field, or miss it entirely. That
  needs a labelled corpus, which is a different exercise and deliberately not
  this one.
- **The live arm is one model, one prompt, four documents, one run.** 87 facts
  is enough to find a failure mode present in every document; it is not a
  precision figure, and no percentage from it belongs in the README.
- **n = 2,640 sentences from 22 documents, all US annual reports.** Enough to
  find a defect present in every document; not enough to put a percentage on a
  dataroom of contracts, board minutes and spreadsheets.

## Reproducing

```bash
cd apps/agent
python -m evals.grounding_study --fetch   # ~22 filings, ~160 MB, into evals/corpus/
python -m evals.grounding_study           # modelled reader
python -m evals.grounding_study --ocr     # real reader; needs tesseract
```

The corpus is not committed — it is third-party documents, and the finding is
the artefact worth keeping. `evals/corpus/` is gitignored.
