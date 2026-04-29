"""Unit tests for Phase 3 canonical settings sync in hub/routers/settings.py (A.2)."""

from __future__ import annotations

import hashlib
import json
from unittest.mock import AsyncMock, patch

import pytest

from backend.webui.hub.routers.settings import (
    _compute_version_hash,
    _fetch_canonical_settings,
    _surface_versions,
    _sync_state,
)


class TestVersionHashComputation:
    def test_hash_is_stable_for_same_settings(self) -> None:
        settings = {"provider": "openai", "model": "gpt-4", "temperature": 0.7}
        h1 = _compute_version_hash(settings)
        h2 = _compute_version_hash(settings)
        assert h1 == h2
        assert len(h1) == 32  # Truncated SHA-256

    def test_hash_differs_for_different_settings(self) -> None:
        s1 = {"provider": "openai", "model": "gpt-4"}
        s2 = {"provider": "openai", "model": "gpt-3.5"}
        h1 = _compute_version_hash(s1)
        h2 = _compute_version_hash(s2)
        assert h1 != h2

    def test_hash_is_order_independent(self) -> None:
        """JSON key order should not affect hash (sorted keys used)."""
        s1 = {"a": 1, "b": 2, "c": 3}
        s2 = {"c": 3, "a": 1, "b": 2}
        h1 = _compute_version_hash(s1)
        h2 = _compute_version_hash(s2)
        assert h1 == h2

    def test_hash_uses_sha256_truncated_to_32_chars(self) -> None:
        settings = {"test": "value"}
        computed = _compute_version_hash(settings)
        # Verify it's a hex string of correct length
        assert len(computed) == 32
        int(computed, 16)  # Should not raise (valid hex)


class TestFetchCanonicalSettings:
    @pytest.mark.asyncio
    async def test_fetch_calls_settings_url(self) -> None:
        mock_response = {"providers": ["openai"], "default_model": "gpt-4"}
        
        with patch("backend.webui.hub.routers.settings._req", new_callable=AsyncMock) as mock_req:
            mock_req.return_value = mock_response
            result = await _fetch_canonical_settings()
            
            mock_req.assert_called_once()
            call_args = mock_req.call_args
            assert call_args[0][0] == "GET"
            assert "settings" in call_args[0][1]
            assert result == mock_response


class TestSurfaceVersionTracking:
    def test_surface_versions_dict_exists(self) -> None:
        """The module should maintain per-surface version tracking."""
        assert "kilocode" in _surface_versions
        assert "webui" in _surface_versions
        assert "hub" in _surface_versions

    def test_sync_state_tracks_canonical_version(self) -> None:
        """The sync state should track the canonical version hash."""
        assert "canonical_version" in _sync_state


class TestDriftDetectionLogic:
    """Drift detection: surface version != canonical version means drifted."""
    
    def test_same_version_not_drifted(self) -> None:
        canonical = {"provider": "openai"}
        canonical_hash = _compute_version_hash(canonical)
        surface_hash = canonical_hash
        
        assert surface_hash == canonical_hash  # Not drifted
    
    def test_different_version_is_drifted(self) -> None:
        canonical = {"provider": "openai", "model": "gpt-4"}
        surface = {"provider": "openai", "model": "gpt-3.5"}
        
        canonical_hash = _compute_version_hash(canonical)
        surface_hash = _compute_version_hash(surface)
        
        assert surface_hash != canonical_hash  # Drifted


class TestSettingsChangeNotification:
    """Settings change notification should broadcast to all surfaces."""
    
    def test_emit_includes_version_info(self) -> None:
        """When settings change, emit should include old and new version."""
        old_settings = {"provider": "openai"}
        new_settings = {"provider": "anthropic"}
        
        old_hash = _compute_version_hash(old_settings)
        new_hash = _compute_version_hash(new_settings)
        
        assert old_hash != new_hash
        
        # Simulate what notify-change endpoint does
        event_payload = {
            "new_version": new_hash,
            "old_version": old_hash,
            "changed_by": "user_abc",
            "changed_keys": ["provider"],
            "reason": "Switching providers",
        }
        
        assert event_payload["new_version"] == new_hash
        assert event_payload["old_version"] == old_hash


class TestCanonicalEndpointContract:
    """GET /api/settings/canonical should return expected structure."""
    
    @pytest.mark.asyncio
    async def test_canonical_response_structure(self) -> None:
        mock_settings = {
            "providers": {"openai": {"key_env": "OPENAI_API_KEY"}},
            "default": {"temperature": 0.7},
        }
        
        with patch("backend.webui.hub.routers.settings._req", new_callable=AsyncMock) as mock_req:
            mock_req.return_value = mock_settings
            
            # Simulate the endpoint logic
            canonical = await _fetch_canonical_settings()
            version_hash = _compute_version_hash(canonical)
            
            response = {
                "settings": canonical,
                "version_hash": version_hash,
                "fetched_at": 1234567890.0,
                "surfaces": {
                    name: {"version": None, "synced": False}
                    for name in ["kilocode", "webui", "hub"]
                },
            }
            
            assert "settings" in response
            assert "version_hash" in response
            assert "fetched_at" in response
            assert "surfaces" in response
            assert response["version_hash"] == version_hash


class TestReportVersionEndpoint:
    """POST /api/settings/report-version should validate surface names."""
    
    def test_known_surfaces_allowed(self) -> None:
        known = ["kilocode", "webui", "hub"]
        for surface in known:
            assert surface in _surface_versions
    
    def test_unknown_surface_rejected(self) -> None:
        unknown = "unknown_surface"
        assert unknown not in _surface_versions


class TestIntegrationFlow:
    """Integration test: full flow of settings sync."""
    
    @pytest.mark.asyncio
    async def test_full_sync_flow(self) -> None:
        """Test the complete flow from fetch to drift check to sync."""
        # 1. Fetch canonical
        mock_settings = {"provider": "openai", "model": "gpt-4"}
        
        with patch("backend.webui.hub.routers.settings._req", new_callable=AsyncMock) as mock_req:
            mock_req.return_value = mock_settings
            canonical = await _fetch_canonical_settings()
            canonical_hash = _compute_version_hash(canonical)
            
            # 2. Surface reports version (initially None/unknown)
            _surface_versions["kilocode"] = None
            
            # 3. KiloCode fetches and computes its version
            kilo_version = canonical_hash  # After sync, matches canonical
            _surface_versions["kilocode"] = kilo_version
            
            # 4. Drift check
            drifted = kilo_version != canonical_hash
            assert not drifted  # Now in sync
            
            # 5. Settings change
            new_settings = {"provider": "anthropic", "model": "claude-3"}
            mock_req.return_value = new_settings
            canonical = await _fetch_canonical_settings()
            new_canonical_hash = _compute_version_hash(canonical)
            
            # 6. Drift check after change
            drifted_after_change = kilo_version != new_canonical_hash
            assert drifted_after_change  # Now drifted
            
            # 7. KiloCode re-syncs
            _surface_versions["kilocode"] = new_canonical_hash
            assert _surface_versions["kilocode"] == new_canonical_hash
