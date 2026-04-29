"""
Unit tests for hermes/orchestrator.py.

Covers: HermesOrchestrator, ZeroClawAdapter (abstract), GitAdapter,
FilesystemAdapter, ResearchAdapter, ShellAdapter, and RepairRouter.
"""

import asyncio
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from backend.hermes.orchestrator import (
    ContractStatus,
    FilesystemAdapter,
    GitAdapter,
    HermesOrchestrator,
    RepairRouter,
    ResearchAdapter,
    ShellAdapter,
    TaskPacket,
    TaskStatus,
    ZeroClawAdapter,
)

# Re-export for convenience in parametrize / isinstance checks
_ConcreteAdapters = (GitAdapter, ShellAdapter, FilesystemAdapter, ResearchAdapter)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def run(coro):
    """Run a coroutine synchronously (compatible with older pytest versions)."""
    return asyncio.new_event_loop().run_until_complete(coro)


# ---------------------------------------------------------------------------
# ZeroClawAdapter – abstract base
# ---------------------------------------------------------------------------

class TestZeroClawAdapterAbstract:
    """ZeroClawAdapter must not be instantiable directly."""

    def test_base_adapter_cannot_instantiate(self):
        """Attempting to instantiate the abstract base must raise TypeError."""
        with pytest.raises(TypeError):
            ZeroClawAdapter()

    def test_concrete_subclass_without_execute_cannot_instantiate(self):
        """A subclass that only implements validate but not execute must also
        raise TypeError on instantiation."""

        class PartialAdapter(ZeroClawAdapter):
            async def validate(self, operation):
                return True

        with pytest.raises(TypeError):
            PartialAdapter()

    def test_concrete_subclass_without_validate_cannot_instantiate(self):
        """A subclass that only implements execute but not validate must also
        raise TypeError on instantiation."""

        class PartialAdapter(ZeroClawAdapter):
            async def execute(self, operation):
                return {"status": "ok"}

        with pytest.raises(TypeError):
            PartialAdapter()


# ---------------------------------------------------------------------------
# FilesystemAdapter – chosen as the primary concrete adapter under test
# ---------------------------------------------------------------------------

class TestFilesystemAdapterExecute:
    """FilesystemAdapter.execute dispatches to the correct sub-operation."""

    def setup_method(self):
        self.adapter = FilesystemAdapter(root_path="/tmp")

    def test_concrete_adapter_execute_read_dispatches(self, tmp_path):
        """execute with operation='read' must call read_file and return content."""
        target = tmp_path / "hello.txt"
        target.write_bytes(b"hello world")
        adapter = FilesystemAdapter(root_path=str(tmp_path))

        result = run(adapter.execute({"operation": "read", "path": str(target)}))

        assert result["status"] == "read"
        assert result["content"] == b"hello world"
        assert result["size"] == 11

    def test_execute_write_dispatches(self, tmp_path):
        """execute with operation='write' must write bytes and return status."""
        target = tmp_path / "out.txt"
        adapter = FilesystemAdapter(root_path=str(tmp_path))

        result = run(adapter.execute({
            "operation": "write",
            "path": str(target),
            "content": b"test data",
        }))

        assert result["status"] == "written"
        assert target.read_bytes() == b"test data"

    def test_execute_list_dispatches(self, tmp_path):
        """execute with operation='list' returns directory entries."""
        (tmp_path / "a.txt").write_text("a")
        (tmp_path / "b.txt").write_text("b")
        adapter = FilesystemAdapter(root_path=str(tmp_path))

        result = run(adapter.execute({"operation": "list", "path": str(tmp_path)}))

        assert result["status"] == "listed"
        assert result["count"] == 2

    def test_execute_unknown_operation_returns_error(self):
        """execute with an unknown operation type must return an error dict."""
        result = run(self.adapter.execute({"operation": "frobnicate", "path": "/tmp"}))
        assert result["status"] == "error"
        assert "Unknown operation" in result["error"]

    def test_execute_validation_failure_returns_error(self):
        """execute must reject an operation that fails validate()."""
        # /etc/passwd is in the dangerous-paths list and outside /tmp root
        adapter = FilesystemAdapter(root_path="/tmp")
        result = run(adapter.execute({"operation": "read", "path": "/etc/passwd"}))
        assert result["status"] == "error"


class TestFilesystemAdapterValidate:
    """FilesystemAdapter.validate correctly accepts and rejects operations."""

    def setup_method(self):
        self.adapter = FilesystemAdapter(root_path="/tmp")

    def test_concrete_adapter_validate_good_operation(self, tmp_path):
        """A path inside root_path must be accepted."""
        adapter = FilesystemAdapter(root_path=str(tmp_path))
        valid = run(adapter.validate({"operation": "read", "path": str(tmp_path / "file.txt")}))
        assert valid is True

    def test_concrete_adapter_validate_bad_operation_no_path(self):
        """An operation dict with no path must be rejected."""
        valid = run(self.adapter.validate({"operation": "read"}))
        assert valid is False

    def test_concrete_adapter_validate_bad_operation_dangerous_path(self):
        """A path in the dangerous list must be rejected when no root_path constraint."""
        adapter = FilesystemAdapter()  # no root_path restriction
        valid = run(adapter.validate({"operation": "read", "path": "/etc/passwd"}))
        assert valid is False

    def test_concrete_adapter_validate_outside_root(self, tmp_path):
        """A path outside root_path must be rejected even if it exists."""
        adapter = FilesystemAdapter(root_path=str(tmp_path))
        valid = run(adapter.validate({"operation": "read", "path": "/var/log/syslog"}))
        assert valid is False


