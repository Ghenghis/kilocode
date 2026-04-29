"""Tests for Hub v2 /api/settings/* proxy — Speech, Routing, Governance tabs.

These tabs proxy through the settings router catch-all to settings_canonical.
We mock the _req function to simulate the canonical service responses.
"""
from unittest.mock import patch, AsyncMock

# Patch target: where _req is imported INTO, not where it's defined
_PATCH_REQ = "backend.webui.hub.routers.settings._req"

_MOCK_SPEECH = {
    "enabled": False, "provider": "openai", "volume": 80,
    "autoSpeak": False, "interruptOnType": True, "multiVoiceMode": False,
    "interactionMode": "push-to-talk", "debugMode": False,
    "sentimentIntensity": 50, "tuning": {"rate": 1.0, "pitch": 0},
    "openai": {}, "elevenlabs": {}, "azure": {}, "google": {}, "polly": {},
}

_MOCK_ROUTING = {
    "mode": "auto", "costThreshold": 0.05, "privacyMode": False,
    "claudeCodeCompat": False, "showTaskTimeline": True,
    "workstation": {"name": "dev-ws", "hardware": {}, "limits": {}},
}

_MOCK_GOVERNANCE = {
    "enabled": True, "defaultTier": "standard",
}


class TestSpeechProxy:
    def test_get_speech_config(self, client):
        with patch(_PATCH_REQ, new_callable=AsyncMock, return_value=_MOCK_SPEECH):
            r = client.get("/api/settings/kilocode/speech")
            assert r.status_code == 200
            data = r.json()
            assert data["provider"] == "openai"
            assert data["volume"] == 80

    def test_save_speech_config(self, client):
        saved = {**_MOCK_SPEECH, "ok": True, "volume": 90}
        with patch(_PATCH_REQ, new_callable=AsyncMock, return_value=saved):
            r = client.post("/api/settings/kilocode/speech", json={"volume": 90})
            assert r.status_code == 200
            data = r.json()
            assert data["ok"] is True

    def test_test_speech(self, client):
        result = {"ok": True, "text": "Hello", "provider": "openai", "simulated": True}
        with patch(_PATCH_REQ, new_callable=AsyncMock, return_value=result):
            r = client.post("/api/settings/kilocode/speech/test", json={"text": "Hello"})
            assert r.status_code == 200
            assert r.json()["simulated"] is True


class TestRoutingProxy:
    def test_get_routing_config(self, client):
        with patch(_PATCH_REQ, new_callable=AsyncMock, return_value=_MOCK_ROUTING):
            r = client.get("/api/settings/kilocode/routing")
            assert r.status_code == 200
            data = r.json()
            assert data["mode"] == "auto"

    def test_save_routing_config(self, client):
        saved = {**_MOCK_ROUTING, "ok": True}
        with patch(_PATCH_REQ, new_callable=AsyncMock, return_value=saved):
            r = client.post("/api/settings/kilocode/routing", json={"mode": "manual"})
            assert r.status_code == 200
            assert r.json()["ok"] is True


class TestGovernanceProxy:
    def test_get_governance_config(self, client):
        with patch(_PATCH_REQ, new_callable=AsyncMock, return_value=_MOCK_GOVERNANCE):
            r = client.get("/api/settings/kilocode/governance")
            assert r.status_code == 200
            data = r.json()
            assert data["enabled"] is True

    def test_save_governance_config(self, client):
        saved = {**_MOCK_GOVERNANCE, "ok": True}
        with patch(_PATCH_REQ, new_callable=AsyncMock, return_value=saved):
            r = client.post("/api/settings/kilocode/governance", json={"enabled": False})
            assert r.status_code == 200
            assert r.json()["ok"] is True

    def test_governance_status(self, client):
        status = {"releaseReadiness": "pass", "criticalDefects": 0, "highDefects": 2, "rollbackReady": True}
        with patch(_PATCH_REQ, new_callable=AsyncMock, return_value=status):
            r = client.get("/api/settings/kilocode/governance/status")
            assert r.status_code == 200
            data = r.json()
            assert data["releaseReadiness"] == "pass"

    def test_governance_verdicts(self, client):
        verdicts = {"verdicts": [{"decision": "pass", "scope": "v1.0", "criticalDefects": 0, "highDefects": 0}]}
        with patch(_PATCH_REQ, new_callable=AsyncMock, return_value=verdicts):
            r = client.get("/api/settings/kilocode/governance/verdicts")
            assert r.status_code == 200
            data = r.json()
            assert len(data["verdicts"]) == 1

    def test_create_verdict(self, client):
        result = {"ok": True, "verdict_id": "v-123"}
        with patch(_PATCH_REQ, new_callable=AsyncMock, return_value=result):
            r = client.post("/api/settings/kilocode/governance/verdicts", json={
                "scope": "v1.0", "criticalDefects": 0, "highDefects": 1,
                "decision": "conditional_pass", "riskSummary": "Low risk",
            })
            assert r.status_code == 200
            assert r.json()["ok"] is True
