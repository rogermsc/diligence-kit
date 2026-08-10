"""Records the LLM fixtures that let `make demo` run the pipeline offline.

Hand-writing fixture files does not work: each one is addressed by a hash of the
exact prompt the pipeline builds, so the only reliable way to produce them is to
run the real pipeline and capture what it asked for. This script does that with
the model replaced by canned answers, so the keys are correct by construction and
no API call is made.

    make fixtures         record everything (this script)
    make fixtures-check   replay against what is committed and fail on a miss

Rerun after changing anything the key is built from. That is wider than "a
prompt": `_fixture_key` hashes purpose + model + the prompt text, and for a
spreadsheet or CSV the rendered document *is* the prompt text. So all of these
invalidate the committed set —

    src/core/prompts/*.py            the prompts themselves
    LLM_MODEL_* in core/config.py    the model name is part of the key
    extractors/excel_extractor.py    it renders the text the prompt carries
    fixtures/dataroom/*              different documents, different prompts

The keys deliberately do not depend on today's date: it is interpolated into two
system prompts, and hashing it made every committed fixture expire at local
midnight.

Both pipelines are recorded — the one-pager *and* the four diligence domains.
Recording only the first left ~600 lines of domain report code with no offline
coverage at all, and made stage 2 of `make demo` fail on a replay miss.

Outputs land in fixtures/llm/, and the three artefacts `make demo` seeds from are
copied into fixtures/demo-output/. Both are committed. Nothing used to copy the
second set, so editing a prompt, re-recording, and watching the tests pass still
left the demo showing the pre-edit one-pager.
"""

import argparse
import asyncio
import json
import os
import pathlib
import shutil
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

# Settings validate on import, and the pipeline must not reach the network.
os.environ.update(
    OPENAI_API_KEY="not-used",
    AGENT_SECRET="x" * 32,
    WEBHOOK_SECRET="y" * 32,
    API_KEY="z" * 32,
    BACKEND_BASE_URL="http://localhost:3001",
    GOOGLE_CLOUD_BUCKET_NAME="local-bucket",
    STORAGE_DRIVER="local",
    STORAGE_LOCAL_ROOT=str(ROOT / ".data" / "storage"),
    LLM_DRIVER="openai",
)

from src.core import llm  # noqa: E402
from src.core.config import settings  # noqa: E402
from src.data.storage import get_storage  # noqa: E402
from src.domain.analyze.entities import AnalyzeInput, Document  # noqa: E402
from src.domain.analyze.use_cases import AnalyzeUseCase  # noqa: E402
from src.domain.diligence.entities import DiligenceInput  # noqa: E402
from src.domain.diligence.use_cases import DiligenceUseCase  # noqa: E402

COMPANY = "Northwind Robotics"
AUTOMATION_ID = "00000000-0000-4000-8000-000000000001"
COMPANY_ID = "00000000-0000-4000-8000-000000000002"

DATAROOM = ROOT / "fixtures" / "dataroom"
DEMO_OUTPUT = ROOT / "fixtures" / "demo-output"

DOMAINS = ["OPERATIONAL", "COMMERCIAL", "FINANCIAL", "CAP_TABLE_AND_LEGAL_REVIEW"]

# Which pipeline is running, so the canned extraction answers can match the
# schema being asked for. The diligence domains each use their own field set, and
# answering one with another's fields produces facts that are silently dropped as
# unknown. Set by main() around each run rather than sniffed out of the prompt.
_CURRENT_DOMAIN: str | None = None


def _block_network() -> None:
    """Make a real API call impossible rather than merely unlikely.

    The stub is installed by patching the name in each module that imported it,
    which is a list that has to stay in step with the code. It previously skipped
    any module it could not find, so adding a service that calls the LLM — or
    mistyping a module path — meant this script quietly talked to OpenAI with
    whatever key was in the environment. Closing the socket at the source turns
    that into a loud failure instead of a bill.
    """

    def refuse():
        raise SystemExit(
            "record_demo_fixtures tried to reach OpenAI. Some module that calls "
            "the LLM was not stubbed — add it to install_stub()."
        )

    llm._get_client = refuse


