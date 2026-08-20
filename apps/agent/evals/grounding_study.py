"""Does a quote check survive a PDF this pipeline did not write?

`fixtures/dataroom` cannot answer that. `scripts/make_demo_dataroom.py` writes
those PDFs with PyMuPDF and `grounding.pdf_text` reads them back with PyMuPDF,
so the writer and the reader are the same library and they agree by
construction — 35 of 35 quotes verify there, and would whatever the verifier
did.

So this measures against real filings instead: SEC annual reports (form ARS),
typeset by someone else, full of justified columns, tables and ligatures.

    python -m evals.grounding_study --fetch     # ~20 filings into evals/corpus/
    python -m evals.grounding_study             # measure what is there

The corpus is deliberately not committed. It is ~150 MB of third-party
documents, and the finding is the artefact worth keeping, not the PDFs.

WHAT IS AND IS NOT MEASURED

A model reads the rendered page; the verifier reads the text layer underneath.
Comparing them needs a model of what a page-reader writes down, and this uses a
mechanical one: a word split across a line break is one word, a soft hyphen is
not a character, and NFKC-equivalent glyphs are what they are drawn as. That
isolates the verifier, which is the open question. It is not a measurement of
how accurately any model reads a document — no model runs here.
"""

import argparse
import collections
import json
import os
import pathlib
import random
import re
import sys
import time
import unicodedata
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

# Settings validate on import and the study must not need real credentials.
os.environ.setdefault("LLM_DRIVER", "replay")
for k, v in {
    "AGENT_SECRET": "x" * 32, "WEBHOOK_SECRET": "y" * 32, "API_KEY": "z" * 32,
    "BACKEND_BASE_URL": "http://localhost:3001", "STORAGE_DRIVER": "local",
    "GOOGLE_CLOUD_BUCKET_NAME": "local-bucket",
}.items():
    os.environ.setdefault(k, v)

import fitz  # noqa: E402

from src.data.analyze import grounding as _gr  # noqa: E402
from src.data.analyze.grounding import pdf_text, verify  # noqa: E402

CORPUS = pathlib.Path(__file__).resolve().parent / "corpus"
UA = "Diligence Kit Grounding Study contact@diligence-kit.invalid"
SEED = 20260820
PER_DOC = 120

_SENTENCE = re.compile(r"(?<=[.!?])\s+")
_HYPHEN_BREAK = re.compile(r"([A-Za-z])-\n([a-z])")
_SOFT_HYPHEN = "­"


def transcribe(s: str) -> str:
    """What a reader of the rendered page writes down.

    Mechanical on purpose: a ligature glyph is drawn as the letters it stands
    for, and a word split across a line break is one word on the page. Smart
    quotes and dashes are left alone — they render as themselves, and a verbatim
    quote should keep them.
    """
    s = _HYPHEN_BREAK.sub(r"\1\2", s).replace(_SOFT_HYPHEN, "")
    return unicodedata.normalize("NFKC", s)


def _get(url, binary=False):
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept-Encoding": "identity"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read() if binary else json.loads(r.read())


def fetch(limit=22):
    """Annual reports filed as PDFs, straight from EDGAR full-text search."""
    CORPUS.mkdir(parents=True, exist_ok=True)
    seen, saved = set(), 0
    for q in ("%22revenue%22", "%22net+income%22", "%22total+assets%22"):
        hits = _get(f"https://efts.sec.gov/LATEST/search-index?q={q}&forms=ARS&hits=40")
        for h in hits.get("hits", {}).get("hits", []):
            ident = h["_id"]
            if ":" not in ident or not ident.lower().endswith(".pdf"):
                continue
            acc, fn = ident.split(":", 1)
            cik = int(h["_source"]["ciks"][0])
            if (cik, fn) in seen:
                continue
            seen.add((cik, fn))
            name = h["_source"]["display_names"][0].split("(")[0].strip()
            name = re.sub(r"[^A-Za-z0-9]+", "_", name)[:24]
            dest = CORPUS / f"{name}__{fn}"
            if not dest.exists():
                try:
                    data = _get(
                        f"https://www.sec.gov/Archives/edgar/data/{cik}/{acc.replace('-', '')}/{fn}",
                        binary=True,
                    )
                except Exception as e:
                    print(f"  skip {fn}: {e}")
                    continue
                if len(data) < 40_000:
                    continue
                dest.write_bytes(data)
                print(f"  {dest.name[:58]:58s} {len(data) // 1024:6d} KB")
                time.sleep(0.15)
            saved += 1
            if saved >= limit:
                return saved
    return saved


