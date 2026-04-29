"""
Unit tests for src/kilocode/runtime_sync.py

Run with:  pytest tests/unit/test_kilocode_runtime_sync.py -v
"""

import json
import os
import sys
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

# ---------------------------------------------------------------------------
# Make sure the project src tree is importable when running tests directly.
# ---------------------------------------------------------------------------
_SRC = Path(__file__).parent.parent.parent / "src"
if str(_SRC) not in sys.path:
    sys.path.insert(0, str(_SRC))

from kilocode.runtime_sync import RuntimeSync, SettingsManager, SyncState


# ===========================================================================
# Helpers
# ===========================================================================


def _make_clean_sync(**kwargs) -> RuntimeSync:
    """Create a RuntimeSync with auto_configure disabled (via explicit url/key)."""
    defaults = {"runtime_url": "http://test.local:9000", "api_key": "test-key"}
    defaults.update(kwargs)
    return RuntimeSync(**defaults)


# ===========================================================================
# Tests
# ===========================================================================


class TestRuntimeSyncInitDefaults:
    """test_runtime_sync_init_defaults — verify default state after construction."""

    def test_default_url(self):
        """When no runtime_url is passed AND env/config are absent, default URL is used."""
        # Ensure env vars are absent
        env_clean = {
            k: v for k, v in os.environ.items()
            if k not in ("KILOCODE_RUNTIME_URL", "KILOCODE_API_KEY", "KILOCODE_MODEL", "KILOCODE_PROVIDER")
        }
        with patch.dict(os.environ, env_clean, clear=True):
            rs = RuntimeSync()
        assert rs.runtime_url == "http://localhost:8080"

    def test_default_state_is_disconnected(self):
        rs = _make_clean_sync()
        assert rs.state == SyncState.DISCONNECTED

    def test_default_connected_is_false(self):
        rs = _make_clean_sync()
        assert rs._connected is False

    def test_explicit_url_accepted(self):
        rs = _make_clean_sync(runtime_url="http://custom:1234")
        assert rs.runtime_url == "http://custom:1234"

    def test_explicit_api_key_accepted(self):
        rs = _make_clean_sync(api_key="sk-abc123")
        assert rs.api_key == "sk-abc123"

    def test_active_tasks_empty(self):
        rs = _make_clean_sync()
        assert rs.active_tasks == {}

    def test_last_sync_none(self):
        rs = _make_clean_sync()
        assert rs._last_sync is None


class TestSettingsManagerValidKey:
    """test_settings_manager_valid_key — set_setting returns True for all VALID_SETTINGS."""

    @pytest.mark.parametrize("key", list(SettingsManager.VALID_SETTINGS))
    def test_valid_key_accepted(self, key):
        sm = SettingsManager()
        assert sm.set_setting(key, "dummy_value") is True
        assert sm.get_setting(key) == "dummy_value"


class TestSettingsManagerInvalidKeyRejected:
    """test_settings_manager_invalid_key_rejected — unknown keys must be rejected."""

    def test_unknown_key_returns_false(self):
        sm = SettingsManager()
        result = sm.set_setting("totally_unknown_key", "oops")
        assert result is False

    def test_unknown_key_not_stored(self):
        sm = SettingsManager()
        sm.set_setting("bad_key", "value")
        assert sm.get_setting("bad_key") is None

    def test_empty_key_rejected(self):
        sm = SettingsManager()
        assert sm.set_setting("", "value") is False


class TestSettingsManagerListMasksApiKey:
    """test_settings_manager_list_masks_api_key — api_key must appear masked."""

    def test_api_key_masked(self):
        sm = SettingsManager()
        sm.set_setting("api_key", "sk-supersecret123456")
        listed = sm.list_settings()
        assert listed["api_key"] == "sk-...****"

    def test_api_key_masked_does_not_leak_value(self):
        sm = SettingsManager()
        sm.set_setting("api_key", "sk-supersecret123456")
        listed = sm.list_settings()
        assert "supersecret" not in listed["api_key"]

    def test_other_settings_not_masked(self):
        sm = SettingsManager()
        sm.set_setting("runtime_url", "http://example.com")
        sm.set_setting("model", "claude-opus")
        listed = sm.list_settings()
        assert listed["runtime_url"] == "http://example.com"
        assert listed["model"] == "claude-opus"

    def test_empty_api_key_not_masked(self):
        """An explicitly empty api_key should not be mangled."""
        sm = SettingsManager()
        sm.set_setting("api_key", "")
        listed = sm.list_settings()
        # Empty string is falsy — passes through unchanged
        assert listed["api_key"] == ""


