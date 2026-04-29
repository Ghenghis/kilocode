"""
Integration tests: AgentAccessAPI <-> ControlCenterApp.

Tests that AgentAccessAPI integrates correctly with the control center,
including evidence management, save/load state round-trips, and auth.
"""

import asyncio
import json
import os
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../../src"))

from backend.webui.control_center import (
    AgentAccessAPI,
    ControlCenterApp,
    EvidencePanel,
    RepairPanel,
)

_TOKEN = "test-token-abc123"


def _run(coro):
    return asyncio.new_event_loop().run_until_complete(coro)


def _make_app():
    """Create a ControlCenterApp with evidence + repairs panels mounted."""
    app = ControlCenterApp()
    evidence_panel = EvidencePanel()
    repair_panel = RepairPanel()
    _run(app.mount_panel("evidence", evidence_panel))
    _run(app.mount_panel("repairs", repair_panel))
    return app


# ---------------------------------------------------------------------------
# Auth tests
# ---------------------------------------------------------------------------

class TestAgentAccessAuth(unittest.TestCase):
    """Unauthorized requests must be rejected for every operation."""

    def setUp(self):
        self.app = _make_app()

    def test_list_items_rejects_bad_token(self):
        api = AgentAccessAPI(self.app)
        with patch.dict(os.environ, {"WEBUI_AGENT_TOKEN": _TOKEN}):
            result = api.list_items("evidence", token="wrong-token")
        self.assertIn("error", result)
        self.assertEqual(result["error"], "unauthorized")

    def test_list_items_rejects_missing_env(self):
        api = AgentAccessAPI(self.app)
        env = {k: v for k, v in os.environ.items() if k != "WEBUI_AGENT_TOKEN"}
        with patch.dict(os.environ, env, clear=True):
            result = api.list_items("evidence", token=_TOKEN)
        self.assertIn("error", result)

    def test_add_item_rejects_bad_token(self):
        api = AgentAccessAPI(self.app)
        with patch.dict(os.environ, {"WEBUI_AGENT_TOKEN": _TOKEN}):
            result = api.add_item("evidence", {"type": "log"}, token="bad")
        self.assertEqual(result.get("error"), "unauthorized")

    def test_delete_item_rejects_bad_token(self):
        api = AgentAccessAPI(self.app)
        with patch.dict(os.environ, {"WEBUI_AGENT_TOKEN": _TOKEN}):
            result = api.delete_item("some-id", "evidence", token="bad")
        self.assertEqual(result.get("error"), "unauthorized")

    def test_save_state_rejects_bad_token(self):
        api = AgentAccessAPI(self.app)
        with patch.dict(os.environ, {"WEBUI_AGENT_TOKEN": _TOKEN}):
            result = api.save_state(token="wrong")
        self.assertEqual(result.get("error"), "unauthorized")

    def test_load_state_rejects_bad_token(self):
        api = AgentAccessAPI(self.app)
        with patch.dict(os.environ, {"WEBUI_AGENT_TOKEN": _TOKEN}):
            result = api.load_state(token="wrong")
        self.assertEqual(result.get("error"), "unauthorized")


# ---------------------------------------------------------------------------
# Evidence management
# ---------------------------------------------------------------------------

class TestEvidenceManagement(unittest.TestCase):
    """Test add / list / edit / delete evidence via AgentAccessAPI."""

    def setUp(self):
        self.app = _make_app()
        self.api = AgentAccessAPI(self.app)
        self.env = {"WEBUI_AGENT_TOKEN": _TOKEN}

    def test_add_evidence_returns_id(self):
        with patch.dict(os.environ, self.env):
            result = self.api.add_item(
                "evidence",
                {"type": "log", "source": "test", "content": "all good"},
                token=_TOKEN,
            )
        self.assertEqual(result.get("status"), "added")
        self.assertIn("id", result)

    def test_added_evidence_appears_in_list(self):
        with patch.dict(os.environ, self.env):
            add_result = self.api.add_item(
                "evidence", {"type": "screenshot"}, token=_TOKEN
            )
            item_id = add_result["id"]
            list_result = self.api.list_items("evidence", token=_TOKEN)
        ids = [item.get("id") for item in list_result.get("items", [])]
        self.assertIn(item_id, ids)

    def test_edit_evidence_field(self):
        with patch.dict(os.environ, self.env):
            add_result = self.api.add_item(
                "evidence", {"type": "log", "status": "pending"}, token=_TOKEN
            )
            item_id = add_result["id"]
            edit_result = self.api.edit_item(item_id, "status", "reviewed", token=_TOKEN)
        self.assertEqual(edit_result.get("status"), "updated")

    def test_delete_evidence_removes_item(self):
        with patch.dict(os.environ, self.env):
            add_result = self.api.add_item("evidence", {"type": "log"}, token=_TOKEN)
            item_id = add_result["id"]
            del_result = self.api.delete_item(item_id, "evidence", token=_TOKEN)
            list_result = self.api.list_items("evidence", token=_TOKEN)
        self.assertEqual(del_result.get("status"), "deleted")
        ids = [item.get("id") for item in list_result.get("items", [])]
        self.assertNotIn(item_id, ids)

    def test_replace_evidence_item(self):
        with patch.dict(os.environ, self.env):
            add_result = self.api.add_item(
                "evidence", {"type": "log", "status": "pending"}, token=_TOKEN
            )
            item_id = add_result["id"]
            replace_result = self.api.replace_item(
                item_id, {"type": "screenshot", "status": "verified"}, token=_TOKEN
            )
        self.assertEqual(replace_result.get("status"), "replaced")

    def test_list_evidence_count_matches(self):
        with patch.dict(os.environ, self.env):
            for i in range(3):
                self.api.add_item("evidence", {"type": f"item-{i}"}, token=_TOKEN)
            result = self.api.list_items("evidence", token=_TOKEN)
        self.assertEqual(result["count"], len(result["items"]))


