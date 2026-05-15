"""HTTP capture proxy.

Receives AI traffic and forwards it to ARCA SENTRY's orchestrator. Two modes:

  1. Passive — a backend service POSTs an `Interaction` to /capture/interaction
     and SENTRY only audits (no blocking).
  2. Inline — a backend service POSTs the user request to /capture/before
     and the proposed AI response to /capture/before-emit; SENTRY may return
     `block` and the backend must withhold the response.

The proxy is a thin FastAPI app so it can be deployed independently from the
main API and scale separately.
"""

from __future__ import annotations

import logging
import os
import uuid
from datetime import datetime, timezone
from typing import Any

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from core.event_store import EventStore
from core.orchestrator import Interaction, Orchestrator

log = logging.getLogger(__name__)

app = FastAPI(title="ARCA SENTRY — Capture Proxy", version="0.1.0")

_orchestrator: Orchestrator | None = None
_event_store: EventStore | None = None


# ─────────────── Request / response schemas ───────────────


class InteractionIn(BaseModel):
    interaction_id: str | None = None
    channel: str = Field("text", description="text | voice")
    actor: str = Field(..., description="The audited AI system identifier")
    request: str
    response: str
    metadata: dict[str, Any] = Field(default_factory=dict)


class DecisionOut(BaseModel):
    interaction_id: str
    severity: str
    action_taken: str
    findings: list[dict[str, Any]]


# ─────────────── Wiring ───────────────


def configure(orchestrator: Orchestrator, event_store: EventStore) -> None:
    """Inject the live orchestrator and event store. Called from __main__."""
    global _orchestrator, _event_store
    _orchestrator = orchestrator
    _event_store = event_store


# ─────────────── Routes ───────────────


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok", "service": "capture-proxy"}


@app.post("/capture/interaction", response_model=DecisionOut)
async def capture_interaction(payload: InteractionIn) -> DecisionOut:
    if _orchestrator is None:
        raise HTTPException(503, "orchestrator not configured")

    interaction = Interaction(
        interaction_id=payload.interaction_id or str(uuid.uuid4()),
        timestamp=datetime.now(timezone.utc).isoformat(),
        channel=payload.channel,
        actor=payload.actor,
        request=payload.request,
        response=payload.response,
        metadata=payload.metadata,
    )

    decision = await _orchestrator.process(interaction)

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
    )


# ─────────────── Standalone runner ───────────────


def run() -> None:
    """Entry-point for `sentry-capture-proxy` console script."""
    import asyncio

    import uvicorn

    from adapters.featherless import FeatherlessClient
    from agents.dora import DORAAgent
    from agents.eu_ai_act import EUAIActAgent
    from agents.gdpr import GDPRAgent
    from agents.pii_leak import PIILeakAgent
    from agents.prompt_injection import PromptInjectionAgent

    logging.basicConfig(
        level=os.getenv("LOG_LEVEL", "INFO"),
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
    )

    async def _bootstrap() -> None:
        store = EventStore()
        await store.open()
        feather = FeatherlessClient()
        await feather.__aenter__()
        agents = [
            EUAIActAgent(feather),
            GDPRAgent(feather),
            DORAAgent(feather),
            PIILeakAgent(feather),
            PromptInjectionAgent(feather),
        ]
        orch = Orchestrator(agents=agents, event_store=store)
        configure(orch, store)

    asyncio.run(_bootstrap())

    port = int(os.getenv("CAPTURE_PROXY_PORT", "8089"))
    uvicorn.run(app, host="0.0.0.0", port=port, log_level="info")


if __name__ == "__main__":
    run()
