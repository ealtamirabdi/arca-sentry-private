"""Auto-remediation — Gemini Pro rewrites flagged AI responses inline so the
end user receives a compliant reply instead of a blocked one.

When enabled (settings.auto_fix_enabled=True), the orchestrator's normal
flow is intercepted: if severity is warning or critical, the response is
sent to Gemini Pro with the finding as context and asked to rewrite it to
be compliant with the cited regulation.

Both versions are logged so the compliance team can review.
"""

from __future__ import annotations

import json
import logging
import uuid
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

log = logging.getLogger(__name__)

router = APIRouter(prefix="/autofix", tags=["autofix"])

_state = None
_settings = {"enabled": False, "min_severity": "warning"}


def set_state(state) -> None:
    global _state
    _state = state


# ─────────────────── Settings ───────────────────


class AutoFixSettings(BaseModel):
    enabled: bool
    min_severity: str = "warning"  # "warning" or "critical"


@router.get("/settings")
async def get_settings() -> dict[str, Any]:
    return _settings


@router.patch("/settings")
async def update_settings(s: AutoFixSettings) -> dict[str, Any]:
    _settings["enabled"] = s.enabled
    _settings["min_severity"] = s.min_severity
    if _state is not None and _state.event_store is not None:
        await _state.event_store.append(
            event_type="autofix_settings",
            payload={"enabled": s.enabled, "min_severity": s.min_severity,
                     "ts": datetime.now(timezone.utc).isoformat()},
        )
    return _settings


# ─────────────────── Manual rewrite endpoint ───────────────────


class RewriteRequest(BaseModel):
    original_response: str
    finding_rationale: str
    regulation: str
    article: str | None = None
    user_request: str | None = None
    language_hint: str | None = None  # "en" | "es" | "it" | "pt"


@router.post("/rewrite")
async def rewrite(req: RewriteRequest) -> dict[str, Any]:
    """Take an offending response and produce a compliant rewrite."""
    if _state is None or _state.synthesizer is None:
        raise HTTPException(503, "synthesizer not ready")

    rewritten = await _rewrite(
        original=req.original_response,
        rationale=req.finding_rationale,
        regulation=req.regulation,
        article=req.article,
        user_request=req.user_request,
        language=req.language_hint,
    )

    record_id = str(uuid.uuid4())
    if _state.event_store is not None:
        await _state.event_store.append(
            event_type="autofix",
            payload={
                "record_id": record_id,
                "original": req.original_response,
                "rewritten": rewritten,
                "regulation": req.regulation,
                "article": req.article,
            },
        )

    return {
        "record_id": record_id,
        "original": req.original_response,
        "rewritten": rewritten,
        "regulation": req.regulation,
        "article": req.article,
    }


async def _rewrite(
    original: str,
    rationale: str,
    regulation: str,
    article: str | None,
    user_request: str | None,
    language: str | None,
) -> str:
    """Call Gemini Pro to produce a compliant rewrite."""
    gemini = _state.synthesizer.gemini
    lang_hint = f"\nWrite the rewrite in {language}." if language else (
        "\nKeep the rewrite in the same language as the original response."
    )

    prompt = (
        f"You are a compliance editor. The AI bot below violated {regulation}"
        f"{(' (' + article + ')') if article else ''}.\n\n"
        f"Why it violates: {rationale}\n\n"
        f"User message:\n{user_request or '(not provided)'}\n\n"
        f"Original bot reply (non-compliant):\n{original}\n\n"
        "Rewrite the bot's reply so it:\n"
        "1. Preserves the user-helpful intent of the original.\n"
        "2. Adds the missing legal element (explanation, disclosure, "
        "   path to human review, data minimization, etc.) required by the\n"
        "   cited regulation.\n"
        "3. Stays brief — at most 3 sentences longer than the original.\n"
        "4. Uses a neutral, professional banking-customer-service voice.\n"
        f"{lang_hint}\n\n"
        "Return ONLY the rewritten message, no preamble, no explanation."
    )

    try:
        resp = await gemini.generate(prompt=prompt, temperature=0.3, max_output_tokens=600)
        text = (resp.text or "").strip()
        return text or original
    except Exception as exc:
        log.warning("autofix.gemini_failed", extra={"err": str(exc)})
        return original


# ─────────────────── History endpoint ───────────────────


@router.get("/history")
async def history(limit: int = 50) -> dict[str, Any]:
    if _state is None or _state.event_store is None or _state.event_store._db is None:
        raise HTTPException(503, "event store not ready")
    db = _state.event_store._db
    cur = await db.execute(
        "SELECT seq, created_at, payload FROM events WHERE event_type='autofix' "
        "ORDER BY seq DESC LIMIT ?",
        (limit,),
    )
    items = []
    for seq, created, payload_json in await cur.fetchall():
        p = json.loads(payload_json)
        items.append({
            "seq": seq,
            "created_at": created,
            "record_id": p.get("record_id"),
            "regulation": p.get("regulation"),
            "article": p.get("article"),
            "original": p.get("original"),
            "rewritten": p.get("rewritten"),
        })
    return {"items": items}