def facts_for(doc_name: str) -> dict:
    """Canned extraction output per *prepared document*, not per file.

    Excel is extracted one prepared document per sheet, named
    "02_financial_model.xlsx (Summary)". Matching on the file name alone handed
    both sheets of a workbook the same answer, so the Summary sheet's revenue and
    the Cap Table sheet's shareholders were also recorded against the Pipeline and
    Terms sheets — nine facts citing a sheet that does not contain them.

    That is worse than a wrong page number. The same fact then arrives from two
    apparently different sources, and anything counting sources reads one sheet
    double-counted as two documents agreeing.

    Every quote below is verbatim from the sheet or page it names, so the
    grounding check in fact_extraction_service exercises the same path here that
    it would on live output — and fails loudly if these drift.
    """
    if doc_name.startswith("01_pitch_deck"):
        return {
            "facts": [
                {"field": "company_name", "value": "Northwind Robotics Ltd", "page": "1",
                 "quote": "Northwind Robotics Ltd"},
                {"field": "industry", "value": "Warehouse automation for third-party logistics",
                 "page": "1", "quote": "Warehouse automation for mid-market third-party logistics"},
                {"field": "headquarters", "value": "Bristol, United Kingdom", "page": "1",
                 "quote": "Headquartered in Bristol, United Kingdom"},
                {"field": "founded_year", "value": "2019", "page": "1", "quote": "Founded 2019"},
                {"field": "website", "value": "www.example.com", "page": "1",
                 "quote": "www.example.com"},
                {"field": "employees", "value": "52", "page": "1", "quote": "52 employees"},
                {"field": "annual_revenue_fy2024", "value": "£4.1M", "page": "1",
                 "quote": "FY2024 revenue: £4.1M", "source_type": "pro_forma"},
                {"field": "market_position",
                 "value": "Targets 3PL operators running 4 to 40 sites", "page": "1",
                 "quote": "We target 3PL operators running between 4 and 40 sites"},
                {"field": "customer_base", "value": "34 enterprise customers", "page": "1",
                 "quote": "34 enterprise customers across the UK, Ireland and the Netherlands"},
                {"field": "geographic_presence", "value": "UK, Ireland, Netherlands", "page": "1",
                 "quote": "across the UK, Ireland and the Netherlands"},
                {"field": "transaction_value", "value": "GBP 6M Series A", "page": "1",
                 "quote": "Raising GBP 6M Series A at a GBP 30M pre-money valuation"},
            ],
            "coverage": ["deck", "one_pager", "market_research", "go_to_market_strategy"],
        }

    if doc_name.startswith("04_audited_accounts"):
        return {
            "facts": [
                {"field": "annual_revenue_fy2024", "value": "£3.2M", "page": "1",
                 "quote": "Turnover                          £3.2M", "source_type": "actual",
                 "document_date": "2024-12-31"},
                {"field": "ebitda", "value": "(£0.31M)", "page": "1",
                 "quote": "EBITDA                            (£0.31M)", "source_type": "actual",
                 "document_date": "2024-12-31"},
                {"field": "net_income", "value": "(£0.58M)", "page": "1",
                 "quote": "Loss for the financial year       (£0.58M)", "source_type": "actual",
                 "document_date": "2024-12-31"},
                {"field": "total_assets", "value": "£4.15M", "page": "1",
                 "quote": "Total assets                      £4.15M", "source_type": "actual"},
                {"field": "employees", "value": "49", "page": "1",
                 "quote": "Average monthly number of employees during the year: 49"},
                {"field": "risk_factor",
                 "value": "Going concern depends on completing a funding round within 12 months",
                 "page": "1",
                 "quote": "the company is dependent on completing a further funding round within twelve months of signing"},
            ],
            "coverage": ["quality_of_earnings", "revenue_analysis", "working_capital"],
        }

    if doc_name.startswith("02_financial_model.xlsx (Summary)"):
        return {
            "facts": [
                {"field": "annual_revenue_fy2024", "value": "£3.8M", "page": "Summary!B10",
                 "quote": "FY2024 revenue shown as £3.8M on a run-rate basis.",
                 "source_type": "pro_forma"},
                {"field": "annual_revenue_fy2023", "value": "£1.95M", "page": "Summary!B5",
                 "quote": "Revenue (GBP),1950000", "source_type": "actual"},
                {"field": "ebitda", "value": "(£0.31M) FY2024", "page": "Summary!C7",
                 "quote": "EBITDA (GBP),-820000,-310000", "source_type": "actual"},
                {"field": "employees", "value": "52", "page": "Summary!C8",
                 "quote": "Headcount,31,52,78,104"},
            ],
            "coverage": ["financial_forecasts", "usage_data"],
        }

    if doc_name.startswith("02_financial_model.xlsx (Pipeline)"):
        # A named sales pipeline and nothing else. It covers an information type
        # without yielding a single field in the extraction schema, which is a
        # real and common shape — a document can be responsive without being
        # extractable. The previous canned answer put a `pipeline_value` fact
        # here, which is not in EXTRACTION_FIELDS and was silently dropped as an
        # unknown field on every run since.
        return {"facts": [], "coverage": ["pipeline"]}

    if doc_name.startswith("03_cap_table.xlsx (Cap Table)"):
        return {
            "facts": [
                {"field": "shareholder", "value": "A. Okonkwo (CEO) — 31.0%", "page": "Cap Table!A2",
                 "quote": "A. Okonkwo (CEO),Ordinary,3100000,31.0%"},
                {"field": "shareholder", "value": "R. Lindqvist (CTO) — 24.0%",
                 "page": "Cap Table!A3", "quote": "R. Lindqvist (CTO),Ordinary,2400000,24.0%"},
                {"field": "shareholder", "value": "Seedwell Ventures — 19.0%", "page": "Cap Table!A4",
                 "quote": "Seedwell Ventures,Seed Preferred,1900000,19.0%"},
                {"field": "key_person", "value": "A. Okonkwo, Chief Executive Officer",
                 "page": "Cap Table!A2", "quote": "A. Okonkwo (CEO)"},
                {"field": "key_person", "value": "R. Lindqvist, Chief Technology Officer",
                 "page": "Cap Table!A3", "quote": "R. Lindqvist (CTO)"},
            ],
            "coverage": ["cap_table", "contracts_esop"],
        }

    if doc_name.startswith("03_cap_table.xlsx (Terms)"):
        return {
            "facts": [
                {"field": "deal_type", "value": "Seed Preferred equity", "page": "Terms!B1",
                 "quote": "Instrument,Seed Preferred"},
                {"field": "payment_structure",
                 "value": "1x non-participating liquidation preference", "page": "Terms!B2",
                 "quote": "Liquidation preference,1x non-participating"},
            ],
            "coverage": ["investment_docs", "shareholder_agreements"],
        }

    return {"facts": [], "coverage": []}


