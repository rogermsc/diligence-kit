"""The chat request contract, and the company lookup it drives.

Both carry tenancy consequences: an absent user id used to pool conversations
under one shared identity, and the company lookup resolves a name read out of a
chat message straight into a company id.
"""

import inspect

import pytest
from pydantic import ValidationError

from app.domain.repositories.CompanyRepository import ICompanyRepository
from app.infra.database.repositories.CompanyRepositoryImpl import (
    CompanyRepositoryImpl,
)
from app.presentation.chat.dtos.ChatDto import ChatRequest


def test_a_request_without_a_user_is_refused():
    """It used to default to the literal "default_user", pooling every caller who
    omitted it into one identity — which the per-user history filter then treated
    as a single owner, so one user read another's conversations."""
    with pytest.raises(ValidationError):
        ChatRequest(message="hello")


def test_an_empty_user_is_refused_too():
    with pytest.raises(ValidationError):
        ChatRequest(message="hello", user_id="")


def test_a_request_with_a_user_is_accepted():
    request = ChatRequest(message="hello", user_id="user-1")

    assert request.user_id == "user-1"
    assert request.session_id is None


def test_company_lookups_require_an_owner():
    """Required rather than optional, so an unscoped lookup cannot be written.
    The name being matched comes out of a chat message, so matching across all
    tenants hands one caller another tenant's company id."""
    for method in ("get_company_by_name", "get_company_by_id"):
        parameters = inspect.signature(
            getattr(ICompanyRepository, method)
        ).parameters
        assert "owner_id" in parameters
        assert parameters["owner_id"].default is inspect.Parameter.empty


async def test_a_lookup_with_no_owner_returns_nothing_and_queries_nothing():
    class ExplodingSession:
        async def execute(self, *_args, **_kwargs):
            raise AssertionError("must not reach the database unscoped")

    repository = CompanyRepositoryImpl(ExplodingSession())

    assert await repository.get_company_by_name("Acme", "") is None
    assert await repository.get_company_by_id("some-id", "") is None


async def test_a_lookup_scopes_the_query_by_owner():
    captured = {}

    class RecordingSession:
        async def execute(self, query):
            captured["sql"] = str(query)

            class Result:
                @staticmethod
                def scalar_one_or_none():
                    return None

            return Result()

    repository = CompanyRepositoryImpl(RecordingSession())
    await repository.get_company_by_name("Acme", "owner-1")

    sql = captured["sql"]

    # Scoped to the owner, and case-insensitive (SQLAlchemy renders ilike as
    # lower(..) LIKE lower(..) on the default dialect).
    assert 'companies."ownerId" =' in sql
    assert "lower(companies.name) LIKE" in sql
    # The name comes out of a chat message and must stay a bound parameter
    # rather than being interpolated into the statement.
    assert "Acme" not in sql
