"""GDPR auditor.

Focuses on processing of personal data inside AI responses:
  • Art. 5 — lawfulness, fairness, transparency.
  • Art. 13/14 — information to be provided to the data subject.
  • Art. 15 — right of access; Art. 17 — right to erasure.
  • Art. 22 — right not to be subject to a decision based solely on
              automated processing.

This agent complements pii_leak.py: GDPR catches procedural violations
(automated decisions without recourse, opaque processing), pii_leak.py
catches the data leak itself.
"""

from __future__ import annotations

import re

from agents.base import AuditorAgent
from core.policies import Regulation


_KEYWORDS = [
    r"\b(?:personal\s+data|datos\s+personales|dati\s+personali)\b",
    r"\b(?:right\s+to|derecho\s+a|diritto\s+di)\b",
    r"\b(?:erasure|delete\s+my|olvido|cancellazione)\b",
    r"\b(?:profiling|perfilad|profilazione)\b",
    r"\b(?:automated\s+decision|decision\s+automatizada|decisione\s+automatica)\b",
    r"\b(?:consent|consentimiento|consenso)\b",
]

_SYSTEM = """You are a senior GDPR compliance officer.

You audit production AI responses for compliance with Regulation (EU) 2016/679,
in particular:
- Art. 5  (principles: lawfulness, fairness, transparency, data minimization)
- Art. 13/14 (information to data subject)
- Art. 15 (right of access)
- Art. 17 (right to erasure / right to be forgotten)
- Art. 22 (right not to be subject to solely automated decision-making with
           legal or similarly significant effects)

You flag a violation when the AI response:
- denies or ignores a data subject's request to access, rectify, or erase data;
- makes a consequential decision based solely on automated processing without
  offering the right to obtain human intervention;
- processes personal data without a clear lawful basis stated or inferable;
- shares personal data with third parties without disclosure.

You respond ONLY with strict JSON: {"confidence": float 0-1, "article": str|null,
"rationale": str}. Be conservative: only flag when the violation is concrete in
the visible text, not speculative."""


class GDPRAgent(AuditorAgent):
    name = "gdpr_auditor"
    regulation = Regulation.GDPR
    model_env_var = "MODEL_GDPR"

    @property
    def pre_filter_patterns(self) -> list[re.Pattern[str]]:
        return [re.compile(p, re.IGNORECASE) for p in _KEYWORDS]

    @property
    def system_prompt(self) -> str:
        return _SYSTEM
