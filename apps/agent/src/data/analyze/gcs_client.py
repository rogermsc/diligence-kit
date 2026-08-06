import os

from google.cloud import storage

from src.core.config import settings
from src.core.logging import get_logger

logger = get_logger(__name__)


_MAX_DOWNLOAD_BYTES = 500 * 1024 * 1024  # 500 MB


def _parse_gs_url(gs_url: str) -> tuple[str, str]:
    """Parse gs://bucket/path without urlparse (which mangles # in filenames)."""
    if not gs_url.startswith("gs://"):
        raise ValueError(f"Not a GCS URL: {gs_url}")
    without_scheme = gs_url[len("gs://"):]
    bucket_name, _, blob_path = without_scheme.partition("/")
    return bucket_name, blob_path


class GCSClient:
    def __init__(self):
        if settings.google_cloud_credentials:
            self._client = storage.Client.from_service_account_json(
                settings.google_cloud_credentials
            )
        else:
            self._client = storage.Client()
        self.bucket_name = settings.google_cloud_bucket_name

    def download(self, gs_url: str, dest_dir: str) -> str:
        """Download a GCS object to a local file. Returns the local file path."""
        bucket_name, blob_path = _parse_gs_url(gs_url)

        if bucket_name != self.bucket_name:
            raise ValueError(f"Bucket not allowed: {bucket_name}")

        file_name = os.path.basename(blob_path)

        bucket = self._client.bucket(bucket_name)
        blob = bucket.blob(blob_path)
        blob.reload()

        if blob.size and blob.size > _MAX_DOWNLOAD_BYTES:
            raise ValueError(f"File too large: {blob.size} bytes (max {_MAX_DOWNLOAD_BYTES})")

        local_path = os.path.join(dest_dir, file_name)
        blob.download_to_filename(local_path)

        logger.info(f"Downloaded gs://{bucket_name}/{blob_path} ({file_name})")
        return local_path

    def upload_json(self, blob_path: str, data: str, bucket_name: str = None) -> str:
        """Upload a JSON string to GCS. Returns the gs:// URL."""
        bucket_name = bucket_name or settings.google_cloud_bucket_name
        bucket = self._client.bucket(bucket_name)
        blob = bucket.blob(blob_path)
        blob.upload_from_string(data, content_type="application/json")

        gs_url = f"gs://{bucket_name}/{blob_path}"
        logger.info(f"Uploaded {gs_url}")
        return gs_url

    def blob_exists(self, blob_path: str) -> bool:
        bucket = self._client.bucket(self.bucket_name)
        return bucket.blob(blob_path).exists()

    def download_json(self, blob_path: str) -> str:
        bucket = self._client.bucket(self.bucket_name)
        blob = bucket.blob(blob_path)
        return blob.download_as_string().decode('utf-8')

    def upload_bytes(self, blob_path: str, data: bytes, content_type: str, bucket_name: str = None) -> str:
        """Upload raw bytes to GCS. Returns the gs:// URL."""
        bucket_name = bucket_name or settings.google_cloud_bucket_name
        bucket = self._client.bucket(bucket_name)
        blob = bucket.blob(blob_path)
        blob.upload_from_string(data, content_type=content_type)

        gs_url = f"gs://{bucket_name}/{blob_path}"
        logger.info(f"Uploaded {gs_url}")
        return gs_url
