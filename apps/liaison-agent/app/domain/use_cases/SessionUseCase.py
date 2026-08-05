import uuid
from app.domain.repositories.ChatRepository import IChatRepository

class SessionUseCase:
    def __init__(self, repository: IChatRepository):
        self.repository = repository

    async def get_or_create_session(self, user_id: str) -> str:
        """
        Retrieves the last active session for the user or creates a new one if none exists.
        """
        last_session = await self.repository.get_last_session_by_user(user_id)
        
        if last_session:
            return last_session
            
        return str(uuid.uuid4())

    def create_new_session(self, user_id: str) -> str:
        """
        Forces the creation of a new session ID for the given user.
        """
        return str(uuid.uuid4())

