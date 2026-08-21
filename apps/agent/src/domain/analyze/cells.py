"""Does the cited row actually hold the fact?

A spreadsheet fact carries a reference like `Summary!C7`, and until now nothing
checked it. Quote verification cannot: a sheet is rendered as one text blob, so
a quote taken from row 5 verifies perfectly against a fact that cites row 12.
The value is on the sheet either way, and a wrong reference looks exactly like a
right one — the same shape as the bug that had spreadsheet facts citing the
wrong sheet entirely, which reached `main` and was caught by a test rather than
by anything in the pipeline.

The check is possible at all because the rendering is deterministic: the grid is
a real CSV whose first field is the row number as the spreadsheet numbers it. So
a reference can be read back.

**The row is the unit, and the column is deliberately not checked.** Citing the
label cell of a row rather than the cell holding the figure — `A5` for the
revenue on row 5 — is a reasonable thing to do and lands an analyst in the right
place; flagging it would bury the failure that matters in noise. A wrong *row*
is provenance pointing somewhere the figure is not.

Advisory. Nothing is dropped on this signal: a fact that turns out to be real
with an imprecise citation is worth more than no fact.
"""

import csv
import io
import re
from typing import Optional

from src.domain.analyze.authority import parse_amount

_REFERENCE = re.compile(r"^\s*(?:(?P<sheet>.+)!)?[A-Za-z]{1,3}(?P<row>\d+)\s*$")


def cited_row(grid: str, reference: str) -> Optional[list]:
    """The cells of the row a reference points at, or None if it points nowhere.

    None, not an empty list, for every reason the question cannot be answered —
    the reference is not a cell reference at all (a PDF's page "4"), or names a
    row the sheet does not have. Only a row that exists returns cells, so an
    absent answer never reads as an empty row.
    """
    match = _REFERENCE.match(reference or "")
    if not match or not grid:
        return None

    row = match.group("row")
    for parsed in csv.reader(io.StringIO(grid)):
        if parsed and parsed[0] == row:
            return [cell.strip() for cell in parsed[1:]]
    return None


def cites_its_own_row(value: str, quote: str, page: str, grid: str) -> Optional[bool]:
    """Is the fact's value on the row it cites? None when unanswerable.

    Matched two ways, because a cell holds what the spreadsheet stores and a
    fact carries what a reader would write:

    - the text of some cell appears in the value or the quote, or contains it —
      "Seed Preferred" cited for "Seed Preferred equity";
    - some cell is the same amount — a row holding `-310000` cited for
      "(£0.31M) FY2024" is one figure written two ways, and `parse_amount`
      already knows how to read both.
    """
    cells = cited_row(grid, page)
    if cells is None:
        return None

    written = [text.strip() for text in (value or "", quote or "") if text.strip()]
    if not written:
        return False

    for cell in cells:
        if not cell:
            continue
        for other in written:
            if cell.casefold() in other.casefold() or other.casefold() in cell.casefold():
                return True
            here, there = parse_amount(cell), parse_amount(other)
            if here is not None and there is not None and abs(here) == abs(there):
                return True

    return False