CONFLICT_RESOLUTION = {
    # The model's only job here is telling a real disagreement from the same
    # figure written twice. Which value prevails is decided in fact_merge by a
    # stated rule, before this runs, so there is no preferred_value to cann.
    "resolutions": [
        {
            "field": "annual_revenue_fy2024",
            "is_real_conflict": True,
            "reason": "Three different FY2024 revenue figures. The pitch deck's £4.1M is "
                      "pro-forma, the model's £3.8M is an annualised exit run-rate, and only "
                      "the audited accounts state an actual.",
        },
        {
            "field": "employees",
            "is_real_conflict": False,
            "reason": "52 is the headcount at year end and 49 is the average over the year. "
                      "Both are correct on their own basis.",
        },
        {
            "field": "ebitda",
            "is_real_conflict": False,
            "reason": "Same figure, one carrying an explicit period label.",
        },
    ]
}

ONE_PAGER = {
    "executive_summary":
        "Northwind Robotics is a Bristol-based warehouse automation vendor serving mid-market "
        "third-party logistics operators. FY2024 audited turnover was £3.2M against an EBITDA "
        "loss of £0.31M. Note that the pitch deck and the operating model quote £4.1M and £3.8M "
        "for the same period on pro-forma and run-rate bases respectively; the £3.2M actual is "
        "the figure used throughout this memorandum. Growth is real — FY2023 turnover was £1.95M "
        "— but the auditor has flagged that going concern depends on closing this round within "
        "twelve months, which makes the raise a condition of the business rather than an option.",
    "company_overview": {
        "name": "Northwind Robotics Ltd",
        "industry": "Warehouse automation for third-party logistics",
        "headquarters": "Bristol, United Kingdom",
        "founded": "2019",
        "website": "www.example.com",
    },
    "financial_highlights": {
        "annual_revenue": "£3.2M (FY2024 audited actual)",
        "ebitda": "(£0.31M) (FY2024)",
        "net_income": "(£0.58M) (FY2024)",
        "total_assets": "£4.15M",
        "employees": "52 at year end (49 average over the year)",
        "projections": "£7.4M FY2025 and £12.9M FY2026 per the operating model. These are "
                       "management projections, not audited, and imply 131% growth off a base "
                       "the company has not yet demonstrated.",
    },
    "business_metrics": {
        "market_position": "Targets 3PL operators running between 4 and 40 sites, positioned "
                           "between enterprise vendors and low-cost integrators.",
        "primary_revenue_streams": "Warehouse automation deployments to 3PL operators.",
        "geographic_presence": "United Kingdom, Ireland and the Netherlands.",
        "customer_base": "34 enterprise customers.",
        "competitive_advantages": "Net revenue retention of 118% per the deck, though this is "
                                  "not independently evidenced in the dataroom.",
    },
    "scorecard": [
        {"category": "Financial Readiness", "score": "2.5/5",
         "key_issues": ["Three conflicting FY2024 revenue figures across the dataroom",
                        "EBITDA negative", "Going concern qualified on closing this round"]},
        {"category": "Product Maturity", "score": "3.5/5",
         "key_issues": ["34 enterprise customers deployed",
                        "No product documentation or roadmap supplied"]},
        {"category": "Go-To-Market Engine", "score": "3.5/5",
         "key_issues": ["118% net revenue retention claimed but unevidenced",
                        "Named pipeline of £1.185M across four accounts"]},
        {"category": "Team & Leadership", "score": "3.0/5",
         "key_issues": ["Two named founders holding 55% between them",
                        "No CVs, references or org chart supplied"]},
        {"category": "Legal & Compliance", "score": "2.0/5",
         "key_issues": ["No client contracts, insurance or policies in the dataroom",
                        "No IP register"]},
        {"category": "Capital Structure", "score": "4.0/5",
         "key_issues": ["Clean cap table, 1x non-participating preference",
                        "17% option pool with 5% unallocated"]},
        {"category": "Market Positioning", "score": "3.0/5",
         "key_issues": ["Segment rationale is stated but not sized",
                        "No competitive analysis supplied"]},
        {"category": "ESG & Risk Factors", "score": "2.0/5",
         "key_issues": ["No ESG disclosure of any kind in the dataroom"]},
    ],
    "transaction_structure": {
        "category": "Series A preferred equity",
        "value": "GBP 6M at a GBP 30M pre-money valuation",
        "payment": "Not specified in the dataroom",
        "timeline": "Not specified in the dataroom",
    },
    "deal_rationale": {
        "strategic_objectives": "Fund engineering (45%), commercial expansion (35%) and working "
                                "capital (20%).",
        "synergies_expected": "Not specified in the dataroom",
        "market_rationale": "Underserved mid-market band between enterprise vendors and low-cost "
                            "integrators.",
    },
    "key_terms": {
        "closing_conditions": "Not specified in the dataroom",
        "due_diligence_period": "Not specified in the dataroom",
        "regulatory_approvals": "None identified",
        "financing": "GBP 6M primary",
    },
    "critical_risk_factors": [
        {"risk": "FY2024 revenue is stated three ways across three documents, and the highest "
                 "figure appears in the document written to raise money.",
         "mitigation": "Anchor on the £3.2M audited actual and require management to reconcile "
                       "the pro-forma and run-rate bridges in writing."},
        {"risk": "Going concern is conditional on this round closing within twelve months.",
         "mitigation": "Confirm the runway calculation against the £1.02M cash balance and "
                       "agree milestones before signing."},
        {"risk": "No client contracts were supplied, so revenue quality and churn exposure "
                 "cannot be assessed.",
         "mitigation": "Request the top ten contracts by ARR, with termination and renewal terms."},
    ],
    "key_success_factors": [
        "Converting the named £1.185M pipeline on the stated timeline",
        "Reaching EBITDA breakeven before the round's runway expires",
        "Evidencing the 118% net revenue retention claim with cohort data",
    ],
    "summary_highlights": {
        "primary_risk_areas": "Financial reporting consistency, going concern, and an absent "
                              "legal and commercial contract set.",
        "key_strengths": "64% year-on-year audited revenue growth, a clean capital structure, "
                         "and 34 deployed enterprise customers.",
    },
}


