"""Voice tap — bridges Speechmatics streaming STT to the orchestrator.

A telephony backend or a browser-side recorder pushes audio chunks over a
WebSocket to `/voice/stream`. We pair the speaker-diarized transcripts into
user-vs-agent turns and ship complete turns to the orchestrator as text
interactions.

For the hackathon demo we accept two simpler modes too:
  • POST /voice/transcript — the caller already did STT and just submits text.
  • POST /voice/file       — single short audio file (wav/ogg/mp3).
"""

from __future__ import annotations

import logging
import os
import uuid
from datetime import datetime, timezone
from typing import Any

from fastapi import FastAPI, HTTPException, UploadFile
from pydantic import BaseModel, Field

from core.event_store import EventStore
from core.orchestrator import Interaction, Orchestrator

log = logging.getLogger(__name__)

app = FastAPI(title="ARCA SENTRY — Voice Tap", version="0.1.0")

_orchestrator: Orchestrator | None = None


def configure(orchestrator: Orchestrator, _store: EventStore) -> None:
    global _orchestrator
    _orchestrator = orchestrator


# ─────────────── Schemas ───────────────


class VoiceTranscriptIn(BaseModel):
    interaction_id: str | None = None
    actor: str = Field(..., description="The audited voice agent identifier")
    user_speech: str = Field(..., description="Transcribed user turn")
    agent_speech: str = Field(..., description="Transcribed AI agent turn")
    user_speaker: str | None = None
    agent_speaker: str | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)


# ─────────────── Routes ───────────────


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok", "service": "voice-tap"}


@app.post("/voice/transcript")
async def voice_transcript(payload: VoiceTranscriptIn) -> dict[str, Any]:
    if _orchestrator is None:
        raise HTTPException(503, "orchestrator not configured")

    interaction = Interaction(
        interaction_id=payload.interaction_id or str(uuid.uuid4()),
        timestamp=datetime.now(timezone.utc).isoformat(),
        channel="voice",
        actor=payload.actor,
        request=payload.user_speech,
        response=payload.agent_speech,
        metadata={
            **payload.metadata,
            "user_speaker": payload.user_speaker,
            "agent_speaker": payload.agent_speaker,
        },
    )

    decision = await _orchestrator.process(interaction)
    return {
        "interaction_id": decision.interaction_id,
        "severity": decision.severity.value,
        "action_taken": decision.action_taken,
    }


@app.post("/voice/file")
async def voice_file(
    actor: str,
    audio: UploadFile,
    interaction_id: str | None = None,
) -> dict[str, Any]:
    """Accept a short audio file, run Speechmatics over it, then audit."""
    if _orchestrator is None:
        raise HTTPException(503, "orchestrator not configured")

    from adapters.speechmatics import SpeechmaticsClient

    audio_bytes = await audio.read()

    async def _one_chunk():
        yield audio_bytes

    user_turn_parts: list[str] = []
    agent_turn_parts: list[str] = []
    current_speaker: str | None = None

    async with SpeechmaticsClient() as sm:
        async for seg in sm.transcribe_chunks(_one_chunk()):
            if not seg.is_final:
                continue
            if seg.speaker != current_speaker and current_speaker is not None:
                # speaker change — assume the existing accumulator was user,
                # the new one is agent. Simple two-speaker model for demo.
                pass
            (agent_turn_parts if seg.speaker == "S2" else user_turn_parts).append(
                seg.text
            )
            current_speaker = seg.speaker

    user_speech = " ".join(user_turn_parts).strip()
    agent_speech = " ".join(agent_turn_parts).strip()

    interaction = Interaction(
        interaction_id=interaction_id or str(uuid.uuid4()),
        timestamp=datetime.now(timezone.utc).isoformat(),
        channel="voice",
        actor=actor,
        request=user_speech,
        response=agent_speech,
        metadata={"source": "voice_file", "filename": audio.filename},
    )
    decision = await _orchestrator.process(interaction)
    return {
        "interaction_id": decision.interaction_id,
        "severity": decision.severity.value,
        "action_taken": decision.action_taken,
        "user_speech": user_speech,
        "agent_speech": agent_speech,
    }


# ─────────────── Standalone runner ───────────────


def run() -> None:
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
    port = int(os.getenv("VOICE_TAP_PORT", "8090"))
    uvicorn.run(app, host="0.0.0.0", port=port, log_level="info")


if __name__ == "__main__":
    run()
