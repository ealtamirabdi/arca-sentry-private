# ARCA SENTRY — Regulations covered

| Code | Full name | Key articles ARCA SENTRY checks | Status |
|---|---|---|---|
| **EU AI Act** | Regulation (EU) 2024/1689 | Art. 13 (transparency), Art. 14 (human oversight), Art. 15 (accuracy/robustness), Art. 50 (disclosure of synthetic content) | Phased application 2025–2027; ARCA SENTRY targets pre-Aug-2026 readiness. |
| **GDPR** | Regulation (EU) 2016/679 | Art. 5 (principles), Art. 13/14 (information), Art. 15 (access), Art. 17 (erasure), Art. 22 (automated decisions) | In force since 2018. |
| **DORA** | Regulation (EU) 2022/2554 | Arts. 5–14 (ICT risk), Arts. 17–23 (incident reporting), Arts. 28–44 (third-party risk) | Applies since January 2025. |
| **OWASP LLM Top 10** | Industry framework | LLM01 (Prompt Injection), LLM02 (Insecure Output), LLM06 (Sensitive Info Disclosure) | Industry standard, mapped where useful. |

## What ARCA SENTRY does **not** cover (by design)

- **National data localization rules** — these vary too widely; ARCA SENTRY
  exposes the data flow so customers can apply their own jurisdictional rules.
- **Sectoral regulations** beyond DORA — MiFID II, MDR, etc. require domain
  experts; ARCA SENTRY is extensible with new agents for these verticals.
- **Bias and fairness statistical analysis** — this is a separate discipline
  with its own tooling (Holistic AI, Fairly AI). ARCA SENTRY flags
  *individual* discriminatory outputs but does not run bias metrics over
  populations.
