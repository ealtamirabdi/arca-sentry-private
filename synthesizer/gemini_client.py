"""Synthesizer — the final stage powered by Gemini Pro.

Receives the orchestrator's decision plus the supporting findings, and
generates two artifacts:
  1. A short, actionable summary for the compliance dashboard.
  2. A long-form auditable report (PDF) suitable for regulator submission.

The synthesizer is the only component that uses a frontier model — it carries
the legal-grade reasoning load. Auditor agents stay on cheaper specialized
models.
"""

from __future__ import annotations

import logging

from adapters.gemini import GeminiClient
from core.orchestrator import Decision, Interaction

log = logging.getLogger(__name__)


_SYSTEM_INSTRUCTION = """You are the chief synthesis agent of ARCA SENTRY, a
compliance audit system for enterprise AI.

You receive structured findings from five specialized auditor agents
(EU AI Act, GDPR, DORA, PII leak, prompt injection) covering one human-AI
interaction. Your job is to produce a clear, defensible compliance verdict
that a compliance officer (lawyer, non-engineer) can act on within seconds.

You write in the language of the interaction's primary text (Italian,
English, or Spanish). You are concise, factual, and avoid speculation. When
findings conflict, you state the conflict explicitly. When the severity is
critical, your first sentence states the action taken (blocked) and the
single most important reason."""


_USER_TEMPLATE = """Interaction:
- ID: {interaction_id}
- Channel: {channel}
- Actor: {actor}
- Severity: {severity}
- Action taken: {action_taken}

User request:
{request}

AI response:
{response}

Findings ({finding_count}):
{findings_block}

Produce TWO sections separated by `---SHORT---` and `---LONG---`:

---SHORT---
A 2-3 sentence dashboard summary stating: what happened, which regulation(s),
recommended action for the compliance team. Plain language.

---LONG---
A 4-6 paragraph auditable report covering:
1. Description of the interaction (1 paragraph)
2. Specific regulatory citations and how they apply (2 paragraphs)
3. Recommended remediation and monitoring (1 paragraph)
4. Confidence assessment and limitations of this analysis (1 paragraph)"""


class Synthesizer:
    def __init__(self, gemini: GeminiClient | None = None) -> None:
        self.gemini = gemini or GeminiClient()

    async def synthesize(
        self,
        decision: Decision,
        interaction: Interaction,
    ) -> dict[str, str]:
        prompt = self._render_prompt(decision, interaction)
        try:
            response = await self.gemini.generate(
                prompt=prompt,
                system_instruction=_SYSTEM_INSTRUCTION,
                temperature=0.1,
                max_output_tokens=1600,
            )
        except Exception as exc:
            log.exception("synthesizer.gemini_failed", extra={"error": str(exc)})
            return self._fallback(decision, interaction)

        text = response.text or ""
        short, long_ = _split_sections(text)
        return {
            "short": short.strip() or "No summary generated.",
            "long": long_.strip() or "No long report generated.",
            "model": response.model,
            "tokens_prompt": str(response.tokens_prompt),
            "tokens_completion": str(response.tokens_completion),
        }

    @staticmethod
    def _render_prompt(decision: Decision, interaction: Interaction) -> str:
        findings_block = "\n".join(
            f"  • [{f.agent_name}] {f.regulation.value} "
            f"(art. {f.article or 'n/a'}) conf={f.confidence:.2f} — {f.rationale}"
            for f in decision.findings
        ) or "  (no findings)"

        return _USER_TEMPLATE.format(
            interaction_id=interaction.interaction_id,
            channel=interaction.channel,
            actor=interaction.actor,
            severity=decision.severity.value,
            action_taken=decision.action_taken,
            request=interaction.request,
            response=interaction.response,
            finding_count=len(decision.findings),
            findings_block=findings_block,
        )

    @staticmethod
    def _fallback(decision: Decision, interaction: Interaction) -> dict[str, str]:
        short = (
            f"Severity {decision.severity.value} on interaction "
            f"{interaction.interaction_id}. {len(decision.findings)} findings. "
            f"Action taken: {decision.action_taken}. (Gemini unavailable — "
            "see findings table for detail.)"
        )
        return {"short": short, "long": short, "model": "fallback",
                "tokens_prompt": "0", "tokens_completion": "0"}


def _split_sections(text: str) -> tuple[str, str]:
    """Split the model's reply into SHORT / LONG sections."""
    short_marker = "---SHORT---"
    long_marker = "---LONG---"

    if long_marker in text:
        head, _, long_part = text.partition(long_marker)
        short_part = head.replace(short_marker, "").strip()
        return short_part, long_part.strip()

    # Fallback: no markers — first paragraph is short, rest is long.
    parts = text.strip().split("\n\n", 1)
    if len(parts) == 2:
        return parts[0], parts[1]
    return text.strip(), text.strip()
