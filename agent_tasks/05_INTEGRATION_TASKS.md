# Agent Team E (Integration) - Task Specification

**Team**: Integration & Verification  
**Allocation**: 15% of total work  
**Dependencies**: Teams B, C, D

---

## Task Overview

Wire all modules together, create the proof module, and implement integration tests.

---

## Task ID: INT-001
**Task**: Wire `src/webui` to `src/runtime`  
**Source**: All WebUI tasks (WEB-*), All Runtime tasks (RT-*)  
**Target**: `src/webui/services/api_client.py` connecting to `src/runtime/api.py`  
**Priority**: P0  
**Estimated Time**: 3 hours  
**Dependencies**: WEB-001, WEB-008, WEB-009, RT-002

### Wiring Checklist
- [ ] APIClient points to Runtime API base URL
- [ ] EventBusClient subscribes to Runtime NATS events
- [ ] WebSocket connection for real-time updates
- [ ] Auth token propagation
- [ ] Error handling for API failures

### Verification Command
```bash
python -c "
import asyncio
from src.webui.control_center_app import ControlCenterApp
from src.runtime.api import create_app

async def test_wiring():
    app = ControlCenterApp()
    await app.initialize()
    print('WebUI → Runtime wiring: OK')

asyncio.run(test_wiring())
"
```

---

## Task ID: INT-002
**Task**: Wire `src/runtime` to `src/hermes`  
**Source**: All Runtime tasks (RT-*), All Hermes tasks (HER-*)  
**Target**: `src/runtime/event_bus.py` routing to `src/hermes/orchestrator.py`  
**Priority**: P0  
**Estimated Time**: 3 hours  
**Dependencies**: RT-001, HER-001

### Wiring Checklist
- [ ] Runtime publishes provider/agent events to Hermes
- [ ] Hermes publishes workflow status to Runtime
- [ ] Health monitoring data flows both directions
- [ ] Circuit breaker integrates with Hermes recovery

### Verification Command
```bash
python -c "
import asyncio
from src.runtime.event_bus import EventBus
from src.hermes.orchestrator import HermesOrchestrator

async def test_wiring():
    eb = EventBus()
    await eb.connect('nats://localhost:4222')
    orch = HermesOrchestrator()
    print('Runtime → Hermes wiring: OK')
    await eb.disconnect()

asyncio.run(test_wiring())
"
```

---

## Task ID: INT-003
**Task**: Wire `src/hermes` to `src/zeroclaw`  
**Source**: HER-001 through HER-005, zeroclaw adapters  
**Target**: `src/hermes/orchestrator.py` using `src/zeroclaw/adapters/*`  
**Priority**: P0  
**Estimated Time**: 2 hours  
**Dependencies**: HER-001, HER-002, HER-003, HER-004, HER-005

### Wiring Checklist
- [ ] HermesOrchestrator imports all adapters
- [ ] Fan-out phase uses appropriate adapter per task type
- [ ] Adapter results aggregated correctly
- [ ] Error propagation from adapters to Hermes

### Verification Command
```bash
python -c "
from src.hermes.orchestrator import HermesOrchestrator
from src.zeroclaw.adapters.git_adapter import GitAdapter
from src.zeroclaw.adapters.shell_adapter import ShellAdapter
from src.zeroclaw.adapters.filesystem_adapter import FilesystemAdapter
from src.zeroclaw.adapters.research_adapter import ResearchAdapter
print('Hermes → ZeroClaw wiring: OK')
"
```

---

## Task ID: INT-004
**Task**: Create `src/proof/` Module  
**Source**: Contract patterns from hermes-agent-2026.4.13  
**Target**: `src/proof/`  
**Priority**: P0  
**Estimated Time**: 4 hours  
**Dependencies**: HER-006

### Files to Create

#### `src/proof/__init__.py`
```python
from .proof_engine import ProofEngine
from .evidence_store import EvidenceStore
from .verification import Verifier

__all__ = ['ProofEngine', 'EvidenceStore', 'Verifier']
```

#### `src/proof/proof_engine.py`
```python
class ProofEngine:
    async def create_proof(self, contract: Contract, results: List[Result]) -> Proof
    async def verify_proof(self, proof: Proof) -> VerificationResult
    async def get_proof_status(self, proof_id: str) -> ProofStatus
    async def chain_proofs(self, proof_ids: List[str]) -> ChainedProof
```

