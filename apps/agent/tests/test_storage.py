import pytest

from src.core.config import settings
from src.data.storage import LocalStorage, parse_gs_url


@pytest.fixture
def storage(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "storage_local_root", str(tmp_path))
    monkeypatch.setattr(settings, "google_cloud_bucket_name", "test-bucket")
    return LocalStorage()


def test_roundtrip_keeps_the_gs_url_shape(storage):
    """Stored URLs must stay portable between the local and GCS drivers."""
    url = storage.upload_json("agent-facts/abc/facts.json", '{"a": 1}')

    assert url == "gs://test-bucket/agent-facts/abc/facts.json"
    assert storage.blob_exists("agent-facts/abc/facts.json")
    assert storage.download_json("agent-facts/abc/facts.json") == '{"a": 1}'


def test_missing_blob_is_absent_not_an_error(storage):
    assert storage.blob_exists("nope/missing.json") is False


def test_download_copies_out_of_storage(storage, tmp_path):
    storage.upload_bytes("docs/report.pdf", b"%PDF-1.4", "application/pdf")
    dest = tmp_path / "out"
    dest.mkdir()

    local = storage.download("gs://test-bucket/docs/report.pdf", str(dest))

    assert open(local, "rb").read() == b"%PDF-1.4"


def test_download_refuses_a_foreign_bucket(storage, tmp_path):
    with pytest.raises(ValueError, match="Bucket not allowed"):
        storage.download("gs://someone-elses-bucket/docs/x.pdf", str(tmp_path))


@pytest.mark.parametrize("key", ["../escaped.json", "a/../../escaped.json"])
def test_traversal_cannot_escape_the_root(storage, key):
    """Keys derive from filenames inside uploaded archives, so `../` is reachable
    by an attacker and must not read or write outside the data directory."""
    with pytest.raises(ValueError, match="escapes storage root"):
        storage.upload_json(key, "{}")


def test_absolute_looking_keys_are_contained_not_honoured(storage, tmp_path):
    """A GCS key is an opaque string, so a leading slash is normalised away rather
    than treated as a filesystem root — writing to /etc/passwd is not an option."""
    url = storage.upload_json("/etc/passwd", "{}")

    assert url == "gs://test-bucket//etc/passwd"
    assert (tmp_path / "etc/passwd").is_file()


def test_parse_gs_url_keeps_hash_in_filenames():
    """urlparse would truncate at '#'; filenames legitimately contain it."""
    assert parse_gs_url("gs://b/dir/Q1 #2 report.pdf") == ("b", "dir/Q1 #2 report.pdf")


def test_parse_gs_url_rejects_other_schemes():
    with pytest.raises(ValueError):
        parse_gs_url("https://example.com/x.pdf")
