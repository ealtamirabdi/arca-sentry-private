# ARCA SENTRY — Architecture

## Overview

ARCA SENTRY is a multi-agent compliance auditor for production AI systems.
Every interaction (text or voice) flows through five specialized auditor
agents in parallel; their findings feed a Synthesizer powered by Gemini Pro;
the verdict is persisted to an append-only event store and surfaced via API
and dashboard.

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
                       eu_ai_act  gdpr   dora   pii_leak  prompt_injection
                       (Featherless model per agent)
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
                                │  synthesizer/gemini  │── Gemini Pro
                                └──────────┬───────────┘
                                           ▼
                                ┌──────────────────────┐
                                │   event_store (SQL)  │── append-only, hash-chain
                                └──────────┬───────────┘
                                           ▼
                                ┌──────────────────────┐
                                │  api/ + dashboard    │
                                └──────────────────────┘
```

## Folder responsibilities

| Folder | Responsibility | Stable boundary |
|---|---|---|
| `core/` | Event store + orchestrator + severity policies. Pure domain logic. | Imported by everything; imports nothing from siblings. |
| `agents/` | Five auditor agents. Each focuses on one regulation or risk. | Imports `core/` and `adapters/featherless`. |
| `capture/` | HTTP proxy + voice tap. Bridges enterprise traffic to orchestrator. | Imports `core/`, `agents/`, `adapters/`. |
| `synthesizer/` | Gemini Pro reasoning + PDF report generation. | Imports `adapters/gemini`. |
| `adapters/` | Anti-corruption layer for external services (Featherless, Gemini, Speechmatics). | Imports nothing from sibling layers. |
| `api/` | Public FastAPI surface + static dashboard. | Composes everything. |
| `db/` | Optional PostgreSQL schema for enterprise deployments. | Schema only. |
| `deploy/` | Dockerfile, systemd units, installer. | Operational. |
| `tests/` | Unit and integration tests, fast and offline by default. | — |
| `docs/` | This file and others. | — |

## Why this segmentation

Each folder has a single responsibility and a stable downward-only import
direction:

- `adapters/` knows about external APIs but nothing about ARCA's domain.
- `core/` knows about ARCA's domain but nothing about external APIs.
- `agents/` and `synthesizer/` compose the two.
- `capture/` and `api/` are entry points; nothing depends on them.

This means each layer can be replaced (e.g. swap PostgreSQL for SQLite, swap
Gemini for another frontier model, add a new auditor) without touching the
others.

## Severity model

A three-tier model deliberately chosen to limit false-positive disruption:

| Severity | Trigger | Action |
|---|---|---|
| advisory | Any finding ≥ 0.5 confidence | Logged. No alert. |
| warning | Any finding ≥ 0.7 confidence | Compliance team notified. |
| critical | ≥ 3 findings ≥ 0.85 confidence (consensus) | Response blocked at the gateway. |

The consensus rule for critical means a single hallucinating agent cannot
unilaterally block production traffic. Three agents must converge.

## Latency budget

- Pre-filter regex pass: ~0.1 ms per agent.
- Featherless call (specialized small model): ~300–700 ms per agent.
- Five agents run concurrently with `asyncio.gather`, so p95 ≈ slowest agent.
- Gemini Pro synthesis: ~1–2 s, only invoked when findings exist.
- Event store write: ~1 ms per record (SQLite WAL mode).

Target p95 for end-to-end audit on a flagged interaction: **< 2 seconds**.
Target p95 for clean (no agent fires past pre-filter): **< 50 ms**.

## Tamper-evident audit log

The event store is append-only at the application layer (no UPDATE/DELETE
methods exposed). Each record carries a SHA-256 hash chaining to the previous
record, allowing regulators to verify integrity end-to-end via
`EventStore.verify_integrity()`. The PostgreSQL alternative enforces
immutability at the database layer via row-level triggers.
