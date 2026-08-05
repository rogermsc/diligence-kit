from sqlalchemy import Column, String
from app.core.database.connection_database import Base

class UserModel(Base):
    """
    Modelo parcial da tabela users apenas para satisfazer a ForeignKey do ChatMessage.
    Não será usado para queries, apenas para metadados do SQLAlchemy.
    """
    __tablename__ = "users"
    __table_args__ = {"extend_existing": True}

    id = Column(String, primary_key=True)

