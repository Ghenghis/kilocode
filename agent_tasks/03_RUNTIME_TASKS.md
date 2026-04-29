# Agent Team C (Runtime) - Task Specification

**Team**: Runtime Development  
**Allocation**: 25% of total work  
**Source Patterns**: `hermes-agent-2026.4.13/gateway/`, `hermes-agent-2026.4.13/src/runtime/`

---

## Task Overview

Implement the runtime core system including event bus (NATS), FastAPI routes, circuit breaker, and provider router.

---

## Task ID: RT-001
**Task**: Implement `EventBus` - NATS Event Bus Integration  
**Source**: `hermes-agent-2026.4.13/gateway/run.py` (event patterns), `hermes-agent-2026.4.13/src/core/event_bus.py`  
**Target**: `src/runtime/event_bus.py`  
**Priority**: P0  
**Estimated Time**: 4 hours  
**Dependencies**: None

### Methods to Implement
```python
class EventBus:
    async def connect(self, nats_url: str) -> None
    async def disconnect(self) -> None
    async def subscribe(self, topic: str, handler: Callable, queue: str = None) -> str
    async def unsubscribe(self, subscription_id: str) -> None
    async def publish(self, topic: str, message: Dict) -> None
    async def request(self, topic: str, message: Dict, timeout: float = 5.0) -> Dict
    async def get_subscriptions(self) -> List[Subscription]
    async def is_connected(self) -> bool
```

### Verification Command
```bash
python -c "from src.runtime.event_bus import EventBus; eb = EventBus(); print('EventBus: OK')"
```

---

## Task ID: RT-002
**Task**: Implement `RuntimeCoreAPI` - FastAPI Routes  
**Source**: `hermes-agent-2026.4.13/gateway/run.py` (routing patterns)  
**Target**: `src/runtime/api.py`  
**Priority**: P0  
**Estimated Time**: 6 hours  
**Dependencies**: RT-001

### Routes to Implement

#### Health Endpoints
```python
@app.get("/health")
async def health_check() -> HealthStatus

@app.get("/health/detailed")
async def detailed_health() -> DetailedHealth
```

#### Provider Endpoints
```python
@app.get("/providers")
async def list_providers() -> List[Provider]

@app.get("/providers/{provider_id}")
async def get_provider(provider_id: str) -> Provider

@app.post("/providers/{provider_id}/state")
async def set_provider_state(provider_id: str, state: ProviderState) -> None

@app.get("/providers/{provider_id}/health")
async def get_provider_health(provider_id: str) -> HealthStatus
```

#### Agent Endpoints
```python
@app.get("/agents")
async def list_agents() -> List[Agent]

@app.get("/agents/{agent_id}")
async def get_agent(agent_id: str) -> AgentDetails

@app.post("/agents/{agent_id}/pause")
async def pause_agent(agent_id: str) -> None

@app.post("/agents/{agent_id}/resume")
async def resume_agent(agent_id: str) -> None

@app.post("/agents/{agent_id}/terminate")
async def terminate_agent(agent_id: str) -> None
```

#### Workflow Endpoints
```python
@app.get("/workflows")
async def list_workflows() -> List[Workflow]

@app.get("/workflows/{workflow_id}")
async def get_workflow(workflow_id: str) -> WorkflowDetails

@app.post("/workflows/{workflow_id}/cancel")
async def cancel_workflow(workflow_id: str) -> None

@app.post("/workflows/{workflow_id}/steps/{step_id}/retry")
async def retry_workflow_step(workflow_id: str, step_id: str) -> None
```

#### Evidence Endpoints
```python
@app.get("/evidence")
async def list_evidence(filter: EvidenceFilter) -> List[Evidence]

@app.post("/evidence")
async def add_evidence(evidence: Evidence) -> None

@app.get("/evidence/export")
async def export_evidence(evidence_ids: List[str], format: str) -> bytes
```

#### Settings Endpoints
```python
@app.get("/settings")
async def get_settings() -> Settings

@app.put("/settings")
async def update_settings(settings: Settings) -> None

@app.post("/settings/reset")
async def reset_settings() -> None
```

### Verification Command
```bash
python -c "from src.runtime.api import create_app; app = create_app(); print('RuntimeCoreAPI: OK')"
```

---

## Task ID: RT-003
**Task**: Implement `CircuitBreaker` - Fault Tolerance Pattern  
**Source**: `hermes-agent-2026.4.13/src/runtime/circuit_breaker.py`  
**Target**: `src/runtime/circuit_breaker.py`  
**Priority**: P0  
**Estimated Time**: 3 hours  
**Dependencies**: None

