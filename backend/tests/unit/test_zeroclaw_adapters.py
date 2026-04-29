"""
Unit tests for ZeroClaw adapters.

Covers:
- BaseAdapter abstractness
- GitAdapter validate and execute (command mode)
- GitAdapter stats
- FilesystemAdapter execute and validate (representative concrete adapter)
- ShellAdapter execute and validate
- ResearchAdapter execute and validate
"""

import pytest
import subprocess
from unittest.mock import AsyncMock, MagicMock, patch

from backend.zeroclaw.adapters import (
    BaseAdapter,
    GitAdapter,
    ShellAdapter,
    FilesystemAdapter,
    ResearchAdapter,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def make_completed_process(stdout="", stderr="", returncode=0):
    """Return a mock CompletedProcess-like object."""
    cp = MagicMock(spec=subprocess.CompletedProcess)
    cp.stdout = stdout
    cp.stderr = stderr
    cp.returncode = returncode
    return cp


# ---------------------------------------------------------------------------
# BaseAdapter
# ---------------------------------------------------------------------------

class TestBaseAdapterIsAbstract:
    """BaseAdapter cannot be instantiated directly."""

    def test_base_adapter_is_abstract(self):
        with pytest.raises(TypeError):
            BaseAdapter("test")  # type: ignore[abstract]

    def test_concrete_subclass_must_implement_execute_and_validate(self):
        """A subclass that implements only execute should still fail."""

        class PartialAdapter(BaseAdapter):
            async def execute(self, operation):
                return {}

        with pytest.raises(TypeError):
            PartialAdapter("partial")  # type: ignore[abstract]

    def test_concrete_subclass_with_both_methods_instantiates(self):
        """A complete subclass should instantiate without error."""

        class FullAdapter(BaseAdapter):
            async def execute(self, operation):
                return {"status": "ok"}

            async def validate(self, operation):
                return True

        adapter = FullAdapter("full")
        assert adapter.name == "full"


# ---------------------------------------------------------------------------
# GitAdapter — validate
# ---------------------------------------------------------------------------

class TestGitAdapterValidate:
    """Tests for GitAdapter.validate in both command and named-operation modes."""

    @pytest.fixture
    def adapter(self):
        return GitAdapter()

    @pytest.mark.asyncio
    async def test_git_adapter_validate_valid_operation(self, adapter):
        """A whitelisted command with no repo_path should pass validation."""
        operation = {"command": "status"}
        assert await adapter.validate(operation) is True

    @pytest.mark.asyncio
    async def test_git_adapter_validate_valid_operation_with_args(self, adapter):
        """A whitelisted command with extra args should pass validation."""
        operation = {"command": "log", "args": ["--oneline", "-5"]}
        assert await adapter.validate(operation) is True

    @pytest.mark.asyncio
    async def test_git_adapter_validate_invalid_command(self, adapter):
        """A non-whitelisted command should fail validation."""
        operation = {"command": "rm"}
        assert await adapter.validate(operation) is False

    @pytest.mark.asyncio
    async def test_git_adapter_validate_missing_command_key(self, adapter):
        """An operation with neither 'command' nor 'name' should fail."""
        operation = {"args": ["--short"]}
        assert await adapter.validate(operation) is False

    @pytest.mark.asyncio
    async def test_git_adapter_validate_empty_command(self, adapter):
        """An empty string for command should fail validation."""
        operation = {"command": ""}
        assert await adapter.validate(operation) is False

    @pytest.mark.asyncio
    async def test_git_adapter_validate_repo_path_exists(self, adapter, tmp_path):
        """A valid repo_path that exists on disk should pass."""
        operation = {"command": "status", "repo_path": str(tmp_path)}
        assert await adapter.validate(operation) is True

    @pytest.mark.asyncio
    async def test_git_adapter_validate_repo_path_missing(self, adapter):
        """A repo_path that does not exist on disk should fail."""
        operation = {"command": "status", "repo_path": "/nonexistent/path/xyz"}
        assert await adapter.validate(operation) is False

    @pytest.mark.asyncio
    async def test_git_adapter_validate_named_op_valid_clone(self, adapter):
        """Named-operation mode: clone with repository key should pass."""
        operation = {"name": "clone", "repository": "https://github.com/example/repo"}
        assert await adapter.validate(operation) is True

    @pytest.mark.asyncio
    async def test_git_adapter_validate_named_op_clone_missing_repo(self, adapter):
        """Named-operation mode: clone without repository key should fail."""
        operation = {"name": "clone"}
        assert await adapter.validate(operation) is False

    @pytest.mark.asyncio
    async def test_git_adapter_validate_named_op_unknown(self, adapter):
        """Named-operation mode: unknown operation name should fail."""
        operation = {"name": "rebase"}
        assert await adapter.validate(operation) is False


# ---------------------------------------------------------------------------
# GitAdapter — execute (command mode)
# ---------------------------------------------------------------------------

class TestGitAdapterExecuteCommandMode:
    """Tests for GitAdapter.execute in command mode (subprocess-based)."""

    @pytest.fixture
    def adapter(self):
        return GitAdapter()

    @pytest.mark.asyncio
    async def test_git_adapter_execute_status(self, adapter, tmp_path):
        """execute with command='status' should call subprocess and return ok."""
        mock_result = make_completed_process(
            stdout="On branch main\nnothing to commit", returncode=0
        )
        with patch("subprocess.run", return_value=mock_result) as mock_run:
            result = await adapter.execute(
                {"command": "status", "repo_path": str(tmp_path)}
            )

        assert result["status"] == "ok"
        assert result["command"] == "status"
        assert "On branch main" in result["output"]
        mock_run.assert_called_once()
        call_args = mock_run.call_args
        assert call_args[0][0][:2] == ["git", "status"]

    @pytest.mark.asyncio
    async def test_git_adapter_execute_status_with_args(self, adapter, tmp_path):
        """execute should pass extra args to subprocess."""
        mock_result = make_completed_process(stdout="M  file.py", returncode=0)
        with patch("subprocess.run", return_value=mock_result) as mock_run:
            result = await adapter.execute(
                {"command": "status", "args": ["--short"], "repo_path": str(tmp_path)}
            )

        assert result["status"] == "ok"
        call_args = mock_run.call_args
        assert call_args[0][0] == ["git", "status", "--short"]

    @pytest.mark.asyncio
    async def test_git_adapter_execute_invalid_command_returns_error(self, adapter):
        """execute with a non-whitelisted command should return error without calling subprocess."""
        with patch("subprocess.run") as mock_run:
            result = await adapter.execute({"command": "rm"})

        assert result["status"] == "error"
        mock_run.assert_not_called()

    @pytest.mark.asyncio
    async def test_git_adapter_execute_subprocess_timeout(self, adapter, tmp_path):
        """execute should handle subprocess.TimeoutExpired gracefully."""
        with patch(
            "subprocess.run", side_effect=subprocess.TimeoutExpired(cmd="git status", timeout=300)
        ):
            result = await adapter.execute(
                {"command": "status", "repo_path": str(tmp_path)}
            )

        assert result["status"] == "error"
        assert "timed out" in result["error"].lower()

    @pytest.mark.asyncio
    async def test_git_adapter_execute_fetch(self, adapter, tmp_path):
        """execute with command='fetch' (whitelisted) should work."""
        mock_result = make_completed_process(stdout="", returncode=0)
        with patch("subprocess.run", return_value=mock_result):
            result = await adapter.execute(
                {"command": "fetch", "repo_path": str(tmp_path)}
            )
        assert result["status"] == "ok"
        assert result["command"] == "fetch"

    @pytest.mark.asyncio
    async def test_git_adapter_execute_log(self, adapter, tmp_path):
        """execute with command='log' should work."""
        log_output = "abc1234 First commit\ndef5678 Second commit\n"
        mock_result = make_completed_process(stdout=log_output, returncode=0)
        with patch("subprocess.run", return_value=mock_result):
            result = await adapter.execute(
                {"command": "log", "args": ["--oneline"], "repo_path": str(tmp_path)}
            )
        assert result["status"] == "ok"
        assert "First commit" in result["output"]


# ---------------------------------------------------------------------------
# GitAdapter — stats
# ---------------------------------------------------------------------------

class TestAdapterGetStats:
    """Tests for BaseAdapter.get_stats via GitAdapter."""

    @pytest.fixture
    def adapter(self):
        return GitAdapter()

    def test_initial_stats(self, adapter):
        stats = adapter.get_stats()
        assert stats["name"] == "git"
        assert stats["operations_count"] == 0
        assert stats["last_operation"] is None

    @pytest.mark.asyncio
    async def test_stats_after_execute(self, adapter, tmp_path):
        mock_result = make_completed_process(stdout="output", returncode=0)
        with patch("subprocess.run", return_value=mock_result):
            await adapter.execute({"command": "status", "repo_path": str(tmp_path)})

        stats = adapter.get_stats()
        assert stats["operations_count"] == 1
        assert stats["last_operation"] == {
            "command": "status",
            "repo_path": str(tmp_path),
        }

    @pytest.mark.asyncio
    async def test_stats_operations_count_increments(self, adapter, tmp_path):
        mock_result = make_completed_process(stdout="", returncode=0)
        with patch("subprocess.run", return_value=mock_result):
            for _ in range(3):
                await adapter.execute(
                    {"command": "status", "repo_path": str(tmp_path)}
                )

        assert adapter.get_stats()["operations_count"] == 3


# ---------------------------------------------------------------------------
# FilesystemAdapter — execute and validate
# ---------------------------------------------------------------------------

class TestFilesystemAdapterExecute:
    """Tests for FilesystemAdapter (another concrete adapter)."""

    @pytest.fixture
    def adapter(self, tmp_path):
        return FilesystemAdapter(config={"root_path": str(tmp_path)})

    @pytest.mark.asyncio
    async def test_filesystem_adapter_validate_read_valid(self, adapter):
        operation = {"name": "read", "path": "/some/file.txt"}
        assert await adapter.validate(operation) is True

    @pytest.mark.asyncio
    async def test_filesystem_adapter_validate_read_missing_path(self, adapter):
        operation = {"name": "read"}
        assert await adapter.validate(operation) is False

    @pytest.mark.asyncio
    async def test_filesystem_adapter_validate_copy_valid(self, adapter):
        operation = {"name": "copy", "source": "/a.txt", "destination": "/b.txt"}
        assert await adapter.validate(operation) is True

    @pytest.mark.asyncio
    async def test_filesystem_adapter_validate_unknown_op(self, adapter):
        operation = {"name": "chmod"}
        assert await adapter.validate(operation) is False

    @pytest.mark.asyncio
    async def test_filesystem_adapter_execute_write_and_read(self, adapter, tmp_path):
        """Write a file then read it back through the adapter."""
        content = b"hello zeroclaw"
        write_result = await adapter.execute(
            {"name": "write", "path": "test.txt", "content": content}
        )
        assert write_result["status"] == "success"
        assert write_result["bytes_written"] == len(content)

        read_result = await adapter.execute(
            {"name": "read", "path": "test.txt"}
        )
        assert read_result["status"] == "success"
        assert read_result["content"] == content

    @pytest.mark.asyncio
    async def test_filesystem_adapter_execute_list_directory(self, adapter, tmp_path):
        """list_directory should enumerate files in the root."""
        (tmp_path / "alpha.txt").write_text("a")
        (tmp_path / "beta.txt").write_text("b")

        result = await adapter.execute({"name": "list_directory", "path": str(tmp_path)})
        assert result["status"] == "success"
        names = {e["name"] for e in result["entries"]}
        assert "alpha.txt" in names
        assert "beta.txt" in names

    @pytest.mark.asyncio
    async def test_filesystem_adapter_execute_read_missing_file(self, adapter):
        result = await adapter.execute({"name": "read", "path": "nonexistent.txt"})
        assert result["status"] == "error"

    @pytest.mark.asyncio
    async def test_filesystem_adapter_execute_unknown_operation(self, adapter):
        result = await adapter.execute({"name": "chmod"})
        assert result["status"] == "error"

    def test_filesystem_adapter_stats(self, adapter):
        stats = adapter.get_stats()
        assert stats["name"] == "filesystem"
        assert stats["operations_count"] == 0


# ---------------------------------------------------------------------------
# ShellAdapter — execute and validate
# ---------------------------------------------------------------------------

class TestShellAdapterExecuteAndValidate:
    """Tests for ShellAdapter."""

    @pytest.fixture
    def adapter(self):
        return ShellAdapter()

    @pytest.mark.asyncio
    async def test_shell_adapter_validate_run_valid(self, adapter):
        operation = {"name": "run", "command": "echo"}
        assert await adapter.validate(operation) is True

    @pytest.mark.asyncio
    async def test_shell_adapter_validate_run_missing_command(self, adapter):
        operation = {"name": "run"}
        assert await adapter.validate(operation) is False

    @pytest.mark.asyncio
    async def test_shell_adapter_validate_get_output_valid(self, adapter):
        operation = {"name": "get_output", "process_id": "abc123"}
        assert await adapter.validate(operation) is True

    @pytest.mark.asyncio
    async def test_shell_adapter_validate_unknown_op(self, adapter):
        operation = {"name": "kill"}
        assert await adapter.validate(operation) is False

    @pytest.mark.asyncio
    async def test_shell_adapter_execute_run(self, adapter):
        """execute with name='run' should invoke Popen and capture output."""
        mock_process = MagicMock()
        mock_process.communicate.return_value = ("hello\n", "")
        mock_process.returncode = 0

        with patch("subprocess.Popen", return_value=mock_process):
            result = await adapter.execute(
                {"name": "run", "command": "echo", "args": ["hello"]}
            )

        assert result["status"] == "success"
        assert result["stdout"] == "hello\n"
        assert result["exit_code"] == 0

    @pytest.mark.asyncio
    async def test_shell_adapter_execute_get_output_not_found(self, adapter):
        """get_output for unknown process_id should return error."""
        result = await adapter.execute(
            {"name": "get_output", "process_id": "nonexistent"}
        )
        assert result["status"] == "error"

    def test_shell_adapter_stats(self, adapter):
        stats = adapter.get_stats()
        assert stats["name"] == "shell"


# ---------------------------------------------------------------------------
# ResearchAdapter — execute and validate
# ---------------------------------------------------------------------------

class TestResearchAdapterExecuteAndValidate:
    """Tests for ResearchAdapter."""

    @pytest.fixture
    def adapter(self):
        return ResearchAdapter()

    @pytest.mark.asyncio
    async def test_research_adapter_validate_search_valid(self, adapter):
        assert await adapter.validate({"name": "search", "query": "zeroclaw"}) is True

    @pytest.mark.asyncio
    async def test_research_adapter_validate_search_missing_query(self, adapter):
        assert await adapter.validate({"name": "search"}) is False

    @pytest.mark.asyncio
    async def test_research_adapter_validate_extract_valid(self, adapter):
        assert await adapter.validate({"name": "extract", "url": "https://example.com"}) is True

    @pytest.mark.asyncio
    async def test_research_adapter_validate_extract_missing_url(self, adapter):
        assert await adapter.validate({"name": "extract"}) is False

    @pytest.mark.asyncio
    async def test_research_adapter_validate_summarize_valid(self, adapter):
        assert await adapter.validate({"name": "summarize", "content": "some text"}) is True

    @pytest.mark.asyncio
    async def test_research_adapter_validate_unknown_op(self, adapter):
        assert await adapter.validate({"name": "crawl"}) is False

    @pytest.mark.asyncio
    async def test_research_adapter_execute_summarize_short_content(self, adapter):
        """Summarize should return content unchanged when it is short enough."""
        short_text = "This is a short summary."
        result = await adapter.execute(
            {"name": "summarize", "content": short_text, "max_length": 500}
        )
        assert result["status"] == "success"
        assert short_text in result["summary"]

    @pytest.mark.asyncio
    async def test_research_adapter_execute_summarize_truncates(self, adapter):
        """Summarize should truncate content that exceeds max_length."""
        long_text = "Word. " * 200  # 1200 chars
        result = await adapter.execute(
            {"name": "summarize", "content": long_text, "max_length": 50}
        )
        assert result["status"] == "success"
        assert len(result["summary"]) <= len(long_text)

    @pytest.mark.asyncio
    async def test_research_adapter_execute_validation_failure(self, adapter):
        """execute should return error when validation fails."""
        result = await adapter.execute({"name": "search"})  # missing query
        assert result["status"] == "error"

    def test_research_adapter_stats(self, adapter):
        stats = adapter.get_stats()
        assert stats["name"] == "research"