# ---------------------------------------------------------------------------
# GitAdapter
# ---------------------------------------------------------------------------

class TestGitAdapterValidate:
    """GitAdapter.validate blocks dangerous git commands."""

    def setup_method(self):
        self.adapter = GitAdapter()

    def test_safe_git_command_is_valid(self):
        result = run(self.adapter.validate({"command": ["git", "status"]}))
        assert result is True

    def test_force_push_is_rejected(self):
        result = run(self.adapter.validate({"command": "git push --force origin main"}))
        assert result is False

    def test_filter_branch_is_rejected(self):
        result = run(self.adapter.validate({"command": "git filter-branch --all"}))
        assert result is False


# ---------------------------------------------------------------------------
# ShellAdapter
# ---------------------------------------------------------------------------

class TestShellAdapterValidate:
    """ShellAdapter.validate blocks dangerous shell commands."""

    def setup_method(self):
        self.adapter = ShellAdapter()

    def test_safe_command_is_valid(self):
        result = run(self.adapter.validate({"command": "echo hello"}))
        assert result is True

    def test_empty_command_is_invalid(self):
        result = run(self.adapter.validate({"command": ""}))
        assert result is False

    def test_rm_rf_root_is_rejected(self):
        result = run(self.adapter.validate({"command": "rm -rf /"}))
        assert result is False


# ---------------------------------------------------------------------------
# ResearchAdapter
# ---------------------------------------------------------------------------

class TestSearchFunctionality:
    """ResearchAdapter search and validation behaviour."""

    def setup_method(self):
        self.adapter = ResearchAdapter()

    def test_search_functionality_returns_stub_results(self):
        """search() must return results even when httpx is not available."""
        result = run(self.adapter.search("contract automation", max_results=3))
        assert result["status"] == "searched"
        assert result["query"] == "contract automation"
        assert isinstance(result["results"], list)
        assert len(result["results"]) <= 3

    def test_validate_search_operation_good(self):
        valid = run(self.adapter.validate({"operation": "search", "query": "test query"}))
        assert valid is True

    def test_validate_search_operation_bad_missing_query(self):
        valid = run(self.adapter.validate({"operation": "search"}))
        assert valid is False

    def test_validate_extract_operation_good(self):
        valid = run(self.adapter.validate({
            "operation": "extract",
            "url": "https://example.com/page"
        }))
        assert valid is True

    def test_validate_extract_operation_bad_no_scheme(self):
        valid = run(self.adapter.validate({
            "operation": "extract",
            "url": "example.com/page"
        }))
        assert valid is False

    def test_summarize_returns_truncated_content(self):
        long_text = "This is a sentence. " * 50
        result = run(self.adapter.summarize(long_text, max_length=100))
        assert result["status"] == "summarized"
        assert len(result["summary"]) <= 110  # small tolerance for trailing period


# ---------------------------------------------------------------------------
# HermesOrchestrator
# ---------------------------------------------------------------------------

class TestOrchestratorInit:
    """HermesOrchestrator initialises correctly."""

    def test_orchestrator_init_no_args(self):
        orch = HermesOrchestrator()
        assert orch.runtime_api is None
        assert orch.event_bus is None
        assert orch.provider_router is None
        assert isinstance(orch.contracts, dict)
        assert isinstance(orch.tasks, dict)
        # Default adapter is a ShellAdapter; it must still satisfy the ZeroClawAdapter interface.
        assert isinstance(orch.zeroclaw_adapter, ZeroClawAdapter)
        assert isinstance(orch.zeroclaw_adapter, ShellAdapter)

    def test_orchestrator_init_with_args(self):
        mock_api = MagicMock()
        mock_bus = MagicMock()
        mock_router = MagicMock()
        orch = HermesOrchestrator(
            runtime_api=mock_api,
            event_bus=mock_bus,
            provider_router=mock_router,
        )
        assert orch.runtime_api is mock_api
        assert orch.event_bus is mock_bus
        assert orch.provider_router is mock_router


