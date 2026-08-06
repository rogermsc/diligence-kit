from sqlalchemy import Column, String

from app.core.database.connection_database import Base


class CompanyModel(Base):
    """
    Partial model of the companies table for log lookup.
    Will not be used for complete CRUD operations, only for queries.
    """
    __tablename__ = "companies"
    __table_args__ = {"extend_existing": True}

    id = Column(String, primary_key=True)
    name = Column(String, nullable=False)
    # The tenancy root. Every company lookup here must be scoped by it: this
    # agent resolves companies from names it reads out of chat messages, and an
    # unscoped match would hand one tenant another tenant's company id.
    owner_id = Column("ownerId", String, nullable=False)
