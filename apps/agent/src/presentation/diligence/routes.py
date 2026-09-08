import httpx
from fastapi import APIRouter, Depends

from src.core.background import heartbeat, spawn
from src.core.config import settings
from src.core.failure import describe_failure
from src.core.logging import get_logger
from src.core.security import verify_api_key
from src.core.signing import build_headers, canonical_json
from src.domain.analyze.entities import Document, MergedFacts
from src.domain.diligence.entities import DiligenceInput, DiligenceReport
from src.domain.diligence.use_cases import DiligenceUseCase
from src.presentation.diligence.schemas import (
    DiligenceAutomation,
    DiligenceRequest,
    DiligenceResponse,
)

logger = get_logger(__name__)

router = APIRouter(prefix="/api/v1", tags=["diligence"])


@router.post("/diligence", response_model=DiligenceResponse, dependencies=[Depends(verify_api_key)])
async def diligence(payload: DiligenceRequest):
    for automation in payload.automations:
        spawn(
            _run_diligence(automation),
            name=f"diligence:{automation.domain}:{automation.automation_id}",
        )

    return DiligenceResponse(
        success=True,
        message=f"Diligence started for {len(payload.automations)} automation(s)",
    )


async def _run_diligence(automation: DiligenceAutomation):
    domain = automation.domain
    try:
        input = DiligenceInput(
            company_id=automation.company_id,
            company_name=automation.company_name,
            automation_id=automation.automation_id,
            domain=domain,
            documents=[Document(id=d.id, url=d.url, openai_file_id=d.openai_file_id) for d in automation.documents],
        )

        use_case = DiligenceUseCase(domain)
        async with heartbeat(
            lambda: _notify_backend_heartbeat(automation.automation_id),
            every=settings.heartbeat_seconds,
            name=f"diligence:{domain}:{automation.automation_id}",
        ):
            pdf_url, merged, report = await use_case.execute(input)

        await _notify_backend_complete(
            automation.automation_id, domain, pdf_url, merged, report
        )
    except Exception as e:
        logger.error(
            f"[{domain}] Diligence failed for automation {automation.automation_id}: {e}",
            exc_info=True,
        )
        await _notify_backend_error(
            automation.automation_id, domain, describe_failure(e)
        )


async def _notify_backend_heartbeat(automation_id: str) -> None:
    url = f"{settings.backend_base_url}/automation/heartbeat"
    body = canonical_json({"automationId": automation_id})
    async with httpx.AsyncClient() as client:
        await client.post(url, content=body, headers=build_headers(body), timeout=10.0)


async def _notify_backend_complete(
    automation_id: str,
    domain: str,
    report_url: str,
    merged: MergedFacts = None,
    report: DiligenceReport = None,
):
    url = f"{settings.backend_base_url}/automation/complete-report"
    payload = {
        "automationId": automation_id,
        "domain": domain,
        "status": "COMPLETED",
        "reportUrl": report_url,
    }
    if merged and report:
        # The same envelope the one-pager posts back, carrying the domain report
        # instead. Report.analysis has been waiting for it since the migration
        # that added the column described it as "written now, read later"; this
        # is later. Without it the four domain runs computed a full evidence
        # trail and shipped a PDF, and the trail was reachable by nothing.
        payload["analysis"] = {
            "version": 1,
            **merged.model_dump(),
            "report": report.model_dump(),
        }
    try:
        body = canonical_json(payload)
        async with httpx.AsyncClient() as client:
            response = await client.post(url, content=body, headers=build_headers(body), timeout=30.0)
            logger.info(
                f"[{domain}] Backend callback complete-report: {response.status_code}"
            )
    except Exception as e:
        logger.error(f"[{domain}] Backend callback complete-report failed: {e}")


async def _notify_backend_error(automation_id: str, domain: str, error: str):
    url = f"{settings.backend_base_url}/automation/complete-report-error"
    payload = {
        "automationId": automation_id,
        "domain": domain,
        "status": "FAILED",
        "error": error,
    }
    try:
        body = canonical_json(payload)
        async with httpx.AsyncClient() as client:
            response = await client.post(url, content=body, headers=build_headers(body), timeout=30.0)
            logger.info(
                f"[{domain}] Backend callback complete-report-error: {response.status_code}"
            )
    except Exception as e:
        logger.error(f"[{domain}] Backend callback error failed: {e}")
