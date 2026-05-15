"""Proxy Mode — drop-in compatible with OpenAI / Anthropic / Gemini.

The differentiator: the developer changes a single line (the base_url) and
SENTRY intercepts every call, audits it, and decides whether to forward,
allow with a warning header, or block at the gateway with HTTP 451.

  # Before
  client = OpenAI(api_key="…")

  # After
  client = OpenAI(api_key="…", base_url="https://sentry.example.com/v1")

Three endpoints, mirroring the three popular APIs:
  • /v1/chat/completions  → OpenAI-compatible
  • /v1/messages          → Anthropic-compatible
  • /v1beta/models/{model}:generateContent → Gemini-compatible
"""

from __future__ import annotations

import json
import logging
import uuid
from datetime import datetime, timezone
from typing import Any

import httpx
from fastapi import APIRouter, HTTPException, Request, Response
from fastapi.responses import JSONResponse

from core.orchestrator import Interaction
from core.policies import Severity

log = logging.getLogger(__name__)

router = APIRouter(prefix="", tags=["proxy"])

_state = None


def set_state(state) -> None:
    global _state
    _state = state


# ─────────────────── Helpers ───────────────────


async def _audit(user_msg: str, bot_msg: str, actor: str, metadata: dict) -> dict[str, Any]:
    """Run the orchestrator on this interaction and return decision dict."""
    interaction = Interaction(
        interaction_id=str(uuid.uuid4()),
        timestamp=datetime.now(timezone.utc).isoformat(),
        channel="proxy",
        actor=actor,
        request=user_msg,
        response=bot_msg,
        metadata={**metadata, "source": "proxy"},
    )
    decision = await _state.orchestrator.process(interaction)
    return {
        "interaction_id": decision.interaction_id,
        "severity": decision.severity.value,
        "action_taken": decision.action_taken,
        "findings": [
            {
                "agent": f.agent_name,
                "regulation": f.regulation.value,
                "article": f.article,
                "confidence": f.confidence,
                "rationale": f.rationale,
            }
            for f in decision.findings
        ],
    }


def _sentry_headers(decision: dict[str, Any]) -> dict[str, str]:
    h = {
        "X-Sentry-Severity": decision["severity"],
        "X-Sentry-Action": decision["action_taken"],
        "X-Sentry-Interaction-Id": decision["interaction_id"],
        "X-Sentry-Finding-Count": str(len(decision["findings"])),
    }
    if decision["findings"]:
        primary = decision["findings"][0]
        h["X-Sentry-Primary-Regulation"] = primary["regulation"]
        if primary.get("article"):
            h["X-Sentry-Primary-Article"] = primary["article"]
    return h


def _block_response(decision: dict[str, Any], api_format: str) -> Response:
    """Return an HTTP 451 in the upstream API's error shape."""
    findings = decision["findings"]
    first = findings[0] if findings else {}
    reason = first.get("rationale", "Blocked by SENTRY compliance gate.")
    article = first.get("article") or first.get("regulation", "")

    payload: dict[str, Any]
    if api_format == "openai":
        payload = {
            "error": {
                "message": f"Response blocked by SENTRY · {article} · {reason}",
                "type": "compliance_block",
                "code": "blocked_by_sentry",
                "param": None,
            }
        }
    elif api_format == "anthropic":
        payload = {
            "type": "error",
            "error": {
                "type": "compliance_block",
                "message": f"Response blocked by SENTRY · {article} · {reason}",
            },
        }
    else:  # gemini-ish
        payload = {
            "error": {
                "code": 451,
                "message": f"Response blocked by SENTRY · {article} · {reason}",
                "status": "BLOCKED_BY_SENTRY",
            }
        }

    return JSONResponse(
        status_code=451,
        content=payload,
        headers=_sentry_headers(decision),
    )


# ─────────────────── OpenAI-compatible ───────────────────


@router.post("/v1/chat/completions")
async def openai_chat_completions(request: Request):
    """Drop-in for any OpenAI client. Forwards to OPENAI_UPSTREAM_BASE
    (default: api.openai.com) and audits before returning."""
    body = await request.json()
    auth = request.headers.get("authorization", "")
    if not auth:
        raise HTTPException(401, "Missing Authorization header — pass your upstream OpenAI key")

    # extract user message from messages array
    messages = body.get("messages", [])
    user_msg = " | ".join(m.get("content", "") for m in messages if m.get("role") == "user")[:8000]
    model = body.get("model", "unknown")

    upstream_base = "https://api.openai.com"
    timeout = httpx.Timeout(60.0)

    async with httpx.AsyncClient(timeout=timeout) as client:
        try:
            r = await client.post(
                f"{upstream_base}/v1/chat/completions",
                json=body,
                headers={"Authorization": auth, "Content-Type": "application/json"},
            )
        except httpx.HTTPError as exc:
            raise HTTPException(502, f"Upstream OpenAI unreachable: {exc}") from exc

    if r.status_code != 200:
        # forward upstream errors verbatim
        return Response(content=r.content, status_code=r.status_code,
                        headers={"content-type": r.headers.get("content-type", "application/json")})

    try:
        data = r.json()
        bot_msg = data["choices"][0]["message"]["content"]
    except (json.JSONDecodeError, KeyError, IndexError):
        return Response(content=r.content, status_code=200,
                        headers={"content-type": "application/json"})

    decision = await _audit(user_msg, bot_msg, f"openai:{model}", {"upstream": "openai"})

    if decision["severity"] == "critical":
        return _block_response(decision, "openai")

    # forward upstream response with SENTRY headers attached
    return JSONResponse(content=data, headers=_sentry_headers(decision))


