"""Generates the synthetic dataroom used by `make demo`.

The company is fictional. The point of the fixture is not that it looks real but
that it contains the thing the pipeline exists to handle: the pitch deck, the
financial model and the audited accounts state three different FY2024 revenue
figures, and only the accounts are an actual. A demo where every document agrees
would show none of the product.

    python scripts/make_demo_dataroom.py

Outputs land in fixtures/dataroom/ and are committed, so a demo needs no Python.
"""

import pathlib

import fitz  # PyMuPDF
from openpyxl import Workbook

OUT = pathlib.Path(__file__).resolve().parents[1] / "fixtures" / "dataroom"

# The disagreement the demo is built around. Same period, three sources, three
# numbers, decreasing order of reliability.
REVENUE_DECK = "£4.1M"          # pitch deck, unlabelled — actually pro-forma
REVENUE_MODEL = "£3.8M"         # financial model, run-rate
REVENUE_ACCOUNTS = "£3.2M"      # audited accounts, the actual


def pdf(name: str, title: str, blocks: list[tuple[str, str]]) -> None:
    doc = fitz.open()
    page = doc.new_page()
    y = 72

    page.insert_text((72, y), title, fontname="hebo", fontsize=18)
    y += 36

    for heading, body in blocks:
        if y > 720:
            page = doc.new_page()
            y = 72
        page.insert_text((72, y), heading, fontname="hebo", fontsize=12)
        y += 18
        for line in body.strip().split("\n"):
            if y > 760:
                page = doc.new_page()
                y = 72
            page.insert_text((72, y), line.strip(), fontname="helv", fontsize=10)
            y += 14
        y += 12

    path = OUT / name
    doc.save(path)
    doc.close()
    print(f"  {path.name}")


def xlsx(name: str, sheets: dict[str, list[list]]) -> None:
    wb = Workbook()
    wb.remove(wb.active)
    for sheet_name, rows in sheets.items():
        ws = wb.create_sheet(sheet_name)
        for row in rows:
            ws.append(row)
    path = OUT / name
    wb.save(path)
    print(f"  {path.name}")


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    print(f"Writing demo dataroom to {OUT}")

    pdf(
        "01_pitch_deck.pdf",
        "Northwind Robotics — Series A",
        [
            ("Company", """
                Northwind Robotics Ltd
                Warehouse automation for mid-market third-party logistics
                Founded 2019 · Headquartered in Bristol, United Kingdom
                www.example.com
                52 employees
            """),
            ("Traction", f"""
                FY2024 revenue: {REVENUE_DECK}
                Gross margin 61%
                Net revenue retention 118%
                34 enterprise customers across the UK, Ireland and the Netherlands
            """),
            ("Market", """
                Warehouse automation is a growing segment of intralogistics.
                We target 3PL operators running between 4 and 40 sites, a band
                underserved by both enterprise vendors and low-cost integrators.
            """),
            ("The ask", """
                Raising GBP 6M Series A at a GBP 30M pre-money valuation.
                Use of funds: engineering (45%), commercial expansion (35%),
                working capital (20%).
            """),
        ],
    )

    pdf(
        "04_audited_accounts.pdf",
        "Northwind Robotics Ltd — Report and Financial Statements",
        [
            ("Basis of preparation", """
                For the year ended 31 December 2024. Prepared under FRS 102.
                These figures are audited actuals and are not adjusted for
                pro-forma or annualised effects.
            """),
            ("Statement of comprehensive income", f"""
                Turnover                          {REVENUE_ACCOUNTS}
                Cost of sales                     (£1.29M)
                Gross profit                      £1.91M
                Administrative expenses           (£2.44M)
                Operating loss                    (£0.53M)
                EBITDA                            (£0.31M)
                Loss for the financial year       (£0.58M)
            """),
            ("Balance sheet", """
                Total assets                      £4.15M
                Cash at bank                      £1.02M
                Total liabilities                 £2.61M
                Net assets                        £1.54M
            """),
            ("Employees", """
                Average monthly number of employees during the year: 49
            """),
            ("Going concern", """
                The directors note that the company is dependent on completing a
                further funding round within twelve months of signing. The
                accounts are prepared on a going concern basis on that assumption.
            """),
        ],
    )

    xlsx(
        "02_financial_model.xlsx",
        {
            "Summary": [
                ["Northwind Robotics — Operating Model"],
                ["Basis", "Exit run-rate annualised"],
                [],
                ["Metric", "FY2023", "FY2024", "FY2025F", "FY2026F"],
                ["Revenue (GBP)", 1_950_000, 3_800_000, 7_400_000, 12_900_000],
                ["Gross profit (GBP)", 1_100_000, 2_320_000, 4_600_000, 8_200_000],
                ["EBITDA (GBP)", -820_000, -310_000, 450_000, 2_600_000],
                ["Headcount", 31, 52, 78, 104],
                [],
                ["Note", f"FY2024 revenue shown as {REVENUE_MODEL} on a run-rate basis."],
            ],
            "Pipeline": [
                ["Account", "Stage", "ARR (GBP)", "Close quarter"],
                ["Meridian 3PL", "Contracting", 340_000, "Q1 2025"],
                ["Halberd Logistics", "Proposal", 210_000, "Q2 2025"],
                ["Coastal Freight Group", "Discovery", 480_000, "Q3 2025"],
                ["Ardent Supply Co", "Proposal", 155_000, "Q2 2025"],
            ],
        },
    )

    xlsx(
        "03_cap_table.xlsx",
        {
            "Cap Table": [
                ["Shareholder", "Class", "Shares", "Fully diluted %"],
                ["A. Okonkwo (CEO)", "Ordinary", 3_100_000, "31.0%"],
                ["R. Lindqvist (CTO)", "Ordinary", 2_400_000, "24.0%"],
                ["Seedwell Ventures", "Seed Preferred", 1_900_000, "19.0%"],
                ["Kestrel Angels SPV", "Seed Preferred", 900_000, "9.0%"],
                ["Employee option pool", "Options", 1_200_000, "12.0%"],
                ["Unallocated", "Options", 500_000, "5.0%"],
                [],
                ["Total", "", 10_000_000, "100.0%"],
            ],
            "Terms": [
                ["Instrument", "Seed Preferred"],
                ["Liquidation preference", "1x non-participating"],
                ["Anti-dilution", "Broad-based weighted average"],
                ["Board", "2 founder, 1 investor, 1 independent"],
            ],
        },
    )

    print("\nThe FY2024 revenue figures disagree on purpose:")
    print(f"  pitch deck       {REVENUE_DECK}   (unlabelled, pro-forma)")
    print(f"  financial model  {REVENUE_MODEL}   (run-rate)")
    print(f"  audited accounts {REVENUE_ACCOUNTS}   (actual)")


if __name__ == "__main__":
    main()