# --------------------------------------------------------------------------
# Diligence: four domains, each with its own extraction schema and report model.
#
# The dataroom is four documents. It has no contracts, no policies, no IP
# register, no insurance and no org chart, so most of a real operational or
# commercial report genuinely cannot be written from it. These fixtures say so
# rather than inventing prose: an honest "not evidenced" is both the accurate
# answer and a better demonstration of the product than filler would be.
# --------------------------------------------------------------------------

ABSENT = "Not evidenced in the dataroom."

DILIGENCE_FACTS = {
    "OPERATIONAL": {
        "01_pitch_deck.pdf": {
            "facts": [
                {"field": "headcount", "value": "52", "page": "1", "quote": "52 employees"},
            ],
            "coverage": ["deck", "one_pager"],
        },
        "03_cap_table.xlsx (Cap Table)": {
            "facts": [
                {"field": "key_person", "value": "A. Okonkwo, Chief Executive Officer",
                 "page": "Cap Table!A2", "quote": "A. Okonkwo (CEO)"},
                {"field": "key_person", "value": "R. Lindqvist, Chief Technology Officer",
                 "page": "Cap Table!A3", "quote": "R. Lindqvist (CTO)"},
            ],
            "coverage": ["structure_incorporation"],
        },
    },
    "COMMERCIAL": {
        "01_pitch_deck.pdf": {
            "facts": [
                {"field": "customer_count", "value": "34 enterprise customers", "page": "1",
                 "quote": "34 enterprise customers across the UK, Ireland and the Netherlands"},
                {"field": "customer_segment",
                 "value": "3PL operators running between 4 and 40 sites", "page": "1",
                 "quote": "We target 3PL operators running between 4 and 40 sites"},
            ],
            "coverage": ["deck", "go_to_market_strategy"],
        },
        # The sheet that yields nothing against the one-pager schema is exactly
        # the sheet commercial diligence wants.
        "02_financial_model.xlsx (Pipeline)": {
            "facts": [
                # One value, not one per account: pipeline_value is a unique field
                # in this domain, so several would merge into a conflict between
                # four accounts that do not disagree about anything.
                {"field": "pipeline_value", "value": "£480k — Coastal Freight Group",
                 "page": "Pipeline!C4", "quote": "Coastal Freight Group,Discovery,480000,Q3 2025",
                 "source_type": "projection"},
                {"field": "pipeline_stage", "value": "Contracting — Meridian 3PL, Q1 2025",
                 "page": "Pipeline!B2", "quote": "Meridian 3PL,Contracting,340000,Q1 2025"},
            ],
            "coverage": ["pipeline"],
        },
    },
    "FINANCIAL": {
        "04_audited_accounts.pdf": {
            "facts": [
                {"field": "annual_revenue_fy2024", "value": "£3.2M", "page": "1",
                 "quote": "Turnover                          £3.2M", "source_type": "actual",
                 "document_date": "2024-12-31"},
                {"field": "ebitda", "value": "(£0.31M)", "page": "1",
                 "quote": "EBITDA                            (£0.31M)", "source_type": "actual",
                 "document_date": "2024-12-31"},
            ],
            "coverage": ["quality_of_earnings", "revenue_analysis"],
        },
        "02_financial_model.xlsx (Summary)": {
            "facts": [
                {"field": "annual_revenue_fy2024", "value": "£3.8M", "page": "Summary!B10",
                 "quote": "FY2024 revenue shown as £3.8M on a run-rate basis.",
                 "source_type": "pro_forma"},
            ],
            "coverage": ["financial_forecasts"],
        },
    },
    "CAP_TABLE_AND_LEGAL_REVIEW": {
        "03_cap_table.xlsx (Cap Table)": {
            "facts": [
                {"field": "shareholder", "value": "A. Okonkwo (CEO) — 31.0%", "page": "Cap Table!A2",
                 "quote": "A. Okonkwo (CEO),Ordinary,3100000,31.0%"},
                {"field": "option_pool", "value": "12.0% granted, 5.0% unallocated",
                 "page": "Cap Table!A6", "quote": "Employee option pool,Options,1200000,12.0%"},
            ],
            "coverage": ["cap_table", "contracts_esop"],
        },
        "03_cap_table.xlsx (Terms)": {
            "facts": [
                {"field": "liquidation_preference", "value": "1x non-participating",
                 "page": "Terms!B2", "quote": "Liquidation preference,1x non-participating"},
            ],
            "coverage": ["investment_docs", "shareholder_agreements"],
        },
    },
}

