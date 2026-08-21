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

## A fourth arm: is the number right?

Everything above asks whether a quote is *real*. None of it asks whether the
value attached to it is *correct* — a model can quote an audited revenue line
perfectly and still file it under the wrong year.

Checking that needs ground truth, and labels we write ourselves are worth
little: the traps, the prompts and the answers would all come from the same
person. So the labels are the company's own XBRL submission to the SEC. Nobody
in this repo authored them.

Ten companies, one filing each, statement pages only (`--extract`). **57
headline figures.**

| | n |
|---|---|
| matches the filer's XBRL | **42** |
| pro forma — excluded, see below | 4 |
| pre-XBRL filer (2001–2003) | 6 |
| value carried no unit | 4 |
| period XBRL no longer retains | 1 |

**42 of 43 checkable, and the one exception is not an error.** Axcelis FY2022
net income is `183,079`, from the row `Net income $ 200,992 $ 246,263 $ 183,079`.
XBRL confirms 200,992 for 2024 and 246,263 for 2023, so the row maps
2024 | 2023 | 2022 and the third figure is consistent — XBRL simply no longer
carries that period. Zero incorrect figures.

### The pro forma four are the interesting ones

Microsoft's annual report states revenue twice: `245,122` on the income
statement and `247,442` on a later page headed *"supplemental consolidated
financial results … on an unaudited pro forma basis, as if the acquisition had
been"*. Both were extracted. The first is tagged `actual` and matches XBRL; the
second is tagged `pro_forma` and does not, because XBRL reports GAAP actuals.

That is the distinction the whole product is built on, and it held on a real
filing without being prompted for. Scoring pro forma figures against XBRL would
have counted that discipline as five errors — which is what the first version of
this harness did.

### The one real defect

eGain's statements put the unit in a column header, so four figures came back as
`$ 98,011` with no scale. `authority.parse_amount` reads that as ninety-eight
thousand dollars. A revenue stated "in thousands" by one document and "£98.0M"
by another would then look like a thousand-fold disagreement instead of
agreement — and the memo would print an ambiguous figure. Extraction now logs a
warning naming those facts. Not a refusal: 4 of 57 is too thin a base for one.

That warning earned its keep almost immediately — see the fifth arm, where the
same defect turned out to affect 35 figures once prior-period columns started
coming back, and where the prompt fix that followed took it to zero.

### The harness was wrong five times; the model was wrong none

Worth recording, because it is the whole lesson of this directory. Before the
numbers above settled, this harness reported mismatches caused by: double-scaling
a figure already scaled, stopping at the first XBRL concept that answered,
picking "thousand" out of a quote because it came first in a list rather than
nearest the number, keeping only the first filed value for a period when
restatements mean there are several, and — worst — fuzzy-matching company names,
which mapped Golden Telecom to Genesco and Redfin to Redwire. Every one would
have been published as "the model got it wrong".

## A fifth arm: what the model did NOT extract

Everything above scores figures the model returned. That is precision, and
precision alone is satisfied by a model that reports one correct figure and
stops — which is close to what was happening.

Recall needs an answer key, and one we write ourselves is worth little. This key
is built from two sources that owe us nothing, and a figure only enters it when
both agree: the filer's XBRL says this value is *<concept>* for *<period>*, and
that value, formatted as a page prints it, occurs in the text the model was
given. So every miss is a number printed on a page the model read, whose meaning
the filer certified, which the model did not return.

Three rules keep the key honest, each of them added after it produced a wrong
accusation:

- **Only renderings carrying a thousands separator.** "49" occurs on any page
  with a page number; "245,122" does not occur by accident.
- **Only a period the page itself names.** S&P Global's XBRL still retains a
  2013 revenue of 4,702, and the pre-tax income on its 2022 income statement is
  also 4,702. Without this rule the key demanded a figure that is not on the
  page under any reading.
- **One question per concept and period, not per filed value.** A statement
  prints both a consolidated and an attributable net income, and a restatement
  files the same period twice. Reporting either is reporting the figure;
  demanding both counted correct readings as misses.

### The result: 81%, and every miss the same shape

**47 of 58** figures extracted. All eleven misses were prior-period columns, and
none was a current period. CarGurus prints this:

```
Year Ended December 31,      2024       2023       2022
Total revenue             894,384    914,242  1,655,035
```

and the model returned **one** fact from it. Manhattan Associates' balance sheet
prints `Total assets  $ 673,353  $ 570,178`; only the first was extracted.
Redfin's year-over-year table prints FY2021 beside FY2020; only FY2021 came
back. Meanwhile five of the nine companies had every column extracted, so this
is not a model that cannot read a second column — it is one that often does not.

The prompt already asked for this, in a paragraph outside the numbered rules:
*"If comparative figures exist … extract EACH period as a separate fact."* It
now says so with the failing shape drawn out as a worked example.

**Re-measured on the same 58 figures: 58 of 58. Nothing regressed.**

### The side effect, and the second fix

Extracting prior-period columns made a known defect much worse. A statement
states its scale once, in a header — so the figures further from that header
came back bare: **35 financial facts with no unit**, against 4 before. The
warning shipped for eGain's `$ 98,011` was suddenly firing across a third of
the corpus, which is what a warning is for.

A second rule now tells the model to carry the table's scale into every figure
it takes from that table. **35 → 0.** And because a figure with no scale cannot
be scored at all, the accuracy arm's checkable base rose with it: 43 figures
before, **66 after — all 66 matching XBRL, none incorrect.**

### The harness was wrong three more times

Same lesson as the fourth arm, so it is worth keeping the tally honest. Before
these numbers settled, this harness reported as model errors: four eGain figures
it could not parse because they state no unit (all four had been extracted);
three figures whose concept is `ProfitLoss` rather than `NetIncomeLoss`, one of
which `NetIncomeLoss` does not retain at all; and three correct S&P Global
figures scored against a "nearest filed" value from 2007. **Across five arms the
count now stands at eight harness defects to zero model fabrications** — when a
measurement says the system under test is wrong, suspect the measurement first.
It is newer, less exercised, and nobody has ever run it.

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
- **Recall is measured only for three headline concepts.** The fifth arm asks
  whether revenue, net income and total assets were returned for every period
  the page prints. It says nothing about the other twenty information types —
  a customer count or a key person has no XBRL to check it against, and no
  cheap key exists for them.
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

python -m evals.accuracy_study --extract  # costs money: one model call per filing
python -m evals.accuracy_study            # score against the filers' XBRL
python -m evals.recall_study              # score what was NOT extracted
```

The corpus is not committed — it is third-party documents, and the finding is
the artefact worth keeping. `evals/corpus/` is gitignored.
