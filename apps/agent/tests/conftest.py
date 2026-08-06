"""`src.core.config` builds a Settings instance at import time and raises if the
service secrets are absent, so every value has to be in the environment before
any `src.*` module is imported — including by collection.
"""

import os

os.environ.setdefault("OPENAI_API_KEY", "test-key")
os.environ.setdefault("AGENT_SECRET", "a" * 32)
os.environ.setdefault("WEBHOOK_SECRET", "b" * 32)
os.environ.setdefault("API_KEY", "c" * 32)
os.environ.setdefault("BACKEND_BASE_URL", "http://localhost:3001")
os.environ.setdefault("GOOGLE_CLOUD_BUCKET_NAME", "test-bucket")
os.environ.setdefault("STORAGE_DRIVER", "local")
os.environ.setdefault("LLM_DRIVER", "replay")
