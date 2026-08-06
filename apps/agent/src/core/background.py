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
import contextlib
from typing import AsyncIterator, Awaitable, Callable, Coroutine, Set

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
    """How many background tasks are running."""
    return len(_running)


@contextlib.asynccontextmanager
async def heartbeat(
    send: Callable[[], Awaitable[None]], *, every: float, name: str
) -> AsyncIterator[None]:
    """Pings `send` on an interval for as long as the body runs.

    The backend cannot otherwise tell a slow run from an abandoned one: nothing
    writes to the automation row between dispatch and completion, so its
    stale-run sweep had to guess from wall-clock and would fail runs that were
    still working.

    A failing ping is logged and never propagated — losing liveness is worth a
    timeout, not the loss of the run itself.
    """

    async def _loop() -> None:
        while True:
            await asyncio.sleep(every)
            try:
                await send()
            except Exception as error:  # noqa: BLE001 - liveness is best-effort
                logger.warning(f"Heartbeat failed for {name}: {error}")

    task = asyncio.create_task(_loop(), name=f"heartbeat:{name}")
    try:
        yield
    finally:
        task.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await task
