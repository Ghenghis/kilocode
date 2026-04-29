"""
Integration tests: RuntimeCoreAPI + ProviderRouter + CircuitBreaker.

Tests that the runtime core initializes, health check works, providers are
routed correctly, and circuit breakers open/close under load.
"""

import asyncio
import os
import sys
import time
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../../src"))

from backend.runtime.core import (
    CircuitBreaker,
    CircuitState,
    EventBus,
    HealthStatus,
    ProviderRouter,
    RuntimeCoreAPI,
)


def _run(coro):
    return asyncio.new_event_loop().run_until_complete(coro)


# ---------------------------------------------------------------------------
# RuntimeCoreAPI
# ---------------------------------------------------------------------------

class TestRuntimeCoreAPIInitialization(unittest.TestCase):

    def test_api_initializes_with_defaults(self):
        api = RuntimeCoreAPI()
        self.assertIsNotNone(api.app)
        self.assertIsInstance(api.settings, dict)

    def test_health_check_returns_healthy(self):
        api = RuntimeCoreAPI()
        result = _run(api.health_check())
        self.assertEqual(result["status"], HealthStatus.HEALTHY.value)

    def test_health_check_has_components(self):
        api = RuntimeCoreAPI()
        result = _run(api.health_check())
        self.assertIn("components", result)
        self.assertIn("settings", result["components"])
        self.assertIn("events", result["components"])

    def test_update_setting_persists(self):
        api = RuntimeCoreAPI()
        _run(api.update_setting("timeout", 120))
        self.assertEqual(api.settings.get("timeout"), 120)

    def test_get_settings_returns_all(self):
        api = RuntimeCoreAPI()
        _run(api.update_setting("model", "gpt-4"))
        result = _run(api.get_settings())
        self.assertIn("model", result)

    def test_get_specific_setting(self):
        api = RuntimeCoreAPI()
        _run(api.update_setting("key1", "val1"))
        result = _run(api.get_settings(key="key1"))
        self.assertEqual(result["value"], "val1")

    def test_publish_event_appended_to_list(self):
        api = RuntimeCoreAPI()
        _run(api.publish_event("test.event", {"foo": "bar"}))
        events = _run(api.get_events())
        self.assertGreater(len(events), 0)
        types = [e["type"] for e in events]
        self.assertIn("test.event", types)


# ---------------------------------------------------------------------------
# ProviderRouter
# ---------------------------------------------------------------------------

class TestProviderRouterRouting(unittest.TestCase):

    def test_router_initializes_with_providers(self):
        router = ProviderRouter(["minimax", "openai", "anthropic"])
        self.assertEqual(len(router.providers), 3)

    def test_route_returns_valid_provider(self):
        router = ProviderRouter(["minimax", "openai"])
        result = _run(router.route({"prompt": "Hello"}))
        self.assertIn(result["provider"], ["minimax", "openai"])
        self.assertTrue(result["routed"])

    def test_route_round_robins_providers(self):
        router = ProviderRouter(["p1", "p2"])
        providers_seen = set()
        for _ in range(4):
            result = _run(router.route({"x": 1}))
            providers_seen.add(result["provider"])
        self.assertEqual(providers_seen, {"p1", "p2"})

    def test_record_success_resets_failure_count(self):
        router = ProviderRouter(["minimax"])
        cb = router.circuit_breakers["minimax"]
        cb.failure_count = 3
        _run(router.record_success("minimax"))
        self.assertEqual(cb.failure_count, 0)

    def test_record_failure_increments_stats(self):
        router = ProviderRouter(["minimax"])
        _run(router.record_failure("minimax"))
        self.assertEqual(router.provider_stats["minimax"]["failures"], 1)

    def test_get_provider_health_returns_circuit_state(self):
        router = ProviderRouter(["minimax"])
        health = _run(router.get_provider_health("minimax"))
        self.assertIn("circuit_state", health)

    def test_get_circuit_state_starts_closed(self):
        router = ProviderRouter(["minimax"])
        state = router.get_circuit_state("minimax")
        self.assertEqual(state, CircuitState.CLOSED)

    def test_route_skips_open_circuit(self):
        router = ProviderRouter(["bad_provider", "good_provider"])
        # Manually open the first provider's circuit
        cb = router.circuit_breakers["bad_provider"]
        cb.state = CircuitState.OPEN
        cb.last_failure_time = time.time()
        result = _run(router.route({"x": 1}))
        self.assertEqual(result["provider"], "good_provider")

    def test_route_returns_error_when_all_circuits_open(self):
        router = ProviderRouter(["p1"])
        cb = router.circuit_breakers["p1"]
        cb.state = CircuitState.OPEN
        cb.last_failure_time = time.time()
        result = _run(router.route({"x": 1}))
        self.assertTrue(result.get("all_circuits_open"))


