"""
B5 — Live E2E proof tests against VPS 187.77.30.206 + local services.
Runs against real endpoints (no mocks).

For VPS services, forward ports first:
  ssh -L 18081:localhost:8081 -L 18082:localhost:8082 \
      -L 18091:localhost:8091 -L 18095:localhost:8095 \
      root@187.77.30.206

Local LM Studio / Ollama tested directly (localhost).
"""
import json
import pytest
import httpx

VPS = "187.77.30.206"

# VPS services (via SSH tunnel)
RUNTIME_URL  = "http://localhost:18081"
SETTINGS_URL = "http://localhost:18082"
HERMES_URL   = "http://localhost:18091"
WEBUI_URL    = "http://localhost:18095"
OPENWEBUI_URL = "https://hermes.daveai.tech"

# Local model servers (direct, no tunnel needed)
LM_STUDIO_URL = "http://localhost:1234"
OLLAMA_URL    = "http://localhost:11434"
LITELLM_URL   = "http://localhost:4000"

TIMEOUT = 15.0


def _reachable(url: str) -> bool:
    try:
        return httpx.get(url, timeout=3.0).status_code < 500
    except Exception:
        return False


# ─── Runtime (port 8081) ────────────────────────────────────────────────────

def test_runtime_health():
    r = httpx.get(f"{RUNTIME_URL}/health", timeout=TIMEOUT)
    assert r.status_code == 200
    data = r.json()
    assert data["status"] == "healthy"
    assert "components" in data


def test_runtime_settings_endpoint():
    r = httpx.get(f"{RUNTIME_URL}/api/settings", timeout=TIMEOUT)
    assert r.status_code == 200


def test_runtime_events_endpoint():
    r = httpx.get(f"{RUNTIME_URL}/api/events", timeout=TIMEOUT)
    assert r.status_code == 200


# ─── Hermes (port 8091) ─────────────────────────────────────────────────────

def test_hermes_health():
    r = httpx.get(f"{HERMES_URL}/health", timeout=TIMEOUT)
    assert r.status_code == 200
    data = r.json()
    assert data["status"] == "healthy"
    assert data["service"] == "kilocode-hermes"


def test_hermes_intake_shell_task():
    payload = {
        "task_type": "shell",
        "description": "echo proof-b5-playwright",
        "evidence": [],
        "priority": "normal"
    }
    r = httpx.post(f"{HERMES_URL}/intake", json=payload, timeout=TIMEOUT)
    assert r.status_code == 200
    data = r.json()
    assert "task_id" in data or "contract_id" in data or "status" in data


def test_hermes_intake_git_task():
    payload = {
        "task_type": "git",
        "description": "git status proof",
        "evidence": [],
        "priority": "low"
    }
    r = httpx.post(f"{HERMES_URL}/intake", json=payload, timeout=TIMEOUT)
    assert r.status_code == 200


def test_hermes_intake_returns_task_id():
    payload = {"task_type": "shell", "description": "unique-proof-task", "evidence": []}
    r = httpx.post(f"{HERMES_URL}/intake", json=payload, timeout=TIMEOUT)
    assert r.status_code == 200
    data = r.json()
    assert "task_id" in data
    assert len(data["task_id"]) > 8


def test_hermes_intake_status_normalized():
    payload = {"task_type": "shell", "description": "status-check", "evidence": []}
    r = httpx.post(f"{HERMES_URL}/intake", json=payload, timeout=TIMEOUT)
    assert r.status_code == 200
    data = r.json()
    assert data.get("status") == "normalized"


# ─── WebUI control center (port 8095) ───────────────────────────────────────

def test_webui_health():
    r = httpx.get(f"{WEBUI_URL}/health", timeout=TIMEOUT)
    assert r.status_code == 200
    data = r.json()
    assert data["status"] == "healthy"
    assert data["service"] == "kilocode-webui"


def test_webui_root_serves_html():
    r = httpx.get(f"{WEBUI_URL}/", timeout=TIMEOUT)
    assert r.status_code == 200
    assert "text/html" in r.headers.get("content-type", "")
    # Hub must contain key landmark text
    assert "KiloCode" in r.text
    assert "Control Hub" in r.text or "Control Center" in r.text


# ─── Settings service (port 8082) ──────────────────────────────────────────

def test_settings_health():
    r = httpx.get(f"{SETTINGS_URL}/health", timeout=TIMEOUT)
    assert r.status_code == 200
    assert r.json()["status"] == "healthy"


