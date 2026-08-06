import json

import pytest

from src.core import llm
from src.core.config import settings


@pytest.fixture
def fixtures(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "llm_fixture_dir", str(tmp_path))
    return tmp_path


class FakeChat:
    """Stands in for the OpenAI client, recording what it was asked."""

    def __init__(self, output):
        self.output = output
        self.calls = []

    async def create(self, **kwargs):
        self.calls.append(kwargs)
        message = type("M", (), {"content": self.output})()
        choice = type("C", (), {"message": message, "finish_reason": "stop"})()
        return type("R", (), {"choices": [choice], "usage": None})()


def _install_fake_chat(monkeypatch, output):
    fake = FakeChat(output)
    client = type("Client", (), {"chat": type("Ch", (), {"completions": fake})()})()
    monkeypatch.setattr(llm, "_get_client", lambda: client)
    return fake


async def test_record_then_replay_returns_the_same_output(fixtures, monkeypatch):
    monkeypatch.setattr(settings, "llm_driver", "openai")
    monkeypatch.setattr(settings, "llm_record", True)
    _install_fake_chat(monkeypatch, '{"ok": true}')

    live = await llm.complete_json("one_pager", "user prompt", "system prompt")
    assert live == '{"ok": true}'
    assert len(list(fixtures.glob("*.json"))) == 1

    # Same request under replay must resolve from disk with no client at all.
    monkeypatch.setattr(settings, "llm_driver", "replay")
    monkeypatch.setattr(llm, "_get_client", _explode)

    assert await llm.complete_json("one_pager", "user prompt", "system prompt") == '{"ok": true}'


def _explode():
    raise AssertionError("replay must not construct a client")


async def test_replay_miss_names_the_purpose_and_the_fix(fixtures, monkeypatch):
    monkeypatch.setattr(settings, "llm_driver", "replay")

    with pytest.raises(llm.ReplayMiss) as err:
        await llm.complete_json("one_pager", "never recorded")

    assert "one_pager" in str(err.value)
    assert "LLM_RECORD=1" in str(err.value)


async def test_a_different_prompt_is_a_different_fixture(fixtures, monkeypatch):
    monkeypatch.setattr(settings, "llm_driver", "openai")
    monkeypatch.setattr(settings, "llm_record", True)
    _install_fake_chat(monkeypatch, "{}")

    await llm.complete_json("one_pager", "prompt A")
    await llm.complete_json("one_pager", "prompt B")

    assert len(list(fixtures.glob("*.json"))) == 2


async def test_changing_the_model_invalidates_the_recording(fixtures, monkeypatch):
    """A fixture recorded from one model must not be served for another, or a
    model change would silently replay the old model's answers."""
    monkeypatch.setattr(settings, "llm_driver", "openai")
    monkeypatch.setattr(settings, "llm_record", True)
    _install_fake_chat(monkeypatch, "{}")
    await llm.complete_json("one_pager", "same prompt")

    monkeypatch.setattr(settings, "llm_model_one_pager", "some-other-model")
    monkeypatch.setattr(settings, "llm_driver", "replay")

    with pytest.raises(llm.ReplayMiss):
        await llm.complete_json("one_pager", "same prompt")


def test_uploaded_file_ids_are_excluded_from_the_fixture_key():
    """OpenAI mints a fresh file id per upload. Keying on it would make every
    recording match exactly one run and never replay."""
    content_a = [
        {"type": "input_file", "file_id": "file-aaa"},
        {"type": "input_text", "text": "Extract facts from deck.pdf"},
    ]
    content_b = [
        {"type": "input_file", "file_id": "file-zzz"},
        {"type": "input_text", "text": "Extract facts from deck.pdf"},
    ]

    key = lambda c: llm._fixture_key(  # noqa: E731
        "fact_extraction",
        "gpt-5-mini",
        ["sys", *[p["text"] for p in c if p["type"] == "input_text"]],
    )
    assert key(content_a) == key(content_b)


def test_unknown_purpose_fails_loudly():
    with pytest.raises(ValueError, match="Unknown LLM purpose"):
        llm.model_for("not_a_real_purpose")


def test_purposes_used_by_the_pipeline_all_resolve():
    for purpose in (
        "fact_extraction",
        "conflict_resolution",
        "one_pager",
        "diligence_report",
    ):
        assert llm.model_for(purpose)


async def test_a_system_prompt_is_omitted_when_empty(fixtures, monkeypatch):
    """conflict_resolution sends a single user message; inserting an empty system
    turn would change the request that the live model sees."""
    monkeypatch.setattr(settings, "llm_driver", "openai")
    fake = _install_fake_chat(monkeypatch, "{}")

    await llm.complete_json("conflict_resolution", "just the user part")

    roles = [m["role"] for m in fake.calls[0]["messages"]]
    assert roles == ["user"]


async def test_upload_is_a_no_op_under_replay(monkeypatch):
    monkeypatch.setattr(settings, "llm_driver", "replay")
    monkeypatch.setattr(llm, "_get_client", _explode)

    file_id = await llm.upload_file("deck.pdf", b"%PDF-1.4")

    assert file_id.startswith("replay-file-")


async def test_fixture_records_the_model_it_came_from(fixtures, monkeypatch):
    monkeypatch.setattr(settings, "llm_driver", "openai")
    monkeypatch.setattr(settings, "llm_record", True)
    _install_fake_chat(monkeypatch, "{}")

    await llm.complete_json("one_pager", "prompt")

    recorded = json.loads(next(fixtures.glob("*.json")).read_text())
    assert recorded["purpose"] == "one_pager"
    assert recorded["model"] == settings.llm_model_one_pager
