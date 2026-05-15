"""Append-only event store backed by SQLite.

The event store is the forensic source of truth. It never deletes, never
updates: every audit interaction, every finding, every alert is appended with
a monotonically increasing sequence number and a SHA-256 hash linking to the
previous record (lightweight tamper-evident chain).
"""

from __future__ import annotations

import hashlib
import json
import os
from dataclasses import asdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import aiosqlite

from core.policies import Finding, Severity

DEFAULT_PATH = os.getenv("EVENT_STORE_PATH", "./var/event_store.db")


_SCHEMA = """
CREATE TABLE IF NOT EXISTS events (
    seq          INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at   TEXT NOT NULL,
    event_type   TEXT NOT NULL,
    interaction_id TEXT,
    payload      TEXT NOT NULL,    -- JSON
    prev_hash    TEXT NOT NULL,
    self_hash    TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_events_interaction ON events(interaction_id);
CREATE INDEX IF NOT EXISTS idx_events_type ON events(event_type);
CREATE INDEX IF NOT EXISTS idx_events_created ON events(created_at);
"""

_GENESIS_HASH = "0" * 64


class EventStore:
    """Async append-only event store with hash-chained integrity."""

    def __init__(self, path: str | Path = DEFAULT_PATH) -> None:
        self.path = Path(path)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self._db: aiosqlite.Connection | None = None

    async def open(self) -> None:
        self._db = await aiosqlite.connect(self.path)
        await self._db.executescript(_SCHEMA)
        await self._db.commit()

    async def close(self) -> None:
        if self._db is not None:
            await self._db.close()
            self._db = None

    async def __aenter__(self) -> EventStore:
        await self.open()
        return self

    async def __aexit__(self, *exc: Any) -> None:
        await self.close()

    # ───────────────────────── Append API ─────────────────────────

    async def append(
        self,
        event_type: str,
        payload: dict[str, Any],
        interaction_id: str | None = None,
    ) -> int:
        """Append an event. Returns the assigned sequence number."""
        if self._db is None:
            raise RuntimeError("EventStore not opened")

        prev_hash = await self._last_hash()
        created_at = datetime.now(timezone.utc).isoformat()
        payload_json = json.dumps(payload, default=str, sort_keys=True)
        self_hash = self._hash(prev_hash, created_at, event_type, payload_json)

        cur = await self._db.execute(
            "INSERT INTO events (created_at, event_type, interaction_id, payload, prev_hash, self_hash) "
            "VALUES (?, ?, ?, ?, ?, ?)",
            (created_at, event_type, interaction_id, payload_json, prev_hash, self_hash),
        )
        await self._db.commit()
        return cur.lastrowid  # type: ignore[return-value]

    async def append_finding(self, finding: Finding) -> int:
        return await self.append(
            event_type="finding",
            payload=asdict(finding),
            interaction_id=finding.interaction_id,
        )

    async def append_decision(
        self,
        interaction_id: str,
        severity: Severity,
        findings: list[Finding],
        action_taken: str,
    ) -> int:
        return await self.append(
            event_type="decision",
            payload={
                "severity": severity.value,
                "finding_count": len(findings),
                "finding_ids": [f.finding_id for f in findings],
                "action_taken": action_taken,
            },
            interaction_id=interaction_id,
        )

    # ──────────────────────── Read-only API ────────────────────────

    async def by_interaction(self, interaction_id: str) -> list[dict[str, Any]]:
        if self._db is None:
            raise RuntimeError("EventStore not opened")
        cur = await self._db.execute(
            "SELECT seq, created_at, event_type, payload, self_hash "
            "FROM events WHERE interaction_id = ? ORDER BY seq ASC",
            (interaction_id,),
        )
        rows = await cur.fetchall()
        return [
            {"seq": r[0], "created_at": r[1], "event_type": r[2],
             "payload": json.loads(r[3]), "hash": r[4]}
            for r in rows
        ]

    async def verify_integrity(self) -> bool:
        """Recompute the hash chain to detect tampering."""
        if self._db is None:
            raise RuntimeError("EventStore not opened")
        cur = await self._db.execute(
            "SELECT created_at, event_type, payload, prev_hash, self_hash "
            "FROM events ORDER BY seq ASC"
        )
        expected_prev = _GENESIS_HASH
        async for row in cur:
            created_at, event_type, payload, prev_hash, self_hash = row
            if prev_hash != expected_prev:
                return False
            recomputed = self._hash(prev_hash, created_at, event_type, payload)
            if recomputed != self_hash:
                return False
            expected_prev = self_hash
        return True

    # ────────────────────────── Internals ──────────────────────────

    async def _last_hash(self) -> str:
        if self._db is None:
            raise RuntimeError("EventStore not opened")
        cur = await self._db.execute(
            "SELECT self_hash FROM events ORDER BY seq DESC LIMIT 1"
        )
        row = await cur.fetchone()
        return row[0] if row else _GENESIS_HASH

    @staticmethod
    def _hash(prev_hash: str, created_at: str, event_type: str, payload_json: str) -> str:
        h = hashlib.sha256()
        h.update(prev_hash.encode())
        h.update(created_at.encode())
        h.update(event_type.encode())
        h.update(payload_json.encode())
        return h.hexdigest()
