"""Tests for Hub v2 core health endpoint."""


class TestHubHealth:
    def test_health_returns_ok(self, client):
        r = client.get("/health")
        assert r.status_code == 200
        data = r.json()
        assert data["status"] == "ok"
        assert data["version"] == "2.0.0"

    def test_health_has_auth_field(self, client):
        r = client.get("/health")
        data = r.json()
        assert "auth" in data
