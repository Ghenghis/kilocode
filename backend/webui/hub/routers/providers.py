"""Hub v2 router — provider detection, health, circuit breakers, profiles (/api/providers/*)."""
import json
import os
import re
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional
import uuid
from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse
import httpx
from hub.config import PROVIDER_HEALTH_URLS
from hub.auth import require_write
from hub.event_bus import emit

_CIRCUIT: dict = {
    pid: {"state": "closed", "failures": 0, "last_ok": None, "last_fail": None, "latency_ms": None}
    for pid in PROVIDER_HEALTH_URLS
}

_ACTIVITY_LOG: list = []

# ── Saved profiles (in-memory, persisted to _PROFILES_FILE) ───────────────────
_PROFILES: list[dict] = []
_PROFILES_FILE = Path(os.environ.get("HUB_PROFILES_FILE", "provider_profiles.json"))


def _ts() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def _load_profiles() -> None:
    global _PROFILES
    if _PROFILES_FILE.exists():
        try:
            _PROFILES = json.loads(_PROFILES_FILE.read_text(encoding="utf-8"))
        except Exception:
            _PROFILES = []


def _save_profiles() -> None:
    try:
        _PROFILES_FILE.write_text(json.dumps(_PROFILES, indent=2), encoding="utf-8")
    except Exception:
        pass


# ── Provider detection (ported from OpenClaude state.js getOpenAICompatibleLabel) ─
_PROVIDER_PATTERNS: list[tuple[str, str]] = [
    (r"api\.minimaxi\.chat", "MiniMax"),
    (r"api\.minimax\.io", "MiniMax"),
    (r"localhost:1234|100\.117\.190\.97:1234|lmstudio", "LM Studio"),
    (r"localhost:11434|host\.docker\.internal:11434|ollama", "Ollama"),
    (r"api\.openai\.com", "OpenAI"),
    (r"api\.anthropic\.com", "Anthropic"),
    (r"api\.deepseek\.com", "DeepSeek"),
    (r"openrouter\.ai", "OpenRouter"),
    (r"api\.together\.xyz", "Together AI"),
    (r"api\.groq\.com", "Groq"),
    (r"api\.mistral\.ai", "Mistral"),
    (r"\.openai\.azure\.com", "Azure OpenAI"),
    (r"api\.siliconflow\.com", "SiliconFlow"),
    (r"generativelanguage\.googleapis\.com", "Google AI"),
    (r"localhost:\d+|127\.0\.0\.1:\d+|0\.0\.0\.0:\d+", "Local (custom)"),
]


def detect_provider(base_url: str, model: str = "") -> dict:
    """Detect the AI provider from a base URL and optional model name.
    Returns {label, detail, source, baseUrl, model, tone}."""
    if not base_url:
        return {"label": "Unknown", "detail": "No base URL provided", "source": "none",
                "baseUrl": "", "model": model, "tone": "critical"}
    url_lower = base_url.lower()
    for pattern, label in _PROVIDER_PATTERNS:
        if re.search(pattern, url_lower, re.IGNORECASE):
            tone = "positive"
            detail = f"Detected from URL pattern: {pattern}"
            return {"label": label, "detail": detail, "source": "url",
                    "baseUrl": base_url, "model": model, "tone": tone}
    # Model-name heuristics
    if model:
        m = model.lower()
        if "gpt" in m or "o1" in m or "o3" in m:
            return {"label": "OpenAI", "detail": "Detected from model name",
                    "source": "model", "baseUrl": base_url, "model": model, "tone": "positive"}
        if "claude" in m:
            return {"label": "Anthropic", "detail": "Detected from model name",
                    "source": "model", "baseUrl": base_url, "model": model, "tone": "positive"}
        if "minimax" in m:
            return {"label": "MiniMax", "detail": "Detected from model name",
                    "source": "model", "baseUrl": base_url, "model": model, "tone": "positive"}
        if "deepseek" in m:
            return {"label": "DeepSeek", "detail": "Detected from model name",
                    "source": "model", "baseUrl": base_url, "model": model, "tone": "positive"}
    return {"label": "Unknown", "detail": f"Could not detect provider from {base_url}",
            "source": "unknown", "baseUrl": base_url, "model": model, "tone": "warning"}


def _detect_from_env() -> list[dict]:
    """Scan environment variables and .env files for provider configurations."""
    results = []
    # Check known env patterns
    env_pairs = [
        ("MINIMAX_BASE_URL", "MINIMAX_MODEL", "minimax"),
        ("LMSTUDIO_BASE_URL", "LMSTUDIO_MODEL", "lmstudio"),
        ("OPENAI_BASE_URL", "OPENAI_MODEL", "openai"),
        ("OLLAMA_BASE_URL", "OLLAMA_MODEL", "ollama"),
        ("ANTHROPIC_BASE_URL", "ANTHROPIC_MODEL", "anthropic"),
    ]
    for url_key, model_key, pid in env_pairs:
        url = os.environ.get(url_key, "")
        model = os.environ.get(model_key, "")
        if url:
            det = detect_provider(url, model)
            det["env_key"] = url_key
            det["provider_id"] = pid
            results.append(det)
    # Also detect from PROVIDER_HEALTH_URLS config
    from hub.config import (LM_STUDIO_URL, OLLAMA_URL, LITELLM_URL)
    for pid, url in [("lmstudio", LM_STUDIO_URL), ("ollama", OLLAMA_URL), ("litellm", LITELLM_URL)]:
        if url and not any(r.get("provider_id") == pid for r in results):
            det = detect_provider(url)
            det["provider_id"] = pid
            det["source"] = "config"
            results.append(det)
    return results


