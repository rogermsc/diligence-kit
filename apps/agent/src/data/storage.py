"""Object storage seam.

The pipeline reads uploaded documents and writes facts, reports and PDFs. In
production that is Google Cloud Storage; locally it is a directory. Both speak
`gs://<bucket>/<key>` URLs — those URLs are persisted by the backend in
`documents.bucketPath` and passed back to this agent, so inventing a second URL
scheme for local would make stored paths non-portable between drivers.
"""

import os
import shutil
from pathlib import Path
from typing import Protocol

from src.core.config import settings
from src.core.logging import get_logger

logger = get_logger(__name__)


def parse_gs_url(gs_url: str) -> tuple[str, str]:
    """Parse gs://bucket/path without urlparse (which mangles # in filenames)."""
    if not gs_url.startswith("gs://"):
        raise ValueError(f"Not a GCS URL: {gs_url}")
    without_scheme = gs_url[len("gs://") :]
    bucket_name, _, blob_path = without_scheme.partition("/")
    return bucket_name, blob_path


class Storage(Protocol):
    bucket_name: str

    def download(self, gs_url: str, dest_dir: str) -> str: ...
    def upload_json(self, blob_path: str, data: str, bucket_name: str = None) -> str: ...
    def upload_bytes(
        self, blob_path: str, data: bytes, content_type: str, bucket_name: str = None
    ) -> str: ...
    def blob_exists(self, blob_path: str) -> bool: ...
    def download_json(self, blob_path: str) -> str: ...


class LocalStorage:
    """Filesystem implementation, so the agent runs with no cloud account."""

    def __init__(self):
        self._root = Path(settings.storage_local_root).resolve()
        self.bucket_name = settings.google_cloud_bucket_name or "local-bucket"
        self._root.mkdir(parents=True, exist_ok=True)

    def _resolve(self, blob_path: str) -> Path:
        """Map a key to a path, refusing anything that escapes the root.

        Keys are built from filenames that originate inside uploaded archives, so
        a `../` entry must not be able to read or write outside the data dir.
        """
        full = (self._root / blob_path.lstrip("/")).resolve()
        if full != self._root and self._root not in full.parents:
            raise ValueError(f"Path escapes storage root: {blob_path}")
        return full

    def download(self, gs_url: str, dest_dir: str) -> str:
        bucket_name, blob_path = parse_gs_url(gs_url)
        if bucket_name != self.bucket_name:
            raise ValueError(f"Bucket not allowed: {bucket_name}")

        src = self._resolve(blob_path)
        local_path = os.path.join(dest_dir, os.path.basename(blob_path))
        shutil.copyfile(src, local_path)
        logger.info(f"Read {gs_url} from local storage")
        return local_path

    def upload_json(self, blob_path: str, data: str, bucket_name: str = None) -> str:
        return self.upload_bytes(
            blob_path, data.encode("utf-8"), "application/json", bucket_name
        )

    def upload_bytes(
        self, blob_path: str, data: bytes, content_type: str, bucket_name: str = None
    ) -> str:
        full = self._resolve(blob_path)
        full.parent.mkdir(parents=True, exist_ok=True)
        full.write_bytes(data)

        url = f"gs://{bucket_name or self.bucket_name}/{blob_path}"
        logger.info(f"Wrote {url} to local storage")
        return url

    def blob_exists(self, blob_path: str) -> bool:
        return self._resolve(blob_path).is_file()

    def download_json(self, blob_path: str) -> str:
        return self._resolve(blob_path).read_text(encoding="utf-8")


def get_storage() -> Storage:
    if settings.storage_driver == "local":
        return LocalStorage()

    # Imported lazily: the GCS client resolves credentials on construction, which
    # a local-only run has none of.
    from src.data.analyze.gcs_client import GCSClient

    return GCSClient()
