"""DORA auditor — Digital Operational Resilience Act (Regulation EU 2022/2554).

Applies to financial entities and critical ICT third-party providers. Focuses
on:
  • Art. 5–14 — ICT risk management framework.
  • Art. 17–23 — ICT-related incident management & reporting.
  • Art. 28–44 — ICT third-party risk (concentration, exit strategies, etc.).
  • Art. 24–27 — Digital operational resilience testing (TLPT for significant
                 entities).

In a conversational AI context this most often surfaces when:
  - the AI advises on financial products without disclosing reliance on
    third-party AI infrastructure;
  - a customer asks about an incident and the bot answers without referring
    to the incident reporting channel;
  - automated trading or asset-allocation advice is offered without the
    required resilience disclosures.
"""

from __future__ import annotations

import re

from agents.base import AuditorAgent
from core.policies import Regulation

_KEYWORDS = [
    r"\b(?:trading|trade|portfolio|invest(?:ment)?|advisor)\b",
    r"\b(?:incident|outage|breach|downtime|disruption)\b",
    r"\b(?:resilience|operational\s+risk|business\s+continuity)\b",
    r"\b(?:third[- ]party|vendor|provider|outsourc)\b",
    r"\b(?:bank|broker|insurer|insurance|aseguradora|banco|brokerage)\b",
    r"\b(?:ict|critical\s+function|fonction\s+critique)\b",
]

_SYSTEM = """You are a senior DORA (Regulation EU 2022/2554) compliance officer.

You audit production AI responses from financial entities or their critical
ICT providers for compliance with the Digital Operational Resilience Act,
in particular:
- Arts. 5–14 (ICT risk management framework)
- Arts. 17–23 (incident management and reporting)
- Arts. 28–44 (ICT third-party risk: concentration, dependence, exit strategy)
- Arts. 24–27 (operational resilience testing)

You flag a violation when the AI response:
- gives financial advice or executes transactional steps without disclosing
  the AI provider chain (in violation of third-party transparency obligations);
- describes or denies an incident without pointing to the incident-reporting
  channel required by Art. 19;
- recommends a strategy that would create unmanaged ICT concentration risk;
- communicates an outage to customers without the required content elements.

You respond ONLY with strict JSON: {"confidence": float 0-1, "article": str|null,
"rationale": str}."""


class DORAAgent(AuditorAgent):
    name = "dora_auditor"
    regulation = Regulation.DORA
    model_env_var = "MODEL_DORA"

    @property
    def pre_filter_patterns(self) -> list[re.Pattern[str]]:
        return [re.compile(p, re.IGNORECASE) for p in _KEYWORDS]

    @property
    def system_prompt(self) -> str:
        return _SYSTEM
