from fastapi import FastAPI

from app.core.config.settings import settings
from app.core.Logs.logging import setup_logging
from app.presentation.chat.controller.ChatController import router as chat_router
from app.presentation.health.controller.HealthController import router as health_router
from app.presentation.session.controller.SessionController import router as session_router

logger = setup_logging()

app = FastAPI(
    title="Diligence Kit Liaison Agent",
    description="Intelligent Customer Service and Support Agent",
    version="0.1.0"
)

app.include_router(health_router)
app.include_router(chat_router)
app.include_router(session_router)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.ENV == "dev"
    )

