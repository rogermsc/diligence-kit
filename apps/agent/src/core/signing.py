import hashlib
import hmac
import json


def canonical_json(payload: dict) -> bytes:
    return json.dumps(payload, separators=(",", ":"), sort_keys=True).encode("utf-8")


def sign_payload(body: bytes, secret: str) -> str:
    sig = hmac.new(secret.encode("utf-8"), body, hashlib.sha256).hexdigest()
    return f"sha256={sig}"
