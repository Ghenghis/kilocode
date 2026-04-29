# Agent Team D (Hermes) - Task Specification

**Team**: Hermes Orchestrator Development  
**Allocation**: 20% of total work  
**Source Patterns**: `hermes-agent-2026.4.13/src/`, `hermes-agent-2026.4.13/src/patterns/zeroclaw/`

---

## Task Overview

Implement HermesOrchestrator for intake, contract management, fan-out, and validation. Implement ZeroClaw adapters for Git, Shell, Filesystem, and Research operations.

---

## Task ID: HER-001
**Task**: Implement `HermesOrchestrator` - Main Orchestration Engine  
**Source**: `hermes-agent-2026.4.13/src/core/orchestrator.py`, `hermes-agent-2026.4.13/src/core/agent_loop.py`  
**Target**: `src/hermes/orchestrator.py`  
**Priority**: P0  
**Estimated Time**: 6 hours  
**Dependencies**: RT-001 (Runtime EventBus)

### Methods to Implement

#### Intake Phase
```python
async def intake(self, request: Request) -> IntakeResult
async def validate_intake(self, request: Request) -> ValidationResult
async def classify_request(self, request: Request) -> RequestClass
async def assign_priority(self, request: Request) -> Priority
```

#### Contract Phase
```python
async def create_contract(self, intake: IntakeResult) -> Contract
async def negotiate_contract(self, contract: Contract) -> Contract
async def finalize_contract(self, contract: Contract) -> FinalizedContract
async def validate_contract(self, contract: FinalizedContract) -> ValidationResult
```

#### Fan-out Phase
```python
async def fanout(self, contract: FinalizedContract) -> List[FanoutResult]
async def distribute_tasks(self, contract: FinalizedContract) -> List[Task]
async def monitor_execution(self, tasks: List[Task]) -> ExecutionStatus
async def aggregate_results(self, results: List[FanoutResult]) -> AggregatedResult
```

#### Validation Phase
```python
async def validate_results(self, aggregated: AggregatedResult) -> ValidationResult
async def check_completion(self, aggregated: AggregatedResult) -> CompletionStatus
async def handle_incomplete(self, aggregated: AggregatedResult) -> RecoveryAction
async def finalize(self, aggregated: AggregatedResult) -> FinalResult
```

### Verification Command
```bash
python -c "from src.hermes.orchestrator import HermesOrchestrator; orch = HermesOrchestrator(); print('HermesOrchestrator: OK')"
```

---

## Task ID: HER-002
**Task**: Implement `GitAdapter` - ZeroClaw Git Adapter  
**Source**: `hermes-agent-2026.4.13/src/patterns/zeroclaw/adapters/git_adapter.py` (if exists)  
**Target**: `src/zeroclaw/adapters/git_adapter.py`  
**Priority**: P0  
**Estimated Time**: 3 hours  
**Dependencies**: HER-001

### Methods to Implement
```python
class GitAdapter:
    async def clone(self, repo_url: str, target_path: Path) -> CloneResult
    async def checkout(self, repo_path: Path, branch: str) -> CheckoutResult
    async def pull(self, repo_path: Path) -> PullResult
    async def commit(self, repo_path: Path, message: str, files: List[str]) -> CommitResult
    async def push(self, repo_path: Path) -> PushResult
    async def get_status(self, repo_path: Path) -> GitStatus
    async def get_log(self, repo_path: Path, limit: int = 100) -> List[GitLogEntry]
    async def create_branch(self, repo_path: Path, branch_name: str) -> BranchResult
    async def merge(self, repo_path: Path, source: str, target: str) -> MergeResult
```

### Verification Command
```bash
python -c "from src.zeroclaw.adapters.git_adapter import GitAdapter; adapter = GitAdapter(); print('GitAdapter: OK')"
```

---

## Task ID: HER-003
**Task**: Implement `ShellAdapter` - ZeroClaw Shell Adapter  
**Source**: `hermes-agent-2026.4.13/tools/terminal_tool.py` (shell patterns)  
**Target**: `src/zeroclaw/adapters/shell_adapter.py`  
**Priority**: P0  
**Estimated Time**: 3 hours  
**Dependencies**: HER-001

### Methods to Implement
```python
class ShellAdapter:
    async def execute(self, command: str, cwd: Path = None, env: Dict = None) -> ShellResult
    async def execute_streaming(self, command: str, handler: OutputHandler) -> ShellResult
    async def get_pty(self, command: str) -> PtySession
    async def background_exec(self, command: str) -> BackgroundProcess
    async def wait_for_process(self, process_id: str, timeout: float = None) -> ProcessResult
    async def kill_process(self, process_id: str) -> None
    async def get_process_status(self, process_id: str) -> ProcessStatus
```

