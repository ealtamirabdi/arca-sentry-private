"""Agents catalog — list of demo agents the user can pen-test against
without having to paste API keys.

These reuse the playground's vulnerable system prompts and SENTRY's own
Gemini-Pro backend, so no external credentials are required. Perfect for
a demo: the jury picks a target, hits "Run", and watches the pipeline.
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, HTTPException

router = APIRouter(prefix="/agents", tags=["agents"])

_state = None


def set_state(state) -> None:
    global _state
    _state = state


CATALOG = [
    {
        "id": "bank-acme",
        "name": "ACME Bank · customer service",
        "vertical": "Banking",
        "icon": "🏦",
        "provider": "internal-gemini",
        "model": "gemini-2.5-pro (vulnerable persona)",
        "description":
            "Retail-banking voice + chatbot. Configured to answer briefly, "
            "decline credit applications without explanation, and reference "
            "internal customer records when asked.",
        "regulations": ["EU AI Act", "GDPR", "DORA"],
        "playground_profile": "banking",
        "tags": ["high-risk", "art-13", "gdpr-22", "dora"],
    },
    {
        "id": "ins-acme",
        "name": "ACME Insurance · claims bot",
        "vertical": "Insurance",
        "icon": "🛡️",
        "provider": "internal-gemini",
        "model": "gemini-2.5-pro (vulnerable persona)",
        "description":
            "Automated claims-routing assistant. Refuses claims based on an "
            "internal risk model and references policyholder PII.",
        "regulations": ["EU AI Act", "GDPR"],
        "playground_profile": "insurance",
        "tags": ["high-risk", "art-13", "gdpr-5"],
    },
    {
        "id": "health-acme",
        "name": "ACME Health · triage assistant",
        "vertical": "Healthcare",
        "icon": "🏥",
        "provider": "internal-gemini",
        "model": "gemini-2.5-pro (vulnerable persona)",
        "description":
            "Patient-triage and appointment assistant. Programmed not to "
            "disclose its AI nature unless asked twice — Art. 50 trap.",
        "regulations": ["EU AI Act Art. 50", "GDPR special category"],
        "playground_profile": "healthcare",
        "tags": ["high-risk", "art-50", "voice"],
    },
]


@router.get("")
async def list_agents() -> dict[str, Any]:
    """Catalog + live activity per agent."""
    activity: dict[str, dict[str, Any]] = {a["id"]: {"audits": 0, "last_at": None,
                                                       "warnings": 0, "criticals": 0}
                                            for a in CATALOG}

    if _state is not None and _state.event_store is not None and _state.event_store._db is not None:
        db = _state.event_store._db
        cur = await db.execute(
            "SELECT created_at, interaction_id, payload FROM events "
            "WHERE event_type='interaction' ORDER BY seq DESC LIMIT 500"
        )
        rows = await cur.fetchall()
        for created, iid, payload_json in rows:
            p = json.loads(payload_json)
            actor = p.get("actor", "")
            for a in CATALOG:
                if a["playground_profile"] in actor or a["id"] in actor:
                    aid = a["id"]
                    activity[aid]["audits"] += 1
                    if not activity[aid]["last_at"] or created > activity[aid]["last_at"]:
                        activity[aid]["last_at"] = created
                    break

        # add severity counts from decisions
        cur2 = await db.execute(
            "SELECT interaction_id, payload FROM events WHERE event_type='decision' LIMIT 1000"
        )
        decisions = {}
        for iid, payload_json in await cur2.fetchall():
            decisions[iid] = json.loads(payload_json).get("severity")

        # Re-iterate interactions to count severity per agent
        for created, iid, payload_json in rows:
            sev = decisions.get(iid)
            if not sev or sev == "advisory":
                continue
            p = json.loads(payload_json)
            actor = p.get("actor", "")
            for a in CATALOG:
                if a["playground_profile"] in actor or a["id"] in actor:
                    if sev == "warning":
                        activity[a["id"]]["warnings"] += 1
                    elif sev == "critical":
                        activity[a["id"]]["criticals"] += 1
                    break

    enriched = []
    for a in CATALOG:
        act = activity[a["id"]]
        enriched.append({
            **a,
            "status": "active" if act["audits"] > 0 else "idle",
            "total_audits": act["audits"],
            "last_audited_at": act["last_at"],
            "warnings_caught": act["warnings"],
            "criticals_caught": act["criticals"],
        })
    return {"agents": enriched}


@router.get("/{agent_id}")
async def get_agent(agent_id: str) -> dict[str, Any]:
    for a in CATALOG:
        if a["id"] == agent_id:
            return a
    raise HTTPException(404, f"agent {agent_id} not found")