#### `src/proof/evidence_store.py`
```python
class EvidenceStore:
    async def store(self, evidence: Evidence) -> str
    async def retrieve(self, evidence_id: str) -> Evidence
    async def list_evidence(self, filter: EvidenceFilter) -> List[Evidence]
    async def delete(self, evidence_id: str) -> None
    async def get_evidence_chain(self, proof_id: str) -> List[Evidence]
```

#### `src/proof/verifier.py`
```python
class Verifier:
    async def verify_integrity(self, evidence: Evidence) -> bool
    async def verify_source(self, evidence: Evidence) -> bool
    async def verify_timing(self, evidence: Evidence) -> bool
    async def verify_chain(self, chain: List[Evidence]) -> bool
    async def generate_report(self, verification: VerificationResult) -> Report
```

### Verification Command
```bash
python -c "from src.proof import ProofEngine, EvidenceStore, Verifier; print('Proof module: OK')"
```

---

## Task ID: INT-005
**Task**: Create Integration Test Suite  
**Source**: `hermes-agent-2026.4.13/tests/` patterns  
**Target**: `tests/integration/`  
**Priority**: P0  
**Estimated Time**: 4 hours  
**Dependencies**: INT-001, INT-002, INT-003, INT-004

### Test Files to Create

#### `tests/integration/__init__.py`
```python
# Integration tests package
```

#### `tests/integration/test_webui_runtime.py`
```python
class TestWebUIRuntimeIntegration:
    async def test_api_client_connects_to_runtime(self) -> None
    async def test_event_bus_subscription(self) -> None
    async def test_panel_updates_via_api(self) -> None
```

#### `tests/integration/test_runtime_hermes.py`
```python
class TestRuntimeHermesIntegration:
    async def test_event_published_to_hermes(self) -> None
    async def test_hermes_status_updates_runtime(self) -> None
    async def test_circuit_breaker_integration(self) -> None
```

#### `tests/integration/test_hermes_zeroclaw.py`
```python
class TestHermesZeroClawIntegration:
    async def test_fanout_uses_adapters(self) -> None
    async def test_adapter_results_aggregated(self) -> None
    async def test_error_propagation(self) -> None
```

#### `tests/integration/test_full_flow.py`
```python
class TestFullFlow:
    async def test_end_to_end_contract_flow(self) -> None
    async def test_proof_generation(self) -> None
    async def test_recovery_on_failure(self) -> None
```

### Verification Command
```bash
python -m pytest tests/integration/ -v --tb=short
```

---

## Task ID: INT-006
**Task**: Create `src/__init__.py` and `src/types.py`  
**Source**: Common types across all modules  
**Target**: `src/__init__.py`, `src/types.py`  
**Priority**: P1  
**Estimated Time**: 1 hour  
**Dependencies**: None

### Common Types
```python
# Re-export all public types
from src.webui.types import *
from src.runtime.types import *
from src.hermes.types import *
from src.zeroclaw.types import *
from src.proof.types import *
```

### Verification Command
```bash
python -c "from src import *; print('src/__init__.py: OK')"
```

---

## Verification Checkpoints

### 10% Milestone (INT-001, INT-002)
- [ ] WebUI can communicate with Runtime
- [ ] Runtime can communicate with Hermes
- [ ] Basic event flow established

### 50% Milestone (INT-003, INT-004)
- [ ] Hermes can use ZeroClaw adapters
- [ ] Proof module functional
- [ ] Evidence chain verifiable

### 90% Milestone (INT-005, INT-006)
- [ ] All integration tests pass
- [ ] End-to-end flow verified
- [ ] Common types exported

---

## File Structure to Create

```
src/
├── __init__.py
├── types.py
├── webui/
│   └── (from Team B)
├── runtime/
│   └── (from Team C)
├── hermes/
│   └── (from Team D)
├── zeroclaw/
│   └── (from Team D)
└── proof/
    ├── __init__.py
    ├── proof_engine.py
    ├── evidence_store.py
    ├── verifier.py
    └── types.py

tests/
└── integration/
    ├── __init__.py
    ├── test_webui_runtime.py
    ├── test_runtime_hermes.py
    ├── test_hermes_zeroclaw.py
    └── test_full_flow.py
```

---

## End-to-End Flow Verification

```bash
python -c "
import asyncio
from src.webui.control_center_app import ControlCenterApp
from src.hermes.orchestrator import HermesOrchestrator
from src.proof import ProofEngine

async def full_flow_test():
    # Initialize all components
    app = ControlCenterApp()
    await app.initialize()
    
    orch = HermesOrchestrator()
    
    proof = ProofEngine()
    
    print('End-to-end components initialized: OK')

asyncio.run(full_flow_test())
"
```
