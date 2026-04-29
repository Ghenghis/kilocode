"""
Integration tests: ZeroClawGateway + adapters.

Tests gateway registration, dispatch to correct adapter by type,
and GitAdapter validate + execute pipeline (with mocked subprocess).
"""

import asyncio
import os
import sys
import unittest
from unittest.mock import MagicMock, patch

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../../src"))

from backend.zeroclaw.adapters import (
    FilesystemAdapter,
    GitAdapter,
    ResearchAdapter,
    ShellAdapter,
    ZeroClawGateway,
)


def _run(coro):
    return asyncio.new_event_loop().run_until_complete(coro)


def _make_gateway(config=None):
    """Create a ZeroClawGateway inside a running event loop."""
    async def _create():
        return ZeroClawGateway(config=config)
    return _run(_create())


# ---------------------------------------------------------------------------
# Gateway registration
# ---------------------------------------------------------------------------

class TestZeroClawGatewayRegistration(unittest.TestCase):

    def setUp(self):
        self.gateway = _make_gateway()

    def test_default_adapters_registered(self):
        # Give the create_task a chance to run
        _run(asyncio.sleep(0))
        adapters = self.gateway._adapters
        self.assertIn("git", adapters)
        self.assertIn("shell", adapters)
        self.assertIn("filesystem", adapters)
        self.assertIn("research", adapters)

    def test_register_custom_adapter(self):
        custom = GitAdapter()

        async def register():
            await self.gateway.register_adapter("custom_git", custom)

        _run(register())
        self.assertIn("custom_git", self.gateway._adapters)

    def test_get_adapter_by_name(self):
        _run(asyncio.sleep(0))

        async def get():
            return await self.gateway.get_adapter("git")

        adapter = _run(get())
        self.assertIsNotNone(adapter)

    def test_get_unknown_adapter_raises(self):
        async def get_bad():
            return await self.gateway.get_adapter("nonexistent")

        with self.assertRaises(ValueError):
            _run(get_bad())

    def test_multiple_custom_adapters_registered(self):
        async def setup():
            await self.gateway.register_adapter("adapter_a", ShellAdapter())
            await self.gateway.register_adapter("adapter_b", FilesystemAdapter())

        _run(setup())
        self.assertIn("adapter_a", self.gateway._adapters)
        self.assertIn("adapter_b", self.gateway._adapters)


# ---------------------------------------------------------------------------
# Gateway dispatching
# ---------------------------------------------------------------------------

class TestZeroClawGatewayDispatch(unittest.TestCase):

    def setUp(self):
        self.gateway = _make_gateway()
        _run(asyncio.sleep(0))  # allow default adapter registration

    def test_dispatch_to_shell_adapter(self):
        # ShellAdapter.execute with unknown op name returns error (not crashes)
        async def run():
            return await self.gateway.execute_operation(
                "shell", {"name": "unknown_op"}
            )

        result = _run(run())
        # Should get an error response, not an exception
        self.assertIsInstance(result, dict)

    def test_dispatch_to_git_adapter_unknown_op(self):
        async def run():
            return await self.gateway.execute_operation(
                "git", {"name": "not_a_real_op"}
            )

        result = _run(run())
        self.assertEqual(result.get("status"), "error")

    def test_operation_log_records_execution(self):
        async def run():
            await self.gateway.execute_operation("shell", {"name": "unknown_op"})
            return await self.gateway.get_operation_log()

        log = _run(run())
        self.assertIsInstance(log, list)
        self.assertGreater(len(log), 0)

    def test_batch_execute_processes_multiple(self):
        async def run():
            ops = [
                {"adapter": "git", "operation": {"name": "not_op"}},
                {"adapter": "shell", "operation": {"name": "not_op"}},
            ]
            return await self.gateway.execute_batch(ops)

        results = _run(run())
        self.assertEqual(len(results), 2)

    def test_batch_execute_handles_missing_adapter_name(self):
        async def run():
            return await self.gateway.execute_batch([{"operation": {}}])

        results = _run(run())
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]["status"], "error")


