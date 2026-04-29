"""Tests for Hub v2 /api/pipeline/* endpoints — Pipeline tab."""
from unittest.mock import patch, AsyncMock


class TestPipelineEvents:
    def test_get_events_empty(self, client):
        r = client.get("/api/pipeline/events")
        assert r.status_code == 200
        data = r.json()
        assert "events" in data
        assert "count" in data

    def test_push_event(self, client):
        r = client.post("/api/pipeline/events", json={
            "type": "deploy",
            "agent": "kc-16",
            "detail": "Deployed to staging",
        })
        assert r.status_code == 200
        data = r.json()
        assert data["ok"] is True
        assert data["event"]["agent"] == "kc-16"

    def test_pushed_event_appears(self, client):
        client.post("/api/pipeline/events", json={
            "type": "test", "agent": "kc-08", "detail": "All tests passed",
        })
        data = client.get("/api/pipeline/events").json()
        events = data["events"]
        assert any(e["detail"] == "All tests passed" for e in events)

    def test_clear_events(self, client):
        client.post("/api/pipeline/events", json={"type": "info", "detail": "temp"})
        r = client.delete("/api/pipeline/events")
        assert r.status_code == 200
        data = client.get("/api/pipeline/events").json()
        assert data["count"] == 0


class TestPipelineStatus:
    def test_status_returns_structure(self, client):
        """Pipeline status may fail to reach settings_canonical,
        but the endpoint itself should return valid JSON."""
        r = client.get("/api/pipeline/status")
        assert r.status_code == 200
        data = r.json()
        assert "services" in data or "error" in data
