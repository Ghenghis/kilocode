"""
Shared fixtures for Hub v2 backend tests.

Provides a TestClient wired to the Hub FastAPI app so every tab endpoint
can be exercised without starting a real server.
"""
import pytest
from unittest.mock import AsyncMock, patch
from fastapi.testclient import TestClient


@pytest.fixture(scope="module")
def hub_app():
    """Create a Hub v2 FastAPI app for testing."""
    from backend.webui.hub import create_app
    app = create_app(base_url="http://localhost:8095")
    return app


@pytest.fixture(scope="module")
def client(hub_app):
    """TestClient that talks directly to the Hub app (no network)."""
    return TestClient(hub_app)