def measure():
    random.seed(SEED)
    docs, scans = {}, []
    for p in sorted(CORPUS.glob("*.pdf")):
        text = pdf_text(p.read_bytes(), p.name)
        (scans.append(p.name) if text is None else docs.setdefault(p.name, text))

    rows, totals = [], collections.Counter()
    for name, text in docs.items():
        candidates = [s for s in _SENTENCE.split(text) if 60 <= len(s) <= 300]
        if not candidates:
            continue
        sample = random.sample(candidates, min(PER_DOC, len(candidates)))
        ok = failed = 0
        why = collections.Counter()
        for raw in sample:
            if verify(transcribe(raw), text):
                ok += 1
            else:
                failed += 1
                why["hyphen_break" if _HYPHEN_BREAK.search(raw) else "other"] += 1
        rows.append((name, len(sample), ok, failed, why))
        totals["ok"] += ok
        totals["failed"] += failed
        totals.update(why)

    print(f"{'document':52s} {'n':>5s} {'verified':>9s} {'failed':>7s}  why")
    for name, n, ok, failed, why in rows:
        print(f"{name[:52]:52s} {n:5d} {ok:9d} {failed:7d}  {dict(why) or ''}")
    for name in scans:
        print(f"{name[:52]:52s} {'-':>5s} {'no text layer -> unverifiable':>40s}")

    n = totals["ok"] + totals["failed"]
    if not n:
        print("\nNo corpus. Run with --fetch first.")
        return 1
    print(f"\ndocuments {len(docs)} with a text layer, {len(scans)} scanned")
    print(f"sentences {n}")
    print(f"  verified {totals['ok']:5d}  ({totals['ok'] / n:.1%})")
    print(f"  failed   {totals['failed']:5d}  ({totals['failed'] / n:.1%})"
          f"   hyphen_break={totals['hyphen_break']} other={totals['other']}")
    return 0


def ocr_arm(per_doc_pages=3, docs=8):
    """The same question, with a real reader instead of a modelled one.

    `measure()` transcribes the page from the text layer, so its word order
    always matches the layer by construction. That flatters exact containment.
    Tesseract reads the rendered image and owes the layer nothing — including
    its reading order on a multi-column or tabular page.

    OCR is a pessimistic stand-in: it merges words ("ofthe") in ways a capable
    vision model does not, so treat this as a lower bound and read the fidelity
    bands, not the headline.
    """
    import difflib

    random.seed(SEED)
    bands, mangled, ordering = {}, 0, 0
    for path in sorted(CORPUS.glob("*.pdf"))[:docs]:
        with fitz.open(path) as doc:
            layer_all = "\n".join(pg.get_text() for pg in doc)
            layer_words = set(_gr._normalize(layer_all).split())
            prose = [i for i in range(len(doc)) if len(doc[i].get_text()) > 1500]
            for i in random.sample(prose, min(per_doc_pages, len(prose))) if prose else []:
                page = doc[i]
                layer = page.get_text()
                try:
                    read = page.get_text(textpage=page.get_textpage_ocr(flags=0, dpi=200, full=True))
                except Exception as e:
                    print(f"  OCR unavailable ({e}); install tesseract to run this arm")
                    return 1
                fidelity = difflib.SequenceMatcher(
                    None, " ".join(layer.split()), " ".join(read.split()), autojunk=False
                ).ratio()
                band = (">=0.97 faithful" if fidelity >= 0.97
                        else "0.85-0.97 lossy" if fidelity >= 0.85 else "<0.85 poor")
                tally = bands.setdefault(band, [0, 0])
                for sentence in [x for x in _SENTENCE.split(read) if 60 <= len(x) <= 240][:8]:
                    if verify(sentence, layer_all):
                        tally[0] += 1
                        continue
                    tally[1] += 1
                    words = [w for w in _gr._normalize(sentence).split() if len(w) > 2]
                    if all(w in layer_words for w in words):
                        ordering += 1      # every word is there; the sequence is not
                    else:
                        mangled += 1       # OCR produced a word the document does not contain

    print(f"{'OCR fidelity':20s} {'verified':>9s} {'failed':>7s} {'pass':>8s}")
    for band in (">=0.97 faithful", "0.85-0.97 lossy", "<0.85 poor"):
        if band in bands:
            ok, bad = bands[band]
            print(f"{band:20s} {ok:9d} {bad:7d} {ok / (ok + bad):7.1%}")
    ok = sum(v[0] for v in bands.values())
    bad = sum(v[1] for v in bands.values())
    if not ok + bad:
        print("No corpus. Run with --fetch first.")
        return 1
    print(f"\ntotal {ok + bad} sentences, {ok} verified ({ok / (ok + bad):.1%})")
    print(f"  OCR produced a word the document does not contain : {mangled}")
    print(f"  every word present, sequence differs (reading order): {ordering}")
    return 0


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--fetch", action="store_true", help="download the corpus from SEC EDGAR first")
    ap.add_argument("--ocr", action="store_true", help="read the pages with tesseract instead of modelling the reader")
    args = ap.parse_args()
    if args.fetch:
        print(f"fetching into {CORPUS} …")
        print(f"got {fetch()} filings\n")
    raise SystemExit(ocr_arm() if args.ocr else measure())