DILIGENCE_REPORTS = {
    "OPERATIONAL": {
        "executive_summary":
            "Northwind Robotics employs 52 people at FY2024 year end against 49 on an "
            "average monthly basis, and is led by two founders holding 55% between them. "
            "Beyond headcount and the two named officers, this dataroom contains no "
            "operational evidence: no org chart, no policies, no technology documentation "
            "and no process description. The operational picture cannot be assessed from "
            "what has been supplied, and that absence is itself the finding.",
        "org_structure":
            "Two named officers: A. Okonkwo (Chief Executive Officer) and R. Lindqvist "
            "(Chief Technology Officer). No org chart or reporting lines were supplied.",
        "hr_talent":
            "52 employees at year end; 49 average over the year. No CVs, no turnover data, "
            "no compensation framework and no succession plan.",
        "key_risks":
            "Key-person concentration in two founders with no succession plan on file. "
            "Nine of the ten operational information types requested are absent, so no "
            "assurance can be given on technology, process or policy maturity.",
        "recommendations":
            "Request an org chart, employee handbook, the technology architecture and "
            "security documentation, and CVs for both founders before proceeding.",
    },
    "COMMERCIAL": {
        "executive_summary":
            "The company reports 34 enterprise customers across the UK, Ireland and the "
            "Netherlands, targeting third-party logistics operators running between four "
            "and forty sites. A named pipeline of four accounts is disclosed. No customer "
            "contracts, churn data or cohort analysis were supplied, so revenue quality "
            "cannot be tested and the 118% net revenue retention claimed in the deck is "
            "unevidenced.",
        "customer_analysis":
            "34 enterprise customers stated in the pitch deck. No customer list, no "
            "concentration analysis and no contracts, so exposure to the largest accounts "
            "is unknown.",
        "gtm_strategy":
            "Stated focus on 3PL operators with 4 to 40 sites, positioned between "
            "enterprise vendors and low-cost integrators. The segment is described but "
            "not sized.",
        "revenue_quality":
            "Untestable. No contracts, no billing data and no cohort retention were "
            "supplied. The deck's 118% net revenue retention has no supporting evidence "
            "in this dataroom.",
        "risks_mitigation":
            "Revenue quality is unassessable and customer concentration is unknown. "
            "Request the top ten contracts by ARR with termination and renewal terms.",
        "recommendations":
            "Obtain the customer contract set, a cohort retention analysis substantiating "
            "the 118% claim, and a churn history before relying on the growth case.",
    },
    "FINANCIAL": {
        "executive_summary":
            "FY2024 audited turnover was £3.2M against an EBITDA loss of £0.31M and a "
            "loss for the year of £0.58M, on total assets of £4.15M. Growth is real: "
            "FY2023 turnover was £1.95M, so the audited figures show 64% year-on-year "
            "growth. Two caveats dominate. The operating model states FY2024 revenue as "
            "£3.8M on an annualised exit run-rate basis and the pitch deck states £4.1M "
            "pro-forma; only the £3.2M is an audited actual, and it is the figure used "
            "here. Separately, the auditor has qualified going concern on completion of a "
            "funding round within twelve months.",
        "income_statement":
            "FY2024 audited: turnover £3.2M, EBITDA (£0.31M), loss for the financial year "
            "(£0.58M). FY2023 turnover £1.95M per the operating model.",
        "quality_of_earnings":
            "The same period is reported three ways across three documents — £4.1M "
            "pro-forma in the pitch deck, £3.8M run-rate in the operating model, £3.2M "
            "actual in the audited accounts. The bridges between the bases are not "
            "documented anywhere in the dataroom and should be obtained in writing.",
        "forecast_budget":
            "Management projects £7.4M for FY2025 and £12.9M for FY2026, implying 131% "
            "growth off a base the company has not yet demonstrated. Unaudited.",
        "key_risks":
            "Going concern is conditional on this round closing within twelve months. "
            "Three conflicting revenue figures for one period, with the highest appearing "
            "in the document written to raise money.",
        "recommendations":
            "Anchor on the £3.2M audited actual. Require a written reconciliation of the "
            "pro-forma and run-rate bridges, and confirm the runway calculation against "
            "the cash balance before signing.",
    },
    "CAP_TABLE_AND_LEGAL_REVIEW": {
        "executive_summary":
            "The capital structure is clean and fully accounted for: 10,000,000 shares "
            "totalling 100.0%, with two founders on 31.0% and 24.0%, two seed investors "
            "on 19.0% and 9.0%, and a 17% option pool of which 5% is unallocated. Seed "
            "Preferred carries a 1x non-participating liquidation preference with "
            "broad-based weighted average anti-dilution and a four-person board. No "
            "convertible instruments, side letters or grant documents were supplied.",
        "cap_table_overview":
            "10,000,000 shares fully diluted, summing to 100.0%. A. Okonkwo (CEO) 31.0%, "
            "R. Lindqvist (CTO) 24.0%, Seedwell Ventures 19.0%, Kestrel Angels SPV 9.0%, "
            "employee option pool 12.0%, unallocated options 5.0%.",
        "option_pool_analysis":
            "17% total pool with 12% granted and 5% unallocated. No grant documents, "
            "vesting schedules or option agreements were supplied.",
        "investor_rights":
            "Seed Preferred: 1x non-participating liquidation preference, broad-based "
            "weighted average anti-dilution, board of two founders, one investor and one "
            "independent. The underlying subscription and shareholders' agreements were "
            "not supplied.",
        "key_risks":
            "Founders hold 55% between them with no vesting evidence on file. The "
            "instruments behind the stated terms are absent, so the terms cannot be "
            "verified against executed documents.",
        "recommendations":
            "Request the shareholders' agreement, articles, option plan rules and all "
            "executed grant documents, and confirm whether any side letters exist.",
    },
}