### Verification Command
```bash
python -c "from src.zeroclaw.adapters.shell_adapter import ShellAdapter; adapter = ShellAdapter(); print('ShellAdapter: OK')"
```

---

## Task ID: HER-004
**Task**: Implement `FilesystemAdapter` - ZeroClaw Filesystem Adapter  
**Source**: `hermes-agent-2026.4.13/tools/file_tools.py` (filesystem patterns)  
**Target**: `src/zeroclaw/adapters/filesystem_adapter.py`  
**Priority**: P0  
**Estimated Time**: 2 hours  
**Dependencies**: HER-001

### Methods to Implement
```python
class FilesystemAdapter:
    async def read_file(self, path: Path) -> bytes
    async def write_file(self, path: Path, content: bytes) -> None
    async def read_text(self, path: Path, encoding: str = "utf-8") -> str
    async def write_text(self, path: Path, content: str, encoding: str = "utf-8") -> None
    async def exists(self, path: Path) -> bool
    async def is_file(self, path: Path) -> bool
    async def is_dir(self, path: Path) -> bool
    async def list_dir(self, path: Path) -> List[DirEntry]
    async def create_dir(self, path: Path, parents: bool = True) -> None
    async def remove_file(self, path: Path) -> None
    async def remove_dir(self, path: Path, recursive: bool = False) -> None
    async def copy(self, src: Path, dst: Path) -> None
    async def move(self, src: Path, dst: Path) -> None
    async def get_stats(self, path: Path) -> FileStats
```

### Verification Command
```bash
python -c "from src.zeroclaw.adapters.filesystem_adapter import FilesystemAdapter; adapter = FilesystemAdapter(); print('FilesystemAdapter: OK')"
```

---

## Task ID: HER-005
**Task**: Implement `ResearchAdapter` - ZeroClaw Research Adapter  
**Source**: `hermes-agent-2026.4.13/tools/web_tools.py` (search patterns)  
**Target**: `src/zeroclaw/adapters/research_adapter.py`  
**Priority**: P1  
**Estimated Time**: 3 hours  
**Dependencies**: HER-001

### Methods to Implement
```python
class ResearchAdapter:
    async def search(self, query: str, sources: List[str] = None) -> SearchResult
    async def fetch_page(self, url: str) -> PageContent
    async def extract_content(self, content: PageContent, selector: str) -> ExtractedContent
    async def summarize(self, content: str, max_length: int = 500) -> Summary
    async def find_related(self, topic: str, limit: int = 10) -> List[RelatedTopic]
    async def compare_sources(self, urls: List[str]) -> ComparisonResult
```

### Verification Command
```bash
python -c "from src.zeroclaw.adapters.research_adapter import ResearchAdapter; adapter = ResearchAdapter(); print('ResearchAdapter: OK')"
```

---

## Task ID: HER-006
**Task**: Implement `ValidationEngine` - Contract & Result Validation  
**Source**: `hermes-agent-2026.4.13/src/core/validation.py`  
**Target**: `src/hermes/validation.py`  
**Priority**: P0  
**Estimated Time**: 2 hours  
**Dependencies**: HER-001

### Methods to Implement
```python
class ValidationEngine:
    async def validate_request(self, request: Request) -> ValidationResult
    async def validate_contract(self, contract: Contract) -> ValidationResult
    async def validate_result(self, result: Any, contract: Contract) -> ValidationResult
    async def validate_evidence(self, evidence: Evidence) -> ValidationResult
    async def get_validation_report(self, result_id: str) -> ValidationReport
```

### Verification Command
```bash
python -c "from src.hermes.validation import ValidationEngine; engine = ValidationEngine(); print('ValidationEngine: OK')"
```

---

## Verification Checkpoints

### 10% Milestone (HER-001 Core)
- [ ] Intake phase functional
- [ ] Contract creation works
- [ ] Basic fan-out to adapters

### 50% Milestone (All Adapters)
- [ ] All 4 ZeroClaw adapters implemented
- [ ] Validation engine functional
- [ ] Integration with Runtime EventBus

### 90% Milestone (Full Orchestration)
- [ ] End-to-end contract flow works
- [ ] Error handling and recovery tested
- [ ] Result aggregation verified

---

## File Structure to Create

```
src/hermes/
├── __init__.py
├── orchestrator.py
├── validation.py
├── types.py
└── contracts.py

src/zeroclaw/
├── __init__.py
├── adapters/
│   ├── __init__.py
│   ├── git_adapter.py
│   ├── shell_adapter.py
│   ├── filesystem_adapter.py
│   └── research_adapter.py
└── types.py
```

---

## Integration Points

| Target Module | Integration Type |
|---------------|------------------|
| `src/runtime/event_bus.py` | NATS event publishing |
| `src/runtime/api.py` | Status reporting |
| `src/webui/` | Workflow status updates |
| `src/proof/` | Evidence validation |
