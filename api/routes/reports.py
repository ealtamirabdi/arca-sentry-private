"""GET /reports/{interaction_id} — render auditable PDF or JSON."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException
from fastapi.responses import HTMLResponse, JSONResponse, Response

from core.orchestrator import Decision, Interaction
from core.policies import Finding, Regulation, Severity
from synthesizer.report_generator import render_pdf, render_report

router = APIRouter(prefix="/reports", tags=["reports"])

_state = None


def set_state(state) -> None:
    global _state
    _state = state


async def _reconstruct(interaction_id: str) -> tuple[Interaction, Decision, str]:
    if _state is None or _state.event_store is None:
        raise HTTPException(503, "event store not ready")

    events = await _state.event_store.by_interaction(interaction_id)
    if not events:
        raise HTTPException(404, f"no events for interaction {interaction_id}")

    interaction_payload: dict[str, Any] = {}
    findings: list[Finding] = []
    decision_payload: dict[str, Any] = {}
    last_hash = ""

    for evt in events:
        last_hash = evt.get("hash", last_hash)
        if evt["event_type"] == "interaction":
            interaction_payload = evt["payload"]
        elif evt["event_type"] == "finding":
            p = evt["payload"]
            findings.append(
                Finding(
                    finding_id=p["finding_id"],
                    interaction_id=interaction_id,
                    regulation=Regulation(p["regulation"]),
                    article=p.get("article"),
                    confidence=p["confidence"],
                    rationale=p["rationale"],
                    agent_name=p["agent_name"],
                )
            )
        elif evt["event_type"] == "decision":
            decision_payload = evt["payload"]

    if not interaction_payload or not decision_payload:
        raise HTTPException(404, "incomplete event chain for this interaction")

    interaction = Interaction(
        interaction_id=interaction_id,
        timestamp=events[0]["created_at"],
        channel=interaction_payload.get("channel", "text"),
        actor=interaction_payload.get("actor", "unknown"),
        request=interaction_payload.get("request", ""),
        response=interaction_payload.get("response", ""),
        metadata=interaction_payload.get("metadata", {}),
    )
    decision = Decision(
        interaction_id=interaction_id,
        severity=Severity(decision_payload["severity"]),
        findings=findings,
        action_taken=decision_payload["action_taken"],
    )
    return interaction, decision, last_hash


@router.get("/{interaction_id}.json")
async def report_json(interaction_id: str):
    interaction, decision, event_hash = await _reconstruct(interaction_id)

    synth = {"short": "", "long": "", "model": "n/a",
             "tokens_prompt": "0", "tokens_completion": "0"}
    if _state.synthesizer is not None and decision.findings:
        try:
            synth = await _state.synthesizer.synthesize(decision, interaction)
        except Exception:
            pass

    return JSONResponse(
        {
            "interaction_id": interaction_id,
            "channel": interaction.channel,
            "actor": interaction.actor,
            "severity": decision.severity.value,
            "action_taken": decision.action_taken,
            "summary": synth["short"],
            "long_report": synth["long"],
            "synthesizer_model": synth["model"],
            "findings": [
                {
                    "agent": f.agent_name,
                    "regulation": f.regulation.value,
                    "article": f.article,
                    "confidence": f.confidence,
                    "rationale": f.rationale,
                }
                for f in decision.findings
            ],
            "event_hash": event_hash,
        }
    )


@router.get("/{interaction_id}.pdf")
async def report_pdf(interaction_id: str):
    interaction, decision, event_hash = await _reconstruct(interaction_id)

    synth = {"short": "(synthesizer unavailable)", "long": "",
             "model": "fallback", "tokens_prompt": "0", "tokens_completion": "0"}
    if _state.synthesizer is not None and decision.findings:
        try:
            synth = await _state.synthesizer.synthesize(decision, interaction)
        except Exception:
            pass

    html = render_report(
        interaction_id=interaction_id,
        channel=interaction.channel,
        actor=interaction.actor,
        request=interaction.request,
        response=interaction.response,
        severity=decision.severity.value,
        action_taken=decision.action_taken,
        short=synth["short"],
        long=synth["long"],
        findings=[
            {
                "agent_name": f.agent_name,
                "regulation": f.regulation.value,
                "article": f.article,
                "confidence": f.confidence,
                "rationale": f.rationale,
            }
            for f in decision.findings
        ],
        synth_model=synth["model"],
        tokens_prompt=synth["tokens_prompt"],
        tokens_completion=synth["tokens_completion"],
        event_hash=event_hash,
    )

    import tempfile
    from pathlib import Path

    with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
        path = Path(tmp.name)
    render_pdf(html, path)
    pdf_bytes = path.read_bytes()
    path.unlink(missing_ok=True)

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'inline; filename="sentry-{interaction_id}.pdf"',
        },
    )


@router.get("/{interaction_id}")
async def report_html(interaction_id: str):
    """Friendly HTML view of the report — same content, no PDF rendering."""
    interaction, decision, event_hash = await _reconstruct(interaction_id)
    synth = {"short": "(synthesizer unavailable)", "long": "",
             "model": "fallback", "tokens_prompt": "0", "tokens_completion": "0"}
    if _state.synthesizer is not None and decision.findings:
        try:
            synth = await _state.synthesizer.synthesize(decision, interaction)
        except Exception:
            pass
    html = render_report(
        interaction_id=interaction_id,
        channel=interaction.channel,
        actor=interaction.actor,
        request=interaction.request,
        response=interaction.response,
        severity=decision.severity.value,
        action_taken=decision.action_taken,
        short=synth["short"],
        long=synth["long"],
        findings=[
            {
                "agent_name": f.agent_name,
                "regulation": f.regulation.value,
                "article": f.article,
                "confidence": f.confidence,
                "rationale": f.rationale,
            }
            for f in decision.findings
        ],
        synth_model=synth["model"],
        tokens_prompt=synth["tokens_prompt"],
        tokens_completion=synth["tokens_completion"],
        event_hash=event_hash,
    )
    return HTMLResponse(content=html)
