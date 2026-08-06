"""Records the LLM fixtures that let `make demo` run the pipeline offline.

Hand-writing fixture files does not work: each one is addressed by a hash of the
exact prompt the pipeline builds, so the only reliable way to produce them is to
run the real pipeline and capture what it asked for. This script does that with
the model replaced by canned answers, so the keys are correct by construction and
no API call is made.

    python scripts/record_demo_fixtures.py

Rerun it after changing a prompt — the keys change with it, and replay will start
missing. Outputs land in fixtures/llm/ and are committed.

The keys deliberately do not depend on today's date: it is interpolated into two
system prompts, and hashing it made every committed fixture expire at local
midnight.
"""

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

COMPANY = "Northwind Robotics"
AUTOMATION_ID = "00000000-0000-4000-8000-000000000001"
COMPANY_ID = "00000000-0000-4000-8000-000000000002"

DATAROOM = ROOT / "fixtures" / "dataroom"


def facts_for(file_name: str) -> dict:
    """Canned extraction output per document, quoted from the real fixture text.

    The quotes are verbatim so that grounding checks over these fixtures exercise
    the same path they would on live output.
    """
    if file_name.startswith("01_pitch_deck"):
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

    if file_name.startswith("04_audited_accounts"):
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

    if file_name.startswith("02_financial_model"):
        return {
            "facts": [
                {"field": "annual_revenue_fy2024", "value": "£3.8M", "page": "Summary",
                 "quote": "FY2024 revenue shown as £3.8M on a run-rate basis.",
                 "source_type": "pro_forma"},
                {"field": "annual_revenue_fy2023", "value": "£1.95M", "page": "Summary",
                 "quote": "Revenue (GBP),1950000", "source_type": "actual"},
                {"field": "ebitda", "value": "(£0.31M) FY2024", "page": "Summary",
                 "quote": "EBITDA (GBP),-820000,-310000", "source_type": "actual"},
                {"field": "employees", "value": "52", "page": "Summary",
                 "quote": "Headcount,31,52,78,104"},
                {"field": "pipeline_value", "value": "£1.185M weighted pipeline",
                 "page": "Pipeline", "quote": "Meridian 3PL,Contracting,340000,Q1 2025",
                 "source_type": "projection"},
            ],
            "coverage": ["financial_forecasts", "pipeline", "usage_data"],
        }

    if file_name.startswith("03_cap_table"):
        return {
            "facts": [
                {"field": "shareholder", "value": "A. Okonkwo (CEO) — 31.0%", "page": "Cap Table",
                 "quote": "A. Okonkwo (CEO),Ordinary,3100000,31.0%"},
                {"field": "shareholder", "value": "R. Lindqvist (CTO) — 24.0%",
                 "page": "Cap Table", "quote": "R. Lindqvist (CTO),Ordinary,2400000,24.0%"},
                {"field": "shareholder", "value": "Seedwell Ventures — 19.0%", "page": "Cap Table",
                 "quote": "Seedwell Ventures,Seed Preferred,1900000,19.0%"},
                {"field": "key_person", "value": "A. Okonkwo, Chief Executive Officer",
                 "page": "Cap Table", "quote": "A. Okonkwo (CEO)"},
                {"field": "key_person", "value": "R. Lindqvist, Chief Technology Officer",
                 "page": "Cap Table", "quote": "R. Lindqvist (CTO)"},
            ],
            "coverage": ["cap_table", "investment_docs", "shareholder_agreements",
                         "contracts_esop"],
        }

    return {"facts": [], "coverage": []}


CONFLICT_RESOLUTION = {
    "resolutions": [
        {
            "field": "annual_revenue_fy2024",
            "is_real_conflict": True,
            "reason": "Three different FY2024 revenue figures. The pitch deck's £4.1M is "
                      "unlabelled but reconciles to a pro-forma basis; the model's £3.8M is an "
                      "annualised exit run-rate; only the audited accounts state an actual.",
            "preferred_value": "£3.2M",
        },
        {
            "field": "employees",
            "is_real_conflict": False,
            "reason": "52 is the headcount at year end and 49 is the average over the year. "
                      "Both are correct on their own basis.",
            "preferred_value": "",
        },
        {
            "field": "ebitda",
            "is_real_conflict": False,
            "reason": "Same figure, one carrying an explicit period label.",
            "preferred_value": "",
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


def stub_response(purpose: str, prompt_text: str) -> str:
    if purpose == "fact_extraction":
        for name in sorted(p.name for p in DATAROOM.iterdir()):
            if name in prompt_text or pathlib.Path(name).stem in prompt_text:
                return json.dumps(facts_for(name))
        return json.dumps({"facts": [], "coverage": []})
    if purpose == "conflict_resolution":
        return json.dumps(CONFLICT_RESOLUTION)
    if purpose == "one_pager":
        return json.dumps(ONE_PAGER)
    raise SystemExit(f"No canned response for purpose '{purpose}'")


def install_stub() -> None:
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

    for module in ("src.data.analyze.fact_extraction_service",
                   "src.data.analyze.file_preparation_service",
                   "src.data.analyze.conflict_resolution_service",
                   "src.data.analyze.one_pager_service",
                   "src.data.diligence.report_service"):
        mod = sys.modules.get(module)
        if mod is None:
            continue
        for name, fn in (("complete_json", complete_json), ("respond_json", respond_json),
                         ("upload_file", upload_file)):
            if hasattr(mod, name):
                setattr(mod, name, fn)


def stage_dataroom() -> list[Document]:
    """Put the fixture documents where the pipeline expects to read them from."""
    storage = get_storage()
    documents = []
    for i, path in enumerate(sorted(DATAROOM.iterdir()), start=1):
        key = f"{COMPANY}/{AUTOMATION_ID}/{path.name}"
        storage.upload_bytes(key, path.read_bytes(), "application/octet-stream")
        documents.append(
            Document(id=f"00000000-0000-4000-8000-00000000010{i}",
                     url=f"gs://{storage.bucket_name}/{key}")
        )
    return documents


async def main() -> None:
    fixture_dir = ROOT / "fixtures" / "llm"
    if fixture_dir.exists():
        shutil.rmtree(fixture_dir)
    settings.llm_fixture_dir = str(fixture_dir)

    documents = stage_dataroom()
    print(f"Staged {len(documents)} documents into local storage")

    install_stub()

    await AnalyzeUseCase().execute(
        AnalyzeInput(company_id=COMPANY_ID, company_name=COMPANY,
                     automation_id=AUTOMATION_ID, documents=documents)
    )

    recorded = sorted(fixture_dir.glob("*.json"))
    print(f"\nRecorded {len(recorded)} LLM fixtures into {fixture_dir}")
    for path in recorded:
        print(f"  {json.loads(path.read_text())['purpose']:22} {path.name}")


if __name__ == "__main__":
    asyncio.run(main())
