"""Tests for Hub v2 /api/kom/* endpoints — Orchestrator tab."""


class TestKomStatus:
    def test_status_returns_enabled_field(self, client):
        r = client.get("/api/kom/status")
        assert r.status_code == 200
        data = r.json()
        assert "enabled" in data

    def test_enable_disable_kom(self, client):
        r = client.post("/api/kom/enable")
        assert r.status_code == 200
        data = r.json()
        assert data["enabled"] is True

        r = client.post("/api/kom/disable")
        assert r.status_code == 200
        data = r.json()
        assert data["enabled"] is False

    def test_status_reflects_enable(self, client):
        client.post("/api/kom/enable")
        data = client.get("/api/kom/status").json()
        assert data["enabled"] is True
        client.post("/api/kom/disable")


class TestKomSessions:
    def test_list_sessions_empty(self, client):
        r = client.get("/api/kom/sessions")
        assert r.status_code == 200
        data = r.json()
        assert "sessions" in data

    def test_create_session(self, client):
        r = client.post("/api/kom/sessions", json={
            "goal": "Fix all unit tests",
            "mode": "standard",
        })
        assert r.status_code == 200
        data = r.json()
        assert "session_id" in data

    def test_get_session(self, client):
        r = client.post("/api/kom/sessions", json={
            "goal": "Audit codebase", "mode": "codebase_audit",
        })
        sid = r.json()["session_id"]
        r2 = client.get(f"/api/kom/sessions/{sid}")
        assert r2.status_code == 200
        assert r2.json()["goal"] == "Audit codebase"

    def test_get_nonexistent_session_404(self, client):
        r = client.get("/api/kom/sessions/nonexistent")
        assert r.status_code == 404