class TestAutoConfigureFromEnv:
    """test_auto_configure_from_env — env vars must be wired into the instance."""

    def test_env_api_key_applied(self, monkeypatch):
        monkeypatch.setenv("KILOCODE_API_KEY", "sk-from-env")
        monkeypatch.delenv("KILOCODE_RUNTIME_URL", raising=False)
        monkeypatch.delenv("KILOCODE_MODEL", raising=False)
        monkeypatch.delenv("KILOCODE_PROVIDER", raising=False)
        rs = RuntimeSync()  # no explicit args → auto_configure runs
        assert rs.api_key == "sk-from-env"

    def test_env_runtime_url_applied(self, monkeypatch):
        monkeypatch.setenv("KILOCODE_RUNTIME_URL", "http://env-server:7777")
        monkeypatch.delenv("KILOCODE_API_KEY", raising=False)
        monkeypatch.delenv("KILOCODE_MODEL", raising=False)
        monkeypatch.delenv("KILOCODE_PROVIDER", raising=False)
        rs = RuntimeSync()
        assert rs.runtime_url == "http://env-server:7777"

    def test_env_model_applied(self, monkeypatch):
        monkeypatch.setenv("KILOCODE_MODEL", "anthropic/claude-opus")
        monkeypatch.delenv("KILOCODE_API_KEY", raising=False)
        monkeypatch.delenv("KILOCODE_RUNTIME_URL", raising=False)
        monkeypatch.delenv("KILOCODE_PROVIDER", raising=False)
        rs = RuntimeSync()
        assert rs.model == "anthropic/claude-opus"

    def test_env_provider_applied(self, monkeypatch):
        monkeypatch.setenv("KILOCODE_PROVIDER", "openai")
        monkeypatch.delenv("KILOCODE_API_KEY", raising=False)
        monkeypatch.delenv("KILOCODE_RUNTIME_URL", raising=False)
        monkeypatch.delenv("KILOCODE_MODEL", raising=False)
        rs = RuntimeSync()
        assert rs.provider == "openai"

    def test_explicit_constructor_arg_wins_over_env(self, monkeypatch):
        """Explicitly-passed constructor args must not be overwritten by env vars."""
        monkeypatch.setenv("KILOCODE_API_KEY", "sk-from-env")
        monkeypatch.setenv("KILOCODE_RUNTIME_URL", "http://env-server")
        # Passing explicit args → auto_configure is skipped entirely
        rs = RuntimeSync(runtime_url="http://explicit:9000", api_key="sk-explicit")
        assert rs.api_key == "sk-explicit"
        assert rs.runtime_url == "http://explicit:9000"

    def test_auto_configure_standalone(self, monkeypatch):
        """SettingsManager.auto_configure can be called directly on an existing instance."""
        monkeypatch.setenv("KILOCODE_MODEL", "minimax/abab6")
        monkeypatch.delenv("KILOCODE_API_KEY", raising=False)
        monkeypatch.delenv("KILOCODE_RUNTIME_URL", raising=False)
        monkeypatch.delenv("KILOCODE_PROVIDER", raising=False)

        rs = _make_clean_sync()  # explicit creds → no auto_configure in __init__
        rs.model = None          # reset so auto_configure can fill it
        SettingsManager().auto_configure(rs)
        assert rs.model == "minimax/abab6"


class TestConnectReturnsBool:
    """test_connect_returns_bool — connect() must return True/False and update state."""

    @pytest.mark.asyncio
    async def test_connect_success_returns_true(self):
        rs = _make_clean_sync()
        with patch.object(rs, "_api_request", new=AsyncMock(return_value={"status": "ok"})):
            result = await rs.connect()
        assert result is True
        assert rs._connected is True
        assert rs.state == SyncState.CONNECTED

    @pytest.mark.asyncio
    async def test_connect_failure_returns_false(self):
        rs = _make_clean_sync()

        async def _raise(*_a, **_kw):
            raise ConnectionError("refused")

        with patch.object(rs, "_api_request", new=_raise):
            result = await rs.connect()
        assert result is False
        assert rs._connected is False
        assert rs.state == SyncState.ERROR

    @pytest.mark.asyncio
    async def test_connect_offline_response_still_connects(self):
        """'offline' status in health response should not prevent connection."""
        rs = _make_clean_sync()
        with patch.object(rs, "_api_request", new=AsyncMock(return_value={"status": "offline"})):
            result = await rs.connect()
        assert result is True


