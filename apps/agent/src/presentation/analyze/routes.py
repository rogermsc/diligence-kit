import asyncio
from typing import List

import httpx
import jwt
from fastapi import APIRouter, Depends

from src.core.config import settings
from src.core.security import verify_api_key
from src.core.signing import canonical_json, sign_payload
from src.core.logging import get_logger
from src.domain.analyze.entities import AnalyzeInput, Document, MergedFacts
from src.domain.analyze.use_cases import AnalyzeUseCase
from src.presentation.analyze.schemas import AnalyzeRequest, AnalyzeResponse

logger = get_logger(__name__)

router = APIRouter(prefix="/api/v1", tags=["analyze"])

analyze_use_case = AnalyzeUseCase()


@router.post("/analyze", response_model=AnalyzeResponse, dependencies=[Depends(verify_api_key)])
async def analyze(payload: AnalyzeRequest):
    input = AnalyzeInput(
        company_id=payload.company_id,
        company_name=payload.company_name,
        automation_id=payload.automation_id,
        documents=[Document(id=d.id, url=d.url, openai_file_id=d.openai_file_id) for d in payload.documents],
        retry=payload.retry,
    )

    asyncio.create_task(_run_analysis(input))

    return AnalyzeResponse(
        success=True,
        message="Request received and processing started",
        automation_id=payload.automation_id,
    )


async def _run_analysis(input: AnalyzeInput):
    try:
        pdf_url, documents, merged = await analyze_use_case.execute(input)
        await _notify_backend(input.automation_id, pdf_url, documents, merged)
    except Exception as e:
        logger.error(f"Analysis failed for automation {input.automation_id}: {e}", exc_info=True)
        await _notify_backend_error(input.automation_id, "processing_failed")


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


async def _notify_backend(automation_id: str, one_pager_url: str, documents: List[Document] = None, merged: MergedFacts = None):
    url = f"{settings.backend_base_url}/automation/complete-onepager"
    payload = {
        "automationId": automation_id,
        "onePagerUrl": one_pager_url,
    }
    if documents:
        file_ids = [
            {"documentId": d.id, "openaiFileId": d.openai_file_id}
            for d in documents if d.openai_file_id
        ]
        if file_ids:
            payload["fileIds"] = file_ids
    if merged:
        payload["coverage"] = list(merged.coverage.keys())
        payload["missing"] = merged.missing
    try:
        body = canonical_json(payload)
        async with httpx.AsyncClient() as client:
            response = await client.post(url, content=body, headers=_build_headers(body), timeout=30.0)
            logger.info(f"Backend callback complete_onepager: {response.status_code}")
    except Exception as e:
        logger.error(f"Backend callback failed: {e}")


async def _notify_backend_error(automation_id: str, error: str):
    url = f"{settings.backend_base_url}/automation/complete-onepager-error"
    payload = {
        "automationId": automation_id,
        "error": error,
    }
    try:
        body = canonical_json(payload)
        async with httpx.AsyncClient() as client:
            response = await client.post(url, content=body, headers=_build_headers(body), timeout=30.0)
            logger.info(f"Backend callback error: {response.status_code}")
    except Exception as e:
        logger.error(f"Backend error callback failed: {e}")
