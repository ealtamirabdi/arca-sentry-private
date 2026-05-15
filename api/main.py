"""ARCA SENTRY — public-facing API.

Single FastAPI app that exposes:
  • /health
  • /audit               (alias of capture-proxy /capture/interaction)
  • /alerts              (recent warnings/criticals stream)
  • /reports/{iid}       (audit report PDF for an interaction)
  • /dashboard/          (static HTML dashboard)
  • /demo/run            (one-click demo: run a synthetic interaction)

The orchestrator and event store are constructed once at startup and shared.
"""

from __future__ import annotations

import logging
import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from adapters.featherless import FeatherlessClient
from agents.dora import DORAAgent
from agents.eu_ai_act import EUAIActAgent
from agents.gdpr import GDPRAgent
from agents.pii_leak import PIILeakAgent
from agents.prompt_injection import PromptInjectionAgent
from api.routes import alerts, audit, demo, reports
from core.event_store import EventStore
from core.orchestrator import Orchestrator
from synthesizer.gemini_client import Synthesizer

log = logging.getLogger(__name__)


# Module-level wiring container — populated in lifespan, consumed by routes.
class State:
    event_store: EventStore | None = None
    orchestrator: Orchestrator | None = None
    synthesizer: Synthesizer | None = None
    featherless: FeatherlessClient | None = None


state = State()


@asynccontextmanager
async def lifespan(app: FastAPI):
    logging.basicConfig(
        level=os.getenv("LOG_LEVEL", "INFO"),
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
    )
    log.info("api.startup")

    state.event_store = EventStore()
    await state.event_store.open()

    state.featherless = FeatherlessClient()
    await state.featherless.__aenter__()

    agents = [
        EUAIActAgent(state.featherless),
        GDPRAgent(state.featherless),
        DORAAgent(state.featherless),
        PIILeakAgent(state.featherless),
        PromptInjectionAgent(state.featherless),
    ]
    state.orchestrator = Orchestrator(agents=agents, event_store=state.event_store)
    state.synthesizer = Synthesizer()

    audit.set_state(state)
    alerts.set_state(state)
    reports.set_state(state)
    demo.set_state(state)

    yield

    log.info("api.shutdown")
    if state.featherless is not None:
        await state.featherless.__aexit__(None, None, None)
    if state.event_store is not None:
        await state.event_store.close()


app = FastAPI(
    title="ARCA SENTRY",
    description="Continuous compliance auditing for enterprise AI systems.",
    version="0.1.0",
    lifespan=lifespan,
)

app.include_router(audit.router)
app.include_router(alerts.router)
app.include_router(reports.router)
app.include_router(demo.router)


@app.get("/health")
async def health():
    return {"status": "ok", "service": "arca-sentry-api"}


# Mount static dashboard (single page app)
_DASHBOARD_DIR = Path(__file__).parent / "dashboard"
if _DASHBOARD_DIR.exists():
    app.mount(
        "/dashboard",
        StaticFiles(directory=str(_DASHBOARD_DIR), html=True),
        name="dashboard",
    )


def run() -> None:
    import uvicorn

    host = os.getenv("SENTRY_API_HOST", "0.0.0.0")
    port = int(os.getenv("SENTRY_API_PORT", "8088"))
    workers = int(os.getenv("SENTRY_API_WORKERS", "1"))
    uvicorn.run(
        "api.main:app",
        host=host,
        port=port,
        workers=workers,
        log_level=os.getenv("LOG_LEVEL", "info").lower(),
    )


if __name__ == "__main__":
    run()
