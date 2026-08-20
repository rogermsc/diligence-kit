"""Did the model read the RIGHT number? Labels come from the filer, not from us.

Every other measurement in evals/ asks whether a quote is real. None asks whether
the value attached to it is correct — a model can quote an audited revenue line
perfectly and still file it under the wrong year.

Checking that needs ground truth, and a corpus we label ourselves is worth very
little: the traps, the prompts and the answers would all come from the same
person. So the labels here are the company's own XBRL submission to the SEC —
the numbers the filer swore to, which nobody in this repo authored.

    python -m evals.accuracy_study --extract   # costs money: one call per filing
    python -m evals.accuracy_study             # score what was extracted

WHAT COUNTS AS A MISMATCH

Only figures the model tagged `actual`. XBRL reports GAAP actuals; a pro forma
or projected figure is *supposed* to disagree with it, and scoring those would
count the pipeline's own actual-vs-pro-forma discipline as an error. Microsoft's
annual report states both, and the run below is a fair test of exactly that.

Three ways a figure is unscorable rather than wrong, each reported separately:
a pre-XBRL filer, a period XBRL no longer retains, and a value the model
returned without its unit.
"""

import argparse
import asyncio
import base64
import collections
import json
import logging
import os
import pathlib
import re
import sys
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

# Scoring needs no model. Only --extract does, and it needs a real key.
os.environ.setdefault("LLM_DRIVER", "openai" if os.environ.get("OPENAI_API_KEY") else "replay")
for _k, _v in {
    "AGENT_SECRET": "x" * 32, "WEBHOOK_SECRET": "y" * 32, "API_KEY": "z" * 32,
    "BACKEND_BASE_URL": "http://localhost:3001", "STORAGE_DRIVER": "local",
    "GOOGLE_CLOUD_BUCKET_NAME": "local-bucket",
}.items():
    os.environ.setdefault(_k, _v)

import fitz  # noqa: E402

from src.data.analyze.fact_extraction_service import FactExtractionService  # noqa: E402
from src.domain.analyze.entities import PreparedDocument  # noqa: E402

HERE = pathlib.Path(__file__).resolve().parent
CORPUS = HERE / "corpus"
FACTS = HERE / "extracted"
CIKS = HERE / "ciks.json"
UA = "Diligence Kit Grounding Study contact@diligence-kit.invalid"

# Pages carrying a primary statement. A six-page excerpt of the right pages
# costs a fraction of a 100-page report and contains all the headline figures.
STATEMENT = re.compile(
    r"total assets|net income|total revenue|consolidated balance sheet"
    r"|consolidated statements? of operations|total operating revenue", re.I)

CONCEPTS = {
    "annual_revenue": ["RevenueFromContractWithCustomerExcludingAssessedTax", "Revenues",
                       "RevenueFromContractWithCustomerIncludingAssessedTax",
                       "RevenuesNetOfInterestExpense"],
    "net_income": ["NetIncomeLoss"],
    "total_assets": ["Assets"],
}

_NUMBER = re.compile(r"(?P<neg>\()?\s*[£$€]?\s*(?P<num>-?[\d,]+(?:\.\d+)?)")
_SCALE = {"thousand": 1e3, "million": 1e6, "billion": 1e9}


def _get(url):
    request = urllib.request.Request(
        url, headers={"User-Agent": UA, "Accept-Encoding": "identity"})
    with urllib.request.urlopen(request, timeout=45) as response:
        return json.loads(response.read())


def amount(value: str, quote: str = ""):
    """The figure, scaled exactly once by whichever unit sits nearest it.

    Scanning a fixed word order instead picks up "thousands" from elsewhere in
    the quote and under-scales a figure stated in millions by three orders of
    magnitude — which this harness did, and reported as a model error.
    """
    match = _NUMBER.search(value or "")
    if not match:
        return None
    number = float(match.group("num").replace(",", ""))
    if match.group("neg"):
        number = -number
    for text in (value[match.end():], quote):
        found = [((text or "").lower().find(w), w) for w in _SCALE if w in (text or "").lower()]
        if found:
            return number * _SCALE[min(found)[1]]
    return None      # no unit stated: ambiguous, not wrong


def filed(cik: int, concepts) -> dict:
    """Every annual figure the company filed, keyed by period end.

    A set per period, not one value: companies restate, so the same period is
    filed more than once and picking the first is arbitrary. Taking one turned
    two correct extractions into "NO MATCH".
    """
    out = {}
    for concept in concepts:
        try:
            data = _get(f"https://data.sec.gov/api/xbrl/companyconcept/"
                        f"CIK{cik:010d}/us-gaap/{concept}.json")
        except Exception:
            continue
        for unit in data.get("units", {}).get("USD", []):
            if unit.get("form") != "10-K" or unit.get("fp") != "FY":
                continue
            if unit.get("start"):
                months = ((int(unit["end"][:4]) - int(unit["start"][:4])) * 12
                          + int(unit["end"][5:7]) - int(unit["start"][5:7]))
                if not 11 <= months <= 13:
                    continue
            out.setdefault(unit["end"], set()).add(unit["val"])
    return out