_load_profiles()


async def _probe(pid: str, url: str) -> dict:
    c = _CIRCUIT[pid]
    start = time.monotonic()
    try:
        async with httpx.AsyncClient(timeout=4.0) as cl:
            r = await cl.get(url, headers={"Authorization": "Bearer na"})
        ok = r.status_code < 500
    except Exception:
        ok = False
    latency = round((time.monotonic() - start) * 1000)
    now = _ts()
    c["latency_ms"] = latency if ok else None
    if ok:
        c["last_ok"] = now
        c["failures"] = 0
        if c["state"] == "open":
            c["state"] = "half-open"
        elif c["state"] == "half-open":
            c["state"] = "closed"
    else:
        c["failures"] += 1
        c["last_fail"] = now
        if c["failures"] >= 3:
            c["state"] = "open"
    return {"provider": pid, "ok": ok, "latency_ms": latency, "circuit": c["state"], **c}


def create_router() -> APIRouter:
    router = APIRouter(prefix="/api/providers", tags=["providers"])

    # ── Detection endpoints ───────────────────────────────────────────────────
    @router.get("/detect")
    async def providers_detect():
        """Auto-detect configured providers from env vars and config."""
        detected = _detect_from_env()
        # Also include configured PROVIDER_HEALTH_URLS entries not yet detected
        for pid, url in PROVIDER_HEALTH_URLS.items():
            if not any(r.get("provider_id") == pid for r in detected):
                det = detect_provider(url)
                det["provider_id"] = pid
                det["source"] = "health_config"
                detected.append(det)
        return JSONResponse({"detected": detected, "ts": _ts()})

    @router.post("/detect")
    async def detect_custom(request: Request):
        """Detect provider from a user-supplied baseUrl + model."""
        body = {}
        try:
            body = await request.json()
        except Exception:
            pass
        result = detect_provider(body.get("baseUrl", ""), body.get("model", ""))
        return JSONResponse({"result": result, "ts": _ts()})

    # ── Profile CRUD ──────────────────────────────────────────────────────────
    @router.get("/profiles")
    async def list_profiles():
        """List saved provider profiles."""
        return JSONResponse({"profiles": _PROFILES, "ts": _ts()})

    @router.post("/profiles", dependencies=[Depends(require_write)])
    async def save_profile(request: Request):
        """Save a new provider profile."""
        body = {}
        try:
            body = await request.json()
        except Exception:
            pass
        profile = {
            "id": str(uuid.uuid4())[:8],
            "name": body.get("name", "Untitled"),
            "baseUrl": body.get("baseUrl", ""),
            "model": body.get("model", ""),
            "apiKey": body.get("apiKey", ""),
            "created_at": _ts(),
            **detect_provider(body.get("baseUrl", ""), body.get("model", "")),
        }
        _PROFILES.append(profile)
        _save_profiles()
        emit("provider.profile.saved", {"id": profile["id"], "name": profile["name"]})
        return JSONResponse({"ok": True, "profile": profile})

    @router.delete("/profiles/{profile_id}", dependencies=[Depends(require_write)])
    async def delete_profile(profile_id: str):
        """Delete a saved provider profile."""
        global _PROFILES
        before = len(_PROFILES)
        _PROFILES = [p for p in _PROFILES if p.get("id") != profile_id]
        if len(_PROFILES) == before:
            return JSONResponse({"error": "profile not found"}, status_code=404)
        _save_profiles()
        emit("provider.profile.deleted", {"id": profile_id})
        return JSONResponse({"ok": True, "id": profile_id})

    # ── Health / circuit ──────────────────────────────────────────────────────
    @router.get("/status")
    async def providers_status():
        import asyncio
        results = await asyncio.gather(*[_probe(pid, url) for pid, url in PROVIDER_HEALTH_URLS.items()])
        return JSONResponse({"providers": list(results), "ts": _ts()})

    @router.get("/circuit")
    async def providers_circuit():
        return JSONResponse({"circuits": _CIRCUIT, "ts": _ts()})

    @router.post("/{pid}/reset", dependencies=[Depends(require_write)])
    async def reset_circuit(pid: str):
        if pid not in _CIRCUIT:
            return JSONResponse({"error": "unknown provider"}, status_code=404)
        _CIRCUIT[pid]["state"] = "closed"
        _CIRCUIT[pid]["failures"] = 0
        _ACTIVITY_LOG.insert(0, {"ts": _ts(), "agent": "user",
                                  "type": "circuit.reset", "detail": f"Circuit reset for {pid}"})
        emit("provider.circuit.reset", {"provider": pid})
        return JSONResponse({"ok": True, "provider": pid, "circuit": _CIRCUIT[pid]})

    @router.post("/{pid}/failover", dependencies=[Depends(require_write)])
    async def force_failover(pid: str):
        if pid not in _CIRCUIT:
            return JSONResponse({"error": "unknown provider"}, status_code=404)
        _CIRCUIT[pid]["state"] = "open"
        _CIRCUIT[pid]["failures"] = 3
        now = _ts()
        _CIRCUIT[pid]["last_fail"] = now
        emit("provider.failover.forced", {"provider": pid})
        return JSONResponse({"ok": True, "provider": pid, "circuit": "open"})

    return router
