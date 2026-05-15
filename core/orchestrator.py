"""Orchestrator: coordinates the five auditor agents over each interaction.

Runs each agent concurrently with `asyncio.gather`, collects findings,
classifies overall severity, persists everything to the event store, and
emits the decision to downstream sinks (synthesizer, alert bus, blocker).

Designed to be a library object — the API layer and the capture proxy both
import `Orchestrator` rather than running it as a separate process.
"""

from __future__ import annotations

import asyncio
import logging
import os
from dataclasses import dataclass
from typing import Any, Protocol

from core.event_store import EventStore
from core.policies import (
    Finding,
    Severity,
    SeverityThresholds,
    classify_severity,
)

log = logging.getLogger(__name__)


# ────────────────────────── Domain types ──────────────────────────


@dataclass(frozen=True, slots=True)
class Interaction:
    """A single human-AI exchange that the system audits.

    `request` and `response` may carry text, tool calls, or both. `channel`
    distinguishes text vs voice so agents can apply channel-specific rules
    (e.g. PII spoken aloud has different obligations under GDPR than text).
    """

    interaction_id: str
    timestamp: str
    channel: str            # "text" | "voice"
    actor: str              # which AI system produced the response
    request: str
    response: str
    metadata: dict[str, Any]


@dataclass(frozen=True, slots=True)
class Decision:
    interaction_id: str
    severity: Severity
    findings: list[Finding]
    action_taken: str       # "allow" | "warn" | "block"


# ────────────────────────── Agent protocol ──────────────────────────


class Agent(Protocol):
    """Minimum contract every auditor agent must satisfy."""

    name: str

    async def audit(self, interaction: Interaction) -> Finding | None: ...


# ────────────────────────── Sinks ──────────────────────────


class Sink(Protocol):
    async def emit(self, decision: Decision, interaction: Interaction) -> None: ...


class NullSink:
    async def emit(self, decision: Decision, interaction: Interaction) -> None:
        return None


# ────────────────────────── Orchestrator ──────────────────────────


class Orchestrator:
    def __init__(
        self,
        agents: list[Agent],
        event_store: EventStore,
        thresholds: SeverityThresholds | None = None,
        sinks: list[Sink] | None = None,
    ) -> None:
        if not agents:
            raise ValueError("Orchestrator requires at least one agent")
        self.agents = agents
        self.event_store = event_store
        self.thresholds = thresholds or SeverityThresholds.from_env()
        self.sinks: list[Sink] = sinks or []

    async def process(self, interaction: Interaction) -> Decision:
        """Run every agent in parallel, classify, persist, emit."""
        log.info(
            "orchestrator.process",
            extra={
                "interaction_id": interaction.interaction_id,
                "channel": interaction.channel,
                "actor": interaction.actor,
            },
        )

        await self.event_store.append(
            event_type="interaction",
            payload={
                "channel": interaction.channel,
                "actor": interaction.actor,
                "request": interaction.request,
                "response": interaction.response,
                "metadata": interaction.metadata,
            },
            interaction_id=interaction.interaction_id,
        )

        coros = [self._safe_audit(agent, interaction) for agent in self.agents]
        raw = await asyncio.gather(*coros, return_exceptions=False)
        findings: list[Finding] = [f for f in raw if f is not None]

        for finding in findings:
            await self.event_store.append_finding(finding)

        severity = classify_severity(findings, self.thresholds)
        action = _action_for(severity)

        await self.event_store.append_decision(
            interaction_id=interaction.interaction_id,
            severity=severity,
            findings=findings,
            action_taken=action,
        )

        decision = Decision(
            interaction_id=interaction.interaction_id,
            severity=severity,
            findings=findings,
            action_taken=action,
        )

        for sink in self.sinks:
            try:
                await sink.emit(decision, interaction)
            except Exception:
                log.exception("sink.emit failed", extra={"sink": type(sink).__name__})

        return decision

    async def _safe_audit(self, agent: Agent, interaction: Interaction) -> Finding | None:
        try:
            return await agent.audit(interaction)
        except Exception:
            log.exception(
                "agent.audit raised",
                extra={"agent": agent.name, "interaction_id": interaction.interaction_id},
            )
            return None


def _action_for(severity: Severity) -> str:
    return {
        Severity.ADVISORY: "allow",
        Severity.WARNING: "warn",
        Severity.CRITICAL: "block",
    }[severity]


# ────────────────────────── CLI entry ──────────────────────────


def run() -> None:
    """Stub entry-point used by `sentry-orchestrator` script.

    In production the orchestrator is consumed as a library by the capture
    proxy. This entry exists so the systemd unit can survive standalone for
    debugging / replay scenarios; it tails the event store and re-emits.
    """
    logging.basicConfig(
        level=os.getenv("LOG_LEVEL", "INFO"),
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
    )
    log.info("standalone orchestrator runner — see capture/api_proxy for live mode")
    asyncio.run(asyncio.sleep(0))


if __name__ == "__main__":
    run()