class TestOrchestratorDispatchTask:
    """HermesOrchestrator full intake → contract → fanout pipeline."""

    def setup_method(self):
        self.orch = HermesOrchestrator()

    def test_orchestrator_dispatch_task_intake_to_fanout(self):
        """Full pipeline: intake normalizes, contract_creation stores, task_fanout returns subtasks."""
        raw = {
            "description": "Implement login feature",
            "acceptance_criteria": ["Login form exists", "Auth token returned"],
        }
        normalized = run(self.orch.intake(raw))
        assert normalized["status"] == "normalized"
        assert normalized["description"] == "Implement login feature"

        contract = run(self.orch.contract_creation(normalized))
        assert contract["status"] == "contract_created"
        contract_id = contract["contract_id"]

        subtasks = run(self.orch.task_fanout(contract_id))
        assert isinstance(subtasks, list)
        assert len(subtasks) == 2  # one per acceptance criterion
        assert all(t["status"] == TaskStatus.PENDING.value for t in subtasks)

    def test_intake_missing_description_returns_error(self):
        result = run(self.orch.intake({"context": {}}))
        assert result["status"] == "error"
        assert "description" in result["error"].lower()

    def test_fanout_unknown_contract_returns_error(self):
        result = run(self.orch.task_fanout("nonexistent_contract"))
        assert result[0]["status"] == "error"

    def test_get_contract_status_after_creation(self):
        raw = {"description": "Check status pipeline"}
        normalized = run(self.orch.intake(raw))
        contract = run(self.orch.contract_creation(normalized))
        contract_id = contract["contract_id"]

        status = run(self.orch.get_contract_status(contract_id))
        assert status["contract_id"] == contract_id
        assert status["status"] == ContractStatus.PENDING.value


class TestOrchestratorHandlesError:
    """HermesOrchestrator error handling – exceptions don't propagate to callers."""

    def test_orchestrator_handles_error_intake_bad_type(self):
        """intake must handle an unexpected input type gracefully."""
        orch = HermesOrchestrator()
        # Passing a non-dict will cause .get() to raise AttributeError
        result = run(orch.intake("not a dict"))  # type: ignore[arg-type]
        assert result["status"] == "error"

    def test_orchestrator_handles_error_validation_missing_contract(self):
        """validation on a missing contract must return error, not raise."""
        orch = HermesOrchestrator()
        result = run(orch.validation("ghost_contract", []))
        assert result["status"] == "error"

    def test_orchestrator_validation_passes_with_matching_evidence(self):
        """validation should mark contract VALIDATED when evidence matches criteria."""
        orch = HermesOrchestrator()
        raw = {
            "description": "Build API",
            "acceptance_criteria": ["endpoint /health returns 200"],
        }
        normalized = run(orch.intake(raw))
        contract = run(orch.contract_creation(normalized))
        contract_id = contract["contract_id"]

        evidence = [{"result": "endpoint /health returns 200 OK"}]
        result = run(orch.validation(contract_id, evidence))
        assert result["passed"] is True
        assert result["status"] == "validated"

    def test_orchestrator_validation_fails_when_evidence_missing(self):
        """validation should mark contract FAILED when evidence is empty."""
        orch = HermesOrchestrator()
        raw = {
            "description": "Build API",
            "acceptance_criteria": ["endpoint /health returns 200"],
        }
        normalized = run(orch.intake(raw))
        contract = run(orch.contract_creation(normalized))
        contract_id = contract["contract_id"]

        result = run(orch.validation(contract_id, []))
        assert result["passed"] is False
        assert result["failed_criteria"] == ["endpoint /health returns 200"]


# ---------------------------------------------------------------------------
# RepairRouter
# ---------------------------------------------------------------------------

class TestRepairRouter:
    """RepairRouter routes and executes repairs correctly."""

    def setup_method(self):
        self.router = RepairRouter()

    def test_route_repair_returns_routed_status(self):
        issue = {"type": "validation_failure", "description": "test failed", "severity": "low"}
        result = run(self.router.route_repair(issue))
        assert result["status"] == "routed"
        assert "repair_type" in result

    def test_route_repair_git_issue(self):
        issue = {"description": "git clone failed", "type": "error"}
        result = run(self.router.route_repair(issue))
        assert result["repair_type"] == "git"

    def test_route_repair_filesystem_issue(self):
        issue = {"description": "file write permission denied", "type": "error"}
        result = run(self.router.route_repair(issue))
        assert result["repair_type"] == "filesystem"

    def test_execute_repair_generic(self):
        result = run(self.router.execute_repair("issue-1", "generic", {}))
        assert result["status"] == "repaired"

    def test_get_repair_history_empty(self):
        router = RepairRouter()
        history = run(router.get_repair_history())
        assert history == []

    def test_get_repair_history_populated(self):
        issue = {"id": "iss-42", "description": "network timeout", "type": "timeout"}
        run(self.router.route_repair(issue))
        history = run(self.router.get_repair_history(issue_id="iss-42"))
        assert len(history) == 1
        assert history[0]["issue_id"] == "iss-42"


# ---------------------------------------------------------------------------
# TaskPacket
# ---------------------------------------------------------------------------

class TestTaskPacket:
    """TaskPacket serialization round-trip."""

    def test_to_dict_and_from_dict(self):
        packet = TaskPacket(
            task_id="t-1",
            description="Do something",
            acceptance_criteria=["criterion A"],
            context={"key": "val"},
        )
        packet.status = ContractStatus.ACTIVE
        d = packet.to_dict()
        restored = TaskPacket.from_dict(d)

        assert restored.task_id == "t-1"
        assert restored.description == "Do something"
        assert restored.acceptance_criteria == ["criterion A"]
        assert restored.status == ContractStatus.ACTIVE