def statement_pages(path, cap=7):
    """Real pages, copied not re-rendered, so the typography is the filing's own."""
    source = fitz.open(path)
    ranked = sorted(((len(STATEMENT.findall(source[i].get_text())), i)
                     for i in range(len(source))
                     if STATEMENT.search(source[i].get_text())
                     and len(source[i].get_text()) > 800), reverse=True)
    keep = sorted(i for _, i in ranked[:cap])
    out = fitz.open()
    for i in keep:
        out.insert_pdf(source, from_page=i, to_page=i)
    data, text = out.tobytes(), "\n".join(p.get_text() for p in out)
    source.close()
    out.close()
    return data, text, len(keep)


async def extract():
    if not CIKS.is_file():
        print(f"Need {CIKS} — filename to CIK, from the EDGAR search that fetched the corpus.")
        return 1
    ciks = json.loads(CIKS.read_text())
    FACTS.mkdir(exist_ok=True)
    service = FactExtractionService()
    seen = set()
    for name in sorted(ciks):
        cik = ciks[name][0]
        if cik in seen:          # one filing per company keeps the evidence independent
            continue
        seen.add(cik)
        data, text, pages = statement_pages(CORPUS / name)
        if pages < 2:
            print(f"skip {name[:44]} (no statement pages)")
            continue
        doc = PreparedDocument(document_id=name, file_name=name,
                               pdf_data=base64.b64encode(data).decode(), source_text=text)
        results = await service.extract_facts_all([doc], ciks[name][1].split("(")[0].strip())
        facts = [f.model_dump() for r in results for f in r.facts]
        (FACTS / f"{name}.json").write_text(json.dumps(
            {"cik": cik, "company": ciks[name][1].split("(")[0].strip(),
             "source_text": text, "facts": facts}, ensure_ascii=False))
        print(f"{name[:44]:44s} {pages}p  {len(facts)} facts")
    return 0


def score():
    if not FACTS.is_dir() or not any(FACTS.glob("*.json")):
        print("Nothing extracted. Run with --extract first (this one costs money).")
        return 1
    truth_cache, rows = {}, []
    for path in sorted(FACTS.glob("*.json")):
        doc = json.loads(path.read_text())
        for fact in doc["facts"]:
            base = next((k for k in CONCEPTS if fact["field"].startswith(k)), None)
            if not base:
                continue
            kind = (fact.get("source_type") or "").lower()
            if kind and kind != "actual":
                rows.append((doc["company"], fact["field"], fact["value"], f"excluded ({kind})"))
                continue
            value = amount(fact["value"], fact.get("quote", ""))
            if value is None:
                rows.append((doc["company"], fact["field"], fact["value"], "unit not stated"))
                continue
            key = (doc["cik"], base)
            if key not in truth_cache:
                truth_cache[key] = filed(doc["cik"], CONCEPTS[base])
            reported = truth_cache[key]
            if not reported:
                rows.append((doc["company"], fact["field"], fact["value"], "no XBRL for concept"))
                continue
            hits = [end for end, vals in reported.items()
                    for v in vals if v and abs(value - v) <= abs(v) * 0.005]
            if hits:
                year = re.search(r"fy(\d{4})", fact["field"])
                right_year = not year or any(e[:4] == year.group(1) for e in hits)
                rows.append((doc["company"], fact["field"], fact["value"],
                             "MATCH" if right_year else f"wrong year (filed {hits[0][:4]})"))
            else:
                flat = [(e, v) for e, vals in reported.items() for v in vals if v]
                near = min(flat, key=lambda kv: abs(value - kv[1])) if flat else ("?", 0)
                rows.append((doc["company"], fact["field"], fact["value"],
                             f"NO MATCH (nearest filed {near[0][:4]} {near[1]:,.0f})"))

    print(f"{'company':26s} {'field':22s} {'extracted':32s} verdict")
    for company, field, value, verdict in rows:
        print(f"{company[:26]:26s} {field[:22]:22s} {value[:32]:32s} {verdict}")
    tally = collections.Counter(r[3].split(" (")[0] for r in rows)
    print(f"\n{len(rows)} headline figures from {len({r[0] for r in rows})} companies")
    for verdict, n in tally.most_common():
        print(f"   {n:3d}  {verdict}")
    checkable = tally["MATCH"] + tally["NO MATCH"] + tally["wrong year"]
    if checkable:
        print(f"\ncheckable against XBRL: {checkable}   matching: {tally['MATCH']} "
              f"({tally['MATCH'] / checkable:.0%})")
    return 0


if __name__ == "__main__":
    logging.basicConfig(level=logging.WARNING, format="%(message)s", stream=sys.stdout)
    ap = argparse.ArgumentParser()
    ap.add_argument("--extract", action="store_true",
                    help="run the model over the corpus (needs OPENAI_API_KEY; costs money)")
    args = ap.parse_args()
    raise SystemExit(asyncio.run(extract()) if args.extract else score())
