"""
Hub v2 — Centralized configuration.

All provider endpoint defaults and environment variable bindings live here.
This is the ONLY place where default URLs are set. Do not hardcode URLs elsewhere.
"""
import os

# ── Core service URLs ──────────────────────────────────────────────────────────
RUNTIME_URL   = os.environ.get("RUNTIME_URL",   "http://localhost:8081")
SETTINGS_URL  = os.environ.get("SETTINGS_URL",  "http://localhost:8082")
HERMES_URL    = os.environ.get("HERMES_URL",    "http://localhost:8091")

# FIXED: LM Studio runs at 100.117.190.97:1234, NOT localhost
LM_STUDIO_URL = os.environ.get("LM_STUDIO_URL", "http://100.117.190.97:1234")

OLLAMA_URL    = os.environ.get("OLLAMA_URL",    "http://host.docker.internal:11434")
LITELLM_URL   = os.environ.get("LITELLM_URL",   "http://localhost:4000")

# ── VPS / Discord ──────────────────────────────────────────────────────────────
VPS_HOST      = os.environ.get("VPS_HOST",      "187.77.30.206")
BOT_BASE_PORT = int(os.environ.get("BOT_BASE_PORT", "8200"))

# ── Open WebUI ─────────────────────────────────────────────────────────────────
OPENWEBUI_URL          = os.environ.get("OPENWEBUI_URL",          "http://host.docker.internal:3000")
OPENWEBUI_PIPELINES_URL = os.environ.get("OPENWEBUI_PIPELINES_URL", "http://host.docker.internal:9099")
OPENWEBUI_API_KEY      = os.environ.get("OPENWEBUI_API_KEY",      "0p3n-w3bu!")

# ── Staging / promotion ────────────────────────────────────────────────────────
STAGING_PORT  = int(os.environ.get("STAGING_PORT", "8099"))
LIVE_PORT     = int(os.environ.get("LIVE_PORT",    "8081"))

# ── Auth ───────────────────────────────────────────────────────────────────────
# Set HUB_ADMIN_TOKEN to a secret string. Empty = warn but allow (dev mode).
HUB_ADMIN_TOKEN = os.environ.get("HUB_ADMIN_TOKEN", "")

# ── General ────────────────────────────────────────────────────────────────────
TIMEOUT = float(os.environ.get("HUB_TIMEOUT", "6.0"))

# ── Provider health-check URLs ─────────────────────────────────────────────────
# FIXED: siliconflow.com (NOT .cn), minimaxi.chat (NOT minimax.chat — old domain is dead)
PROVIDER_HEALTH_URLS: dict[str, str] = {
    "lmstudio":    LM_STUDIO_URL + "/v1/models",
    "ollama":      OLLAMA_URL + "/api/tags",
    "litellm":     LITELLM_URL + "/health",
    "minimax":     "https://api.minimaxi.chat/v1/models",
    "siliconflow": "https://api.siliconflow.com/v1/models",
}