def diligence_report_for(domain: str) -> dict:
    """Fill every field of the domain's report model, stating absence explicitly."""
    from src.domain.diligence.entities import DOMAIN_REPORT_MODELS

    written = DILIGENCE_REPORTS[domain]
    return {
        name: written.get(name, ABSENT)
        for name in DOMAIN_REPORT_MODELS[domain].model_fields
    }


def _prepared_names() -> list[str]:
    """Every prepared-document name the pipeline can produce, longest first.

    Longest first because "02_financial_model.xlsx (Summary)" contains
    "02_financial_model.xlsx"; matching the short one first is exactly the bug
    that misattributed nine facts.
    """
    names = []
    for path in sorted(DATAROOM.iterdir()):
        if path.suffix.lower() in {".xlsx", ".xls"}:
            from src.data.analyze.extractors import excel_extractor

            names += [f"{path.name} ({sheet})" for sheet, _ in
                      excel_extractor.extract_sheets(str(path))]
        else:
            names.append(path.name)
    return sorted(names, key=len, reverse=True)


def stub_response(purpose: str, prompt_text: str) -> str:
    if purpose == "fact_extraction":
        for name in _prepared_names():
            if name in prompt_text:
                if _CURRENT_DOMAIN:
                    return json.dumps(
                        DILIGENCE_FACTS[_CURRENT_DOMAIN].get(
                            name, {"facts": [], "coverage": []}
                        )
                    )
                return json.dumps(facts_for(name))
        return json.dumps({"facts": [], "coverage": []})
    if purpose == "conflict_resolution":
        return json.dumps(CONFLICT_RESOLUTION)
    if purpose == "one_pager":
        return json.dumps(ONE_PAGER)
    if purpose == "diligence_report":
        return json.dumps(diligence_report_for(_CURRENT_DOMAIN))
    raise SystemExit(f"No canned response for purpose '{purpose}'")


