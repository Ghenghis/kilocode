"""
WebUI Tests - Control Center panel behavior.

Tests the control center web interface including panel loading,
interactions, and navigation by calling the Python classes directly
and mocking HTTP calls. No browser or playwright required.
"""

import asyncio
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from src.webui.control_center import (
    ControlCenterApp,
    ProviderPanel,
    AgentPanel,
)


def run(coro):
    """Run a coroutine synchronously."""
    return asyncio.new_event_loop().run_until_complete(coro)


# =============================================================================
# ControlCenterApp - health check / routing
# =============================================================================

class TestControlCenterLoads:
    """Test that the control center main application initialises correctly."""

    def test_control_center_loads_with_default_config(self):
        """
        Test that the control center main page loads successfully.

        Verifies the ControlCenterApp initialises without errors and
        exposes a health-check method that returns a healthy status.
        """
        app = ControlCenterApp()
        result = run(app.health_check())

        assert result["status"] == "healthy"
        assert "timestamp" in result
        assert "panels" in result

    def test_control_center_loads_with_custom_config(self):
        """ControlCenterApp accepts a custom config dict without errors."""
        config = {"debug": True, "title": "Contract Kit"}
        app = ControlCenterApp(config=config)
        assert app.config == config

    def test_control_center_get_routes_returns_list(self):
        """get_routes returns a non-empty list of route tuples."""
        app = ControlCenterApp()
        routes = run(app.get_routes())
        assert isinstance(routes, list)
        assert len(routes) > 0

    def test_control_center_health_check_contains_control_center_route(self):
        """Health-check route is present in routes list."""
        app = ControlCenterApp()
        routes = run(app.get_routes())
        paths = [r[0] for r in routes]
        assert any("health" in p for p in paths)


# =============================================================================
# ProviderPanel
# =============================================================================

class TestProviderPanel:
    """Test that the provider panel loads and displays provider information."""

    def test_provider_panel_loads(self):
        """
        Test that the provider panel loads and returns provider information.

        Verifies that the provider panel is accessible and returns a dict
        with the expected structure even when no provider_router is attached.
        """
        panel = ProviderPanel()
        result = run(panel.get_status())

        assert "providers" in result
        assert "healthy_count" in result
        assert isinstance(result["providers"], list)

    def test_provider_panel_healthy_count_is_int(self):
        """healthy_count must be an integer."""
        panel = ProviderPanel()
        result = run(panel.get_status())
        assert isinstance(result["healthy_count"], int)

    def test_provider_panel_with_mock_router(self):
        """Provider panel delegates to provider_router when provided."""
        mock_router = MagicMock()
        mock_router.get_all_providers = AsyncMock(return_value=[
            {"id": "p1", "status": "healthy"},
            {"id": "p2", "status": "degraded"},
        ])

        panel = ProviderPanel(provider_router=mock_router)
        result = run(panel.get_status())

        assert result["healthy_count"] == 1
        assert result["total_count"] == 2

    def test_provider_panel_metrics_returns_dict(self):
        """get_metrics returns a dict with latency_ms and error_rate."""
        panel = ProviderPanel()
        result = run(panel.get_metrics())

        assert "latency_ms" in result
        assert "error_rate" in result

    def test_provider_panel_status_update_on_refresh(self):
        """
        Provider status updates when refreshed with new data.

        Simulates re-calling get_status and verifies the new healthy count
        reflects a changed provider list.
        """
        mock_router = MagicMock()
        mock_router.get_all_providers = AsyncMock(return_value=[
            {"id": "p1", "status": "healthy"},
        ])

        panel = ProviderPanel(provider_router=mock_router)
        first = run(panel.get_status())
        assert first["healthy_count"] == 1

        # Simulate provider going unhealthy on next call
        mock_router.get_all_providers = AsyncMock(return_value=[
            {"id": "p1", "status": "degraded"},
        ])
        second = run(panel.get_status())
        assert second["healthy_count"] == 0


# =============================================================================
# EvidencePanel (via ControlCenterApp delegation)
# =============================================================================

class TestEvidencePanel:
    """Test that the evidence panel loads and displays evidence items."""

    def test_evidence_panel_returns_empty_when_no_panel(self):
        """
        Test that the evidence panel is accessible and returns a list.

        When no panel is registered, list_evidence returns a zero-count
        result rather than raising.
        """
        app = ControlCenterApp()
        result = run(app.list_evidence())

        assert "evidence" in result
        assert isinstance(result["evidence"], list)
        assert result["count"] >= 0

    def test_evidence_panel_with_mock_panel(self):
        """Evidence panel delegates to registered panel correctly."""
        mock_panel = MagicMock()
        mock_panel.list_evidence = AsyncMock(return_value=[
            {"id": "e1", "type": "test_pass"},
            {"id": "e2", "type": "lint_pass"},
        ])

        app = ControlCenterApp()
        run(app.mount_panel("evidence", mock_panel))
        result = run(app.list_evidence())

        assert result["count"] == 2
        assert len(result["evidence"]) == 2

    def test_evidence_panel_supports_filtering_via_panel(self):
        """Evidence filtering is passed through to the underlying panel."""
        mock_panel = MagicMock()
        mock_panel.list_evidence = AsyncMock(return_value=[
            {"id": "e1", "type": "test_pass"},
        ])

        app = ControlCenterApp()
        run(app.mount_panel("evidence", mock_panel))
        result = run(app.list_evidence(filters={"type": "test_pass"}))

        mock_panel.list_evidence.assert_called_once_with({"type": "test_pass"})
        assert result["count"] == 1


# =============================================================================
# AgentPanel
# =============================================================================

class TestAgentPanel:
    """Test that the agent panel returns correct data."""

    def test_agent_panel_returns_empty_list_initially(self):
        """AgentPanel returns an empty active-agents list when no agents exist."""
        panel = AgentPanel()
        agents = run(panel.get_active_agents())
        assert isinstance(agents, list)
        assert agents == []

    def test_agent_panel_shows_running_agents(self):
        """AgentPanel filters and returns only running/active/busy agents."""
        panel = AgentPanel()
        panel.agents["agent-1"] = {"status": "running", "name": "Worker"}
        panel.agents["agent-2"] = {"status": "idle", "name": "Idler"}

        agents = run(panel.get_active_agents())
        assert len(agents) == 1
        assert agents[0]["agent_id"] == "agent-1"

    def test_agent_panel_get_state_returns_error_for_unknown(self):
        """get_agent_state returns an error dict for an unknown agent_id."""
        panel = AgentPanel()
        state = run(panel.get_agent_state("nonexistent-id"))
        assert "error" in state


# =============================================================================
# ControlCenterApp – panel mounting
# =============================================================================

class TestControlCenterMountPanel:
    """Test panel mounting on the ControlCenterApp."""

    def test_mount_panel_registers_correctly(self):
        """Mounted panel is accessible via health check and delegation."""
        app = ControlCenterApp()
        mock_panel = MagicMock()

        run(app.mount_panel("test_panel", mock_panel))

        result = run(app.health_check())
        assert "test_panel" in result["panels"]

    def test_mount_multiple_panels(self):
        """Multiple panels can be mounted and all appear in health check."""
        app = ControlCenterApp()
        run(app.mount_panel("providers", MagicMock()))
        run(app.mount_panel("agents", MagicMock()))
        run(app.mount_panel("evidence", MagicMock()))

        result = run(app.health_check())
        for name in ("providers", "agents", "evidence"):
            assert name in result["panels"]
