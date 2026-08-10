"""End-to-end run of the analysis pipeline, offline.

Every LLM call is served from the committed fixtures and every document is read
from the committed dataroom, so this exercises the real use case — preparation,
extraction, merge, conflict resolution, synthesis, scoring — with no API key, no
bucket and no network. It is also the test that catches a prompt edit: change a
prompt and the fixture key changes, replay misses, and this fails loudly instead
of the demo quietly degrading.
"""

import pathlib

import pytest

from src.core.config import settings
from src.data.analyze import document_renderer
from src.domain.analyze.entities import AnalyzeInput, Document
from src.domain.analyze.use_cases import AnalyzeUseCase

ROOT = pathlib.Path(__file__).resolve().parents[1]
DATAROOM = ROOT / "fixtures" / "dataroom"
COMPANY = "Northwind Robotics"
COMPANY_ID = "00000000-0000-4000-8000-000000000002"
AUTOMATION_ID = "00000000-0000-4000-8000-000000000001"


@pytest.fixture
def pipeline(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "llm_driver", "replay")
    monkeypatch.setattr(settings, "llm_fixture_dir", str(ROOT / "fixtures" / "llm"))
    monkeypatch.setattr(settings, "storage_driver", "local")
    monkeypatch.setattr(settings, "storage_local_root", str(tmp_path))
    monkeypatch.setattr(settings, "google_cloud_bucket_name", "local-bucket")

    # LibreOffice renders the PDF and is not present everywhere; the DOCX render
    # before it still runs, so template breakage is still caught.
    async def _no_pdf(docx_bytes):
        return b"%PDF-1.4 stub"

    monkeypatch.setattr(document_renderer, "convert_docx_to_pdf", _no_pdf)
    monkeypatch.setattr(
        "src.domain.analyze.use_cases.convert_docx_to_pdf", _no_pdf
    )

    from src.data.storage import LocalStorage

    storage = LocalStorage()
    documents = []
    for i, path in enumerate(sorted(DATAROOM.iterdir()), start=1):
        key = f"{COMPANY_ID}/{AUTOMATION_ID}/{path.name}"
        storage.upload_bytes(key, path.read_bytes(), "application/octet-stream")
        documents.append(
            Document(
                id=f"00000000-0000-4000-8000-00000000010{i}",
                url=f"gs://local-bucket/{key}",
            )
        )
    return documents


async def run(documents):
    return await AnalyzeUseCase().execute(
        AnalyzeInput(
            company_id=COMPANY_ID,
            company_name=COMPANY,
            automation_id=AUTOMATION_ID,
            documents=documents,
        )
    )


async def test_the_whole_pipeline_runs_with_no_network(pipeline):
    pdf_url, _, merged = await run(pipeline)

    assert pdf_url == f"gs://local-bucket/one-pagers/{AUTOMATION_ID}.pdf"
    assert merged.facts, "extraction produced nothing"


async def test_the_planted_revenue_disagreement_is_caught(pipeline):
    """Three documents state FY2024 revenue three ways. Finding that is the
    product; a pipeline that reports one number and moves on has failed."""
    _, _, merged = await run(pipeline)

    conflict = next(c for c in merged.conflicts if c.field == "annual_revenue_fy2024")
    joined = " ".join(conflict.values)

    assert "£4.1M" in joined and "£3.8M" in joined and "£3.2M" in joined
    # The audited actual wins over the deck's pro-forma and the model's run-rate.
    assert conflict.preferred_value == "£3.2M"


async def test_facts_keep_the_document_they_came_from(pipeline):
    _, _, merged = await run(pipeline)

    revenue = merged.facts["annual_revenue_fy2024"]
    sources = {f.source for f in revenue}

    assert any("pitch_deck" in s for s in sources)
    assert any("audited_accounts" in s for s in sources)
    assert all(f.quote for f in revenue), "a fact with no quote cannot be checked"


async def test_every_quote_is_checked_against_the_document_it_cites(pipeline):
    """A citation nobody checked is decoration.

    The PDF half of this is the part that used to be impossible: Step 0 uploads
    each PDF and keeps only the file_id, so by extraction time there were no
    bytes left to check a quote against. The text layer now rides along.
    """
    _, _, merged = await run(pipeline)
    facts = [f for fs in merged.facts.values() for f in fs]

    assert all(f.grounding for f in facts), "every fact is classified"
    assert all(f.quote_verified is not None for f in facts), (
        "every document in this dataroom is machine-readable, so no fact should "
        "come back unverifiable"
    )

    for name in ("01_pitch_deck.pdf", "04_audited_accounts.pdf"):
        from_pdf = [f for f in facts if f.source == name]
        assert from_pdf and all(f.quote_verified for f in from_pdf), (
            f"{name}: quotes should be found verbatim in the PDF text layer"
        )


async def test_the_recorded_fixtures_misattribute_nine_excel_facts(pipeline):
    """A known defect in the committed fixtures, kept visible on purpose.

    Excel is extracted one sheet per document. The recorded response for
    `02_financial_model.xlsx (Pipeline)` — a sheet holding nothing but sales
    accounts and close quarters — returns revenue, EBITDA and headcount quoted
    verbatim from the Summary sheet. `(Terms)` does the same with the Cap Table
    sheet's shareholder rows. The model cited content it was never shown.

    It matters beyond the wrong page reference: the same fact now arrives from
    two apparently different sources, so a merge that counts sources reads it as
    corroboration. One sheet double-counted looks exactly like two documents
    agreeing, in a product whose whole job is adjudicating between documents.

    The fix is to re-record (`make fixtures`); this test should then fail and be
    deleted. Until then, asserting the exact shape stops it drifting quietly.
    """
    _, _, merged = await run(pipeline)
    facts = [f for fs in merged.facts.values() for f in fs]

    misattributed = {f.source for f in facts if f.quote_verified is False}
    assert misattributed == {
        "02_financial_model.xlsx (Pipeline)",
        "03_cap_table.xlsx (Terms)",
    }
    assert sum(1 for f in facts if f.quote_verified is False) == 9


async def test_a_difference_of_basis_is_not_reported_as_a_contradiction(pipeline):
    """Year-end headcount of 52 and a 49 average are both true. Flagging that as
    a conflict would bury the revenue one in noise."""
    _, _, merged = await run(pipeline)

    assert not any(c.field == "employees" for c in merged.conflicts)


async def test_absent_information_is_reported_rather_than_assumed(pipeline):
    """The dataroom has no contracts, insurance or policies. Saying so is what
    turns the run into a document request list."""
    _, _, merged = await run(pipeline)

    assert "cap_table" in merged.coverage
    assert {"insurance", "policies", "client_contracts"} <= set(merged.missing)


async def test_a_changed_prompt_invalidates_the_fixtures(pipeline, monkeypatch):
    """Guards the guard: if replay silently fell back to something, none of the
    tests above would mean anything."""
    from src.core import llm
    from src.core.prompts import one_pager as one_pager_prompts

    monkeypatch.setattr(
        one_pager_prompts, "ONE_PAGER_SYSTEM_PROMPT", "changed {current_date}"
    )
    monkeypatch.setattr(
        "src.data.analyze.one_pager_service.ONE_PAGER_SYSTEM_PROMPT",
        "changed {current_date}",
    )

    with pytest.raises(llm.ReplayMiss):
        await run(pipeline)