# ---------------------------------------------------------------------------
# CircuitBreaker
# ---------------------------------------------------------------------------

class TestCircuitBreaker(unittest.TestCase):

    def test_initial_state_is_closed(self):
        cb = CircuitBreaker(failure_threshold=3)
        self.assertEqual(cb.state, CircuitState.CLOSED)
        self.assertTrue(cb.can_execute())

    def test_opens_after_failure_threshold(self):
        cb = CircuitBreaker(failure_threshold=3)
        for _ in range(3):
            cb.record_failure()
        self.assertEqual(cb.state, CircuitState.OPEN)
        self.assertFalse(cb.can_execute())

    def test_success_resets_to_closed(self):
        cb = CircuitBreaker(failure_threshold=3)
        for _ in range(3):
            cb.record_failure()
        cb.record_success()
        self.assertEqual(cb.state, CircuitState.CLOSED)
        self.assertTrue(cb.can_execute())

    def test_half_open_after_recovery_timeout(self):
        cb = CircuitBreaker(failure_threshold=2, recovery_timeout=0.01)
        for _ in range(2):
            cb.record_failure()
        # Wait for recovery timeout to expire
        time.sleep(0.05)
        # can_execute transitions to HALF_OPEN
        result = cb.can_execute()
        self.assertTrue(result)
        self.assertEqual(cb.state, CircuitState.HALF_OPEN)

    def test_does_not_execute_while_open_within_timeout(self):
        cb = CircuitBreaker(failure_threshold=2, recovery_timeout=9999)
        for _ in range(2):
            cb.record_failure()
        self.assertFalse(cb.can_execute())


# ---------------------------------------------------------------------------
# EventBus integration
# ---------------------------------------------------------------------------

class TestEventBusIntegration(unittest.TestCase):

    def test_subscribe_and_receive_event(self):
        bus = EventBus()
        received = []

        async def handler(payload):
            received.append(payload)

        async def run():
            await bus.subscribe("test.subject", handler)
            await bus.publish("test.subject", {"msg": "hello"})

        _run(run())
        self.assertEqual(len(received), 1)
        self.assertEqual(received[0]["msg"], "hello")

    def test_unsubscribe_stops_delivery(self):
        bus = EventBus()
        received = []

        async def handler(payload):
            received.append(payload)

        async def run():
            sub_id = await bus.subscribe("sub.test", handler)
            await bus.unsubscribe(sub_id)
            await bus.publish("sub.test", {"msg": "should not arrive"})

        _run(run())
        self.assertEqual(len(received), 0)

    def test_runtime_api_events_published_on_setting_update(self):
        api = RuntimeCoreAPI()
        events_received = []

        async def run():
            await api.update_setting("foo", "bar")
            events = await api.get_events(event_type="setting.updated")
            events_received.extend(events)

        _run(run())
        self.assertGreater(len(events_received), 0)
        last = events_received[-1]
        self.assertEqual(last["payload"]["key"], "foo")
        self.assertEqual(last["payload"]["new_value"], "bar")


if __name__ == "__main__":
    unittest.main()
