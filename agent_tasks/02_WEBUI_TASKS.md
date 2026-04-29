# Agent Team B (WebUI) - Task Specification

**Team**: WebUI Development  
**Allocation**: 25% of total work  
**Source Patterns**: `hermes-agent-2026.4.13/web/src`

---

## Task Overview

Implement a comprehensive WebUI control system with async-first architecture, real-time event handling, and provider/agent/workflow management panels.

---

## Task ID: WEB-001
**Task**: Implement `ControlCenterApp` - Main Application Container  
**Source**: `hermes-agent-2026.4.13/web/src/app.py`  
**Target**: `src/webui/control_center_app.py`  
**Priority**: P0  
**Estimated Time**: 4 hours  
**Dependencies**: None

### Methods to Implement (17 async methods)
```python
class ControlCenterApp:
    async def initialize(self) -> None
    async def shutdown(self) -> None
    async def mount_panel(self, panel: Panel) -> None
    async def unmount_panel(self, panel_id: str) -> None
    async def handle_event(self, event: Event) -> Response
    async def broadcast_state(self, state: AppState) -> None
    async def subscribe_to_events(self, handler: EventHandler) -> None
    async def unsubscribe_from_events(self, handler_id: str) -> None
    async def update_provider_status(self, provider: Provider) -> None
    async def update_agent_status(self, agent: Agent) -> None
    async def update_workflow_status(self, workflow: Workflow) -> None
    async def show_evidence(self, evidence: Evidence) -> None
    async def initiate_repair(self, repair: RepairRequest) -> Response
    async def save_settings(self, settings: Settings) -> None
    async def load_settings(self) -> Settings
    async def get_panel_state(self, panel_id: str) -> PanelState
    async def validate_layout(self) -> ValidationResult
```

### Verification Command
```bash
python -c "from src.webui.control_center_app import ControlCenterApp; app = ControlCenterApp(); print('ControlCenterApp: OK')"
```

---

## Task ID: WEB-002
**Task**: Implement `ProviderPanel` - Provider Status & Management  
**Source**: `hermes-agent-2026.4.13/web/src/components/provider_panel.py`  
**Target**: `src/webui/panels/provider_panel.py`  
**Priority**: P0  
**Estimated Time**: 3 hours  
**Dependencies**: WEB-001

### Methods to Implement
```python
class ProviderPanel:
    async def render(self) -> str
    async def update_provider_list(self, providers: List[Provider]) -> None
    async def select_provider(self, provider_id: str) -> None
    async def get_provider_details(self, provider_id: str) -> ProviderDetails
    async def set_provider_state(self, provider_id: str, state: ProviderState) -> None
    async def refresh_provider_health(self, provider_id: str) -> HealthStatus
```

### Verification Command
```bash
python -c "from src.webui.panels.provider_panel import ProviderPanel; print('ProviderPanel: OK')"
```

---

## Task ID: WEB-003
**Task**: Implement `AgentPanel` - Agent Status & Management  
**Source**: `hermes-agent-2026.4.13/web/src/components/agent_panel.py`  
**Target**: `src/webui/panels/agent_panel.py`  
**Priority**: P0  
**Estimated Time**: 3 hours  
**Dependencies**: WEB-001

### Methods to Implement
```python
class AgentPanel:
    async def render(self) -> str
    async def update_agent_list(self, agents: List[Agent]) -> None
    async def select_agent(self, agent_id: str) -> None
    async def get_agent_details(self, agent_id: str) -> AgentDetails
    async def pause_agent(self, agent_id: str) -> None
    async def resume_agent(self, agent_id: str) -> None
    async def terminate_agent(self, agent_id: str) -> None
```

### Verification Command
```bash
python -c "from src.webui.panels.agent_panel import AgentPanel; print('AgentPanel: OK')"
```

---

## Task ID: WEB-004
**Task**: Implement `WorkflowPanel` - Workflow Visualization & Control  
**Source**: `hermes-agent-2026.4.13/web/src/components/workflow_panel.py`  
**Target**: `src/webui/panels/workflow_panel.py`  
**Priority**: P1  
**Estimated Time**: 3 hours  
**Dependencies**: WEB-001

### Methods to Implement
```python
class WorkflowPanel:
    async def render(self) -> str
    async def display_workflow(self, workflow: Workflow) -> None
    async def update_workflow_step(self, step: WorkflowStep) -> None
    async def get_workflow_history(self, workflow_id: str) -> List[WorkflowStep]
    async def cancel_workflow(self, workflow_id: str) -> None
    async def retry_workflow_step(self, step_id: str) -> None
```

### Verification Command
```bash
python -c "from src.webui.panels.workflow_panel import WorkflowPanel; print('WorkflowPanel: OK')"
```

---

## Task ID: WEB-005
**Task**: Implement `EvidencePanel` - Evidence Collection & Display  
**Source**: `hermes-agent-2026.4.13/web/src/components/evidence_panel.py`  
**Target**: `src/webui/panels/evidence_panel.py`  
**Priority**: P1  
**Estimated Time**: 2 hours  
**Dependencies**: WEB-001

