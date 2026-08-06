from fastapi import APIRouter, Depends, Security
from sqlalchemy.ext.asyncio import AsyncSession

from app.infra.di.Container import DIContainer, get_container_db
from app.presentation.middleware.security.Auth import verify_service_account
from app.presentation.session.dtos.SessionDto import SessionRequest, SessionResponse

router = APIRouter(prefix="/session", tags=["Session"])

@router.get("/last", response_model=SessionResponse)
async def get_or_create_session(
    user_id: str,
    auth: dict = Security(verify_service_account),
    db: AsyncSession = Depends(get_container_db)
):
    """
    Retrieves the last session for the user or creates a new one.
    """
    use_case = DIContainer.get_session_use_case(db)
    session_id = await use_case.get_or_create_session(user_id)
    return SessionResponse(session_id=session_id)

@router.post("/create", response_model=SessionResponse)
async def start_new_session(
    request: SessionRequest,
    auth: dict = Security(verify_service_account),
    db: AsyncSession = Depends(get_container_db)
):
    """
    Forces the generation of a new unique session ID.
    This ID should be stored by the frontend and sent in subsequent chat requests.
    """
    use_case = DIContainer.get_session_use_case(db)
    new_session_id = use_case.create_new_session(request.user_id)
    return SessionResponse(session_id=new_session_id)

