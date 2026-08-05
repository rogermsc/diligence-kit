from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.sql import func
from app.core.database.connection_database import Base
from app.infra.database.models.UserModel import UserModel

class ChatMessageModel(Base):
    __tablename__ = "chat_messages"

    id = Column(Integer, primary_key=True, autoincrement=True)
    session_id = Column(String, index=True, nullable=False)
    user_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)  
    user_message = Column(Text, nullable=False)
    agent_response = Column(Text, nullable=False) 
    created_at = Column(DateTime(timezone=True), server_default=func.now())

