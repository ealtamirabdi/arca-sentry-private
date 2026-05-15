"""POST /audit — submit an interaction for auditing.

The single most important endpoint: an enterprise points its AI traffic at
this endpoint (in passive or inline mode) and SENTRY returns the decision.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from core.orchestrator import Interaction

router = APIRouter(prefix="/audit", tags=["audit"])

_state = None


def set_state(state) -> None:
    global _state
    _state = state


class InteractionIn(BaseModel):
    interaction_id: str | None = None
    channel: str = "text"
    actor: str
    request: str
    response: str
    metadata: dict[str, Any] = Field(default_factory=dict)


class DecisionOut(BaseModel):
    interaction_id: str
    severity: str
    action_taken: str
    findings: list[dict[str, Any]]
    summary: str | None = None


@router.post("", response_model=DecisionOut)
async def audit_interaction(payload: InteractionIn) -> DecisionOut:
    if _state is None or _state.orchestrator is None:
        raise HTTPException(503, "orchestrator not ready")

    interaction = Interaction(
        interaction_id=payload.interaction_id or str(uuid.uuid4()),
        timestamp=datetime.now(timezone.utc).isoformat(),
        channel=payload.channel,
        actor=payload.actor,
        request=payload.request,
        response=payload.response,
        metadata=payload.metadata,
    )

    decision = await _state.orchestrator.process(interaction)

    summary = None
    if decision.findings and _state.synthesizer is not None:
        try:
            synth = await _state.synthesizer.synthesize(decision, interaction)
            summary = synth.get("short")
        except Exception:
            summary = None

    return DecisionOut(
        interaction_id=decision.interaction_id,
        severity=decision.severity.value,
        action_taken=decision.action_taken,
        findings=[
            {
                "agent": f.agent_name,
                "regulation": f.regulation.value,
                "article": f.article,
                "confidence": f.confidence,
                "rationale": f.rationale,
            }
            for f in decision.findings
        ],
        summary=summary,
    )
