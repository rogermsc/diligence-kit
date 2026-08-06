"""Settings validate on import, so the environment has to be in place before any
`app.*` module is imported — including by collection.
"""

import os

os.environ.setdefault("API_KEY", "test-api-key")
os.environ.setdefault("GOOGLE_CLOUD_PROJECT_ID", "test-project")
os.environ.setdefault(
    "DATABASE_URL", "postgresql+asyncpg://user:pass@localhost:5432/test"
)
