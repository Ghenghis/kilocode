"""
Live E2E tests for canonical settings service (port 8082).
Requires kilocode-settings to be running: uvicorn src.runtime.settings_canonical:app --port 8082
Skip automatically if service is not reachable.
"""
import pytest
import httpx

BASE = "http://localhost:8082"
TIMEOUT = 8.0


def _alive() -> bool:
    try:
        return httpx.get(f"{BASE}/health", timeout=3.0).status_code == 200
    except Exception:
        return False


pytestmark = pytest.mark.skipif(not _alive(), reason="kilocode-settings not running on :8082")


# ── /health ──────────────────────────────────────────────────────────────────

def test_settings_health():
    r = httpx.get(f"{BASE}/health", timeout=TIMEOUT)
    assert r.status_code == 200
    assert r.json()["status"] == "healthy"


# ── /settings/state ───────────────────────────────────────────────────────────

def test_settings_state_structure():
    r = httpx.get(f"{BASE}/settings/state", timeout=TIMEOUT)
    assert r.status_code == 200
    data = r.json()
    assert "canonical" in data
    assert "ports" in data
    assert "mode" in data
    assert data["mode"] in {"standard", "yolo", "elevated", "readonly"}


def test_settings_state_ports_non_empty():
    r = httpx.get(f"{BASE}/settings/state", timeout=TIMEOUT)
    ports = r.json()["ports"]
    assert isinstance(ports, dict)
    assert "kilocode-runtime" in ports
    assert ports["kilocode-runtime"] == 8081


# ── /settings/questions ───────────────────────────────────────────────────────

def test_questions_returns_list():
    r = httpx.get(f"{BASE}/settings/questions", timeout=TIMEOUT)
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, list)
    assert len(data) > 0


def test_questions_have_required_fields():
    r = httpx.get(f"{BASE}/settings/questions", timeout=TIMEOUT)
    for q in r.json():
        assert "id" in q
        assert "label" in q
        assert "type" in q
        assert "answered" in q
        assert "required" in q


def test_questions_secrets_masked():
    r = httpx.get(f"{BASE}/settings/questions", timeout=TIMEOUT)
    for q in r.json():
        if q.get("type") == "secret" and q.get("answered"):
            assert q.get("current") == "***", f"Secret not masked: {q['id']}"


# ── /settings/auto-fill ───────────────────────────────────────────────────────

def test_autofill_returns_filled_list():
    r = httpx.post(f"{BASE}/settings/auto-fill", timeout=TIMEOUT)
    assert r.status_code == 200
    data = r.json()
    assert "filled" in data
    assert "skipped_need_user" in data
    assert "remaining_unanswered" in data
    assert isinstance(data["filled"], list)


def test_autofill_fills_inferable():
    r = httpx.post(f"{BASE}/settings/auto-fill", timeout=TIMEOUT)
    data = r.json()
    # ollama and litellm URLs should be inferable
    skipped = data["skipped_need_user"]
    # inferable keys must NOT appear in skipped
    for key in ("ollama_base_url", "litellm_base_url", "nats_url"):
        assert key not in skipped, f"Inferable key {key} was skipped (not auto-filled)"


# ── /settings/validate ────────────────────────────────────────────────────────

def test_validate_returns_result():
    r = httpx.post(f"{BASE}/settings/validate", timeout=TIMEOUT)
    assert r.status_code == 200
    data = r.json()
    assert "result" in data
    assert data["result"] in ("healthy", "degraded")
    assert "issues" in data
    assert isinstance(data["issues"], list)


# ── /settings/apply ───────────────────────────────────────────────────────────

def test_apply_single_setting():
    r = httpx.post(f"{BASE}/settings/apply", json={
        "settings": {"runtime.log_level": "debug"},
        "changed_by": "test_suite"
    }, timeout=TIMEOUT)
    assert r.status_code == 200
    data = r.json()
    assert "applied" in data
    assert "runtime.log_level" in data["applied"]
    assert "evidence_id" in data
    # Restore
    httpx.post(f"{BASE}/settings/apply", json={"settings": {"runtime.log_level": "info"}, "changed_by": "test_suite"}, timeout=TIMEOUT)


def test_apply_creates_audit_entry():
    unique_key = "test.marker"
    httpx.post(f"{BASE}/settings/apply", json={"settings": {unique_key: "test_value"}, "changed_by": "test_suite"}, timeout=TIMEOUT)
    audit_r = httpx.get(f"{BASE}/settings/audit?limit=10", timeout=TIMEOUT)
    entries = audit_r.json()
    assert any(unique_key in e.get("changed_fields", []) for e in entries)


# ── /settings/repair ──────────────────────────────────────────────────────────

def test_repair_returns_structure():
    r = httpx.post(f"{BASE}/settings/repair", json={"changed_by": "test_suite"}, timeout=TIMEOUT)
    assert r.status_code == 200
    data = r.json()
    assert "repaired" in data
    assert "validation" in data
    assert "evidence_id" in data


def test_repair_subsystem_providers():
    r = httpx.post(f"{BASE}/settings/repair", json={"subsystem": "providers", "changed_by": "test_suite"}, timeout=TIMEOUT)
    assert r.status_code == 200
    assert r.json()["validation"]["result"] in ("healthy", "degraded")


# ── /settings/audit ───────────────────────────────────────────────────────────

def test_audit_returns_list():
    r = httpx.get(f"{BASE}/settings/audit", timeout=TIMEOUT)
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def test_audit_limit_respected():
    r = httpx.get(f"{BASE}/settings/audit?limit=3", timeout=TIMEOUT)
    assert r.status_code == 200
    assert len(r.json()) <= 3


