"""Agent registration & profile details endpoints.

Lets a user register a new agent (Proxy / HTTP / Web URL / WhatsApp / FB)
and retrieves per-agent stats for the profile page.
"""

from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone
from typing import Any, Literal

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

router = APIRouter(prefix="/agents", tags=["agents"])

_state = None


def set_state(state) -> None:
    global _state
    _state = state


# ─────────────────────── Schemas ───────────────────────


class RegisterAgent(BaseModel):
    name: str = Field(..., min_length=2, max_length=120)
    vertical: str = Field("Other")
    icon: str = Field("🤖")
    description: str = Field("", max_length=500)
    connection: Literal["proxy", "http", "web_url", "whatsapp", "facebook"] = "proxy"
    endpoint_url: str | None = None       # for http/web_url
    upstream_provider: str | None = None  # for proxy (openai/anthropic/gemini)


# ─────────────────────── Endpoints ───────────────────────


@router.post("/register")
async def register_agent(payload: RegisterAgent) -> dict[str, Any]:
    """Register a new agent. Persists to the event store as an immutable
    'agent_registered' event so it shows up in the catalog and history."""
    if _state is None or _state.event_store is None:
        raise HTTPException(503, "event store not ready")

    agent_id = f"user-{uuid.uuid4().hex[:8]}"

    # Coming-soon channels are accepted but flagged as pending
    pending = payload.connection in ("whatsapp", "facebook")

    await _state.event_store.append(
        event_type="agent_registered",
        payload={
            "agent_id": agent_id,
            "name": payload.name,
            "vertical": payload.vertical,
            "icon": payload.icon,
            "description": payload.description,
            "connection": payload.connection,
            "endpoint_url": payload.endpoint_url,
            "upstream_provider": payload.upstream_provider,
            "pending": pending,
            "registered_at": datetime.now(timezone.utc).isoformat(),
        },
    )

    return {
        "agent_id": agent_id,
        "connection": payload.connection,
        "pending": pending,
        "proxy_endpoint": (
            f"{_state.public_base_url or ''}/v1/chat/completions"
            if payload.connection == "proxy" else None
        ),
        "next_step": (
            "Update your client base_url to the proxy endpoint above."
            if payload.connection == "proxy"
            else "Click 'Run Red Team' to test this agent immediately."
            if not pending else
            "This channel is in beta — coming soon."
        ),
    }


@router.get("/registered")
async def list_registered() -> dict[str, Any]:
    """List user-registered agents (separate from the demo catalog)."""
    if _state is None or _state.event_store is None or _state.event_store._db is None:
        raise HTTPException(503, "event store not ready")
    db = _state.event_store._db
    cur = await db.execute(
        "SELECT created_at, payload FROM events WHERE event_type='agent_registered' "
        "ORDER BY seq DESC"
    )
    items = []
    for created, payload_json in await cur.fetchall():
        p = json.loads(payload_json)
        items.append({**p, "registered_at": p.get("registered_at") or created})
    return {"agents": items}


@router.get("/{agent_id}/details")
async def agent_details(agent_id: str) -> dict[str, Any]:
    """Full profile for an agent: stats + recent interactions + active tickets
    + violation breakdown by regulation. Powers the /agent/{id} page."""
    if _state is None or _state.event_store is None or _state.event_store._db is None:
        raise HTTPException(503, "event store not ready")
    db = _state.event_store._db

    # Try internal catalog first
    from api.routes.agents import CATALOG
    agent_meta = next((a for a in CATALOG if a["id"] == agent_id), None)

    # Then user-registered
    if not agent_meta:
        cur = await db.execute(
            "SELECT payload FROM events WHERE event_type='agent_registered' "
            "AND json_extract(payload, '$.agent_id') = ?",
            (agent_id,),
        )
        row = await cur.fetchone()
        if row:
            agent_meta = json.loads(row[0])

    if not agent_meta:
        raise HTTPException(404, f"agent {agent_id} not found")

    # Match interactions where actor contains agent_id or playground_profile
    match_keys = [agent_id]
    if "playground_profile" in agent_meta:
        match_keys.append(agent_meta["playground_profile"])

    def _matches(actor: str) -> bool:
        return any(k in (actor or "") for k in match_keys)

    cur = await db.execute(
        "SELECT seq, created_at, interaction_id, payload FROM events "
        "WHERE event_type='interaction' ORDER BY seq DESC LIMIT 1000"
    )
    interactions = []
    interaction_ids = []
    for seq, created, iid, payload_json in await cur.fetchall():
        p = json.loads(payload_json)
        if _matches(p.get("actor", "")):
            interactions.append({
                "seq": seq, "created_at": created, "interaction_id": iid, **p
            })
            interaction_ids.append(iid)

    # Fetch decisions for these interactions
    decisions: dict[str, dict] = {}
    if interaction_ids:
        placeholders = ",".join("?" * len(interaction_ids))
        cur2 = await db.execute(
            f"SELECT interaction_id, payload FROM events "
            f"WHERE event_type='decision' AND interaction_id IN ({placeholders})",
            interaction_ids,
        )
        for iid, payload_json in await cur2.fetchall():
            decisions[iid] = json.loads(payload_json)

    # Stats
    by_severity = {"advisory": 0, "warning": 0, "critical": 0}
    by_regulation: dict[str, int] = {}
    for i in interactions:
        d = decisions.get(i["interaction_id"], {})
        sev = d.get("severity", "advisory")
        by_severity[sev] = by_severity.get(sev, 0) + 1

    # Findings breakdown
    if interaction_ids:
        cur3 = await db.execute(
            f"SELECT payload FROM events WHERE event_type='finding' "
            f"AND interaction_id IN ({placeholders})",
            interaction_ids,
        )
        for (payload_json,) in await cur3.fetchall():
            reg = json.loads(payload_json).get("regulation", "unknown")
            by_regulation[reg] = by_regulation.get(reg, 0) + 1

    # Compose recent interactions enriched with decision
    recent = []
    for i in interactions[:50]:
        d = decisions.get(i["interaction_id"], {})
        recent.append({
            "interaction_id": i["interaction_id"],
            "created_at": i["created_at"],
            "channel": i.get("channel"),
            "request": (i.get("request") or "")[:240],
            "response": (i.get("response") or "")[:240],
            "severity": d.get("severity", "advisory"),
            "action_taken": d.get("action_taken", "allow"),
        })

    return {
        "agent": agent_meta,
        "stats": {
            "total_interactions": len(interactions),
            "by_severity": by_severity,
            "by_regulation": by_regulation,
            "first_seen": interactions[-1]["created_at"] if interactions else None,
            "last_seen": interactions[0]["created_at"] if interactions else None,
        },
        "recent_interactions": recent,
    }
