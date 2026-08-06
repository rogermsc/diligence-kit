"""The single place the agent talks to a language model.

Every call goes through here so that four things are true at once: models are
configured rather than hardcoded at the call site, any OpenAI-compatible provider
works via `OPENAI_BASE_URL`, a run can be recorded and replayed offline
(`LLM_DRIVER=replay`), and token usage is reported in one format.

Two entry points, because the pipeline genuinely needs both API shapes:
`complete_json` for plain system+user prompts, and `respond_json` for the
Responses API, which is what allows attaching an uploaded PDF to the request.
"""

import hashlib
import json
from pathlib import Path
from typing import Optional

import httpx
from openai import AsyncOpenAI

from src.core.config import settings
from src.core.logging import get_logger

logger = get_logger(__name__)


class ReplayMiss(RuntimeError):
    """No recorded response for this request."""


_client: Optional[AsyncOpenAI] = None


def _get_client() -> AsyncOpenAI:
    global _client
    if _client is None:
        _client = AsyncOpenAI(
            api_key=settings.openai_api_key,
            base_url=settings.openai_base_url,
            timeout=httpx.Timeout(180.0, connect=10.0),
            http_client=httpx.AsyncClient(
                limits=httpx.Limits(max_connections=100, max_keepalive_connections=50),
                timeout=httpx.Timeout(180.0, connect=10.0),
            ),
        )
    return _client


def model_for(purpose: str) -> str:
    """Resolve a purpose to its configured model."""
    try:
        return getattr(settings, f"llm_model_{purpose}")
    except AttributeError:
        raise ValueError(
            f"Unknown LLM purpose '{purpose}'. Add llm_model_{purpose} to Settings."
        ) from None


def _fixture_key(purpose: str, model: str, parts: list[str]) -> str:
    """Stable identity for a request.

    Only text is hashed. Uploaded-file ids are deliberately excluded: OpenAI
    returns a fresh id for every upload, so including them would make each
    recording match exactly one run and never replay. The prompt text carries the
    file name, which is the part that actually identifies the document.
    """
    digest = hashlib.sha256()
    digest.update(purpose.encode())
    digest.update(model.encode())
    for part in parts:
        digest.update(b"\x00")
        digest.update(part.encode())
    return digest.hexdigest()[:32]


def _fixture_path(key: str) -> Path:
    return Path(settings.llm_fixture_dir) / f"{key}.json"


def _read_fixture(key: str, purpose: str) -> str:
    path = _fixture_path(key)
    if not path.is_file():
        raise ReplayMiss(
            f"No recorded response for {purpose} ({key}). "
            f"Record one with LLM_DRIVER=openai LLM_RECORD=1, or add {path}."
        )
    logger.info(f"[replay] {purpose} ← {path.name}")
    return json.loads(path.read_text(encoding="utf-8"))["output"]


def _write_fixture(key: str, purpose: str, model: str, output: str) -> None:
    path = _fixture_path(key)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps({"purpose": purpose, "model": model, "output": output}, indent=2),
        encoding="utf-8",
    )
    logger.info(f"[record] {purpose} → {path.name}")


def _log_usage(purpose: str, model: str, usage) -> None:
    if not usage:
        return
    logger.info(
        f"[llm] {purpose} model={model} "
        f"in={getattr(usage, 'input_tokens', None) or getattr(usage, 'prompt_tokens', 0)} "
        f"out={getattr(usage, 'output_tokens', None) or getattr(usage, 'completion_tokens', 0)}"
    )


async def complete_json(purpose: str, user: str, system: str = "") -> str:
    """Chat-completions call constrained to a JSON object. Returns raw JSON text."""
    model = model_for(purpose)
    key = _fixture_key(purpose, model, [system, user])

    if settings.llm_driver == "replay":
        return _read_fixture(key, purpose)

    messages = [{"role": "user", "content": user}]
    if system:
        messages.insert(0, {"role": "system", "content": system})

    response = await _get_client().chat.completions.create(
        model=model,
        messages=messages,
        response_format={"type": "json_object"},
    )

    choice = response.choices[0]
    if choice.finish_reason != "stop":
        logger.warning(f"[llm] {purpose} finish_reason={choice.finish_reason}")
    _log_usage(purpose, model, response.usage)

    output = choice.message.content or ""
    if settings.llm_record:
        _write_fixture(key, purpose, model, output)
    return output


async def respond_json(purpose: str, instructions: str, content: list) -> str:
    """Responses-API call constrained to a JSON object.

    `content` is a list of input parts, which is how a pre-uploaded PDF gets
    attached alongside the prompt text.
    """
    model = model_for(purpose)
    text_parts = [p.get("text", "") for p in content if p.get("type") == "input_text"]
    key = _fixture_key(purpose, model, [instructions, *text_parts])

    if settings.llm_driver == "replay":
        return _read_fixture(key, purpose)

    response = await _get_client().responses.create(
        model=model,
        instructions=instructions,
        input=[{"role": "user", "content": content}],
        text={"format": {"type": "json_object"}},
    )
    _log_usage(purpose, model, getattr(response, "usage", None))

    output = response.output_text or ""
    if settings.llm_record:
        _write_fixture(key, purpose, model, output)
    return output


async def upload_file(file_name: str, data: bytes) -> str:
    """Upload a document for later reference by id. No-op under replay."""
    if settings.llm_driver == "replay":
        return f"replay-file-{hashlib.sha256(data).hexdigest()[:16]}"

    file = await _get_client().files.create(file=(file_name, data), purpose="user_data")
    return file.id
