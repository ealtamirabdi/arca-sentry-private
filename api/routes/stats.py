"""Stats endpoints powering the executive dashboard.

All endpoints read from the append-only event store and return aggregations
suitable for Chart.js / dashboard cards. No mutation.
"""

from __future__ import annotations

import json
from collections import Counter
from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import APIRouter, HTTPException, Query

router = APIRouter(prefix="/stats", tags=["stats"])

_state = None


def set_state(state) -> None:
    global _state
    _state = state


def _db():
    if _state is None or _state.event_store is None or _state.event_store._db is None:
        raise HTTPException(503, "event store not ready")
    return _state.event_store._db


# ───────────────────── SUMMARY (KPIs) ─────────────────────


@router.get("/summary")
async def summary(
    hours: int = Query(24, ge=1, le=720),
) -> dict[str, Any]:
    """KPIs for the headline cards."""
    db = _db()
    cutoff = (datetime.now(timezone.utc) - timedelta(hours=hours)).isoformat()

    cur = await db.execute(
        "SELECT event_type, payload FROM events WHERE created_at >= ?",
        (cutoff,),
    )
    rows = await cur.fetchall()

    total = 0
    severity = {"advisory": 0, "warning": 0, "critical": 0}
    decisions = []
    for r in rows:
        et, payload_json = r
        if et == "interaction":
            total += 1
        elif et == "decision":
            p = json.loads(payload_json)
            s = p.get("severity", "advisory")
            severity[s] = severity.get(s, 0) + 1
            decisions.append(p)

    flagged = severity["warning"] + severity["critical"]
    compliance_rate = (
        round(100 * (total - flagged) / total, 1) if total > 0 else 100.0
    )

    # interactions/min over the last 5 minutes (smoother)
    recent_cutoff = (datetime.now(timezone.utc) - timedelta(minutes=5)).isoformat()
    cur2 = await db.execute(
        "SELECT COUNT(*) FROM events WHERE event_type='interaction' AND created_at >= ?",
        (recent_cutoff,),
    )
    last5_count = (await cur2.fetchone())[0] or 0
    rate_per_min = round(last5_count / 5.0, 2)

    return {
        "window_hours": hours,
        "total_interactions": total,
        "compliance_rate": compliance_rate,
        "violations": {
            "critical": severity["critical"],
            "warning": severity["warning"],
            "advisory": severity["advisory"],
            "total_flagged": flagged,
        },
        "interactions_per_minute": rate_per_min,
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }


# ───────────────────── TIMELINE ─────────────────────


@router.get("/timeline")
async def timeline(
    hours: int = Query(24, ge=1, le=720),
    buckets: int = Query(24, ge=4, le=200),
) -> dict[str, Any]:
    """Bucketed time series of interactions and violations."""
    db = _db()
    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(hours=hours)
    bucket_seconds = (hours * 3600) / buckets

    cur = await db.execute(
        "SELECT created_at, event_type, payload FROM events "
        "WHERE created_at >= ? ORDER BY created_at ASC",
        (cutoff.isoformat(),),
    )
    rows = await cur.fetchall()

    interactions = [0] * buckets
    warnings = [0] * buckets
    criticals = [0] * buckets

    for r in rows:
        created, et, payload_json = r
        t = datetime.fromisoformat(created)
        idx = min(
            int((t - cutoff).total_seconds() / bucket_seconds),
            buckets - 1,
        )
        if idx < 0:
            continue
        if et == "interaction":
            interactions[idx] += 1
        elif et == "decision":
            sev = json.loads(payload_json).get("severity")
            if sev == "warning":
                warnings[idx] += 1
            elif sev == "critical":
                criticals[idx] += 1

    labels = [
        (cutoff + timedelta(seconds=bucket_seconds * (i + 0.5))).strftime("%H:%M")
        for i in range(buckets)
    ]

    return {
        "labels": labels,
        "interactions": interactions,
        "warnings": warnings,
        "criticals": criticals,
        "hours": hours,
    }


# ───────────────────── BY REGULATION ─────────────────────


@router.get("/by_regulation")
async def by_regulation(
    hours: int = Query(24, ge=1, le=720),
) -> dict[str, Any]:
    db = _db()
    cutoff = (datetime.now(timezone.utc) - timedelta(hours=hours)).isoformat()
    cur = await db.execute(
        "SELECT payload FROM events WHERE event_type='finding' AND created_at >= ?",
        (cutoff,),
    )
    counter: Counter[str] = Counter()
    for (payload_json,) in await cur.fetchall():
        p = json.loads(payload_json)
        counter[p.get("regulation", "unknown")] += 1

    items = [{"regulation": k, "count": v} for k, v in counter.most_common()]
    return {"items": items, "total_findings": sum(counter.values())}


# ───────────────────── BY AGENT ─────────────────────


@router.get("/by_agent")
async def by_agent(
    hours: int = Query(24, ge=1, le=720),
) -> dict[str, Any]:
    db = _db()
    cutoff = (datetime.now(timezone.utc) - timedelta(hours=hours)).isoformat()
    cur = await db.execute(
        "SELECT payload FROM events WHERE event_type='finding' AND created_at >= ?",
        (cutoff,),
    )
    counter: Counter[str] = Counter()
    avg_conf: dict[str, list[float]] = {}
    for (payload_json,) in await cur.fetchall():
        p = json.loads(payload_json)
        a = p.get("agent_name", "unknown")
        counter[a] += 1
        avg_conf.setdefault(a, []).append(float(p.get("confidence", 0)))

    items = [
        {
            "agent": a,
            "count": c,
            "avg_confidence": round(sum(avg_conf[a]) / len(avg_conf[a]), 2),
        }
        for a, c in counter.most_common()
    ]
    return {"items": items}


# ───────────────────── RECENT EVENTS ─────────────────────


@router.get("/recent")
async def recent(
    limit: int = Query(50, ge=1, le=500),
) -> dict[str, Any]:
    """Live feed: last N decisions with their interaction and findings."""
    db = _db()
    cur = await db.execute(
        "SELECT seq, created_at, interaction_id, payload "
        "FROM events WHERE event_type='decision' "
        "ORDER BY seq DESC LIMIT ?",
        (limit,),
    )
    items = []
    for r in await cur.fetchall():
        seq, created, iid, payload_json = r
        decision = json.loads(payload_json)

        # join interaction
        cur2 = await db.execute(
            "SELECT payload FROM events WHERE event_type='interaction' AND interaction_id=? LIMIT 1",
            (iid,),
        )
        irow = await cur2.fetchone()
        interaction = json.loads(irow[0]) if irow else {}

        # join findings
        cur3 = await db.execute(
            "SELECT payload FROM events WHERE event_type='finding' AND interaction_id=? "
            "ORDER BY seq ASC",
            (iid,),
        )
        findings = [json.loads(row[0]) for row in await cur3.fetchall()]

        items.append(
            {
                "seq": seq,
                "created_at": created,
                "interaction_id": iid,
                "severity": decision.get("severity"),
                "action_taken": decision.get("action_taken"),
                "channel": interaction.get("channel"),
                "actor": interaction.get("actor"),
                "request_preview": (interaction.get("request") or "")[:140],
                "response_preview": (interaction.get("response") or "")[:140],
                "findings": findings,
                "finding_count": len(findings),
            }
        )
    return {"items": items}
