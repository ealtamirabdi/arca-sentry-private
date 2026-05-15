"""Severity policies and shared types for ARCA SENTRY.

All audit findings produced by the agent layer are represented as `Finding`
instances. Severity is derived by `classify_severity` from numeric confidence
plus consensus rules — never set directly by individual agents.
"""

from __future__ import annotations

import os
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum


class Severity(str, Enum):
    """Three-tier severity model.

    advisory: Logged only. No alert, no block.
    warning:  Compliance team notified. No block.
    critical: Blocking — the offending interaction is intercepted before it
              reaches the end user. Requires consensus to fire.
    """

    ADVISORY = "advisory"
    WARNING = "warning"
    CRITICAL = "critical"


class Regulation(str, Enum):
    EU_AI_ACT = "eu_ai_act"
    GDPR = "gdpr"
    DORA = "dora"
    PII_LEAK = "pii_leak"
    PROMPT_INJECTION = "prompt_injection"


@dataclass(frozen=True, slots=True)
class Finding:
    """A single observation produced by one agent over one interaction."""

    finding_id: str
    interaction_id: str
    regulation: Regulation
    article: str | None
    confidence: float  # 0.0 – 1.0
    rationale: str
    agent_name: str
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

    @classmethod
    def new(
        cls,
        interaction_id: str,
        regulation: Regulation,
        confidence: float,
        rationale: str,
        agent_name: str,
        article: str | None = None,
    ) -> Finding:
        return cls(
            finding_id=str(uuid.uuid4()),
            interaction_id=interaction_id,
            regulation=regulation,
            article=article,
            confidence=max(0.0, min(1.0, confidence)),
            rationale=rationale,
            agent_name=agent_name,
        )


@dataclass(frozen=True, slots=True)
class SeverityThresholds:
    advisory: float
    warning: float
    critical: float
    critical_requires_consensus: int

    @classmethod
    def from_env(cls) -> SeverityThresholds:
        return cls(
            advisory=float(os.getenv("ADVISORY_THRESHOLD", "0.5")),
            warning=float(os.getenv("WARNING_THRESHOLD", "0.7")),
            critical=float(os.getenv("CRITICAL_THRESHOLD", "0.85")),
            critical_requires_consensus=int(os.getenv("CRITICAL_REQUIRES_CONSENSUS", "3")),
        )


def classify_severity(
    findings: list[Finding],
    thresholds: SeverityThresholds | None = None,
) -> Severity:
    """Derive overall severity from a set of findings on the same interaction.

    Rules (in order — first match wins):
      1. CRITICAL — any of the following:
         a. 2+ agents flagged with confidence >= critical threshold
            (multiple regulations violated at once = compound risk)
         b. A single agent flagged with confidence >= 0.95
            (irrefutable evidence — bot literally leaked API key, etc.)
         c. Both prompt_injection AND pii_leak in the same interaction
            (credential + data exfil = active breach pattern)
      2. WARNING — any single agent flagged with confidence >= warning threshold
      3. ADVISORY — any single agent flagged with confidence >= advisory threshold
      4. ADVISORY (default) — no clear flag
    """
    t = thresholds or SeverityThresholds.from_env()
    if not findings:
        return Severity.ADVISORY

    # 1a — multiple agents agree at critical level (2+, not 3+)
    critical_hits = sum(1 for f in findings if f.confidence >= t.critical)
    if critical_hits >= 2:
        return Severity.CRITICAL

    # 1b — single agent with overwhelming confidence
    if any(f.confidence >= 0.95 for f in findings):
        return Severity.CRITICAL

    # 1c — compound breach pattern: credential leak + data leak together
    regulations = {f.regulation for f in findings if f.confidence >= 0.7}
    if Regulation.PROMPT_INJECTION in regulations and Regulation.PII_LEAK in regulations:
        return Severity.CRITICAL

    # 1d — three distinct regulations flagged at warning+ level = systemic
    if len(regulations) >= 3:
        return Severity.CRITICAL

    # 2 — warning
    if any(f.confidence >= t.warning for f in findings):
        return Severity.WARNING

    # 3, 4 — advisory
    return Severity.ADVISORY
