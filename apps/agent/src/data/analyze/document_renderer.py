"""Renders OnePager data into a branded DOCX (via template) and converts to PDF."""

import asyncio
import os
import tempfile
from datetime import date
from io import BytesIO

from docxtpl import DocxTemplate

from src.core import soffice
from src.core.logging import get_logger
from src.domain.analyze.entities import OnePager

logger = get_logger(__name__)

TEMPLATE_PATH = os.path.normpath(os.path.join(os.path.dirname(__file__), "..", "..", "assets", "One_pager_template.docx"))

# Rendered into the template header/footer. Set REPORT_PREPARED_BY to your own firm name.
PREPARED_BY = os.getenv("REPORT_PREPARED_BY", "Your Organization")

# Map scorecard category names → template key suffixes
CATEGORY_KEY_MAP = {
    "Financial Readiness": "financial_readiness",
    "Product Maturity": "product_maturity",
    "Go-To-Market Engine": "go_to_market_engine",
    "Team & Leadership": "team_leadership",
    "Legal & Compliance": "legal_compliance",
    "Capital Structure": "capital_structure",
    "Market Positioning": "market_positioning",
    "ESG & Risk Factors": "esg_risk_factors",
}


def _build_render_context(one_pager: OnePager, company_name: str, automation_id: str) -> dict:
    """Map OnePager entity to the flat dict expected by the DOCX template."""
    ctx = {
        # Metadata
        "company_name": one_pager.company_overview.name,
        "document_id": f"DS-{automation_id[:8]}",
        "classification": "Confidential/Internal Use Only",
        "date_prepared": date.today().isoformat(),
        "prepared_by": PREPARED_BY,

        # Company Overview
        "company_industry": one_pager.company_overview.industry,
        "company_founded": one_pager.company_overview.founded,
        "company_hq": one_pager.company_overview.headquarters,
        "company_website": one_pager.company_overview.website,

        # Financial Metrics
        "fin_metric_revenue": one_pager.financial_highlights.annual_revenue,
        "fin_metric_ebitda": one_pager.financial_highlights.ebitda,
        "fin_metric_net_income": one_pager.financial_highlights.net_income,
        "fin_metric_assets": one_pager.financial_highlights.total_assets,
        "fin_metric_employees": one_pager.financial_highlights.employees,
        "fin_metric_projections": one_pager.financial_highlights.projections,

        # Business Metrics
        "biz_metric_market_pos": one_pager.business_metrics.market_position,
        "biz_metric_revenue_streams": one_pager.business_metrics.primary_revenue_streams,
        "biz_metric_geo_presence": one_pager.business_metrics.geographic_presence,
        "biz_metric_customer_base": one_pager.business_metrics.customer_base,
        "biz_metric_comp_advantages": one_pager.business_metrics.competitive_advantages,

        # Deal / Transaction
        "deal_category": one_pager.transaction_structure.category,
        "transaction_value": one_pager.transaction_structure.value,
        "payment_structure": one_pager.transaction_structure.payment,
        "deal_timeline": one_pager.transaction_structure.timeline,

        # Deal Rationale
        "strategic_objectives": one_pager.deal_rationale.strategic_objectives,
        "synergies_expected": one_pager.deal_rationale.synergies_expected,
        "market_rationale": one_pager.deal_rationale.market_rationale,

        # Key Terms
        "closing_conditions": one_pager.key_terms.closing_conditions,
        "due_diligence_period": one_pager.key_terms.due_diligence_period,
        "regulatory_approvals": one_pager.key_terms.regulatory_approvals,
        "financing": one_pager.key_terms.financing,

        # Scorecard overall
        "overall_weighted_score": one_pager.overall_score,

        # Executive Summary
        "executive_summary": one_pager.executive_summary,

        # Lists
        "critical_risk_factors": [
            f"{rf.risk}: {rf.mitigation}" for rf in one_pager.critical_risk_factors
        ],
        "key_success_factors": one_pager.key_success_factors,

        # Summary
        "summary_overall_score": one_pager.overall_score,
        "summary_transaction_value": one_pager.transaction_structure.value,
        "summary_primary_risk_areas": one_pager.summary_highlights.primary_risk_areas,
        "summary_key_strengths": one_pager.summary_highlights.key_strengths,
    }

    # Scorecard per-category fields: score_*, weighted_*, issues_*
    for cat in one_pager.scorecard:
        key = CATEGORY_KEY_MAP.get(cat.category)
        if not key:
            logger.warning(f"Unknown scorecard category: {cat.category}")
            continue
        ctx[f"score_{key}"] = cat.score
        ctx[f"weighted_{key}"] = cat.weighted_score
        ctx[f"issues_{key}"] = "\n".join(f"• {issue}" for issue in cat.key_issues) if cat.key_issues else "No critical issues identified."

    return ctx


def render_docx(one_pager: OnePager, company_name: str, automation_id: str) -> bytes:
    """Render OnePager into a branded DOCX using the template. Returns bytes."""
    ctx = _build_render_context(one_pager, company_name, automation_id)

    template = DocxTemplate(TEMPLATE_PATH)
    template.render(ctx)

    buffer = BytesIO()
    template.save(buffer)
    buffer.seek(0)
    docx_bytes = buffer.getvalue()
    buffer.close()

    logger.info(f"DOCX rendered: {len(docx_bytes)} bytes")
    return docx_bytes


# File I/O runs off the event loop: documents are converted concurrently, and a
# multi-megabyte blocking read stalls every other in-flight conversion.
def _write_bytes(path: str, data: bytes) -> None:
    with open(path, "wb") as f:
        f.write(data)


def _read_pdf(path: str) -> bytes | None:
    if not os.path.exists(path):
        return None
    with open(path, "rb") as f:
        return f.read()


async def convert_docx_to_pdf(docx_bytes: bytes) -> bytes:
    """Convert DOCX bytes to PDF using LibreOffice headless."""
    with tempfile.TemporaryDirectory() as temp_dir:
        docx_path = os.path.join(temp_dir, "input.docx")
        pdf_path = os.path.join(temp_dir, "input.pdf")

        await asyncio.to_thread(_write_bytes, docx_path, docx_bytes)

        # Give LibreOffice a writable per-call user profile. The container runs
        # as a non-root user whose HOME is not writable, so without this LO fails
        # to create its user installation (dconf/.cache permission denied) and
        # aborts. A per-call dir also avoids profile-lock contention between
        # concurrent conversions.
        lo_profile = os.path.join(temp_dir, "lo_profile")
        cmd = soffice.binary()
        process = await asyncio.create_subprocess_exec(
            cmd, f"-env:UserInstallation=file://{lo_profile}",
            "--headless", "--convert-to", "pdf",
            "--outdir", temp_dir, docx_path,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await process.communicate()

        pdf_bytes = await asyncio.to_thread(_read_pdf, pdf_path)
        if process.returncode != 0 or pdf_bytes is None:
            raise RuntimeError(f"DOCX to PDF conversion failed: {stderr.decode()}")

        logger.info(f"PDF converted: {len(pdf_bytes)} bytes")
        return pdf_bytes
