"""Event store integration tests — append-only + hash chain."""

from __future__ import annotations

import tempfile
from pathlib import Path

import pytest

from core.event_store import EventStore
from core.policies import Finding, Regulation, Severity


@pytest.fixture
def tmp_db_path():
    p = Path(tempfile.mktemp(suffix=".db"))
    yield p
    p.unlink(missing_ok=True)


async def test_append_and_read(tmp_db_path: Path) -> None:
    async with EventStore(tmp_db_path) as store:
        seq = await store.append("interaction",
                                  {"actor": "bot", "channel": "text"},
                                  interaction_id="i-1")
        assert seq == 1

        f = Finding.new("i-1", Regulation.EU_AI_ACT, 0.9, "test", "agent-x")
        await store.append_finding(f)
        await store.append_decision("i-1", Severity.WARNING, [f], "warn")

        events = await store.by_interaction("i-1")
        assert len(events) == 3
        assert events[0]["event_type"] == "interaction"
        assert events[2]["event_type"] == "decision"
        assert events[2]["payload"]["severity"] == "warning"


async def test_integrity_verifies_clean_chain(tmp_db_path: Path) -> None:
    async with EventStore(tmp_db_path) as store:
        for i in range(5):
            await store.append("test", {"i": i}, interaction_id=f"i-{i}")
        assert await store.verify_integrity() is True
