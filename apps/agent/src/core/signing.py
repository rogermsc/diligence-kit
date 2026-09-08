"""How the agent proves a callback came from it, and when.

The signature used to cover the body alone, which made every captured callback
valid forever. The damaging replay is `complete-onepager-error`: the backend
applies it unconditionally, so a months-old error callback would flip a
COMPLETED automation to FAILED. Binding a timestamp into the signed material
and rejecting stale ones closes that, and costs one header.

`build_headers` lives here rather than in each route module because it was
written out twice, identically, in presentation/analyze and
presentation/diligence — and a signing scheme that exists in two places is one
that gets upgraded in one of them.
"""

import hashlib
import hmac
import json
import time

import jwt

from src.core.config import settings


def canonical_json(payload: dict) -> bytes:
    return json.dumps(payload, separators=(",", ":"), sort_keys=True).encode("utf-8")


def sign_payload(body: bytes, secret: str, timestamp: str) -> str:
    """HMAC over "<timestamp>.<body>", so a signature is only good for a window.

    The separator is a character that cannot appear in the decimal timestamp, so
    there is exactly one way to split the signed material — without it,
    timestamp "1" + body "23..." and timestamp "12" + body "3..." would sign
    identically.
    """
    signed = timestamp.encode("utf-8") + b"." + body
    sig = hmac.new(secret.encode("utf-8"), signed, hashlib.sha256).hexdigest()
    return f"sha256={sig}"


def build_jwt_token() -> str:
    return jwt.encode(
        {"sub": "agent", "service": "diligence-kit-agent"},
        settings.agent_secret,
        algorithm="HS256",
    )


def build_headers(body: bytes) -> dict:
    timestamp = str(int(time.time()))
    return {
        "Authorization": f"Bearer {build_jwt_token()}",
        "X-Webhook-Signature": sign_payload(body, settings.webhook_secret, timestamp),
        "X-Webhook-Timestamp": timestamp,
        "Content-Type": "application/json",
    }
