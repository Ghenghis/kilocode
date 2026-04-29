"""Tests for Hub v2 /api/runtime/discord/* endpoints — Hermes Bots tab."""


class TestDiscordBots:
    def test_list_bots(self, client):
        r = client.get("/api/runtime/discord/bots")
        assert r.status_code == 200
        data = r.json()
        assert "bots" in data
        # Should list hermes1..hermes5
        assert len(data["bots"]) >= 5

    def test_bot_status_fields(self, client):
        data = client.get("/api/runtime/discord/bots").json()
        for bot in data["bots"]:
            assert "bot" in bot
            assert "channel" in bot
            assert "status" in bot

    def test_single_bot_health(self, client):
        r = client.get("/api/runtime/discord/bots/hermes1/health")
        assert r.status_code == 200
        data = r.json()
        assert data["bot"] == "hermes1"
        assert data["status"] in ("online", "offline")

    def test_unknown_bot_404(self, client):
        r = client.get("/api/runtime/discord/bots/nonexistent/health")
        assert r.status_code == 404