def test_settings_state_has_mode():
    r = httpx.get(f"{SETTINGS_URL}/settings/state", timeout=TIMEOUT)
    assert r.status_code == 200
    data = r.json()
    assert "mode" in data
    assert data["mode"] in {"standard", "yolo", "elevated", "readonly"}


def test_settings_ports_canonical():
    r = httpx.get(f"{SETTINGS_URL}/ports", timeout=TIMEOUT)
    assert r.status_code == 200
    svcs = r.json()["services"]
    assert svcs["kilocode-runtime"]["port"] == 8081
    assert svcs["kilocode-hermes"]["port"] == 8091


# ─── LM Studio (local RTX 3090Ti) ───────────────────────────────────────────

@pytest.mark.skipif(not _reachable(f"{LM_STUDIO_URL}/v1/models"), reason="LM Studio not running")
def test_lmstudio_models_endpoint():
    r = httpx.get(f"{LM_STUDIO_URL}/v1/models", timeout=TIMEOUT)
    assert r.status_code == 200
    data = r.json()
    assert "data" in data
    assert isinstance(data["data"], list)


@pytest.mark.skipif(not _reachable(f"{LM_STUDIO_URL}/v1/models"), reason="LM Studio not running")
def test_lmstudio_chat_completion():
    models_r = httpx.get(f"{LM_STUDIO_URL}/v1/models", timeout=TIMEOUT).json()
    if not models_r.get("data"):
        pytest.skip("No models loaded in LM Studio")
    model_id = models_r["data"][0]["id"]
    r = httpx.post(f"{LM_STUDIO_URL}/v1/chat/completions", json={
        "model": model_id,
        "messages": [{"role": "user", "content": "reply with the single word: pong"}],
        "max_tokens": 10,
        "temperature": 0.0,
        "stream": False,
    }, timeout=60.0)
    assert r.status_code == 200
    data = r.json()
    assert "choices" in data
    content = data["choices"][0]["message"]["content"]
    assert len(content) > 0


# ─── Ollama (local) ─────────────────────────────────────────────────────────

@pytest.mark.skipif(not _reachable(f"{OLLAMA_URL}/api/tags"), reason="Ollama not running")
def test_ollama_tags():
    r = httpx.get(f"{OLLAMA_URL}/api/tags", timeout=TIMEOUT)
    assert r.status_code == 200
    assert "models" in r.json()


# ─── LiteLLM proxy ──────────────────────────────────────────────────────────

@pytest.mark.skipif(not _reachable(f"{LITELLM_URL}/health"), reason="LiteLLM not running")
def test_litellm_health():
    r = httpx.get(f"{LITELLM_URL}/health", timeout=TIMEOUT)
    assert r.status_code == 200


# ─── Open WebUI (hermes.daveai.tech) ────────────────────────────────────────

def test_openwebui_live():
    r = httpx.get(OPENWEBUI_URL, timeout=TIMEOUT, follow_redirects=True)
    assert r.status_code == 200


def test_openwebui_ssl():
    assert OPENWEBUI_URL.startswith("https://")
    r = httpx.get(OPENWEBUI_URL, timeout=TIMEOUT, follow_redirects=True)
    assert r.status_code == 200


# ─── Restart resilience (re-check after previous B4 restarts) ───────────────

def test_all_services_still_healthy_post_restart():
    results = {}
    for name, url in [
        ("runtime",  f"{RUNTIME_URL}/health"),
        ("settings", f"{SETTINGS_URL}/health"),
        ("hermes",   f"{HERMES_URL}/health"),
        ("webui",    f"{WEBUI_URL}/health"),
    ]:
        try:
            r = httpx.get(url, timeout=TIMEOUT)
            results[name] = r.status_code
        except Exception as e:
            results[name] = f"error: {e}"
    failed = {k: v for k, v in results.items() if v != 200}
    assert not failed, f"Unhealthy services after restart: {failed}"


# ─── WebUI proxies ───────────────────────────────────────────────────────────

def test_webui_healthall_endpoint():
    r = httpx.get(f"{WEBUI_URL}/api/healthall", timeout=TIMEOUT)
    assert r.status_code == 200
    data = r.json()
    assert "runtime" in data
    assert "settings" in data
    assert "hermes" in data


def test_webui_proxy_settings_state():
    r = httpx.get(f"{WEBUI_URL}/api/settings/settings/state", timeout=TIMEOUT)
    assert r.status_code == 200
    assert "mode" in r.json()


def test_webui_proxy_runtime_health():
    r = httpx.get(f"{WEBUI_URL}/api/runtime/health", timeout=TIMEOUT)
    assert r.status_code == 200
    assert r.json().get("status") == "healthy"
