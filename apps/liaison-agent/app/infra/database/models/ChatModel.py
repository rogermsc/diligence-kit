from sqlalchemy import Column, DateTime, Integer, String, Text
from sqlalchemy.sql import func

from app.core.database.connection_database import Base


class ChatMessageModel(Base):
    __tablename__ = "chat_messages"

    id = Column(Integer, primary_key=True, autoincrement=True)
    session_id = Column(String, index=True, nullable=False)
    # No ForeignKey to users.id: that table is in the backend's database and
    # Postgres cannot reference across databases. Leaving it here is what made
    # Alembic emit a constraint that failed the documented upgrade.
    user_id = Column(String, nullable=False, index=True)  
    user_message = Column(Text, nullable=False)
    agent_response = Column(Text, nullable=False) 
    created_at = Column(DateTime(timezone=True), server_default=func.now())

