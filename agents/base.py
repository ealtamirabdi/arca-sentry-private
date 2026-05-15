"""Base class for auditor agents.

Each auditor agent specializes in one regulation or risk family. The base
class handles the common pattern:

  1. Run a fast pre-filter (regex / heuristic) — cheap CPU.
  2. If the pre-filter matches, call Featherless with a domain-specialized
     model to produce a confidence score and rationale.
  3. Return a `Finding` or None.

This split keeps p95 latency low: most interactions never call the LLM
because the pre-filter rejects them.
"""

from __future__ import annotations

import json
import logging
import re
from abc import ABC, abstractmethod

from adapters.featherless import ChatMessage, FeatherlessClient
from core.orchestrator import Interaction
from core.policies import Finding, Regulation

log = logging.getLogger(__name__)


class AuditorAgent(ABC):
    """Base class. Subclasses set `name`, `regulation`, `model_env_var`, and
    implement `pre_filter_patterns` and `system_prompt`."""

    name: str = "abstract-auditor"
    regulation: Regulation = Regulation.EU_AI_ACT
    model_env_var: str = "MODEL_EU_AI_ACT"

    def __init__(self, featherless: FeatherlessClient) -> None:
        self.featherless = featherless

    # ──────────────── To implement in subclasses ────────────────

    @property
    @abstractmethod
    def pre_filter_patterns(self) -> list[re.Pattern[str]]:
        """Regexes that, if any matches request or response, trigger an LLM
        call. Empty list disables the pre-filter (always call LLM)."""

    @property
    @abstractmethod
    def system_prompt(self) -> str:
        """Instructions handed to the specialized model. Must elicit a JSON
        reply with shape {"confidence": float 0-1, "article": str|null,
        "rationale": str}."""

    # ──────────────── Common audit entry point ────────────────

    async def audit(self, interaction: Interaction) -> Finding | None:
        if self.pre_filter_patterns and not self._pre_filter_match(interaction):
            return None

        prompt = self._render_user_prompt(interaction)
        try:
            import os
            model = os.environ.get(self.model_env_var, "meta-llama/Llama-3.1-8B-Instruct")
            completion = await self.featherless.chat(
                model=model,
                messages=[
                    ChatMessage(role="system", content=self.system_prompt),
                    ChatMessage(role="user", content=prompt),
                ],
                max_tokens=400,
                temperature=0.0,
            )
        except Exception as exc:
            log.warning(
                "agent.featherless_failed",
                extra={"agent": self.name, "error": str(exc)},
            )
            return None

        parsed = _parse_judgment(completion.content)
        if parsed is None:
            return None

        confidence = float(parsed.get("confidence", 0.0))
        if confidence < 0.4:
            return None

        return Finding.new(
            interaction_id=interaction.interaction_id,
            regulation=self.regulation,
            confidence=confidence,
            rationale=str(parsed.get("rationale", ""))[:1000],
            agent_name=self.name,
            article=parsed.get("article"),
        )

    # ──────────────── Helpers ────────────────

    def _pre_filter_match(self, interaction: Interaction) -> bool:
        haystack = f"{interaction.request}\n{interaction.response}"
        return any(p.search(haystack) for p in self.pre_filter_patterns)

    def _render_user_prompt(self, interaction: Interaction) -> str:
        return (
            f"Audit the following human-AI interaction for {self.regulation.value} compliance.\n\n"
            f"--- Channel: {interaction.channel} ---\n"
            f"--- Actor: {interaction.actor} ---\n\n"
            f"User request:\n{interaction.request}\n\n"
            f"AI response:\n{interaction.response}\n\n"
            "IMPORTANT — multilingual rules:\n"
            "• The interaction may be in English, Spanish, Italian, French or any other language.\n"
            "• Apply the SAME flagging logic regardless of the source language. A violation in\n"
            "  Spanish or Italian is equally serious as the same violation in English.\n"
            "• You may write the `rationale` in the source language of the interaction, but\n"
            "  the JSON keys (`confidence`, `article`, `rationale`) MUST be in English.\n\n"
            "Respond ONLY with strict JSON of shape: "
            '{"confidence": 0.0-1.0, "article": "<regulation article or null>", '
            '"rationale": "<one paragraph>"}'
        )


def _parse_judgment(text: str) -> dict | None:
    """Tolerant JSON parser — accepts the model wrapping JSON in fences."""
    text = text.strip()
    # strip code fences
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text)
        text = re.sub(r"\s*```$", "", text)
    # take the first JSON object if there's trailing prose
    m = re.search(r"\{.*\}", text, flags=re.DOTALL)
    if not m:
        return None
    try:
        return json.loads(m.group(0))
    except json.JSONDecodeError:
        return None
