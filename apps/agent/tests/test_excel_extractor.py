"""Excel facts have to cite a cell, not just a sheet.

The extraction prompt asks for "sheet name + row" and the schema asks for a
cell reference. `to_csv` emitted values and nothing else, so neither was
possible and every Excel fact came back citing a sheet — a citation an analyst
cannot check.
"""

import pandas as pd
import pytest

from src.data.analyze.extractors.excel_extractor import _column_letters, extract_sheets


@pytest.fixture
def book(tmp_path):
    def write(sheets: dict[str, list[list]]) -> str:
        path = tmp_path / "book.xlsx"
        with pd.ExcelWriter(path) as writer:
            for name, rows in sheets.items():
                pd.DataFrame(rows).to_excel(
                    writer, sheet_name=name, index=False, header=False
                )
        return str(path)

    return write


def test_column_letters_pass_z():
    letters = _column_letters(30)
    assert letters[:3] == ["A", "B", "C"]
    assert letters[25:28] == ["Z", "AA", "AB"]


def test_rows_are_numbered_as_the_spreadsheet_numbers_them(book):
    path = book({"Summary": [["Metric", "FY2024"], ["Revenue", 3800000]]})
    [(name, grid)] = extract_sheets(path)

    assert name == "Summary"
    assert "columns: A,B" in grid
    # Row 2 here is row 2 in Excel, so "Summary!B2" means the same thing in both.
    assert "2,Revenue,3800000" in grid


def test_a_title_row_is_not_promoted_to_a_header(book):
    # Pandas' default turns the first row into column names, which on a real
    # model is a title — and produced a header line of "Unnamed: 1, Unnamed: 2".
    path = book({"Summary": [["Northwind Operating Model"], ["Metric", "FY2024"]]})
    [(_, grid)] = extract_sheets(path)

    assert "Unnamed" not in grid
    assert "1,Northwind Operating Model" in grid


def test_blank_rows_keep_their_position(book):
    # Skipping them would shift every row number below, and a citation that is
    # off by one is worse than none.
    path = book({"S": [["top"], [None], ["bottom"]]})
    [(_, grid)] = extract_sheets(path)

    assert "1,top" in grid
    assert "3,bottom" in grid


def test_a_valueless_sheet_warns_and_says_what_to_check(book, caplog):
    # read_excel returns cached formula results, so a workbook saved without
    # recalculating reads as blank — and pandas trims it to a 0x0 frame, exactly
    # like a genuinely empty sheet. They cannot be told apart from here, and one
    # of them means a company's financial model was silently dropped, so the log
    # names both rather than saying "skipping".
    path = book({"Model": [[None, None], [None, None]]})

    with caplog.at_level("WARNING"):
        assert extract_sheets(path) == []

    assert "without recalculating" in caplog.text


def test_the_demo_workbook_still_renders_every_figure():
    [(_, summary), _] = extract_sheets("fixtures/dataroom/02_financial_model.xlsx")

    # The quotes the fixtures cite are substrings of the numbered rows, which is
    # what keeps grounding passing across this change.
    assert "Revenue (GBP),1950000" in summary
    assert "Headcount,31,52,78,104" in summary
    assert "[sheet: Summary] columns: A,B,C,D,E" in summary
