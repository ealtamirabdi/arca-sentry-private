# ARCA SENTRY

> Continuous compliance auditing for enterprise AI systems.
> Your AI doesn't know it's breaking the law. SENTRY does.

ARCA SENTRY is a multi-agent system that audits production AI systems in real
time against European AI regulation (EU AI Act, GDPR, DORA), detecting and
preventing violations before they materialize as fines, lawsuits or
reputational damage.

Built by **B Drive IT** for the **AI Agent Olympics Hackathon** (Milan, May 2026).

## Features

- **Real-time auditing** of HTTP-based AI endpoints and voice channels
- **Five specialized auditor agents**, each domain-expert:
  - EU AI Act compliance
  - GDPR / privacy
  - DORA (financial sector resilience)
  - PII leak detection
  - Prompt injection detection
- **Voice channel audit** via Speechmatics real-time transcription with
  speaker diarization
- **Synthesizer agent** powered by Google Gemini Pro produces auditable
  legal reports
- **Open-source models** from Featherless catalog for specialized reasoning
- **Three-tier severity model**: advisory, warning, critical (blocking)
- **Append-only event store** for forensic audit
- **Deployable on Vultr** with systemd or Docker Compose

## Architecture

```
capture/    →  orchestrator  →  agents/  →  synthesizer  →  api/
   ↓             (core/)         (5x)        (Gemini)       (FastAPI)
event_store (append-only)                                  dashboard
```

## Quickstart

```bash
# Local development with Docker
make dev

# Production deploy on Vultr (Ubuntu 22.04+)
sudo bash deploy/install.sh
```

## License

MIT — see `LICENSE`.

## Status

Active development for AI Agent Olympics Hackathon (Milan, 20 May 2026).
