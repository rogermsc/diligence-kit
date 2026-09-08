from fastapi import APIRouter, Depends, Security

from app.domain.use_cases.SessionUseCase import SessionUseCase
from app.infra.di.Container import get_session_use_case
from app.presentation.middleware.security.Auth import verify_service_account
from app.presentation.session.dtos.SessionDto import SessionRequest, SessionResponse

router = APIRouter(prefix="/session", tags=["Session"])

@router.get("/last", response_model=SessionResponse)
async def get_or_create_session(
    user_id: str,
    auth: dict = Security(verify_service_account),
    use_case: SessionUseCase = Depends(get_session_use_case),
):
    """
    Retrieves the last session for the user or creates a new one.
    """
    session_id = await use_case.get_or_create_session(user_id)
    return SessionResponse(session_id=session_id)

@router.post("/create", response_model=SessionResponse)
async def start_new_session(
    request: SessionRequest,
    auth: dict = Security(verify_service_account),
    use_case: SessionUseCase = Depends(get_session_use_case),
):
    """
    Forces the generation of a new unique session ID.
    This ID should be stored by the frontend and sent in subsequent chat requests.
    """
    new_session_id = use_case.create_new_session(request.user_id)
    return SessionResponse(session_id=new_session_id)