# ---------------------------------------------------------------------------
# GitAdapter validate + execute (mocked subprocess)
# ---------------------------------------------------------------------------

class TestGitAdapterValidateAndExecute(unittest.TestCase):

    def test_validate_allowed_command(self):
        adapter = GitAdapter()
        result = _run(adapter.validate({"command": "status"}))
        self.assertTrue(result)

    def test_validate_rejects_disallowed_named_op(self):
        adapter = GitAdapter()
        result = _run(adapter.validate({"name": "not_valid"}))
        self.assertFalse(result)

    def test_validate_clone_requires_repository(self):
        adapter = GitAdapter()
        result = _run(adapter.validate({"name": "clone", "repository": ""}))
        self.assertFalse(result)

    def test_validate_clone_with_repository_passes(self):
        adapter = GitAdapter()
        result = _run(adapter.validate({"name": "clone", "repository": "https://example.com/repo.git"}))
        self.assertTrue(result)

    def test_validate_commit_requires_message(self):
        adapter = GitAdapter()
        result = _run(adapter.validate({"name": "commit"}))
        self.assertFalse(result)

    def test_execute_command_mode_with_mocked_subprocess(self):
        adapter = GitAdapter()
        mock_result = MagicMock()
        mock_result.stdout = "On branch main\n"
        mock_result.stderr = ""
        mock_result.returncode = 0

        with patch("subprocess.run", return_value=mock_result):
            result = _run(adapter.execute({"command": "status"}))

        self.assertEqual(result["status"], "ok")
        self.assertIn("main", result["output"])

    def test_execute_named_clone_with_mocked_subprocess(self):
        adapter = GitAdapter()
        mock_result = MagicMock()
        mock_result.stdout = "Cloning...\n"
        mock_result.stderr = ""
        mock_result.returncode = 0

        with patch("subprocess.run", return_value=mock_result):
            result = _run(adapter.execute({
                "name": "clone",
                "repository": "https://github.com/example/repo.git"
            }))

        self.assertEqual(result["status"], "success")
        self.assertIn("repository", result)

    def test_execute_stats_increments_on_each_call(self):
        adapter = GitAdapter()
        mock_result = MagicMock()
        mock_result.stdout = ""
        mock_result.stderr = ""
        mock_result.returncode = 0

        with patch("subprocess.run", return_value=mock_result):
            _run(adapter.execute({"command": "status"}))
            _run(adapter.execute({"command": "status"}))

        self.assertEqual(adapter.operations_count, 2)

    def test_execute_invalid_command_returns_error(self):
        adapter = GitAdapter()
        result = _run(adapter.execute({"command": "rm_rf_slash"}))
        self.assertEqual(result["status"], "error")


# ---------------------------------------------------------------------------
# FilesystemAdapter integration
# ---------------------------------------------------------------------------

class TestFilesystemAdapterIntegration(unittest.TestCase):

    def test_validate_read_requires_path(self):
        adapter = FilesystemAdapter()
        result = _run(adapter.validate({"name": "read", "path": ""}))
        self.assertFalse(result)

    def test_validate_read_with_path_passes(self):
        adapter = FilesystemAdapter()
        result = _run(adapter.validate({"name": "read", "path": "/some/path"}))
        self.assertTrue(result)

    def test_read_nonexistent_file_returns_error(self):
        adapter = FilesystemAdapter()
        result = _run(adapter.read("/nonexistent/path/file.txt"))
        self.assertEqual(result["status"], "error")

    def test_list_directory_on_real_path(self):
        adapter = FilesystemAdapter()
        result = _run(adapter.list_directory("/tmp"))
        self.assertEqual(result["status"], "success")
        self.assertIn("entries", result)


if __name__ == "__main__":
    unittest.main()
