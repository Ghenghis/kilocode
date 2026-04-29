# Task Board - Contract Kit v17

**Total Methods:** 170  
**Completed:** 47  
**Remaining:** 153  
**Last Updated:** 2026-04-20

---

## P0 - CRITICAL (Must Complete First)
**Priority:** Blocked by dependencies, foundational work  
**Target:** 2026-04-21T17:00:00-07:00  
**Teams:** C, D, E

### P0 Tasks by Module

| File | Method | Team | Hours | Dependencies | Status |
|------|--------|------|-------|--------------|--------|
| **src/zeroclaw/adapters.py** | | | | | |
| | BaseAdapter.execute() | D | 2 | None | IN PROGRESS |
| | BaseAdapter.validate() | D | 2 | None | IN PROGRESS |
| | BaseAdapter.initialize() | D | 1 | None | TODO |
| | BaseAdapter.shutdown() | D | 1 | None | TODO |
| | BaseAdapter.health_check() | D | 1 | None | TODO |
| | BaseAdapter.get_status() | D | 1 | None | TODO |
| **src/proof/** (NEW MODULE) | | | | | |
| | test_runner.py: TestRunner.run() | E | 5 | Directory exists | TODO |
| | test_runner.py: TestRunner.discover() | E | 3 | None | TODO |
| | test_runner.py: TestRunner.execute() | E | 4 | None | TODO |
| | assertions.py: assert_equal() | E | 2 | None | TODO |
| | assertions.py: assert_not_equal() | E | 2 | None | TODO |
| | assertions.py: assert_true/false() | E | 2 | None | TODO |
| | assertions.py: assert_raises() | E | 2 | None | TODO |
| | assertions.py: assert_match() | E | 2 | None | TODO |
| | fixtures.py: load/save() | E | 4 | None | TODO |
| | reporter.py: generate() | E | 3 | None | TODO |
| | validator.py: validate() | E | 4 | None | TODO |
| **src/runtime/** | | | | | |
| | EventBus.connect() | C | 2 | NATS installed | IN PROGRESS |
| | EventBus.disconnect() | C | 1 | connect() | TODO |
| | EventBus.publish() | C | 2 | connect() | TODO |
| | EventBus.subscribe() | C | 2 | connect() | TODO |
| | EventBus.unsubscribe() | C | 1 | subscribe() | TODO |
| | EventBus.get_subscribers() | C | 1 | None | TODO |
| | EventBus.flush() | C | 1 | None | TODO |
| | EventBus.get_stats() | C | 1 | None | TODO |

### P0 Kanban Board

```
┌────────────────────────────────────────────────────────────────────────────────┐
│ P0 - CRITICAL (src/zeroclaw, src/proof/, src/runtime)                         │
├────────────────────────────────────────────────────────────────────────────────┤
│                                                                                │
│  ┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐              │
│  │ TODO            │   │ IN PROGRESS     │   │ DONE            │              │
│  ├─────────────────┤   ├─────────────────┤   ├─────────────────┤              │
│  │ BaseAdapter.    │   │ BaseAdapter.    │   │ BaseAdapter.    │              │
│  │ initialize()    │   │ execute() [D]   │   │ class [D]       │              │
│  │ [D]             │   │                 │   │                 │              │
│  │                 │   │ BaseAdapter.    │   │ EventBus class  │              │
│  │ BaseAdapter.    │   │ validate() [D]  │   │ skeleton [C]    │              │
│  │ shutdown() [D]  │   │                 │   │                 │              │
│  │                 │   │ EventBus.       │   │                 │              │
│  │ BaseAdapter.    │   │ connect() [C]   │   │                 │              │
│  │ health_check()  │   │                 │   │                 │              │
│  │ [D]             │   │                 │   │                 │              │
│  │                 │   │                 │   │                 │              │
│  │ src/proof/      │   │                 │   │                 │              │
│  │ __init__.py [E] │   │                 │   │                 │              │
│  │                 │   │                 │   │                 │              │
│  │ test_runner.py  │   │                 │   │                 │              │
│  │ [E]             │   │                 │   │                 │              │
│  │                 │   │                 │   │                 │              │
│  │ assertions.py   │   │                 │   │                 │              │
│  │ [E]             │   │                 │   │                 │              │
│  │                 │   │                 │   │                 │              │
│  │ fixtures.py [E] │   │                 │   │                 │              │
│  │                 │   │                 │   │                 │              │
│  │ reporter.py [E] │   │                 │   │                 │              │
│  │                 │   │                 │   │                 │              │
│  │ validator.py [E]│   │                 │   │                 │              │
│  │                 │   │                 │   │                 │              │
│  │ EventBus.       │   │                 │   │                 │              │
│  │ publish() [C]   │   │                 │   │                 │              │
│  │                 │   │                 │   │                 │              │
│  │ EventBus.       │   │                 │   │                 │              │
│  │ subscribe() [C] │   │                 │   │                 │              │
│  └─────────────────┘   └─────────────────┘   └─────────────────┘              │
└────────────────────────────────────────────────────────────────────────────────┘
```

---

## P1 - HIGH PRIORITY
**Priority:** Core functionality, user-facing features  
**Target:** 2026-04-22T17:00:00-07:00  
**Teams:** B, C, D

### P1 Tasks by Module

| File | Method | Team | Hours | Dependencies | Status |
|------|--------|------|-------|--------------|--------|
| **src/zeroclaw/adapters.py** | | | | | |
| | GitAdapter.clone() | D | 2 | execute() | TODO |
| | GitAdapter.push() | D | 2 | execute() | TODO |
| | GitAdapter.pull() | D | 2 | execute() | TODO |
| | GitAdapter.checkout() | D | 2 | execute() | TODO |
| | GitAdapter.branch() | D | 1 | execute() | TODO |
| | GitAdapter.commit() | D | 2 | execute() | TODO |
| | GitAdapter.log() | D | 1 | execute() | TODO |
| | GitAdapter.diff() | D | 1 | execute() | TODO |
| | GitAdapter.status() | D | 1 | execute() | TODO |
| | GitAdapter.add() | D | 1 | execute() | TODO |
| | GitAdapter.remove() | D | 1 | execute() | TODO |
| | ShellAdapter.run_command() | D | 3 | execute() | TODO |
| | ShellAdapter.get/set_env() | D | 2 | execute() | TODO |
| | ShellAdapter.get_cwd/change_dir() | D | 2 | execute() | TODO |
| | ShellAdapter.file ops (6) | D | 6 | execute() | TODO |
| **src/hermes/** | | | | | |
| | HermesOrch.intake() | D | 3 | BaseAdapter | TODO |
| | HermesOrch.dispatch() | D | 2 | intake() | TODO |
| | HermesOrch.route() | D | 2 | None | TODO |
| | HermesOrch.prioritize() | D | 2 | None | TODO |
| | HermesOrch.execute() | D | 3 | dispatch() | TODO |
| | HermesOrch.monitor() | D | 2 | execute() | TODO |
| | HermesOrch.complete() | D | 1 | monitor() | TODO |
| | HermesOrch.fail() | D | 1 | monitor() | TODO |
| | HermesOrch.retry/cancel() | D | 2 | None | TODO |
| | HermesOrch.status/list/get/update/delete() | D | 5 | None | TODO |
| | HermesOrch.adapter register/unregister/list/status() | D | 4 | adapters | TODO |
| | HermesOrch.event_bus connect/disconnect() | D | 2 | EventBus | TODO |
| | HermesOrch.subscribe/publish/handle_event() | D | 3 | EventBus | TODO |
| | HermesOrch.event handlers (4) | D | 2 | None | TODO |
| | HermesOrch.shutdown() | D | 1 | None | TODO |
| | MessageRouter.route() | D | 2 | None | TODO |
| | MessageRouter.forward/broadcast() | D | 2 | route() | TODO |
| | TaskQueue.enqueue/dequeue() | D | 2 | None | TODO |
| | TaskQueue.get_size/clear() | D | 1 | None | TODO |
| | StateManager.get/set/delete() | D | 3 | None | TODO |
| | StateManager.load/save() | D | 2 | None | TODO |
| **src/web/** | | | | | |
| | ControlCenterApp.start/stop/restart() | B | 3 | None | TODO |
| | ControlCenterApp.get/register_route() | B | 2 | None | IN PROGRESS |
| | ControlCenterApp.get_metrics/export() | B | 2 | None | TODO |
| | ControlCenterApp.get/update/reset_config() | B | 3 | None | TODO |
| | ControlCenterApp.get_health/version/status() | B | 3 | None | TODO |
| | ControlCenterApp.get_logs/clear_cache/reload() | B | 3 | None | TODO |
| | ControlCenterApp.shutdown() | B | 1 | None | TODO |
| | ProviderPanel.list/add/remove/get_provider() | B | 6 | hermes state | TODO |
| | ProviderPanel.update/test/enable/disable() | B | 6 | None | TODO |
| | ProviderPanel.get_status/metrics/export/import() | B | 4 | None | TODO |
| | TaskView.list/get/create/update/delete() | B | 6 | hermes state | TODO |
| | TaskView.cancel/retry/get_logs() | B | 3 | None | TODO |
| | MetricsDashboard.get_summary/charts() | B | 4 | event bus | TODO |
| | MetricsDashboard.export/set_time/refresh() | B | 4 | None | TODO |
| | MetricsDashboard.configure_alerts() | B | 2 | None | TODO |
| **src/runtime/** | | | | | |
| | RuntimeCore.start/stop/pause/resume() | C | 4 | None | TODO |
| | RuntimeCore.get_info/stats() | C | 2 | None | TODO |
| | RuntimeCore.validate_config() | C | 2 | None | TODO |
| | RuntimeCore.load/unload/list plugins() | C | 4 | None | TODO |
| | RuntimeCore.plugin_status/log_level() | C | 3 | None | TODO |
| | RuntimeCore.rotate/export/clear_logs() | C | 3 | None | TODO |
| | RuntimeCore.uptime/dependencies/health() | C | 3 | None | TODO |
| | RuntimeCore.shutdown (graceful/force) | C | 2 | None | TODO |
| | Executor.execute/execute_async() | C | 4 | EventBus | TODO |
| | Executor.cancel/get_result/kill() | C | 3 | None | TODO |
| | Executor.list_running/queued/clear_queue() | C | 3 | None | TODO |
| | Executor.set/get_timeout/priority() | C | 3 | None | TODO |
| | ResourceManager.allocate/release() | C | 3 | system metrics | TODO |
| | ResourceManager.get/set_usage/limit() | C | 3 | None | TODO |
| | ResourceManager.list/monitor/alert() | C | 3 | None | TODO |
| | ResourceManager.optimize/available/reserve() | C | 3 | None | TODO |

### P1 Kanban Board

```
┌────────────────────────────────────────────────────────────────────────────────┐
│ P1 - HIGH PRIORITY (src/hermes, src/web/, src/zeroclaw continued)            │
├────────────────────────────────────────────────────────────────────────────────┤
│                                                                                │
│  ┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐              │
│  │ TODO            │   │ IN PROGRESS     │   │ DONE            │              │
│  ├─────────────────┤   ├─────────────────┤   ├─────────────────┤              │
│  │ GitAdapter.     │   │ ControlCenterApp│   │ ControlCenterApp│              │
│  │ clone() [D]     │   │ register_route()│   │ start() [B]     │              │
│  │                 │   │ [B]             │   │                 │              │
│  │ GitAdapter.     │   │                 │   │ ControlCenterApp│              │
│  │ push/pull() [D] │   │                 │   │ stop() [B]      │              │
│  │                 │   │                 │   │                 │              │
│  │ ShellAdapter.   │   │                 │   │ ControlCenterApp│              │
│  │ run_command()[D]│   │                 │   │ get_routes() [B]│              │
│  │                 │   │                 │   │                 │              │
│  │ HermesOrch.     │   │                 │   │                 │              │
│  │ intake() [D]    │   │                 │   │                 │              │
│  │                 │   │                 │   │                 │              │
│  │ HermesOrch.     │   │                 │   │                 │              │
│  │ dispatch() [D]  │   │                 │   │                 │              │
│  │                 │   │                 │   │                 │              │
│  │ ProviderPanel.  │   │                 │   │                 │              │
│  │ list_providers()│   │                 │   │                 │              │
│  │ [B]             │   │                 │   │                 │              │
│  │                 │   │                 │   │                 │              │
│  │ TaskView.       │   │                 │   │                 │              │
│  │ list_tasks() [B]│   │                 │   │                 │              │
│  │                 │   │                 │   │                 │              │
│  │ RuntimeCore.    │   │                 │   │                 │              │
│  │ load_plugins()[C]   │                 │   │                 │              │
│  │                 │   │                 │   │                 │              │
│  │ Executor.       │   │                 │   │                 │              │
│  │ execute() [C]   │   │                 │   │                 │              │
│  └─────────────────┘   └─────────────────┘   └─────────────────┘              │
└────────────────────────────────────────────────────────────────────────────────┘
```

---

## P2 - MEDIUM PRIORITY
**Priority:** Integration, polish, optimization  
**Target:** 2026-04-24T17:00:00-07:00  
**Teams:** B, D, E

### P2 Tasks by Module

| File | Method | Team | Hours | Dependencies | Status |
|------|--------|------|-------|--------------|--------|
| **Integration** | | | | | |
| | Wire hermes to zeroclaw adapters | E | 8 | BaseAdapter, Orch | TODO |
| | Wire web to hermes state | E | 6 | Orch, ProviderPanel | TODO |
| | E2E test: adapter → orch → web | E | 8 | All modules | TODO |
| | Performance validation suite | E | 6 | All modules | TODO |
| **src/hermes/** | | | | | |
| | MessageRouter.get_route_stats() | D | 1 | route() | TODO |
| | MessageRouter.clear_cache() | D | 1 | None | TODO |
| | TaskQueue.pause/resume() | D | 2 | None | TODO |
| | TaskQueue.get_stats() | D | 1 | None | TODO |
| | StateManager.get_stats() | D | 1 | None | TODO |
| | StateManager.clear() | D | 1 | None | TODO |
| **src/web/** | | | | | |
| | ProviderPanel.import_config() | B | 2 | list_providers() | TODO |
| | MetricsDashboard.export_data() | B | 2 | get_summary() | TODO |
| | WebSocket real-time updates | B | 6 | EventBus | TODO |
| | Settings panel persistence | B | 4 | None | TODO |
| **src/runtime/** | | | | | |
| | ResourceManager.get_available() | C | 2 | None | TODO |
| | ResourceManager.reserve() | C | 2 | allocate() | TODO |
| | Executor.set_priority() | C | 1 | None | TODO |

### P2 Kanban Board

```
┌────────────────────────────────────────────────────────────────────────────────┐
│ P2 - MEDIUM PRIORITY (Integration, polish)                                   │
├────────────────────────────────────────────────────────────────────────────────┤
│                                                                                │
│  ┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐              │
│  │ TODO            │   │ IN PROGRESS     │   │ DONE            │              │
│  ├─────────────────┤   ├─────────────────┤   ├─────────────────┤              │
│  │ Wire hermes→    │   │                 │   │                 │              │
│  │ zeroclaw [E]    │   │                 │   │                 │              │
│  │                 │   │                 │   │                 │              │
│  │ Wire web→       │   │                 │   │                 │              │
│  │ hermes [E]      │   │                 │   │                 │              │
│  │                 │   │                 │   │                 │              │
│  │ E2E test        │   │                 │   │                 │              │
│  │ suite [E]       │   │                 │   │                 │              │
│  │                 │   │                 │   │                 │              │
│  │ Performance     │   │                 │   │                 │              │
│  │ validation [E]  │   │                 │   │                 │              │
│  │                 │   │                 │   │                 │              │
│  │ MessageRouter   │   │                 │   │                 │              │
│  │ stats/clear [D] │   │                 │   │                 │              │
│  │                 │   │                 │   │                 │              │
│  │ TaskQueue       │   │                 │   │                 │              │
│  │ pause/resume [D]│   │                 │   │                 │              │
│  │                 │   │                 │   │                 │              │
│  │ WebSocket       │   │                 │   │                 │              │
│  │ updates [B]     │   │                 │   │                 │              │
│  │                 │   │                 │   │                 │              │
│  │ Settings        │   │                 │   │                 │              │
│  │ persistence [B] │   │                 │   │                 │              │
│  └─────────────────┘   └─────────────────┘   └─────────────────┘              │
└────────────────────────────────────────────────────────────────────────────────┘
```

---

## Summary Statistics

### By Team

| Team | Allocation | P0 Hours | P1 Hours | P2 Hours | Total |
|------|------------|----------|----------|----------|-------|
| A (Auditors) | 25% | 0 | 0 | 0 | Audit Only |
| B (WebUI) | 20% | 0 | 52 | 14 | 66 |
| C (Runtime) | 20% | 12 | 42 | 5 | 59 |
| D (Hermes) | 20% | 10 | 52 | 5 | 67 |
| E (Integration) | 15% | 26 | 0 | 28 | 54 |
| **Total** | 100% | **48** | **146** | **52** | **246** |

### By Module

| Module | P0 | P1 | P2 | Total |
|--------|----|----|----|-------|
| src/zeroclaw/ | 6 | 22 | 0 | 28 |
| src/proof/ | 20 | 0 | 0 | 20 |
| src/runtime/ | 8 | 42 | 5 | 55 |
| src/hermes/ | 0 | 42 | 5 | 47 |
| src/web/ | 0 | 40 | 14 | 54 |
| Integration | 0 | 0 | 28 | 28 |
| **Total** | **34** | **146** | **52** | **232** |

*Note: Above counts are task groupings, not individual methods. Total methods: 170*

---

## Team Assignment Reference

| Team | Primary Focus | Secondary Focus |
|------|--------------|-----------------|
| **A (Auditors)** | Code review, audit reports, requirements specs | Cross-module validation |
| **B (WebUI)** | ControlCenterApp, ProviderPanel, TaskView, MetricsDashboard | WebSocket, settings |
| **C (Runtime)** | EventBus, RuntimeCore, Executor, ResourceManager | System metrics, NATS |
| **D (Hermes)** | BaseAdapter, GitAdapter, ShellAdapter, HermesOrch | MessageRouter, TaskQueue |
| **E (Integration)** | proof/ module, component wiring, E2E tests | Performance validation |