def install_stub() -> list[str]:
    """Answer from the canned set, then record under the real fixture key."""

    async def complete_json(purpose, user, system="", *, volatile=()):
        output = stub_response(purpose, user)
        llm._write_fixture(
            llm._fixture_key(
                purpose, llm.model_for(purpose), [system, user], volatile=volatile
            ),
            purpose, llm.model_for(purpose), output,
        )
        return output

    async def respond_json(purpose, instructions, content, *, document_key=""):
        text_parts = [p.get("text", "") for p in content if p.get("type") == "input_text"]
        output = stub_response(purpose, " ".join(text_parts))
        llm._write_fixture(
            llm._fixture_key(
                purpose,
                llm.model_for(purpose),
                [instructions, *text_parts],
                extra=document_key,
            ),
            purpose, llm.model_for(purpose), output,
        )
        return output

    async def upload_file(file_name, data):
        return f"replay-file-{file_name}"

    # Discovered, not listed. These are `from ... import` bindings, so each
    # importing module holds its own reference and has to be patched in place —
    # but the previous hardcoded list skipped anything it could not find, so a
    # new LLM-calling service was silently left talking to the real API. Walking
    # what is actually loaded cannot fall out of step. _block_network() is the
    # backstop if something is imported later still.
    replacements = {
        "complete_json": complete_json,
        "respond_json": respond_json,
        "upload_file": upload_file,
    }
    # Snapshot the originals first. src.core.llm is itself in sys.modules, so
    # patching it mid-loop would change what we compare against and silently skip
    # every module visited afterwards.
    originals = {name: getattr(llm, name) for name in replacements}

    patched = []
    for module_name, mod in list(sys.modules.items()):
        if not module_name.startswith("src.") or mod is None:
            continue
        for name, fn in replacements.items():
            if getattr(mod, name, None) is originals[name]:
                setattr(mod, name, fn)
                patched.append(f"{module_name}.{name}")

    if not patched:
        raise SystemExit(
            "install_stub patched nothing — the LLM entry points moved. "
            "Recording would have called the real API."
        )
    return patched


def stage_dataroom() -> list[Document]:
    """Put the fixture documents where the pipeline expects to read them from."""
    storage = get_storage()
    documents = []
    for i, path in enumerate(sorted(DATAROOM.iterdir()), start=1):
        # Keyed on the company id, matching what the backend writes.
        key = f"{COMPANY_ID}/{AUTOMATION_ID}/{path.name}"
        storage.upload_bytes(key, path.read_bytes(), "application/octet-stream")
        documents.append(
            Document(id=f"00000000-0000-4000-8000-00000000010{i}",
                     url=f"gs://{storage.bucket_name}/{key}")
        )
    return documents


