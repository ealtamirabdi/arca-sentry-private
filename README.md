# ARCA SENTRY

> **Continuous compliance auditing for enterprise AI systems.**
> *Your AI doesn't know it's breaking the law. SENTRY does.*

[![License: MIT](https://img.shields.io/badge/License-MIT-gold.svg)](LICENSE)
[![Python 3.11+](https://img.shields.io/badge/python-3.11+-blue.svg)](https://www.python.org/)
[![Built for AI Agent Olympics — Milan 2026](https://img.shields.io/badge/AI%20Agent%20Olympics-Milan%202026-c9a227)](https://lablab.ai/ai-hackathons/milan-ai-week-hackathon)

ARCA SENTRY is a **multi-agent compliance auditor** that watches your production AI
systems in real time and flags violations of European AI regulation **before they
become fines, lawsuits or scandals**.

Built by **[B Drive IT](https://b-drive.com.mx)** for the **AI Agent Olympics
Hackathon, Milan AI Week 2026**.

---

## Why this exists

The **EU AI Act** enters mandatory enforcement in August 2026. Fines reach
**€35M or 7% of global revenue**, whichever is higher. GDPR has already issued
**€4 billion+** in cumulative fines. DORA applies to every European financial
entity since January 2025.

Most enterprises have **no idea** if their chatbots, copilots, voice agents and
RAG systems are actually compliant. They audit once a year, manually, and find
out about violations from the regulator — too late.

**ARCA SENTRY runs continuously, in production, on every interaction.** It is
the smoke detector for enterprise AI.

---

## What it does

A user-facing AI system (chatbot, voice agent, RAG copilot) sends each
interaction to SENTRY. Five specialized agents audit it in parallel:

| Agent | Watches for | Model |
|---|---|---|
| **EU AI Act** auditor | Art. 13 transparency · Art. 14 human oversight · Art. 50 AI disclosure | DeepSeek-V3.1 |
| **GDPR** auditor | Art. 5 minimization · Art. 22 automated decisions · Art. 17 erasure | DeepSeek-V3.1 |
| **DORA** auditor | Art. 19 incident reporting · Art. 28 third-party risk | DeepSeek-V3.1 |
| **PII Leak** detector | Volunteered email/IBAN/codice fiscale/CURP/SSN/passport | Qwen-2.5-14B + regex |
| **Prompt Injection** detector | Leaked system prompts, leaked API keys, broken character | Kimi-K2-Instruct-0905 |

If at least three agents agree above the critical threshold, the response is
**blocked** before it reaches the end user. Otherwise it is logged or sent as a
warning to the compliance team.

A **Synthesizer agent** (Google Gemini 2.5-Pro) then produces an **auditable
report** in the language of the interaction — Italian, English, Spanish, French —
suitable for handing to a regulator.

Every event is written to an **append-only event store with SHA-256 hash
chaining**, so the audit log itself is tamper-evident.

---

## Live demo

The hackathon demo runs at **http://sentry.bdrive.it** (or the Vultr IP — see
deployment section).

Six pre-loaded scenarios reproduce the most common violations:

| Scenario | Trigger | Outcome |
|---|---|---|
| `credit_denial` (EN) | Loan denied without explanation | EU AI Act Art. 13 — warning |
| `credit_denial_es` (ES) | Crédito rechazado sin explicación | EU AI Act Art. 13 — warning, rationale in Spanish |
| `pii_leak` | Volunteered email + Italian codice fiscale | GDPR Art. 5/32 — warning |
| `prompt_injection` | "Ignore previous instructions" complied | OWASP LLM01 + DORA Art. 19 — warning (2 findings) |
| `dora_incident` | Bot denies an outage that happened | DORA Art. 19 — warning |
| `voice_no_disclosure` (IT) | User asks "parlo con un operatore?", bot says yes | EU AI Act Art. 50 — warning, rationale in Italian |

Click each scenario on the dashboard; you'll see the agents light up, the
verdict appear, the alert table update, and a full PDF report become
downloadable — all in under 6 seconds end to end.

---

## Architecture

```
                                ┌─────────────────────┐
   Production AI ────POST────►  │  capture/api_proxy  │
   (HTTP endpoint)              │  capture/voice_tap  │
                                └──────────┬──────────┘
                                           │ Interaction
                                           ▼
                                ┌──────────────────────┐
                                │   core/orchestrator  │
                                └──────────┬───────────┘
                          ┌────────┬───────┼────────┬──────────┐
                          ▼        ▼       ▼        ▼          ▼
                       EU AI Act  GDPR   DORA   PII Leak  Prompt Injection
                       (Featherless: DeepSeek-V3.1 / Kimi-K2 / Qwen)
                          │        │       │        │          │
                          └────────┴───┬───┴────────┴──────────┘
                                       ▼ Findings
                                ┌──────────────────────┐
                                │  classify_severity   │
                                │  (advisory/warning/  │
                                │   critical)          │
                                └──────────┬───────────┘
                                           ▼
                                ┌──────────────────────┐
                                │  synthesizer/gemini  │── Gemini 2.5-Pro
                                └──────────┬───────────┘
                                           ▼
                                ┌──────────────────────┐
                                │ event_store (SQLite) │── append-only · SHA-256 chain
                                └──────────┬───────────┘
                                           ▼
                                ┌──────────────────────┐
                                │  api/ + dashboard    │
                                └──────────────────────┘
```

See [`docs/architecture.md`](docs/architecture.md) for layer-by-layer detail,
the severity model, latency budgets, and the tamper-evident log design.

---

## Sponsors used (organic, not cosmetic)

| Sponsor | Used by | How |
|---|---|---|
| 🟢 **Google Gemini** | `synthesizer/` | Gemini 2.5-Pro writes the multilingual auditor's report |
| 🟢 **Featherless** | All 5 auditor agents | Domain-specialized open-source models per agent — exactly the *Domain-Specialized* requirement |
| 🟢 **Speechmatics** | `capture/voice_tap.py` | Real-time speaker-diarized transcription for the voice channel audit |
| 🟢 **Vultr** | Deployment target | This repository is deployed on Vultr (see the live demo URL) |
| ⚪ Kraken | not used | Out of scope for compliance auditing |

---

## Tracks covered

All five official tracks of the AI Agent Olympics Hackathon are addressed:

- ✅ **Intelligent Reasoning** — each agent reasons over the legal interpretation
- ✅ **Agentic Workflows** — full multi-agent DAG with asyncio.gather and consensus
- ✅ **Enterprise Utility** — B2B regulated verticals (bank, insurance, healthcare, gov)
- ✅ **Multimodal Intelligence** — voice (Speechmatics) + text + structured logs
- ✅ **Collaborative Systems** — five specialized agents deliberate per interaction

---

## Quickstart (local)

```bash
git clone https://github.com/ealtamirabdi/arca-sentry.git
cd arca-sentry
python3 -m venv .venv
.venv/bin/pip install -e ".[dev]"
cp .env.example .env
# Fill in GEMINI_API_KEY, FEATHERLESS_API_KEY, SPEECHMATICS_API_KEY
PYTHONPATH=. .venv/bin/python -m api.main
# → http://localhost:8088/dashboard
```

Or with Docker:

```bash
cp .env.example .env  # fill keys
docker compose up -d
```

## Production install (Vultr / any Linux)

```bash
sudo bash deploy/install.sh
sudo systemctl start arca-sentry-api
# → http://<your-ip>:8088/dashboard
```

The installer is idempotent and tested on Ubuntu 22.04 / 24.04 on both
**x86_64** and **ARM64** (NVIDIA Grace Hopper validated).

---

## Why us, not Credo AI / Holistic AI / Fairly AI

| | Credo AI | Holistic AI | Fairly AI | **ARCA SENTRY** |
|---|---|---|---|---|
| Real-time voice audit | ❌ | ❌ | ❌ | ✅ |
| Bilingual native (EN/ES/IT) | ❌ | ❌ | ❌ | ✅ |
| EU AI Act post-August 2026 | 🟡 | 🟡 | ❌ | ✅ |
| Multi-agent consensus | ❌ | ❌ | ❌ | ✅ |
| Append-only tamper-evident log | ❌ | ❌ | ❌ | ✅ SHA-256 |
| Latin America go-to-market | ❌ | ❌ | ❌ | ✅ |
| Open source | ❌ | ❌ | ❌ | ✅ MIT |

---

## Repository layout

```
arca-sentry/
├── core/                event store · orchestrator · severity policies
├── agents/              EU AI Act · GDPR · DORA · PII leak · prompt injection
├── adapters/            Featherless · Gemini · Speechmatics
├── capture/             HTTP proxy · voice tap
├── synthesizer/         Gemini Pro reasoning · PDF report generator
├── api/                 FastAPI + dashboard (vanilla JS, no framework)
├── db/                  PostgreSQL schema (optional, for enterprise)
├── deploy/              Dockerfile · systemd units · install.sh
├── tests/               14 tests · pytest-asyncio
└── docs/                architecture.md · regulations.md
```

---

## Numbers

- **3,690** lines of code total, **2,790** Python
- **14/14** tests passing
- **<6 s** end-to-end latency for a flagged interaction (5 agents in parallel)
- **3** language families validated (English, Spanish, Italian)
- **MIT-licensed** from commit 0

---

## Team

Built by **Edgar Altamira** at **B Drive IT** ([b-drive.com.mx](https://b-drive.com.mx)) —
a Mexican AI consultancy specialized in enterprise multi-agent systems.

---

## License

MIT — see [`LICENSE`](LICENSE). Use it, fork it, sell it.

---

*Built in May 2026 for the AI Agent Olympics Hackathon, Milan AI Week.
The compliance smoke detector your enterprise AI didn't know it needed.*
