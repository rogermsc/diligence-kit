"""`asyncio.create_task` returns a task the loop holds only weakly, so a run with
no reference to it can be collected part-way through — silently, leaving the
automation in PROCESSING forever.
"""

import asyncio

import pytest

from src.core import background


async def test_a_task_with_no_caller_reference_still_completes():
    done = asyncio.Event()

    async def work():
        await asyncio.sleep(0)
        done.set()

    background.spawn(work(), name="test:completes")  # deliberately not held

    await asyncio.wait_for(done.wait(), timeout=1)


async def test_running_tasks_are_tracked_then_released():
    release = asyncio.Event()

    async def work():
        await release.wait()

    before = background.in_flight()
    task = background.spawn(work(), name="test:tracked")

    assert background.in_flight() == before + 1

    release.set()
    await task
    # The callback runs on the next loop pass.
    await asyncio.sleep(0)

    assert background.in_flight() == before


async def test_a_failing_task_is_logged_and_does_not_escape(caplog):
    async def work():
        raise RuntimeError("pipeline blew up")

    task = background.spawn(work(), name="test:fails")
    await asyncio.gather(task, return_exceptions=True)
    await asyncio.sleep(0)

    assert background.in_flight() == 0


async def test_cancellation_is_reported():
    """`except Exception` does not catch CancelledError, so a cancelled run would
    otherwise leave no trace at all."""
    started = asyncio.Event()

    async def work():
        started.set()
        await asyncio.sleep(60)

    task = background.spawn(work(), name="test:cancelled")
    await started.wait()
    task.cancel()
    await asyncio.gather(task, return_exceptions=True)
    await asyncio.sleep(0)

    assert task.cancelled()
    assert background.in_flight() == 0


async def test_heartbeat_pings_for_as_long_as_the_work_runs():
    """Without this the backend cannot tell a slow run from an abandoned one, and
    its sweep fails runs that are still working."""
    pings = 0

    async def send():
        nonlocal pings
        pings += 1

    async with background.heartbeat(send, every=0.01, name="test"):
        await asyncio.sleep(0.05)

    assert pings >= 2


async def test_heartbeat_stops_when_the_work_finishes():
    pings = 0

    async def send():
        nonlocal pings
        pings += 1

    async with background.heartbeat(send, every=0.01, name="test"):
        await asyncio.sleep(0.03)

    settled = pings
    await asyncio.sleep(0.05)

    assert pings == settled


async def test_a_failing_ping_does_not_kill_the_work():
    """Losing liveness is worth a timeout, not the loss of the run itself."""
    attempts = 0

    async def send():
        nonlocal attempts
        attempts += 1
        raise RuntimeError("backend unreachable")

    completed = False
    async with background.heartbeat(send, every=0.01, name="test"):
        await asyncio.sleep(0.05)
        completed = True

    assert completed and attempts >= 2


async def test_heartbeat_stops_even_when_the_work_raises():
    pings = 0

    async def send():
        nonlocal pings
        pings += 1

    with pytest.raises(ValueError):
        async with background.heartbeat(send, every=0.01, name="test"):
            await asyncio.sleep(0.02)
            raise ValueError("pipeline failed")

    settled = pings
    await asyncio.sleep(0.04)

    assert pings == settled