class TestPushTaskStateWhenDisconnected:
    """test_push_task_state_when_disconnected — must return False without crashing."""

    @pytest.mark.asyncio
    async def test_returns_false_when_disconnected(self):
        rs = _make_clean_sync()
        assert rs._connected is False
        result = await rs.push_task_state("task-001", {"progress": 0})
        assert result is False

    @pytest.mark.asyncio
    async def test_does_not_mutate_active_tasks_when_disconnected(self):
        rs = _make_clean_sync()
        await rs.push_task_state("task-001", {"progress": 0})
        # active_tasks should NOT be mutated when disconnected (guard fires first)
        assert "task-001" not in rs.active_tasks

    @pytest.mark.asyncio
    async def test_push_succeeds_when_connected(self):
        rs = _make_clean_sync()
        rs._connected = True
        with patch.object(rs, "_api_request", new=AsyncMock(return_value={"status": "ok"})):
            result = await rs.push_task_state("task-abc", {"progress": 50})
        assert result is True
        assert rs.active_tasks["task-abc"] == {"progress": 50}


class TestSettingsExportImport:
    """test_settings_export_import — round-trip through a temporary JSON file."""

    def test_export_creates_file(self, tmp_path):
        sm = SettingsManager()
        sm.set_setting("model", "claude-test")
        sm.set_setting("runtime_url", "http://example.com")
        out_file = str(tmp_path / "settings.json")
        assert sm.export_settings(out_file) is True
        assert Path(out_file).exists()

    def test_exported_file_is_valid_json(self, tmp_path):
        sm = SettingsManager()
        sm.set_setting("model", "claude-test")
        out_file = str(tmp_path / "settings.json")
        sm.export_settings(out_file)
        with open(out_file) as fh:
            data = json.load(fh)
        assert isinstance(data, dict)

    def test_api_key_not_in_exported_file(self, tmp_path):
        sm = SettingsManager()
        sm.set_setting("api_key", "sk-do-not-expose")
        out_file = str(tmp_path / "settings.json")
        sm.export_settings(out_file)
        with open(out_file) as fh:
            raw = fh.read()
        assert "sk-do-not-expose" not in raw

    def test_import_reads_back_settings(self, tmp_path):
        data = {"model": "gpt-4o", "timeout": 30, "provider": "openai"}
        in_file = str(tmp_path / "import.json")
        with open(in_file, "w") as fh:
            json.dump(data, fh)

        sm = SettingsManager()
        assert sm.import_settings(in_file) is True
        assert sm.get_setting("model") == "gpt-4o"
        assert sm.get_setting("provider") == "openai"
        assert sm.get_setting("timeout") == 30

    def test_import_ignores_unknown_keys(self, tmp_path):
        data = {"model": "gpt-4o", "super_secret_unknown": "hack"}
        in_file = str(tmp_path / "import.json")
        with open(in_file, "w") as fh:
            json.dump(data, fh)

        sm = SettingsManager()
        sm.import_settings(in_file)
        assert sm.get_setting("super_secret_unknown") is None

    def test_import_returns_false_on_missing_file(self, tmp_path):
        sm = SettingsManager()
        result = sm.import_settings(str(tmp_path / "no_such_file.json"))
        assert result is False

    def test_import_returns_false_on_bad_json(self, tmp_path):
        bad_file = str(tmp_path / "bad.json")
        with open(bad_file, "w") as fh:
            fh.write("NOT JSON {{{")
        sm = SettingsManager()
        assert sm.import_settings(bad_file) is False

    def test_round_trip_non_api_key_settings(self, tmp_path):
        sm_write = SettingsManager()
        sm_write.set_setting("model", "anthropic/claude-3")
        sm_write.set_setting("timeout", 60)
        sm_write.set_setting("max_retries", 3)

        out_file = str(tmp_path / "rt.json")
        sm_write.export_settings(out_file)

        sm_read = SettingsManager()
        sm_read.import_settings(out_file)

        assert sm_read.get_setting("model") == "anthropic/claude-3"
        assert sm_read.get_setting("timeout") == 60
        assert sm_read.get_setting("max_retries") == 3
