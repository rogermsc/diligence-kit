"""Which document wins when two of them state the same thing differently.

This is the part of the product worth arguing with, so it is written down
rather than asked of a model. The previous design put the question to the LLM
— "prefer the most recent version" — which produced an answer with no stated
reason, no confidence, and no way for a reader to disagree with the rule
instead of the output.

The order below is the ordinary hierarchy of evidence in diligence: a number
someone signed for beats a number someone prepared, which beats a number
someone is selling you.
"""

import re
from decimal import Decimal, InvalidOperation
from typing import Optional, Tuple

# actual > pro_forma > projection. This is the primary key, not a tiebreak: an
# audited actual beats a forecast from a newer document, because recency is not
# the same virtue as being what happened.
SOURCE_TYPE_RANK = {"actual": 3, "pro_forma": 2, "projection": 1, "": 0}

# Matched against the file name, most authoritative first. Substrings rather
# than exact names because dataroom filenames are whatever the seller called
# them; anything unrecognised falls to UNKNOWN and is decided on other grounds.
DOCUMENT_AUTHORITY: list[tuple[tuple[str, ...], int, str]] = [
    (("audited", "statutory account", "annual report", "financial statement"), 6, "audited accounts"),
    (("management account", "trial balance", "ledger"), 5, "management accounts"),
    (("filing", "companies house", "10-k", "10k", "annual return"), 4, "statutory filing"),
    (("model", "forecast", "budget", "projection", "plan"), 3, "financial model"),
    (("cap_table", "cap table", "shareholder", "articles", "term sheet", "subscription"), 2, "cap table or legal instrument"),
    (("deck", "pitch", "teaser", "presentation", "memorandum", "overview"), 1, "pitch deck"),
]

UNKNOWN_AUTHORITY = (0, "unclassified document")


def authority_of(source: str) -> Tuple[int, str]:
    """Rank and human label for a document, from its file name."""
    name = source.lower()
    for needles, rank, label in DOCUMENT_AUTHORITY:
        if any(needle in name for needle in needles):
            return rank, label
    return UNKNOWN_AUTHORITY


def source_type_rank(source_type: str) -> int:
    return SOURCE_TYPE_RANK.get((source_type or "").strip().lower(), 0)


# --- magnitude -------------------------------------------------------------

_MONEY = re.compile(
    r"(?P<neg>\()?\s*[£$€]?\s*(?P<num>-?[\d,]+(?:\.\d+)?)\s*(?P<suffix>[kmbKMB])?",
)
_SCALE = {"k": Decimal(1_000), "m": Decimal(1_000_000), "b": Decimal(1_000_000_000)}


def parse_amount(value: str) -> Optional[Decimal]:
    """The first number in a string, scaled by any K/M/B suffix.

    Deliberately small. It exists to say how far apart two figures are, not to
    be a currency library — if it cannot read something, the caller drops the
    magnitude line rather than guessing.
    """
    match = _MONEY.search(value or "")
    if not match:
        return None
    try:
        amount = Decimal(match.group("num").replace(",", ""))
    except InvalidOperation:
        return None
    suffix = (match.group("suffix") or "").lower()
    if suffix:
        amount *= _SCALE[suffix]
    # Accountants' parentheses: (£0.31M) is negative.
    if match.group("neg"):
        amount = -amount
    return amount


_SYMBOL = re.compile(r"[£$€]")


def magnitude_of(values: list[str]) -> str:
    """How far apart the extremes are, as a sentence, or "" if unreadable.

    "Three documents disagree" is the claim. "…by 28%" is what makes it a
    finding someone has to act on.
    """
    amounts = [a for a in (parse_amount(v) for v in values) if a is not None]
    if len(amounts) < 2:
        return ""

    low, high = min(amounts), max(amounts)
    if low == high:
        return ""

    # Carry the currency through. "28% spread, 3.2M to 4.1M" reads like a count
    # of something; the reader needs to see money.
    symbols = {m.group() for v in values if (m := _SYMBOL.search(v or ""))}
    symbol = symbols.pop() if len(symbols) == 1 else ""
    # Against the smaller absolute figure, so the number reads as "the high one
    # is N% above the low one" rather than being damped by its own size.
    base = min(abs(low), abs(high))
    if base == 0:
        return f"{_fmt(low, symbol)} to {_fmt(high, symbol)}"
    spread = (abs(high - low) / base) * 100
    return f"{spread:.0f}% spread, {_fmt(low, symbol)} to {_fmt(high, symbol)}"


def _fmt(amount: Decimal, symbol: str = "") -> str:
    sign = "-" if amount < 0 else ""
    magnitude = abs(amount)
    for scale, suffix in ((Decimal(1_000_000_000), "B"), (Decimal(1_000_000), "M"), (Decimal(1_000), "K")):
        if magnitude >= scale:
            body = f"{magnitude / scale:.2f}".rstrip("0").rstrip(".") + suffix
            return f"{sign}{symbol}{body}"
    body = f"{magnitude:.2f}".rstrip("0").rstrip(".")
    return f"{sign}{symbol}{body}"