### Methods to Implement
```python
class CircuitBreaker:
    def __init__(self, failure_threshold: int = 5, timeout: float = 60.0, recovery_timeout: float = 30.0)
    
    async def call(self, func: Callable, *args, **kwargs) -> Any
    async def get_state(self) -> CircuitState
    async def get_stats(self) -> CircuitStats
    async def reset(self) -> None

class CircuitState(Enum):
    CLOSED = "closed"
    OPEN = "open"
    HALF_OPEN = "half_open"
```

### Verification Command
```bash
python -c "from src.runtime.circuit_breaker import CircuitBreaker, CircuitState; cb = CircuitBreaker(); print('CircuitBreaker: OK')"
```

---

## Task ID: RT-004
**Task**: Implement `ProviderRouter` - Provider Routing & Load Balancing  
**Source**: `hermes-agent-2026.4.13/src/runtime/provider_router.py`, `kilocode-Azure2/packages/kilo-vscode/src/services/routing/`  
**Target**: `src/runtime/provider_router.py`  
**Priority**: P0  
**Estimated Time**: 4 hours  
**Dependencies**: RT-001, RT-003

### Methods to Implement
```python
class ProviderRouter:
    async def register_provider(self, provider: Provider) -> None
    async def unregister_provider(self, provider_id: str) -> None
    async def get_provider(self, strategy: RoutingStrategy = RoutingStrategy.LEAST_LOADED) -> Provider
    async def get_all_providers(self) -> List[Provider]
    async def update_provider_health(self, provider_id: str, health: HealthStatus) -> None
    async def get_provider_stats(self, provider_id: str) -> ProviderStats

class RoutingStrategy(Enum):
    LEAST_LOADED = "least_loaded"
    ROUND_ROBIN = "round_robin"
    RANDOM = "random"
    PRIORITY = "priority"
    FAILOVER = "failover"
```

### Verification Command
```bash
python -c "from src.runtime.provider_router import ProviderRouter, RoutingStrategy; router = ProviderRouter(); print('ProviderRouter: OK')"
```

---

## Task ID: RT-005
**Task**: Implement `SessionStore` - Session Persistence  
**Source**: `hermes-agent-2026.4.13/gateway/session.py`  
**Target**: `src/runtime/session_store.py`  
**Priority**: P1  
**Estimated Time**: 2 hours  
**Dependencies**: None

### Methods to Implement
```python
class SessionStore:
    async def create_session(self, session: Session) -> str
    async def get_session(self, session_id: str) -> Session
    async def update_session(self, session_id: str, updates: Dict) -> None
    async def delete_session(self, session_id: str) -> None
    async def list_sessions(self, filter: SessionFilter = None) -> List[Session]
    async def cleanup_expired(self) -> int
```

### Verification Command
```bash
python -c "from src.runtime.session_store import SessionStore; store = SessionStore(); print('SessionStore: OK')"
```

---

## Task ID: RT-006
**Task**: Implement `HealthMonitor` - System Health Monitoring  
**Source**: `hermes-agent-2026.4.13/_scripts/health/monitor.py`  
**Target**: `src/runtime/health_monitor.py`  
**Priority**: P1  
**Estimated Time**: 2 hours  
**Dependencies**: RT-001, RT-004

### Methods to Implement
```python
class HealthMonitor:
    async def start_monitoring(self) -> None
    async def stop_monitoring(self) -> None
    async def get_overall_health(self) -> HealthStatus
    async def get_component_health(self, component: str) -> ComponentHealth
    async def register_component(self, component: Component) -> None
    async def unregister_component(self, component_id: str) -> None
```

### Verification Command
```bash
python -c "from src.runtime.health_monitor import HealthMonitor; monitor = HealthMonitor(); print('HealthMonitor: OK')"
```

---

## Verification Checkpoints

### 10% Milestone (RT-001, RT-003)
- [ ] EventBus connects to NATS
- [ ] CircuitBreaker state transitions work
- [ ] Basic publish/subscribe functional

### 50% Milestone (RT-002, RT-004)
- [ ] All API routes registered
- [ ] ProviderRouter load balancing works
- [ ] Health checks operational

### 90% Milestone (All Tasks)
- [ ] Session persistence verified
- [ ] Health monitoring active
- [ ] End-to-end integration with WebUI tested

---

## File Structure to Create

```
src/runtime/
├── __init__.py
├── event_bus.py
├── api.py
├── circuit_breaker.py
├── provider_router.py
├── session_store.py
├── health_monitor.py
└── types.py
```

---

## Integration Points

| Target Module | Integration Type |
|---------------|------------------|
| `src/webui/` | HTTP API, WebSocket events |
| `src/hermes/orchestrator.py` | NATS events, status updates |
| `src/zeroclaw/` | Provider routing requests |
| External NATS | Event bus transport |