def test_audit_entries_have_required_fields():
    r = httpx.get(f"{BASE}/settings/audit?limit=20", timeout=TIMEOUT)
    for entry in r.json():
        assert "evidence_id" in entry
        assert "subsystem" in entry
        assert "changed_by" in entry
        assert "timestamp" in entry
        assert "validation_result" in entry


# ── /mode ────────────────────────────────────────────────────────────────────

def test_set_mode_standard():
    r = httpx.post(f"{BASE}/mode/standard", timeout=TIMEOUT)
    assert r.status_code == 200
    assert r.json()["mode"] == "standard"


def test_set_mode_yolo():
    r = httpx.post(f"{BASE}/mode/yolo", timeout=TIMEOUT)
    assert r.status_code == 200
    data = r.json()
    assert data["mode"] == "yolo"
    assert data["yolo_enabled"] is True
    # Restore
    httpx.post(f"{BASE}/mode/standard", timeout=TIMEOUT)


def test_set_mode_invalid():
    r = httpx.post(f"{BASE}/mode/invalid_mode", timeout=TIMEOUT)
    assert r.status_code == 400


def test_set_mode_creates_audit():
    httpx.post(f"{BASE}/mode/elevated", timeout=TIMEOUT)
    audit = httpx.get(f"{BASE}/settings/audit?limit=5", timeout=TIMEOUT).json()
    assert any(e["subsystem"] == "mode" for e in audit)
    httpx.post(f"{BASE}/mode/standard", timeout=TIMEOUT)


# ── /maintenance/window ───────────────────────────────────────────────────────

def test_maintenance_window_schedule():
    r = httpx.post(f"{BASE}/maintenance/window", json={
        "reason": "test window",
        "duration_minutes": 5
    }, timeout=TIMEOUT)
    assert r.status_code == 200
    data = r.json()
    assert data["duration_minutes"] == 5
    assert data["reason"] == "test window"
    assert "evidence_id" in data


# ── /ports ────────────────────────────────────────────────────────────────────

def test_ports_list():
    r = httpx.get(f"{BASE}/ports", timeout=TIMEOUT)
    assert r.status_code == 200
    data = r.json()
    assert "services" in data
    svc = data["services"]
    assert "kilocode-runtime" in svc
    assert svc["kilocode-runtime"]["port"] == 8081


def test_port_stage_and_apply_cycle():
    # Stage a dummy change on a non-critical service
    svc = "edge-tts"
    r = httpx.put(f"{BASE}/ports/{svc}", json={"port": 5051, "changed_by": "test_suite"}, timeout=TIMEOUT)
    assert r.status_code == 200
    data = r.json()
    assert data["pending_port"] == 5051
    assert data["service"] == svc

    # Apply
    apply_r = httpx.post(f"{BASE}/ports/apply", timeout=TIMEOUT)
    assert apply_r.status_code == 200
    applied = apply_r.json()["applied"]
    assert svc in applied

    # Restore
    httpx.put(f"{BASE}/ports/{svc}", json={"port": 5050, "changed_by": "test_suite"}, timeout=TIMEOUT)
    httpx.post(f"{BASE}/ports/apply", timeout=TIMEOUT)


def test_port_unknown_service():
    r = httpx.put(f"{BASE}/ports/nonexistent-svc", json={"port": 9999, "changed_by": "test"}, timeout=TIMEOUT)
    assert r.status_code == 404


# ── /settings/questions/{id}/answer ──────────────────────────────────────────

def test_answer_inferable_question():
    r = httpx.post(f"{BASE}/settings/questions/nats_url/answer", json={
        "value": "nats://localhost:4222",
        "changed_by": "test_suite"
    }, timeout=TIMEOUT)
    assert r.status_code == 200
    data = r.json()
    assert data["answered"] is True
    assert "evidence_id" in data


def test_answer_unknown_question():
    r = httpx.post(f"{BASE}/settings/questions/nonexistent_q/answer", json={
        "value": "x", "changed_by": "test"
    }, timeout=TIMEOUT)
    assert r.status_code == 404


# ── Full lifecycle ────────────────────────────────────────────────────────────

def test_full_settings_lifecycle():
    """
    End-to-end: autofill → apply → validate → audit → repair.
    Proves the full canonical settings workflow works together.
    """
    # 1. Autofill
    fill = httpx.post(f"{BASE}/settings/auto-fill", timeout=TIMEOUT).json()
    assert "filled" in fill

    # 2. Apply a setting
    apply = httpx.post(f"{BASE}/settings/apply", json={
        "settings": {"runtime.lifecycle_test": True},
        "changed_by": "lifecycle_test"
    }, timeout=TIMEOUT).json()
    assert apply["applied"] == ["runtime.lifecycle_test"]

    # 3. Validate
    val = httpx.post(f"{BASE}/settings/validate", timeout=TIMEOUT).json()
    assert val["result"] in ("healthy", "degraded")

    # 4. Audit shows lifecycle_test entry
    audit = httpx.get(f"{BASE}/settings/audit?limit=10", timeout=TIMEOUT).json()
    assert any("runtime.lifecycle_test" in e.get("changed_fields", []) for e in audit)

    # 5. Repair runs without error
    repair = httpx.post(f"{BASE}/settings/repair", json={"changed_by": "lifecycle_test"}, timeout=TIMEOUT).json()
    assert "repaired" in repair
    assert "evidence_id" in repair
