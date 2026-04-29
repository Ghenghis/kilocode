"""
Integration tests: ContractKitIntegration full pipeline.

Tests initialization, health check, graceful shutdown, and task processing
through the complete pipeline (intake → contract → fanout).

Note: integration.py attempts to instantiate the abstract ZeroClawAdapter
directly (a bug in the source), so we patch it with a concrete subclass for
all initialization-dependent tests.
"""

import asyncio
import os
import sys
import unittest
from unittest.mock import AsyncMock, MagicMock, patch

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../../src"))

import backend.runtime.core as _core
from backend.hermes.orchestrator import ZeroClawAdapter, ShellAdapter


# ---------------------------------------------------------------------------
# Concrete stub that satisfies the abstract ZeroClawAdapter interface.
# This is needed because integration.py instantiates ZeroClawAdapter(config=…)
# directly, which fails because ZeroClawAdapter is abstract.
# ---------------------------------------------------------------------------
class _ConcreteZeroClawAdapter(ZeroClawAdapter):
    def __init__(self, config=None):
        super().__init__()
        self.config = config or {}

    async def execute(self, operation):
        return {"status": "ok", "operation": operation}

    async def validate(self, operation):
        return True


def _run(coro):
    return asyncio.new_event_loop().run_until_complete(coro)


def _make_integration(config=None):
    from backend.integration import ContractKitIntegration
    return ContractKitIntegration(config=config)


def _initialized(config=None):
    """Create and initialize a ContractKitIntegration with all external deps mocked."""
    integration = _make_integration(config=config)
    with patch.object(_core.EventBus, "connect", new_callable=AsyncMock), \
         patch("backend.integration.ZeroClawAdapter", _ConcreteZeroClawAdapter):
        _run(integration.initialize())
    return integration


# ---------------------------------------------------------------------------
# Initialization
# ---------------------------------------------------------------------------

class TestContractKitIntegrationInit(unittest.TestCase):

    def test_initialize_sets_event_bus(self):
        integration = _initialized()
        self.assertIsNotNone(integration.event_bus)

    def test_initialize_sets_provider_router(self):
        integration = _initialized()
        self.assertIsNotNone(integration.provider_router)

    def test_initialize_sets_runtime_api(self):
        integration = _initialized()
        self.assertIsNotNone(integration.runtime_api)

    def test_initialize_sets_zeroclaw_gateway(self):
        integration = _initialized()
        self.assertIsNotNone(integration.zeroclaw_gateway)

    def test_initialize_sets_hermes_orchestrator(self):
        integration = _initialized()
        self.assertIsNotNone(integration.hermes_orchestrator)

    def test_initialize_with_custom_providers(self):
        integration = _initialized(config={"providers": ["anthropic", "openai"]})
        self.assertEqual(integration.providers, ["anthropic", "openai"])

    def test_default_providers_set_when_no_config(self):
        integration = _make_integration()
        self.assertIsInstance(integration.providers, list)
        self.assertGreater(len(integration.providers), 0)


# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------

class TestContractKitHealthCheck(unittest.TestCase):

    def test_health_check_returns_components(self):
        integration = _initialized()
        health = _run(integration.health_check())
        self.assertIn("components", health)

    def test_health_check_includes_runtime_api(self):
        integration = _initialized()
        health = _run(integration.health_check())
        self.assertIn("runtime_api", health["components"])

    def test_health_check_includes_provider_router(self):
        integration = _initialized()
        health = _run(integration.health_check())
        self.assertIn("provider_router", health["components"])

    def test_health_check_includes_hermes_orchestrator(self):
        integration = _initialized()
        health = _run(integration.health_check())
        self.assertIn("hermes_orchestrator", health["components"])

    def test_health_check_provider_router_lists_providers(self):
        integration = _initialized()
        health = _run(integration.health_check())
        router_health = health["components"]["provider_router"]
        self.assertIn("providers", router_health)

    def test_health_check_hermes_orchestrator_counts(self):
        integration = _initialized()
        health = _run(integration.health_check())
        hermes = health["components"]["hermes_orchestrator"]
        self.assertIn("contracts_count", hermes)
        self.assertIn("tasks_count", hermes)


# ---------------------------------------------------------------------------
# Graceful shutdown
# ---------------------------------------------------------------------------

class TestContractKitGracefulShutdown(unittest.TestCase):

    def test_stop_sets_running_false(self):
        integration = _initialized()
        with patch.object(_core.EventBus, "disconnect", new_callable=AsyncMock):
            _run(integration.stop())
        self.assertFalse(integration._running)

    def test_stop_without_initialize_does_not_raise(self):
        integration = _make_integration()
        try:
            _run(integration.stop())
        except Exception as exc:
            self.fail(f"stop() raised unexpectedly: {exc}")

    def test_running_flag_false_before_start(self):
        integration = _make_integration()
        self.assertFalse(integration._running)


# ---------------------------------------------------------------------------
# Task processing via HermesOrchestrator directly
# ---------------------------------------------------------------------------

class TestContractKitProcessTask(unittest.TestCase):
    """Test the orchestrator pipeline components reachable via the integration."""

    def test_process_task_raises_without_init(self):
        integration = _make_integration()
        with self.assertRaises(RuntimeError):
            _run(integration.process_task({"description": "Do something"}))

    def test_intake_rejects_missing_description(self):
        integration = _initialized()
        result = _run(integration.hermes_orchestrator.intake({}))
        self.assertEqual(result["status"], "error")

    def test_intake_succeeds_with_description(self):
        integration = _initialized()
        result = _run(integration.hermes_orchestrator.intake(
            {"description": "Build a feature"}
        ))
        self.assertEqual(result["status"], "normalized")

    def test_contract_creation_after_intake(self):
        integration = _initialized()
        intake = _run(integration.hermes_orchestrator.intake(
            {"description": "Build a feature", "acceptance_criteria": ["Tests pass"]}
        ))
        contract = _run(integration.hermes_orchestrator.contract_creation(intake))
        self.assertEqual(contract["status"], "contract_created")
        self.assertIn("contract_id", contract)

    def test_fanout_after_contract_creation(self):
        integration = _initialized()
        intake = _run(integration.hermes_orchestrator.intake(
            {
                "description": "Deploy service",
                "acceptance_criteria": ["Service starts", "Healthcheck passes"],
            }
        ))
        contract = _run(integration.hermes_orchestrator.contract_creation(intake))
        contract_id = contract["contract_id"]
        subtasks = _run(integration.hermes_orchestrator.task_fanout(contract_id))
        self.assertIsInstance(subtasks, list)
        self.assertGreater(len(subtasks), 0)

    def test_contract_status_after_creation(self):
        integration = _initialized()
        intake = _run(integration.hermes_orchestrator.intake(
            {"description": "Refactor module", "acceptance_criteria": ["No regressions"]}
        ))
        contract = _run(integration.hermes_orchestrator.contract_creation(intake))
        contract_id = contract["contract_id"]
        status = _run(integration.hermes_orchestrator.get_contract_status(contract_id))
        self.assertEqual(status["contract_id"], contract_id)

    def test_event_bus_object_present_after_init(self):
        integration = _initialized()
        self.assertIsNotNone(integration.event_bus)

    def test_multiple_tasks_can_be_processed_sequentially(self):
        integration = _initialized()
        for i in range(3):
            intake = _run(integration.hermes_orchestrator.intake(
                {"description": f"Task {i}"}
            ))
            self.assertEqual(intake["status"], "normalized")


if __name__ == "__main__":
    unittest.main()
