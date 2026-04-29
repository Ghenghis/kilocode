"""
Unit tests for WebUI Control Center components.

Covers EvidencePanel, RepairPanel, and AgentAccessAPI.
"""

import json
import os
import pytest
import asyncio

import sys
sys.path.insert(0, "/sessions/lucid-sweet-ptolemy/mnt/contract-kit-v17/src")

from backend.webui.control_center import (
    ControlCenterApp,
    EvidencePanel,
    RepairPanel,
    AgentAccessAPI,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _run(coro):
    """Run a coroutine synchronously (keeps tests simple without pytest-asyncio dep)."""
    return asyncio.new_event_loop().run_until_complete(coro)


def _make_app_with_panels():
    """Return a ControlCenterApp with evidence and repair panels pre-mounted."""
    app = ControlCenterApp()
    evidence = EvidencePanel()
    repairs = RepairPanel()
    _run(app.mount_panel("evidence", evidence))
    _run(app.mount_panel("repairs", repairs))
    return app, evidence, repairs


# ---------------------------------------------------------------------------
# EvidencePanel tests
# ---------------------------------------------------------------------------

class TestEvidenceManagerAddAndGet:
    """test_evidence_manager_add_and_get"""

    def test_add_item_directly_and_retrieve_via_panel(self):
        panel = EvidencePanel()
        item = {"type": "log", "status": "valid", "source": "agent-01", "content": {"msg": "ok"}}
        panel.evidence_items["ev-001"] = item

        result = _run(panel.get_evidence("ev-001"))
        assert result["evidence_id"] == "ev-001"
        assert result["type"] == "log"
        assert result["status"] == "valid"
        assert result["content"] == {"msg": "ok"}

    def test_get_missing_item_returns_error(self):
        panel = EvidencePanel()
        result = _run(panel.get_evidence("nonexistent"))
        assert "error" in result

    def test_list_evidence_with_type_filter(self):
        panel = EvidencePanel()
        panel.evidence_items["ev-a"] = {"type": "log", "status": "valid", "source": "s1"}
        panel.evidence_items["ev-b"] = {"type": "trace", "status": "valid", "source": "s2"}

        result = _run(panel.list_evidence({"type": "log"}))
        assert len(result) == 1
        assert result[0]["evidence_id"] == "ev-a"

    def test_list_evidence_no_filter(self):
        panel = EvidencePanel()
        panel.evidence_items["ev-1"] = {"type": "log", "status": "valid", "source": "s"}
        panel.evidence_items["ev-2"] = {"type": "trace", "status": "valid", "source": "s"}

        result = _run(panel.list_evidence())
        assert len(result) == 2


# ---------------------------------------------------------------------------
# EvidencePanel export tests
# ---------------------------------------------------------------------------

class TestEvidenceManagerExportJson:
    """test_evidence_manager_export_json"""

    def test_export_json_returns_path(self, tmp_path):
        panel = EvidencePanel(storage_path=str(tmp_path))
        panel.evidence_items["ev-json"] = {
            "type": "log",
            "status": "valid",
            "source": "s",
            "content": {"key": "value"},
        }

        result = _run(panel.export_evidence("ev-json", format="json"))
        assert result.get("format") == "json"
        assert result.get("evidence_id") == "ev-json"
        # File should have been written
        export_path = result["export_path"]
        with open(export_path) as fh:
            data = json.load(fh)
        assert data["evidence_id"] == "ev-json"
        assert data["content"] == {"key": "value"}

    def test_export_missing_item_returns_error(self, tmp_path):
        panel = EvidencePanel(storage_path=str(tmp_path))
        result = _run(panel.export_evidence("no-such-id", format="json"))
        assert "error" in result

    def test_export_unsupported_format_returns_error(self, tmp_path):
        panel = EvidencePanel(storage_path=str(tmp_path))
        panel.evidence_items["ev-x"] = {"type": "log", "content": {}}
        result = _run(panel.export_evidence("ev-x", format="xml"))
        assert "error" in result


# ---------------------------------------------------------------------------
# RepairPanel tests
# ---------------------------------------------------------------------------

class TestRepairTrigger:
    """test_repair_trigger"""

    def test_trigger_creates_repair_entry(self):
        panel = RepairPanel()
        result = _run(panel.trigger_repair("issue-42", "restart"))
        assert result["status"] == "triggered"
        assert result["issue_id"] == "issue-42"
        assert result["repair_type"] == "restart"
        assert "repair_id" in result

    def test_triggered_repair_appears_in_history(self):
        panel = RepairPanel()
        result = _run(panel.trigger_repair("issue-99", "rollback"))
        repair_id = result["repair_id"]

        status = _run(panel.get_repair_status(repair_id))
        assert status["repair_id"] == repair_id
        assert status["issue_id"] == "issue-99"

    def test_trigger_without_router_still_succeeds(self):
        panel = RepairPanel(repair_router=None)
        result = _run(panel.trigger_repair("i1", "patch"))
        assert "error" not in result


class TestRepairCancel:
    """test_repair_cancel"""

    def test_cancel_pending_repair(self):
        panel = RepairPanel()
        result = _run(panel.trigger_repair("issue-7", "patch"))
        repair_id = result["repair_id"]

        cancelled = _run(panel.cancel_repair(repair_id))
        assert cancelled is True

        status = _run(panel.get_repair_status(repair_id))
        assert status["status"] == "cancelled"

    def test_cancel_nonexistent_repair_returns_false(self):
        panel = RepairPanel()
        cancelled = _run(panel.cancel_repair("does-not-exist"))
        assert cancelled is False

    def test_cancel_sets_status_to_cancelled_in_history(self):
        """After cancellation the history entry must reflect 'cancelled'."""
        panel = RepairPanel()
        result = _run(panel.trigger_repair("issue-8", "patch"))
        repair_id = result["repair_id"]
        _run(panel.cancel_repair(repair_id))

        status = _run(panel.get_repair_status(repair_id))
        assert status["status"] == "cancelled"


# ---------------------------------------------------------------------------
# AgentAccessAPI auth tests
# ---------------------------------------------------------------------------

class TestAgentAccessAPIRejectsBadToken:
    """test_agent_access_api_rejects_bad_token"""

    def test_list_items_bad_token_rejected(self, monkeypatch):
        monkeypatch.setenv("WEBUI_AGENT_TOKEN", "secret123")
        app, _, _ = _make_app_with_panels()
        api = AgentAccessAPI(app)
        result = api.list_items("evidence", token="wrong-token")
        assert result == {"error": "unauthorized"}

    def test_add_item_bad_token_rejected(self, monkeypatch):
        monkeypatch.setenv("WEBUI_AGENT_TOKEN", "secret123")
        app, _, _ = _make_app_with_panels()
        api = AgentAccessAPI(app)
        result = api.add_item("evidence", {"type": "log"}, token="bad")
        assert result == {"error": "unauthorized"}

    def test_unset_env_var_always_rejects(self, monkeypatch):
        monkeypatch.delenv("WEBUI_AGENT_TOKEN", raising=False)
        app, _, _ = _make_app_with_panels()
        api = AgentAccessAPI(app)
        assert api.list_items("evidence", token="") == {"error": "unauthorized"}
        assert api.list_items("evidence", token="anything") == {"error": "unauthorized"}

    def test_empty_env_var_always_rejects(self, monkeypatch):
        monkeypatch.setenv("WEBUI_AGENT_TOKEN", "")
        app, _, _ = _make_app_with_panels()
        api = AgentAccessAPI(app)
        assert api.list_items("evidence", token="") == {"error": "unauthorized"}


# ---------------------------------------------------------------------------
# AgentAccessAPI list_items tests
# ---------------------------------------------------------------------------

class TestAgentAccessAPIListItems:
    """test_agent_access_api_list_items"""

    def test_list_empty_evidence(self, monkeypatch):
        monkeypatch.setenv("WEBUI_AGENT_TOKEN", "tok")
        app, _, _ = _make_app_with_panels()
        api = AgentAccessAPI(app)
        result = api.list_items("evidence", token="tok")
        assert result["count"] == 0
        assert result["items"] == []

    def test_list_populated_evidence(self, monkeypatch):
        monkeypatch.setenv("WEBUI_AGENT_TOKEN", "tok")
        app, evidence, _ = _make_app_with_panels()
        evidence.evidence_items["e1"] = {"type": "log"}
        evidence.evidence_items["e2"] = {"type": "trace"}
        api = AgentAccessAPI(app)
        result = api.list_items("evidence", token="tok")
        assert result["count"] == 2

    def test_list_unknown_section_returns_error(self, monkeypatch):
        monkeypatch.setenv("WEBUI_AGENT_TOKEN", "tok")
        app, _, _ = _make_app_with_panels()
        api = AgentAccessAPI(app)
        result = api.list_items("bogus", token="tok")
        assert "error" in result


# ---------------------------------------------------------------------------
# AgentAccessAPI add_item tests
# ---------------------------------------------------------------------------

class TestAgentAccessAPIAddItem:
    """test_agent_access_api_add_item"""

    def test_add_evidence_item(self, monkeypatch):
        monkeypatch.setenv("WEBUI_AGENT_TOKEN", "tok")
        app, evidence, _ = _make_app_with_panels()
        api = AgentAccessAPI(app)
        result = api.add_item("evidence", {"type": "log", "status": "pending"}, token="tok")
        assert result["status"] == "added"
        new_id = result["id"]
        assert new_id in evidence.evidence_items

    def test_add_item_with_explicit_id(self, monkeypatch):
        monkeypatch.setenv("WEBUI_AGENT_TOKEN", "tok")
        app, evidence, _ = _make_app_with_panels()
        api = AgentAccessAPI(app)
        api.add_item("evidence", {"id": "my-id", "type": "log"}, token="tok")
        assert "my-id" in evidence.evidence_items

    def test_edit_item_updates_field(self, monkeypatch):
        monkeypatch.setenv("WEBUI_AGENT_TOKEN", "tok")
        app, evidence, _ = _make_app_with_panels()
        evidence.evidence_items["e1"] = {"type": "log", "status": "pending"}
        api = AgentAccessAPI(app)
        result = api.edit_item("e1", "status", "resolved", token="tok")
        assert result["status"] == "updated"
        assert evidence.evidence_items["e1"]["status"] == "resolved"

    def test_replace_item(self, monkeypatch):
        monkeypatch.setenv("WEBUI_AGENT_TOKEN", "tok")
        app, evidence, _ = _make_app_with_panels()
        evidence.evidence_items["e1"] = {"type": "log", "status": "pending"}
        api = AgentAccessAPI(app)
        result = api.replace_item("e1", {"type": "trace", "status": "done"}, token="tok")
        assert result["status"] == "replaced"
        assert evidence.evidence_items["e1"]["type"] == "trace"

    def test_delete_item(self, monkeypatch):
        monkeypatch.setenv("WEBUI_AGENT_TOKEN", "tok")
        app, evidence, _ = _make_app_with_panels()
        evidence.evidence_items["e1"] = {"type": "log"}
        api = AgentAccessAPI(app)
        result = api.delete_item("e1", "evidence", token="tok")
        assert result["status"] == "deleted"
        assert "e1" not in evidence.evidence_items


# ---------------------------------------------------------------------------
# AgentAccessAPI save/load state tests
# ---------------------------------------------------------------------------

class TestAgentAccessAPISaveLoadState:
    """test_agent_access_api_save_load_state"""

    def test_save_and_load_round_trip(self, monkeypatch, tmp_path):
        monkeypatch.setenv("WEBUI_AGENT_TOKEN", "tok")

        # Redirect the state path to tmp_path
        state_file = tmp_path / "webui_state.json"
        import webui.control_center as cc_module
        original_path = cc_module._WEBUI_STATE_PATH
        cc_module._WEBUI_STATE_PATH = state_file

        try:
            app, evidence, repairs = _make_app_with_panels()
            evidence.evidence_items["ev-save"] = {"type": "log", "status": "valid"}
            _run(repairs.trigger_repair("i1", "patch"))

            api = AgentAccessAPI(app)

            save_result = api.save_state(token="tok")
            assert save_result["status"] == "saved"
            assert state_file.exists()

            # Mutate in-memory state to prove load restores it
            evidence.evidence_items.clear()

            load_result = api.load_state(token="tok")
            assert load_result["status"] == "loaded"
            assert "ev-save" in evidence.evidence_items
        finally:
            cc_module._WEBUI_STATE_PATH = original_path

    def test_load_missing_file_returns_error(self, monkeypatch, tmp_path):
        monkeypatch.setenv("WEBUI_AGENT_TOKEN", "tok")

        import webui.control_center as cc_module
        original_path = cc_module._WEBUI_STATE_PATH
        cc_module._WEBUI_STATE_PATH = tmp_path / "no_such_file.json"

        try:
            app, _, _ = _make_app_with_panels()
            api = AgentAccessAPI(app)
            result = api.load_state(token="tok")
            assert "error" in result
        finally:
            cc_module._WEBUI_STATE_PATH = original_path

    def test_save_state_bad_token(self, monkeypatch):
        monkeypatch.setenv("WEBUI_AGENT_TOKEN", "tok")
        app, _, _ = _make_app_with_panels()
        api = AgentAccessAPI(app)
        result = api.save_state(token="bad")
        assert result == {"error": "unauthorized"}

    def test_load_state_bad_token(self, monkeypatch):
        monkeypatch.setenv("WEBUI_AGENT_TOKEN", "tok")
        app, _, _ = _make_app_with_panels()
        api = AgentAccessAPI(app)
        result = api.load_state(token="bad")
        assert result == {"error": "unauthorized"}
