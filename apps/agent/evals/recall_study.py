"""What the model did NOT extract. The one thing every other arm here misses.

The accuracy arm scores the figures that came back and finds them right. That
is precision, and precision alone is satisfied by a model that returns one
correct figure and stops. A memorandum built from a third of the income
statement is wrong in a way no quote check and no XBRL comparison can see.

Recall needs an answer key, and a key we write ourselves is worth little. This
one is built from two sources that owe us nothing, and a figure only enters it
when BOTH agree:

  1. the filer's XBRL submission says this value is <concept> for <period>, and
  2. that value, formatted as a page prints it, occurs in the text the model
     was actually given.

So every miss reported here is a number printed on a page the model read,
whose meaning the filer certified, which the model did not return — and the
extraction prompt asks for exactly these: "If comparative figures exist (e.g.
current year vs prior year), extract EACH period as a separate fact."

    python -m evals.recall_study          # scores evals/extracted/; no model calls

A figure is EXCLUDED, not counted as missed, when it cannot be rendered with a
thousands separator at any plausible scale — a two- or three-digit string
matches page furniture, and a key that cannot be trusted is worse than a
smaller one.
"""

import argparse
import collections
import json
import logging
import pathlib
import sys

HERE = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))

from evals.accuracy_study import CONCEPTS, amount, filed  # noqa: E402

FACTS = HERE / "extracted"

# How a statement prints a figure: the filer's full-precision value divided by
# the scale the page states in its header, with thousands separators.
_SCALES = (1, 1_000, 1_000_000, 1_000_000_000)

_LABEL = {
    "annual_revenue": "revenue",
    "net_income": "net income",
    "total_assets": "total assets",
}


def renderings(value: float) -> list[str]:
    """Every way a page might print this figure, at every plausible scale.

    Only renderings carrying a thousands separator. "49" occurs on any page
    that has a page number; "245,122" does not occur by accident, and the
    difference between those two is the difference between a key and a rumour.
    """
    out = []
    for scale in _SCALES:
        scaled = abs(value) / scale
        if scaled < 1000:
            continue
        out.append(f"{scaled:,.0f}")
        if scaled < 100_000:            # pages print one decimal at small scales
            out.append(f"{scaled:,.1f}")
    return out


def visible(value: float, text: str) -> str:
    """The rendering that occurs in the text, or "" if none does.

    Negatives are checked as printed — statements set them in parentheses, and
    the minus sign is not on the page.
    """
    for rendering in renderings(value):
        if rendering in text:
            return rendering
    return ""


def was_extracted(value: float, facts) -> bool:
    """Did any returned fact carry this figure?

    Two ways, because either alone under-counts and a recall harness that
    under-counts publishes the model's competence as a defect:

    - the digits as the page prints them, matched against the fact's value.
      This is the only way to see a figure the model returned WITHOUT a unit
      ("$ 98,011", where the page states the scale in a column header) — those
      parse to nothing, and scoring them as missing marked four of eGain's four
      figures unextracted when every one of them had been returned.
    - the parsed amount, for a fact that abbreviates ("$245.1 billion") and so
      shares no digit string with the page at all.
    """
    printed = set(renderings(value))
    for fact in facts:
        text = fact.get("value", "")
        if any(rendering in text for rendering in printed):
            return True
        parsed = amount(text, fact.get("quote", ""))
        if parsed is not None and abs(abs(parsed) - abs(value)) <= abs(value) * 0.005:
            return True
    return False


def score():
    if not FACTS.is_dir() or not any(FACTS.glob("*.json")):
        print("Nothing extracted. Run `python -m evals.accuracy_study --extract` first.")
        return 1

    truth_cache = {}
    rows = []

    for path in sorted(FACTS.glob("*.json")):
        doc = json.loads(path.read_text())
        text = doc["source_text"]
        facts = doc["facts"]

        for base, concepts in CONCEPTS.items():
            key = (doc["cik"], base)
            if key not in truth_cache:
                truth_cache[key] = filed(doc["cik"], concepts)

            for period, values in sorted(truth_cache[key].items()):
                # Only a period the page itself names. A stale concept can
                # retain a decade-old figure that collides with an unrelated
                # number on the page — S&P Global's 2013 revenue is 4,702, and
                # so is the pre-tax income on its 2022 income statement.
                if period[:4] not in text:
                    continue

                # One question per concept and period: did the model report
                # this company's <concept> for <period>? A restatement, and a
                # statement that prints both the consolidated and the
                # attributable line, put several filed values against one
                # period; reporting any of them is reporting the figure, and
                # demanding all of them counts a correct reading as a miss.
                candidates = [float(v) for v in values if v and visible(float(v), text)]
                if not candidates:
                    continue

                rows.append({
                    "company": doc["company"],
                    "concept": _LABEL.get(base, base),
                    "period": period,
                    "printed": visible(candidates[0], text),
                    "found": any(was_extracted(v, facts) for v in candidates),
                })

    if not rows:
        print("No figure in the key was visible on any page. Nothing to score.")
        return 1

    # A period can appear under two concepts, or twice after a restatement;
    # count each printed figure once per company.
    seen, unique = set(), []
    for row in rows:
        marker = (row["company"], row["concept"], row["period"], row["printed"])
        if marker in seen:
            continue
        seen.add(marker)
        unique.append(row)

    print(f"{'company':26s} {'figure':14s} {'period':12s} {'printed':>14s}  verdict")
    for row in sorted(unique, key=lambda r: (r["company"], r["concept"], r["period"])):
        print(f"{row['company'][:26]:26s} {row['concept'][:14]:14s} {row['period']:12s} "
              f"{row['printed']:>14s}  {'found' if row['found'] else 'MISSED'}")

    found = sum(1 for r in unique if r["found"])
    print(f"\n{len(unique)} figures printed on the pages the model read, each one a "
          f"value the filer's XBRL identifies")
    print(f"   {found:3d}  extracted")
    print(f"   {len(unique) - found:3d}  missed")
    print(f"\nrecall: {found / len(unique):.0%}")

    by_company = collections.Counter(
        r["company"] for r in unique if not r["found"])
    if by_company:
        print("\nmisses by company:")
        for company, n in by_company.most_common():
            total = sum(1 for r in unique if r["company"] == company)
            print(f"   {n:3d} of {total:3d}  {company}")
    return 0


if __name__ == "__main__":
    logging.basicConfig(level=logging.WARNING, format="%(message)s", stream=sys.stdout)
    argparse.ArgumentParser().parse_args()
    raise SystemExit(score())
