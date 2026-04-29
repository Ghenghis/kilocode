"""
Integration tests: KiloCode RuntimeSync <-> HermesOrchestrator.

Tests that RuntimeSync can push tasks and that HermesOrchestrator can process
them, plus that SettingsManager.auto_configure flows settings correctly.
"""

import asyncio
import os
import sys
import unittest
from unittest.mock import AsyncMock, MagicMock, patch

# Ensure src/ is on the path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../../src"))

from backend.kilocode.runtime_sync import RuntimeSync, SettingsManager, SyncState
from backend.hermes.orchestrator import HermesOrchestrator


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _run(coro):
    return asyncio.new_event_loop().run_until_complete(coro)


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

class TestRuntimeSyncInitialization(unittest.TestCase):
    """RuntimeSync should initialise with sane defaults."""

    def test_default_runtime_url(self):
        sync = RuntimeSync(api_key="test-key")
        self.assertEqual(sync.runtime_url, "http://localhost:8080")

    def test_explicit_url_is_preserved(self):
        sync = RuntimeSync(runtime_url="http://custom:9090", api_key="k")
        self.assertEqual(sync.runtime_url, "http://custom:9090")

    def test_initial_state_is_disconnected(self):
        sync = RuntimeSync(api_key="key")
        self.assertEqual(sync.state, SyncState.DISCONNECTED)

    def test_active_tasks_starts_empty(self):
        sync = RuntimeSync(api_key="key")
        self.assertEqual(sync.active_tasks, {})


class TestRuntimeSyncConnect(unittest.TestCase):
    """RuntimeSync.connect() should set state to CONNECTED."""

    def test_connect_returns_true(self):
        sync = RuntimeSync(api_key="key")
        # Patch _api_request so no real HTTP happens
        sync._api_request = AsyncMock(return_value={"status": "ok"})
        result = _run(sync.connect())
        self.assertTrue(result)
        self.assertEqual(sync.state, SyncState.CONNECTED)
        self.assertTrue(sync._connected)

    def test_connect_updates_last_sync(self):
        sync = RuntimeSync(api_key="key")
        sync._api_request = AsyncMock(return_value={"status": "ok"})
        _run(sync.connect())
        self.assertIsNotNone(sync._last_sync)


class TestRuntimeSyncPushTask(unittest.TestCase):
    """RuntimeSync.push_task_state() should store the task locally and push remotely."""

    def _connected_sync(self):
        sync = RuntimeSync(api_key="key")
        sync._connected = True
        sync.state = SyncState.CONNECTED
        sync._api_request = AsyncMock(return_value={"status": "ok"})
        return sync

    def test_push_task_stores_locally(self):
        sync = self._connected_sync()
        _run(sync.push_task_state("task-1", {"state": "running", "progress": 50}))
        self.assertIn("task-1", sync.active_tasks)

    def test_push_task_returns_true_on_ok(self):
        sync = self._connected_sync()
        result = _run(sync.push_task_state("task-2", {"state": "done"}))
        self.assertTrue(result)

    def test_push_task_returns_false_when_disconnected(self):
        sync = RuntimeSync(api_key="key")  # not connected
        result = _run(sync.push_task_state("task-x", {"state": "running"}))
        self.assertFalse(result)


class TestHermesOrchestratorIntake(unittest.TestCase):
    """HermesOrchestrator should process tasks coming from RuntimeSync."""

    def setUp(self):
        self.orchestrator = HermesOrchestrator()

    def test_intake_normalises_description(self):
        result = _run(self.orchestrator.intake({"description": "Build a login page"}))
        self.assertEqual(result["description"], "Build a login page")
        self.assertEqual(result["status"], "normalized")

    def test_intake_rejects_missing_description(self):
        result = _run(self.orchestrator.intake({}))
        self.assertEqual(result["status"], "error")

    def test_task_pushed_via_runtime_sync_can_be_ingested(self):
        """Task stored in RuntimeSync can be fed directly into HermesOrchestrator."""
        sync = RuntimeSync(api_key="key")
        sync._connected = True
        sync._api_request = AsyncMock(return_value={"status": "ok"})
        task_state = {"description": "Implement feature X", "acceptance_criteria": ["Tests pass"]}
        _run(sync.push_task_state("task-abc", task_state))

        stored = sync.active_tasks.get("task-abc")
        self.assertIsNotNone(stored)

        intake_result = _run(self.orchestrator.intake(stored))
        self.assertEqual(intake_result["status"], "normalized")
        self.assertEqual(intake_result["description"], "Implement feature X")

    def test_contract_creation_from_intake_result(self):
        intake_result = _run(self.orchestrator.intake({
            "description": "Add unit tests",
            "acceptance_criteria": ["Coverage > 80%"]
        }))
        contract_result = _run(self.orchestrator.contract_creation(intake_result))
        self.assertEqual(contract_result["status"], "contract_created")
        self.assertIn("contract_id", contract_result)

    def test_task_fanout_creates_subtasks(self):
        intake_result = _run(self.orchestrator.intake({
            "description": "Deploy service",
            "acceptance_criteria": ["Service is up", "Healthcheck passes"]
        }))
        contract_result = _run(self.orchestrator.contract_creation(intake_result))
        contract_id = contract_result["contract_id"]

        subtasks = _run(self.orchestrator.task_fanout(contract_id))
        self.assertIsInstance(subtasks, list)
        self.assertGreater(len(subtasks), 0)


class TestSettingsManagerAutoConfigureToRuntimeSync(unittest.TestCase):
    """SettingsManager.auto_configure should flow env-var settings into RuntimeSync."""

    def test_auto_configure_reads_env_api_key(self):
        with patch.dict(os.environ, {"KILOCODE_API_KEY": "env-key-123"}, clear=False):
            sync = RuntimeSync()  # no explicit args → triggers auto_configure
            # SettingsManager should have applied the env key
            self.assertEqual(sync.api_key, "env-key-123")

    def test_auto_configure_reads_env_runtime_url(self):
        with patch.dict(os.environ, {"KILOCODE_RUNTIME_URL": "http://envhost:1234"}, clear=False):
            sync = RuntimeSync()
            self.assertEqual(sync.runtime_url, "http://envhost:1234")

    def test_explicit_constructor_args_win_over_env(self):
        with patch.dict(os.environ, {"KILOCODE_RUNTIME_URL": "http://envhost:9999"}, clear=False):
            sync = RuntimeSync(runtime_url="http://explicit:5000", api_key="x")
            self.assertEqual(sync.runtime_url, "http://explicit:5000")

    def test_settings_manager_set_and_get(self):
        mgr = SettingsManager()
        result = mgr.set_setting("model", "gpt-4")
        self.assertTrue(result)
        self.assertEqual(mgr.get_setting("model"), "gpt-4")

    def test_settings_manager_rejects_unknown_key(self):
        mgr = SettingsManager()
        result = mgr.set_setting("unknown_key_xyz", "value")
        self.assertFalse(result)

    def test_settings_manager_masks_api_key_in_list(self):
        mgr = SettingsManager()
        mgr.set_setting("api_key", "sk-supersecret")
        listed = mgr.list_settings()
        self.assertNotEqual(listed.get("api_key"), "sk-supersecret")
        self.assertIn("****", listed.get("api_key", ""))


if __name__ == "__main__":
    unittest.main()
