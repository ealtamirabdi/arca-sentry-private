"""Google Gemini adapter.

Wraps `google-genai` SDK for use as the Synthesizer's reasoning engine.
The Synthesizer is the only component that calls Gemini Pro — auditor agents
use Featherless. This is intentional: Gemini Pro handles long-context legal
synthesis where it shines; smaller specialized models handle pattern matches.
"""

from __future__ import annotations

import logging
import os
from dataclasses import dataclass
from typing import Any

log = logging.getLogger(__name__)

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-pro")
GEMINI_TIMEOUT = float(os.getenv("GEMINI_TIMEOUT", "30.0"))


@dataclass(slots=True)
class GeminiResponse:
    text: str
    model: str
    finish_reason: str
    tokens_prompt: int
    tokens_completion: int
    raw: Any


class GeminiClient:
    """Thin async wrapper around google-genai for Gemini Pro / Flash."""

    def __init__(
        self,
        api_key: str | None = None,
        model: str = GEMINI_MODEL,
    ) -> None:
        self.api_key = api_key or GEMINI_API_KEY
        self.model = model
        self._client: Any = None

    def _ensure_client(self) -> Any:
        if self._client is not None:
            return self._client
        try:
            from google import genai
        except ImportError as exc:
            raise RuntimeError(
                "google-genai not installed; install with `pip install google-genai`"
            ) from exc

        if not self.api_key:
            raise RuntimeError("GEMINI_API_KEY not set")

        self._client = genai.Client(api_key=self.api_key)
        return self._client

    async def generate(
        self,
        prompt: str,
        system_instruction: str | None = None,
        temperature: float = 0.1,
        max_output_tokens: int = 2048,
        relax_safety: bool = False,
    ) -> GeminiResponse:
        """Async-friendly wrapper. google-genai is sync under the hood; we run
        it in the default executor so the orchestrator's asyncio loop stays
        responsive.

        `relax_safety=True` lowers all safety thresholds to BLOCK_ONLY_HIGH —
        used by the playground bot, which must produce vulnerable replies for
        the audit demo to land.
        """
        import asyncio

        client = self._ensure_client()

        def _call() -> Any:
            from google.genai import types

            safety_settings = None
            if relax_safety:
                safety_settings = [
                    types.SafetySetting(
                        category=cat,
                        threshold=types.HarmBlockThreshold.BLOCK_ONLY_HIGH,
                    )
                    for cat in [
                        types.HarmCategory.HARM_CATEGORY_HARASSMENT,
                        types.HarmCategory.HARM_CATEGORY_HATE_SPEECH,
                        types.HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
                        types.HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
                    ]
                ]

            cfg = types.GenerateContentConfig(
                temperature=temperature,
                max_output_tokens=max_output_tokens,
                system_instruction=system_instruction,
                safety_settings=safety_settings,
            )
            return client.models.generate_content(
                model=self.model,
                contents=prompt,
                config=cfg,
            )

        result = await asyncio.to_thread(_call)

        text = getattr(result, "text", "") or ""
        usage = getattr(result, "usage_metadata", None)
        finish_reason = ""
        if result.candidates:
            fr = getattr(result.candidates[0], "finish_reason", None)
            finish_reason = str(fr) if fr is not None else ""

        return GeminiResponse(
            text=text,
            model=self.model,
            finish_reason=finish_reason,
            tokens_prompt=getattr(usage, "prompt_token_count", 0) if usage else 0,
            tokens_completion=getattr(usage, "candidates_token_count", 0) if usage else 0,
            raw=result,
        )
