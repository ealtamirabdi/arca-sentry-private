"""Featherless adapter.

Featherless exposes an OpenAI-compatible REST surface for 27,000+ open-source
models. We hit `/v1/chat/completions` with the model we route per agent.

Each auditor agent picks its specialized model from env vars (MODEL_EU_AI_ACT,
MODEL_GDPR, etc.). Calls are async via httpx with timeouts and retries.
"""

from __future__ import annotations

import asyncio
import logging
import os
from dataclasses import dataclass
from typing import Any

import httpx

log = logging.getLogger(__name__)

FEATHERLESS_BASE_URL = os.getenv("FEATHERLESS_BASE_URL", "https://api.featherless.ai/v1")
FEATHERLESS_API_KEY = os.getenv("FEATHERLESS_API_KEY", "")
DEFAULT_TIMEOUT = float(os.getenv("FEATHERLESS_TIMEOUT", "20.0"))
DEFAULT_MAX_RETRIES = int(os.getenv("FEATHERLESS_MAX_RETRIES", "2"))


@dataclass(slots=True)
class ChatMessage:
    role: str        # "system" | "user" | "assistant"
    content: str


@dataclass(slots=True)
class ChatCompletion:
    content: str
    model: str
    tokens_prompt: int
    tokens_completion: int
    raw: dict[str, Any]


class FeatherlessClient:
    """Async client for Featherless chat completions."""

    def __init__(
        self,
        api_key: str | None = None,
        base_url: str = FEATHERLESS_BASE_URL,
        timeout: float = DEFAULT_TIMEOUT,
    ) -> None:
        self.api_key = api_key or FEATHERLESS_API_KEY
        if not self.api_key:
            log.warning("FEATHERLESS_API_KEY not set; calls will fail")
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout
        self._client: httpx.AsyncClient | None = None

    async def __aenter__(self) -> FeatherlessClient:
        self._client = httpx.AsyncClient(timeout=self.timeout)
        return self

    async def __aexit__(self, *exc: Any) -> None:
        if self._client is not None:
            await self._client.aclose()
            self._client = None

    async def chat(
        self,
        model: str,
        messages: list[ChatMessage],
        max_tokens: int = 512,
        temperature: float = 0.1,
    ) -> ChatCompletion:
        if self._client is None:
            raise RuntimeError("FeatherlessClient not entered")

        payload = {
            "model": model,
            "messages": [{"role": m.role, "content": m.content} for m in messages],
            "max_tokens": max_tokens,
            "temperature": temperature,
        }
        headers = {"Authorization": f"Bearer {self.api_key}"}
        url = f"{self.base_url}/chat/completions"

        last_exc: Exception | None = None
        for attempt in range(DEFAULT_MAX_RETRIES + 1):
            try:
                r = await self._client.post(url, json=payload, headers=headers)
                r.raise_for_status()
                data = r.json()
                choice = data["choices"][0]["message"]["content"]
                usage = data.get("usage", {})
                return ChatCompletion(
                    content=choice,
                    model=data.get("model", model),
                    tokens_prompt=usage.get("prompt_tokens", 0),
                    tokens_completion=usage.get("completion_tokens", 0),
                    raw=data,
                )
            except (httpx.HTTPError, KeyError) as exc:
                last_exc = exc
                if attempt < DEFAULT_MAX_RETRIES:
                    backoff = 0.5 * (2**attempt)
                    log.warning(
                        "featherless.retry",
                        extra={"attempt": attempt, "backoff": backoff, "error": str(exc)},
                    )
                    await asyncio.sleep(backoff)
                else:
                    raise
        raise RuntimeError(f"unreachable: {last_exc}")
