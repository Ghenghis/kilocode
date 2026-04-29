"""Tests for Hub v2 /api/agents/* endpoints — KC Agents tab."""


class TestAgentsList:
    def test_list_agents_returns_all_21(self, client):
        r = client.get("/api/agents")
        assert r.status_code == 200
        data = r.json()
        assert "agents" in data
        assert data["total"] == 21  # kc-main + kc-01..kc-20

    def test_list_agents_has_status_counts(self, client):
        data = client.get("/api/agents").json()
        for key in ("active", "idle", "busy"):
            assert key in data

    def test_get_single_agent(self, client):
        r = client.get("/api/agents/kc-main")
        assert r.status_code == 200
        data = r.json()
        assert data["id"] == "kc-main"
        assert data["name"] == "KiloCode Main"

    def test_get_nonexistent_agent_404(self, client):
        r = client.get("/api/agents/kc-99")
        assert r.status_code == 404


class TestAgentAssign:
    def test_assign_task_to_agent(self, client):
        r = client.post("/api/agents/kc-01/assign", json={
            "task": "Test task",
            "description": "Run integration tests",
        })
        assert r.status_code == 200
        data = r.json()
        assert data["ok"] is True

    def test_assign_changes_status_to_busy(self, client):
        client.post("/api/agents/kc-02/assign", json={"task": "Review PR"})
        r = client.get("/api/agents/kc-02")
        data = r.json()
        assert data["status"] == "busy"
        assert data["current_task"] == "Review PR"
        # Clean up
        client.post("/api/agents/kc-02/release")


class TestAgentChat:
    def test_get_chat_messages_empty(self, client):
        r = client.get("/api/agents/chat/messages")
        assert r.status_code == 200
        data = r.json()
        assert "messages" in data

    def test_send_chat_message(self, client):
        r = client.post("/api/agents/chat/send", json={
            "from": "user",
            "to": "kc-main",
            "content": "Hello agent",
        })
        assert r.status_code == 200
        data = r.json()
        assert data["ok"] is True

    def test_sent_message_appears_in_list(self, client):
        client.post("/api/agents/chat/send", json={
            "from": "user", "to": "kc-05", "content": "Debug this",
        })
        data = client.get("/api/agents/chat/messages").json()
        msgs = data.get("messages", [])
        assert any(m.get("content") == "Debug this" for m in msgs)
