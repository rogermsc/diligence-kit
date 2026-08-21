import csv
import io
import os
from typing import List, Tuple

import pandas as pd

from src.core.logging import get_logger

logger = get_logger(__name__)

_MAX_EXCEL_BYTES = 50 * 1024 * 1024  # 50 MB


def _column_letters(count: int) -> List[str]:
    """A, B, ... Z, AA, AB, ... — spreadsheet column names."""
    letters = []
    for index in range(count):
        name = ""
        n = index
        while True:
            name = chr(ord("A") + n % 26) + name
            n = n // 26 - 1
            if n < 0:
                break
        letters.append(name)
    return letters


def _to_grid(df: pd.DataFrame, sheet_name: str) -> str:
    """Render a sheet with the coordinates a citation needs.

    The extraction prompt asks for "sheet name + row" and the schema asks for a
    cell reference, and neither was possible: `to_csv` emits values and nothing
    else, so every Excel fact came back citing a sheet and no position. An
    analyst could not check one.

    Two consequences of reading with `header=None`, both wanted. Pandas no
    longer promotes the first row to a header — on a real model that row is a
    title, and promoting it produced a header line of "Unnamed: 1, Unnamed: 2".
    And row numbers now match what the spreadsheet itself shows, so "Summary!B5"
    means the same thing here and in Excel.
    """
    letters = _column_letters(len(df.columns))
    buffer = io.StringIO()
    # Quoted, not joined. A cell may itself contain a comma — "Board: 2 founder,
    # 1 investor" is one cell, and the demo workbook has one — and joining on
    # commas turned it into three, moving every column after it one letter to
    # the left. Nothing downstream could catch that: the value is still
    # somewhere on the sheet, so the quote verifies, and the cell reference is
    # wrong in a way indistinguishable from a right one.
    writer = csv.writer(buffer, lineterminator="\n")

    buffer.write(f"[sheet: {sheet_name}] columns: {','.join(letters)}\n")

    for position, (_, row) in enumerate(df.iterrows(), start=1):
        cells = ["" if pd.isna(value) else str(value) for value in row]
        # Trailing empties carry no information and cost prompt budget on wide
        # sheets; the column letters above still say where the rest would be.
        while cells and cells[-1] == "":
            cells.pop()
        if not cells:
            continue
        writer.writerow([position, *cells])

    return buffer.getvalue().rstrip("\n")


def extract_sheets(file_path: str) -> List[Tuple[str, str]]:
    """Extract all sheets from an Excel file as (sheet_name, grid_text) pairs."""
    size = os.path.getsize(file_path)
    if size > _MAX_EXCEL_BYTES:
        raise ValueError(f"Excel file too large: {size} bytes (max {_MAX_EXCEL_BYTES})")

    sheets = pd.read_excel(file_path, sheet_name=None, dtype=str, header=None)

    results = []
    for sheet_name, df in sheets.items():
        if df.empty:
            # Worth a warning rather than an info line. `read_excel` returns
            # cached formula results, so a workbook saved without recalculating
            # reads as blank — and pandas trims it to a 0x0 frame, exactly like
            # a sheet that really is empty. The two are indistinguishable from
            # here, and one of them means a company's whole financial model was
            # dropped. Say which to check rather than logging "skipping".
            logger.warning(
                f"Sheet '{sheet_name}': no values. Either it is blank, or the "
                f"workbook was saved without recalculating its formulas."
            )
            continue

        results.append((sheet_name, _to_grid(df, sheet_name)))
        logger.info(f"Sheet '{sheet_name}': {len(df)} rows, {len(df.columns)} cols")

    logger.info(f"Excel extraction: {len(results)} sheets")
    return results
