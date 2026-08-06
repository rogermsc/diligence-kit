from fastapi import APIRouter

from app.presentation.health.dtos.HealthDto import HealthResponse

router = APIRouter(tags=["Health"])

@router.get("/health", response_model=HealthResponse)
async def health_check():
    return HealthResponse(status="ok", version="0.1.0")

