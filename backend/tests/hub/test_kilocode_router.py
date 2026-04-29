"""Tests for Hub v2 /api/runtime/kilocode/* endpoints — KiloCode VSIX tab."""


class TestKilocodeStatus:
    def test_status_returns_fields(self, client):
        r = client.get("/api/runtime/kilocode/status")
        assert r.status_code == 200
        data = r.json()
        assert "synced" in data
        assert "commands" in data

    def test_sync(self, client):
        r = client.post("/api/runtime/kilocode/sync", json={"version": "7.2.21"})
        assert r.status_code == 200
        data = r.json()
        assert data["ok"] is True
        assert data["synced"] is True

    def test_sync_updates_status(self, client):
        client.post("/api/runtime/kilocode/sync", json={"version": "7.2.22"})
        data = client.get("/api/runtime/kilocode/status").json()
        assert data["synced"] is True
        assert data["version"] == "7.2.22"

    def test_cmd_known(self, client):
        r = client.post("/api/runtime/kilocode/cmd", json={"command": "runHealthCheck"})
        assert r.status_code == 200
        data = r.json()
        assert data["ok"] is True

    def test_cmd_unknown(self, client):
        r = client.post("/api/runtime/kilocode/cmd", json={"command": "doesNotExist"})
        assert r.status_code == 400