### Methods to Implement
```python
class EvidencePanel:
    async def render(self) -> str
    async def add_evidence(self, evidence: Evidence) -> None
    async def get_evidence_list(self, filter: EvidenceFilter) -> List[Evidence]
    async def export_evidence(self, evidence_ids: List[str], format: str) -> bytes
    async def clear_evidence(self) -> None
```

### Verification Command
```bash
python -c "from src.webui.panels.evidence_panel import EvidencePanel; print('EvidencePanel: OK')"
```

---

## Task ID: WEB-006
**Task**: Implement `RepairPanel` - Repair Workflow Management  
**Source**: `hermes-agent-2026.4.13/web/src/components/repair_panel.py`  
**Target**: `src/webui/panels/repair_panel.py`  
**Priority**: P1  
**Estimated Time**: 2 hours  
**Dependencies**: WEB-001

### Methods to Implement
```python
class RepairPanel:
    async def render(self) -> str
    async def initiate_repair(self, request: RepairRequest) -> RepairSession
    async def get_repair_status(self, session_id: str) -> RepairStatus
    async def cancel_repair(self, session_id: str) -> None
    async def get_repair_history(self) -> List[RepairSession]
```

### Verification Command
```bash
python -c "from src.webui.panels.repair_panel import RepairPanel; print('RepairPanel: OK')"
```

---

## Task ID: WEB-007
**Task**: Implement `SettingsPanel` - Application Settings Management  
**Source**: `hermes-agent-2026.4.13/web/src/components/settings_panel.py`  
**Target**: `src/webui/panels/settings_panel.py`  
**Priority**: P2  
**Estimated Time**: 2 hours  
**Dependencies**: WEB-001

### Methods to Implement
```python
class SettingsPanel:
    async def render(self) -> str
    async def load_settings(self) -> Settings
    async def save_settings(self, settings: Settings) -> None
    async def reset_to_defaults(self) -> None
    async def export_settings(self) -> bytes
    async def import_settings(self, data: bytes) -> None
```

### Verification Command
```bash
python -c "from src.webui.panels.settings_panel import SettingsPanel; print('SettingsPanel: OK')"
```

---

## Task ID: WEB-008
**Task**: Implement `EventBusClient` - WebUI Event Bus Integration  
**Source**: `hermes-agent-2026.4.13/web/src/services/event_bus_client.py`  
**Target**: `src/webui/services/event_bus_client.py`  
**Priority**: P0  
**Estimated Time**: 2 hours  
**Dependencies**: WEB-001

### Methods to Implement
```python
class EventBusClient:
    async def connect(self, url: str) -> None
    async def disconnect(self) -> None
    async def subscribe(self, topic: str, handler: Callable) -> str
    async def unsubscribe(self, subscription_id: str) -> None
    async def publish(self, topic: str, message: Any) -> None
```

### Verification Command
```bash
python -c "from src.webui.services.event_bus_client import EventBusClient; print('EventBusClient: OK')"
```

---

## Task ID: WEB-009
**Task**: Implement `APIClient` - Runtime API Client  
**Source**: `hermes-agent-2026.4.13/web/src/services/api_client.py`  
**Target**: `src/webui/services/api_client.py`  
**Priority**: P0  
**Estimated Time**: 2 hours  
**Dependencies**: WEB-001

### Methods to Implement
```python
class APIClient:
    async def get(self, path: str, params: Dict) -> Any
    async def post(self, path: str, data: Dict) -> Any
    async def put(self, path: str, data: Dict) -> Any
    async def delete(self, path: str) -> Any
    async def set_auth_token(self, token: str) -> None
```

### Verification Command
```bash
python -c "from src.webui.services.api_client import APIClient; print('APIClient: OK')"
```

---

## Verification Checkpoints

### 10% Milestone (WEB-001, WEB-008, WEB-009)
- [ ] ControlCenterApp initializes without errors
- [ ] EventBusClient connects to NATS
- [ ] APIClient makes requests to Runtime API

### 50% Milestone (All Panels)
- [ ] All 6 panels render correctly
- [ ] Panel state management works
- [ ] Cross-panel communication established

### 90% Milestone (Full Integration)
- [ ] End-to-end user flow works
- [ ] Event broadcasting functional
- [ ] Settings persistence verified

---

## File Structure to Create

```
src/webui/
├── __init__.py
├── control_center_app.py
├── panels/
│   ├── __init__.py
│   ├── provider_panel.py
│   ├── agent_panel.py
│   ├── workflow_panel.py
│   ├── evidence_panel.py
│   ├── repair_panel.py
│   └── settings_panel.py
├── services/
│   ├── __init__.py
│   ├── event_bus_client.py
│   └── api_client.py
└── types.py
```

---

## Integration Points

| Target Module | Integration Type |
|---------------|------------------|
| `src/runtime/event_bus.py` | NATS subscription |
| `src/runtime/api.py` | HTTP API calls |
| `src/hermes/orchestrator.py` | Workflow status updates |
