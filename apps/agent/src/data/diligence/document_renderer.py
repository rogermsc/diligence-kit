"""Renders diligence report data into a branded DOCX (via template) and converts to PDF."""

import os
from io import BytesIO

from docxtpl import DocxTemplate

from src.core.logging import get_logger
from src.data.analyze.document_renderer import PREPARED_BY
from src.domain.diligence.entities import DiligenceReport

logger = get_logger(__name__)

TEMPLATES_DIR = os.path.normpath(
    os.path.join(os.path.dirname(__file__), "..", "..", "templates")
)

DOMAIN_TEMPLATE_MAP = {
    "OPERATIONAL": "Operational_Due_Diligence_Report_Template.docx",
    "COMMERCIAL": "Commercial_Due_Diligence_Market_Sizing_Template.docx",
    "FINANCIAL": "Financial_Due_Diligence_Report_Template.docx",
    "CAP_TABLE_AND_LEGAL_REVIEW": "Cap_Table_Legal_Document_Review_Template.docx",
}


def render_diligence_docx(domain: str, report: DiligenceReport) -> bytes:
    """Render a diligence report into a branded DOCX using the domain template. Returns bytes."""
    template_name = DOMAIN_TEMPLATE_MAP[domain]
    template_path = os.path.join(TEMPLATES_DIR, template_name)

    # Flatten Pydantic model to dict — all fields are strings, matching template variables.
    # prepared_by is not part of the report; the template footer renders it.
    ctx = {**report.model_dump(), "prepared_by": PREPARED_BY}

    template = DocxTemplate(template_path)
    template.render(ctx)

    buffer = BytesIO()
    template.save(buffer)
    buffer.seek(0)
    docx_bytes = buffer.getvalue()
    buffer.close()

    logger.info(f"[{domain}] DOCX rendered: {len(docx_bytes)} bytes")
    return docx_bytes