def copy_demo_output() -> list[str]:
    """Copy the three artefacts `make demo` seeds from out of local storage.

    seed-demo.ts reads fixtures/demo-output/; the pipeline writes to
    .data/storage/. Nothing bridged the two, so re-recording updated the fixture
    keys and left the demo showing the previous one-pager — change a prompt, run
    the recorder, watch the tests pass, and the demo would still be stale.
    """
    root = pathlib.Path(settings.storage_local_root)
    wanted = {
        "facts.json": f"agent-facts/{AUTOMATION_ID}/facts.json",
        "one_pager.json": f"agent-facts/{AUTOMATION_ID}/one_pager.json",
        "one_pager.pdf": f"one-pagers/{AUTOMATION_ID}.pdf",
    }
    DEMO_OUTPUT.mkdir(parents=True, exist_ok=True)
    copied = []
    for name, key in wanted.items():
        matches = list(root.rglob(key))
        if not matches:
            print(f"  ! {name}: nothing at {key} — demo seed will keep the old copy")
            continue
        shutil.copyfile(matches[0], DEMO_OUTPUT / name)
        copied.append(name)
    return copied


async def record() -> None:
    fixture_dir = ROOT / "fixtures" / "llm"
    if fixture_dir.exists():
        shutil.rmtree(fixture_dir)
    settings.llm_fixture_dir = str(fixture_dir)

    documents = stage_dataroom()
    print(f"Staged {len(documents)} documents into local storage")

    _block_network()
    patched = install_stub()
    print(f"Stubbed {len(patched)} LLM entry points")

    await AnalyzeUseCase().execute(
        AnalyzeInput(company_id=COMPANY_ID, company_name=COMPANY,
                     automation_id=AUTOMATION_ID, documents=documents)
    )

    global _CURRENT_DOMAIN
    for domain in DOMAINS:
        _CURRENT_DOMAIN = domain
        # A child automation id per domain, matching what the backend creates for
        # stage 2. Reusing the triage id would have each domain overwrite the
        # previous one's cached facts.
        await DiligenceUseCase(domain).execute(
            DiligenceInput(
                company_id=COMPANY_ID,
                company_name=COMPANY,
                automation_id=f"{AUTOMATION_ID[:-1]}{DOMAINS.index(domain) + 2}",
                domain=domain,
                documents=documents,
            )
        )
    _CURRENT_DOMAIN = None

    recorded = sorted(fixture_dir.glob("*.json"))
    print(f"\nRecorded {len(recorded)} LLM fixtures into {fixture_dir}")
    by_purpose: dict[str, int] = {}
    for path in recorded:
        purpose = json.loads(path.read_text())["purpose"]
        by_purpose[purpose] = by_purpose.get(purpose, 0) + 1
    for purpose, count in sorted(by_purpose.items()):
        print(f"  {purpose:22} {count}")

    copied = copy_demo_output()
    print(f"\nCopied {len(copied)} demo artefacts into {DEMO_OUTPUT}: {', '.join(copied)}")


async def check() -> None:
    """Replay both pipelines against what is committed and fail on any miss.

    Something a contributor can run that is not pytest, and the thing CI should
    run to prove the committed fixtures still match the prompts in the tree.
    """
    settings.llm_driver = "replay"
    settings.llm_fixture_dir = str(ROOT / "fixtures" / "llm")

    documents = stage_dataroom()
    _block_network()

    try:
        await AnalyzeUseCase().execute(
            AnalyzeInput(company_id=COMPANY_ID, company_name=COMPANY,
                         automation_id=AUTOMATION_ID, documents=documents)
        )
        for i, domain in enumerate(DOMAINS):
            await DiligenceUseCase(domain).execute(
                DiligenceInput(
                    company_id=COMPANY_ID, company_name=COMPANY,
                    automation_id=f"{AUTOMATION_ID[:-1]}{i + 2}",
                    domain=domain, documents=documents,
                )
            )
    except llm.ReplayMiss as miss:
        raise SystemExit(
            f"\nReplay miss: {miss}\n\n"
            "The committed fixtures no longer match the prompts in this tree. "
            "Something the key is built from changed — a prompt, a model name in "
            "config, the Excel renderer, or the dataroom. Re-record with "
            "`make fixtures`."
        ) from None

    print("Both pipelines replayed with no misses.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--check", action="store_true",
        help="replay against the committed fixtures instead of recording",
    )
    args = parser.parse_args()
    if args.check:
        os.environ["LLM_DRIVER"] = "replay"
        asyncio.run(check())
    else:
        asyncio.run(record())
