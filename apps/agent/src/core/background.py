"""Keeps background work alive for as long as it runs.

`asyncio.create_task` returns a task the event loop holds only weakly. Nothing
else referenced these, so a pipeline run could be garbage collected part-way
through — documented behaviour, and the reason CPython's own docs say to keep a
reference. The failure is silent: the automation simply stops, the backend is
never called back, and the row sits in PROCESSING forever.

This is not durability. A process restart still loses in-flight work; the
backend's reaper is what notices. It removes one way for work to vanish while
the process is perfectly healthy.
"""

import asyncio
from typing import Coroutine, Set

from src.core.logging import get_logger

logger = get_logger(__name__)

_running: Set[asyncio.Task] = set()


def spawn(coro: Coroutine, *, name: str) -> asyncio.Task:
    """Run a coroutine in the background, holding a reference until it finishes."""
    task = asyncio.create_task(coro, name=name)
    _running.add(task)

    def _done(finished: asyncio.Task) -> None:
        _running.discard(finished)
        if finished.cancelled():
            # `except Exception` does not catch CancelledError, so a cancelled
            # run would otherwise leave no trace at all.
            logger.error(f"Background task cancelled before completion: {name}")
            return
        error = finished.exception()
        if error:
            logger.error(f"Background task failed: {name}: {error}", exc_info=error)

    task.add_done_callback(_done)
    return task


def in_flight() -> int:
    """How many background tasks are running. Reported by the health endpoint."""
    return len(_running)
