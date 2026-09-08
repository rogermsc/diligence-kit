"""What to tell the backend when a run fails.

Every failure used to post back the constant "processing_failed", so the screen
said FAILED and support learned nothing: a crashed agent, a document that would
not parse and an unreachable model were one message.

The exception type and its message, and nothing else. A traceback here would
carry file paths and, worse, quoted document text — the payload validator
already learned that lesson by logging a whole dataroom into the sink the
liaison agent reads back.
"""

MAX_REASON_CHARS = 500


def describe_failure(exc: BaseException) -> str:
    """One line naming what broke, safe to show a user."""
    message = " ".join(str(exc).split())
    if not message:
        return type(exc).__name__
    reason = f"{type(exc).__name__}: {message}"
    if len(reason) > MAX_REASON_CHARS:
        reason = reason[: MAX_REASON_CHARS - 1] + "\u2026"
    return reason
