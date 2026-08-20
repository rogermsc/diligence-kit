"""`.csv` and `.txt` pass the upload gates but used to be dropped here.

The dataroom filter in the dashboard has always accepted them, so they uploaded
successfully, were logged as unsupported, and never reached extraction — a
dataroom of CSV exports analysed as an empty dataroom.
"""

import pytest

from src.core.config import settings
from src.data.analyze import extraction_service as extraction
from src.data.analyze.extraction_service import (
    SUPPORTED_EXTENSIONS,
    ExtractionService,
    _read_text,
)
from src.domain.analyze.entities import Document


@pytest.fixture
def prepared(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "storage_local_root", str(tmp_path))
    monkeypatch.setattr(settings, "google_cloud_bucket_name", "local-bucket")
    monkeypatch.setattr(settings, "storage_driver", "local")

    from src.data.storage import LocalStorage

    storage = LocalStorage()

    def write(name: str, data: bytes):
        storage.upload_bytes(f"dataroom/{name}", data, "text/plain")
        service = ExtractionService()
        return service._prepare_one(
            Document(id="doc-1", url=f"gs://local-bucket/dataroom/{name}")
        )

    return write


@pytest.mark.parametrize("ext", [".csv", ".txt"])
def test_the_extensions_the_upload_path_accepts_are_supported(ext):
    assert ext in SUPPORTED_EXTENSIONS


def test_a_csv_is_read_as_text_rather_than_dropped(prepared):
    result = prepared("financials.csv", b"period,revenue\nFY2024,3200000\n")

    assert len(result) == 1
    assert "FY2024,3200000" in result[0].text_content
    # Text goes to the model directly; there is no PDF to render or upload.
    assert result[0].pdf_data is None


def test_a_txt_is_read_as_text(prepared):
    result = prepared("notes.txt", b"Auditor flagged going concern.")

    assert result[0].text_content == "Auditor flagged going concern."


def test_an_empty_text_file_yields_nothing(prepared):
    assert prepared("blank.csv", b"   \n  \n") == []


def test_an_unsupported_extension_is_still_refused(prepared):
    assert prepared("archive.rar", b"whatever") == []


@pytest.mark.parametrize(
    "raw,expected",
    [
        ("café".encode("utf-8"), "café"),
        ("café".encode("utf-8-sig"), "café"),
        ("café".encode("cp1252"), "café"),
        (b"\xff\xfe\x00rubbish", None),  # decodes rather than raising
    ],
)
def test_text_survives_an_unexpected_encoding(tmp_path, raw, expected):
    """Datarooms carry exports from every locale. Raising here would lose the
    whole document rather than a few characters."""
    path = tmp_path / "x.csv"
    path.write_bytes(raw)

    result = _read_text(str(path))

    assert isinstance(result, str)
    if expected is not None:
        assert result == expected


def test_the_pre_upload_step_skips_text_files():
    """There is no PDF to send to the Files API, and trying wastes a download."""
    from src.data.analyze.file_preparation_service import TEXT_EXTENSIONS

    assert {".csv", ".txt"} == TEXT_EXTENSIONS
    assert extraction.TEXT_EXTENSIONS is TEXT_EXTENSIONS


# --- a figure that does not carry its own scale --------------------------------

from src.data.analyze.fact_extraction_service import _has_no_unit  # noqa: E402


@pytest.mark.parametrize("value", [
    "$ 98,011",                 # eGain: the unit is in a column header, not the row
    "963,708",
    "$ (2,441)",
])
def test_a_bare_figure_is_flagged_as_carrying_no_unit(value):
    # authority.parse_amount reads these literally, so a revenue stated "in
    # thousands" by one document and "£98.0M" by another would look like a
    # thousand-fold disagreement instead of agreement.
    assert _has_no_unit(value) is True


@pytest.mark.parametrize("value", [
    "£3.2M",
    "$281.7 billion",
    "$ 963,708 (Dollars in thousands)",
    "(£0.31M) FY2024",
])
def test_a_figure_that_states_its_scale_is_not_flagged(value):
    assert _has_no_unit(value) is False


def test_a_bare_count_is_only_spared_because_it_is_not_a_financial_field():
    # "52" employees needs no scale, and this predicate would flag it. What
    # keeps headcount quiet is the caller: only fields matching a financial
    # prefix are checked at all.
    assert _has_no_unit("52") is True


def test_prose_without_a_number_is_not_a_unit_problem():
    assert _has_no_unit("Warehouse automation for third-party logistics") is False
