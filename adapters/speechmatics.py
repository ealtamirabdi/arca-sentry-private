"""Speechmatics adapter.

Real-time speech-to-text with speaker diarization for the voice channel
audit. Speechmatics returns partial and final transcripts over a WebSocket;
we surface only final transcripts to the orchestrator (partials drive the
live dashboard separately).
"""

from __future__ import annotations

import logging
import os
from dataclasses import dataclass

log = logging.getLogger(__name__)

SPEECHMATICS_API_KEY = os.getenv("SPEECHMATICS_API_KEY", "")
SPEECHMATICS_URL = os.getenv(
    "SPEECHMATICS_URL",
    "wss://eu2.rt.speechmatics.com/v2",
)
SPEECHMATICS_LANGUAGE = os.getenv("SPEECHMATICS_LANGUAGE", "en")


@dataclass(slots=True)
class TranscriptSegment:
    text: str
    speaker: str | None
    start_seconds: float
    end_seconds: float
    is_final: bool


class SpeechmaticsClient:
    """Thin wrapper over the Speechmatics Python SDK.

    Usage:
        async with SpeechmaticsClient() as sm:
            async for seg in sm.transcribe_stream(audio_chunks):
                if seg.is_final:
                    await orchestrator.process(...)
    """

    def __init__(
        self,
        api_key: str | None = None,
        language: str = SPEECHMATICS_LANGUAGE,
        enable_diarization: bool = True,
    ) -> None:
        self.api_key = api_key or SPEECHMATICS_API_KEY
        self.language = language
        self.enable_diarization = enable_diarization

    def _build_config(self) -> dict:
        cfg = {
            "type": "transcription",
            "transcription_config": {
                "language": self.language,
                "operating_point": "enhanced",
                "enable_partials": True,
                "max_delay": 1.5,
            },
        }
        if self.enable_diarization:
            cfg["transcription_config"]["diarization"] = "speaker"
        return cfg

    async def __aenter__(self) -> SpeechmaticsClient:
        return self

    async def __aexit__(self, *exc: object) -> None:
        return None

    async def transcribe_chunks(self, audio_chunks):
        """Run a streaming transcription against an async iterable of bytes.

        Yields `TranscriptSegment` for each final (and optionally partial)
        transcript piece. The Speechmatics SDK is callback-based, so we
        bridge to an asyncio.Queue here.
        """
        import asyncio

        try:
            from speechmatics.client import WebsocketClient
            from speechmatics.models import (
                ConnectionSettings,
                ServerMessageType,
                TranscriptionConfig,
            )
        except ImportError as exc:
            raise RuntimeError(
                "speechmatics-python not installed; install with `pip install speechmatics-python`"
            ) from exc

        out: asyncio.Queue[TranscriptSegment | None] = asyncio.Queue()

        tc_kwargs = {
            "language": self.language,
            "operating_point": "enhanced",
            "enable_partials": True,
            "max_delay": 1.5,
        }
        if self.enable_diarization:
            tc_kwargs["diarization"] = "speaker"
        tc = TranscriptionConfig(**tc_kwargs)

        client = WebsocketClient(
            ConnectionSettings(url=SPEECHMATICS_URL, auth_token=self.api_key)
        )

        def _on_final(msg: dict) -> None:
            for r in msg.get("results", []):
                alt = r.get("alternatives", [{}])[0]
                seg = TranscriptSegment(
                    text=alt.get("content", ""),
                    speaker=alt.get("speaker"),
                    start_seconds=r.get("start_time", 0.0),
                    end_seconds=r.get("end_time", 0.0),
                    is_final=True,
                )
                out.put_nowait(seg)

        client.add_event_handler(ServerMessageType.AddTranscript, _on_final)

        async def feed() -> None:
            async for chunk in audio_chunks:
                client.send_data(chunk)
            client.send_end_of_stream()
            await out.put(None)

        # Run feed and Speechmatics' run() concurrently
        loop = asyncio.get_running_loop()
        feed_task = asyncio.create_task(feed())
        sm_task = loop.run_in_executor(None, client.run, tc)

        while True:
            seg = await out.get()
            if seg is None:
                break
            yield seg

        await feed_task
        await sm_task