# ─────────────────── Anthropic-compatible ───────────────────


@router.post("/v1/messages")
async def anthropic_messages(request: Request):
    body = await request.json()
    api_key = request.headers.get("x-api-key", "")
    if not api_key:
        raise HTTPException(401, "Missing x-api-key header (Anthropic style)")

    messages = body.get("messages", [])
    user_msg = ""
    for m in messages:
        if m.get("role") == "user":
            content = m.get("content", "")
            if isinstance(content, str):
                user_msg += content + " "
            elif isinstance(content, list):
                for c in content:
                    if c.get("type") == "text":
                        user_msg += c.get("text", "") + " "
    user_msg = user_msg.strip()[:8000]
    model = body.get("model", "unknown")

    async with httpx.AsyncClient(timeout=httpx.Timeout(60.0)) as client:
        try:
            r = await client.post(
                "https://api.anthropic.com/v1/messages",
                json=body,
                headers={
                    "x-api-key": api_key,
                    "anthropic-version": request.headers.get("anthropic-version", "2023-06-01"),
                    "content-type": "application/json",
                },
            )
        except httpx.HTTPError as exc:
            raise HTTPException(502, f"Upstream Anthropic unreachable: {exc}") from exc

    if r.status_code != 200:
        return Response(content=r.content, status_code=r.status_code,
                        headers={"content-type": r.headers.get("content-type", "application/json")})

    try:
        data = r.json()
        # extract text from content blocks
        bot_msg = " ".join(
            block.get("text", "")
            for block in data.get("content", [])
            if block.get("type") == "text"
        )
    except (json.JSONDecodeError, KeyError):
        return Response(content=r.content, status_code=200,
                        headers={"content-type": "application/json"})

    decision = await _audit(user_msg, bot_msg, f"anthropic:{model}", {"upstream": "anthropic"})

    if decision["severity"] == "critical":
        return _block_response(decision, "anthropic")

    return JSONResponse(content=data, headers=_sentry_headers(decision))


# ─────────────────── Gemini-compatible ───────────────────


@router.post("/v1beta/models/{model}:generateContent")
async def gemini_generate(model: str, request: Request):
    body = await request.json()
    api_key = (
        request.query_params.get("key")
        or request.headers.get("x-goog-api-key", "")
    )
    if not api_key:
        raise HTTPException(401, "Missing ?key= query param or x-goog-api-key header")

    # extract user text from contents
    contents = body.get("contents", [])
    user_msg = ""
    for c in contents:
        for part in c.get("parts", []):
            if "text" in part:
                user_msg += part["text"] + " "
    user_msg = user_msg.strip()[:8000]

    async with httpx.AsyncClient(timeout=httpx.Timeout(60.0)) as client:
        try:
            r = await client.post(
                f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent",
                json=body,
                params={"key": api_key},
                headers={"Content-Type": "application/json"},
            )
        except httpx.HTTPError as exc:
            raise HTTPException(502, f"Upstream Gemini unreachable: {exc}") from exc

    if r.status_code != 200:
        return Response(content=r.content, status_code=r.status_code,
                        headers={"content-type": r.headers.get("content-type", "application/json")})

    try:
        data = r.json()
        bot_msg = ""
        for cand in data.get("candidates", []):
            for part in cand.get("content", {}).get("parts", []):
                if "text" in part:
                    bot_msg += part["text"]
    except (json.JSONDecodeError, KeyError):
        return Response(content=r.content, status_code=200,
                        headers={"content-type": "application/json"})

    decision = await _audit(user_msg, bot_msg, f"gemini:{model}", {"upstream": "gemini"})

    if decision["severity"] == "critical":
        return _block_response(decision, "gemini")

    return JSONResponse(content=data, headers=_sentry_headers(decision))


# ─────────────────── Status endpoint for the UI ───────────────────


@router.get("/proxy/status")
async def proxy_status() -> dict[str, Any]:
    """Stats specific to proxy-mode traffic for the UI."""
    if _state is None or _state.event_store is None or _state.event_store._db is None:
        raise HTTPException(503, "event store not ready")
    db = _state.event_store._db

    cur = await db.execute(
        "SELECT payload FROM events WHERE event_type='interaction' "
        "AND json_extract(payload, '$.channel') = 'proxy' "
        "ORDER BY seq DESC LIMIT 200"
    )
    rows = await cur.fetchall()
    total = len(rows)
    by_upstream: dict[str, int] = {}
    for (payload_json,) in rows:
        p = json.loads(payload_json)
        upstream = p.get("metadata", {}).get("upstream", "unknown")
        by_upstream[upstream] = by_upstream.get(upstream, 0) + 1

    return {
        "total_proxied": total,
        "by_upstream": by_upstream,
        "endpoints": [
            {"path": "/v1/chat/completions", "provider": "OpenAI"},
            {"path": "/v1/messages", "provider": "Anthropic"},
            {"path": "/v1beta/models/{model}:generateContent", "provider": "Google Gemini"},
        ],
    }