# ---------------------------------------------------------------------------
# Save / load state round-trip
# ---------------------------------------------------------------------------

class TestSaveLoadStateRoundTrip(unittest.TestCase):
    """save_state then load_state must preserve evidence data."""

    def test_save_load_round_trip_preserves_evidence(self):
        app = _make_app()
        api = AgentAccessAPI(app)

        with tempfile.TemporaryDirectory() as tmpdir:
            state_path = Path(tmpdir) / "webui_state.json"

            with patch.dict(os.environ, {"WEBUI_AGENT_TOKEN": _TOKEN}):
                # Add evidence
                api.add_item(
                    "evidence",
                    {"id": "ev-1", "type": "log", "source": "unit-test"},
                    token=_TOKEN,
                )

                # Save state to a temp path
                import webui.control_center as cc_module
                original_path = cc_module._WEBUI_STATE_PATH
                cc_module._WEBUI_STATE_PATH = state_path
                try:
                    save_result = api.save_state(token=_TOKEN)
                    self.assertEqual(save_result.get("status"), "saved")

                    # Wipe evidence from app
                    app._panels["evidence"].evidence_items.clear()

                    # Load state back
                    load_result = api.load_state(token=_TOKEN)
                    self.assertEqual(load_result.get("status"), "loaded")

                    # Evidence should be restored
                    list_result = api.list_items("evidence", token=_TOKEN)
                    ids = [item.get("id") for item in list_result.get("items", [])]
                    self.assertIn("ev-1", ids)
                finally:
                    cc_module._WEBUI_STATE_PATH = original_path

    def test_load_state_error_when_file_absent(self):
        app = _make_app()
        api = AgentAccessAPI(app)

        import webui.control_center as cc_module
        original_path = cc_module._WEBUI_STATE_PATH
        cc_module._WEBUI_STATE_PATH = Path("/nonexistent/path/webui_state.json")
        try:
            with patch.dict(os.environ, {"WEBUI_AGENT_TOKEN": _TOKEN}):
                result = api.load_state(token=_TOKEN)
            self.assertIn("error", result)
        finally:
            cc_module._WEBUI_STATE_PATH = original_path


# ---------------------------------------------------------------------------
# Control center integration
# ---------------------------------------------------------------------------

class TestControlCenterIntegration(unittest.TestCase):
    """Verify AgentAccessAPI + ControlCenterApp wiring."""

    def test_unknown_section_returns_error(self):
        app = _make_app()
        api = AgentAccessAPI(app)
        with patch.dict(os.environ, {"WEBUI_AGENT_TOKEN": _TOKEN}):
            result = api.list_items("unknown_section", token=_TOKEN)
        self.assertIn("error", result)

    def test_health_check_returns_healthy(self):
        app = _make_app()
        result = _run(app.health_check())
        self.assertEqual(result["status"], "healthy")

    def test_evidence_panel_listed_in_health(self):
        app = _make_app()
        result = _run(app.health_check())
        self.assertIn("evidence", result["panels"])

    def test_list_evidence_via_control_center_app(self):
        app = _make_app()
        api = AgentAccessAPI(app)

        with patch.dict(os.environ, {"WEBUI_AGENT_TOKEN": _TOKEN}):
            api.add_item("evidence", {"type": "log"}, token=_TOKEN)

        result = _run(app.list_evidence())
        self.assertIn("evidence", result)


if __name__ == "__main__":
    unittest.main()
