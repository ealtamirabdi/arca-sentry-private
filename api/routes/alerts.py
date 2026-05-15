"""GET /alerts — recent warnings and criticals."""

from __future__ import annotations

import json
from typing import Any

from fastapi import APIRouter, HTTPException, Query

router = APIRouter(prefix="/alerts", tags=["alerts"])

_state = None


def set_state(state) -> None:
    global _state
    _state = state


@router.get("")
async def list_alerts(
    limit: int = Query(50, ge=1, le=500),
    severity: str | None = Query(None, regex="^(warning|critical)$"),
) -> dict[str, Any]:
    if _state is None or _state.event_store is None:
        raise HTTPException(503, "event store not ready")

    if _state.event_store._db is None:
        raise HTTPException(503, "event store not opened")

    where = "event_type = 'decision'"
    params: list[Any] = []
    if severity:
        where += " AND json_extract(payload, '$.severity') = ?"
        params.append(severity)
    else:
        where += " AND json_extract(payload, '$.severity') IN ('warning', 'critical')"

    sql = (
        "SELECT seq, created_at, interaction_id, payload "
        f"FROM events WHERE {where} ORDER BY seq DESC LIMIT ?"
    )
    params.append(limit)

    cur = await _state.event_store._db.execute(sql, params)
    rows = await cur.fetchall()
    items = [
        {
            "seq": r[0],
            "created_at": r[1],
            "interaction_id": r[2],
            "decision": json.loads(r[3]),
        }
        for r in rows
    ]
    return {"alerts": items, "count": len(items)}
