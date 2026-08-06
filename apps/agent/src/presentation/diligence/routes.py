import httpx
import jwt
from fastapi import APIRouter, Depends

from src.core.background import heartbeat, spawn
from src.core.config import settings
from src.core.logging import get_logger
from src.core.security import verify_api_key
from src.core.signing import canonical_json, sign_payload
from src.domain.analyze.entities import Document
from src.domain.diligence.entities import DiligenceInput
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
            pdf_url = await use_case.execute(input)

        await _notify_backend_complete(automation.automation_id, domain, pdf_url)
    except Exception as e:
        logger.error(
            f"[{domain}] Diligence failed for automation {automation.automation_id}: {e}",
            exc_info=True,
        )
        await _notify_backend_error(automation.automation_id, domain, "processing_failed")


async def _notify_backend_heartbeat(automation_id: str) -> None:
    url = f"{settings.backend_base_url}/automation/heartbeat"
    body = canonical_json({"automationId": automation_id})
    async with httpx.AsyncClient() as client:
        await client.post(url, content=body, headers=_build_headers(body), timeout=10.0)


def _build_jwt_token() -> str:
    return jwt.encode(
        {"sub": "agent", "service": "diligence-kit-agent"},
        settings.agent_secret,
        algorithm="HS256",
    )


def _build_headers(body: bytes) -> dict:
    return {
        "Authorization": f"Bearer {_build_jwt_token()}",
        "X-Webhook-Signature": sign_payload(body, settings.webhook_secret),
        "Content-Type": "application/json",
    }


async def _notify_backend_complete(
    automation_id: str, domain: str, report_url: str
):
    url = f"{settings.backend_base_url}/automation/complete-report"
    payload = {
        "automationId": automation_id,
        "domain": domain,
        "status": "COMPLETED",
        "reportUrl": report_url,
    }
    try:
        body = canonical_json(payload)
        async with httpx.AsyncClient() as client:
            response = await client.post(url, content=body, headers=_build_headers(body), timeout=30.0)
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
            response = await client.post(url, content=body, headers=_build_headers(body), timeout=30.0)
            logger.info(
                f"[{domain}] Backend callback complete-report-error: {response.status_code}"
            )
    except Exception as e:
        logger.error(f"[{domain}] Backend callback error failed: {e}")
