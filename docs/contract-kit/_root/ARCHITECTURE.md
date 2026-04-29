# Contract-Kit v17 Architecture

## System Overview

Contract-kit v17 is a multi-agent orchestration platform for coordinating LLM-powered code generation, testing, review, and deployment across a distributed agent pool. The system enforces contractual obligations between task producers and task executors through structured packet-based communication, formal acceptance criteria, and evidence-based verification.

### Design Philosophy

Contract-kit v17 is built on three core principles:

1. **Contractual Task Execution**: Every task is defined as a `TaskPacket` with explicit acceptance criteria, scope boundaries, and evidence requirements. Executors produce `CompletionPacket` instances that demonstrate fulfillment or failure against those criteria.

2. **Lane-Based Parallelization**: Agent work is partitioned into independent lanes (WebUI, KiloCode, Runtime+Provider, Hermes+ZeroClaw) that communicate through a shared message bus. Lanes can develop and deploy independently, converging only at defined integration points.

3. **Evidence-First Auditing**: All significant actions produce evidence bundles that are stored, indexed, and retrievable for compliance, debugging, and improvement purposes. The evidence system operates independently of the execution lanes.

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         External Systems                            │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌────────────┐ │
│  │    Users     │ │   VCS       │ │  CI/CD       │ │  Monitoring│ │
│  └──────┬───────┘ └──────┬───────┘ └──────┬───────┘ └─────┬──────┘ │
└─────────┼────────────────┼────────────────┼───────────────┼────────┘
          │                │                │               │
          ▼                ▼                ▼               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         NATS JetStream                               │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  daveai.control.>  │  daveai.tasks.>  │  daveai.completions.>  │  │
│  │  daveai.repairs.>  │  daveai.incidents.>  │  daveai.evidence.> │  │
│  └──────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
          │                    │                    │
          ▼                    ▼                    ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────┐
│  Control Lane   │  │   Task Lanes    │  │    Evidence Lane        │
│  (Orchestrator) │  │                 │  │                         │
│  ┌───────────┐  │  │  ┌───────────┐  │  │  ┌───────────────────┐  │
│  │ Hermes    │  │  │  │  WebUI    │  │  │  │  Evidence Store   │  │
│  │  Agent    │  │  │  │  Lane     │  │  │  │                   │  │
│  └───────────┘  │  │  └───────────┘  │  │  │  ┌───────────────┐ │  │
│  ┌───────────┐  │  │  ┌───────────┐  │  │  │  │ Audit Trail  │ │  │
│  │ Route    │  │  │  │ KiloCode │  │  │  │  └───────────────┘ │  │
│  │ Manager   │  │  │  │  Lane     │  │  │  └───────────────────┘  │
│  └───────────┘  │  │  └───────────┘  │  └─────────────────────────┘
│  ┌───────────┐  │  │  ┌───────────┐  │
│  │ Health    │  │  │  │ Runtime   │  │
│  │ Monitor   │  │  │  │  Lane     │  │
│  └───────────┘  │  │  └───────────┘  │
└─────────────────┘  │  ┌───────────┐  │
                     │  │ ZeroClaw  │  │
                     │  │  Lane     │  │
                     │  └───────────┘  │
                     └─────────────────┘
```

---

## Component Diagram

### Core Components

#### 1. Message Bus (NATS JetStream)

The central nervous system of contract-kit. All inter-component communication flows through NATS JetStream streams.

| Stream | Subject Pattern | Purpose |
|--------|----------------|---------|
| `CONTRACTCTL` | `daveai.control.>` | Orchestration, health, coordination |
| `CONTRACTTASKS` | `daveai.tasks.>` | Task lifecycle events |
| `CONTRACTCMPL` | `daveai.completions.>` | Task completion and acceptance |
| `CONTRACTREPAIR` | `daveai.repairs.>` | Error recovery workflows |
| `CONTRACTINC` | `daveai.incidents.>` | Incident management |
| `CONTRACTEVD` | `daveai.evidence.>` | Evidence bundle storage |

#### 2. Control Plane Components

**Orchestrator**

- Role: Central coordination agent that owns task routing decisions
- Inputs: Incoming `TaskPacket` via `daveai.tasks.incoming`
- Outputs: Routed tasks to appropriate lane via `daveai.control.route`
- Responsibilities:
  - Task queue management
  - Lane selection based on `TaskPacket.owner_role` and `TaskPacket.project_id`
  - Load balancing across agents within each lane
  - Deadline tracking and timeout enforcement

**Route Manager**

- Role: Maintains routing topology and lane health
- Inputs: `daveai.control.heartbeat` from all lane agents
- Outputs: Routing decisions via `daveai.control.route`
- Responsibilities:
  - Tracking agent availability
  - Detecting lane saturation
  - Implementing fallback routing when lanes are unhealthy

**Health Monitor**

- Role: Aggregates health signals from all components
- Inputs: Provider health checks, agent heartbeats, stream lag metrics
- Outputs: Health status via `daveai.control.heartbeat`; alerts via `daveai.incidents.alert`
- Responsibilities:
  - Provider health tracking (minimax, siliconflow, lmstudio, ollama)
  - Agent health aggregation
  - Auto-remediation trigger for unhealthy providers

#### 3. Task Lane Components

**WebUI Lane**

- Role: Human-in-the-loop interactions and approvals
- Primary agent: WebUI agent
- Inputs: Tasks from orchestrator; user approval decisions
- Outputs: Approval packets via `daveai.completions.review`
- Key features:
  - Real-time task dashboard
  - Approval workflow for destructive actions
  - Evidence viewer
  - Skin/theme engine integration

**KiloCode Lane**

- Role: Agentic code generation and editing
- Primary agent: KiloCode agent
- Inputs: Tasks from orchestrator; delegated sub-tasks
- Outputs: `CompletionPacket` via `daveai.completions.close`
- Key features:
  - File operation scope enforcement
  - Terminal tool integration
  - Multi-agent delegation
  - Prompt template management

**Runtime Lane**

- Role: LLM provider abstraction and task execution
- Primary components: Provider router, execution engine, token manager
- Inputs: Tasks from orchestrator; provider responses
- Outputs: `CompletionPacket` via `daveai.completions.close`
- Key features:
  - Multi-provider routing (minimax, siliconflow, lmstudio, ollama)
  - Context window management
  - Token budgeting and cost tracking
  - Prompt caching (Anthropic)

**ZeroClaw Lane**

- Role: Deployment and infrastructure operations
- Primary agent: ZeroClaw agent
- Inputs: Deploy tasks from orchestrator
- Outputs: Deployment status via `daveai.completions.close`
- Key features:
  - Service deployment
  - Scaling operations
  - Rollback procedures
  - Health check integration

#### 4. Evidence Lane Components

**Evidence Store**

- Role: Persistent storage for evidence bundles
- Inputs: Evidence via `daveai.evidence.bundle`
- Outputs: Retrieval via `daveai.evidence.retrieve`
- Storage: File-based or S3-compatible object storage
- Responsibilities:
  - Bundle ingestion and compression
  - Metadata indexing
  - Retention policy enforcement
  - Integrity verification (signing)

**Audit Trail**

- Role: Immutable log of all significant events
- Inputs: Audit events from all components
- Outputs: Query API for compliance review
- Responsibilities:
  - Event capture and hash chaining
  - Tamper detection
  - Rotation and archival
  - Compliance reporting

---

## Data Flow

### Task Lifecycle Flow

```
1. TASK SUBMISSION
   User/VCS/CI → TaskPacket → daveai.tasks.incoming
                          │
                          ▼
2. ROUTING
   Orchestrator → evaluates TaskPacket.owner_role, project_id, priority
                → selects target lane (WebUI/KiloCode/Runtime/ZeroClaw)
                → publishes daveai.control.route
                          │
                          ▼
3. LANE EXECUTION
   Target Lane Agent → receives TaskPacket
                     → executes within scope_boundaries
                     → collects evidence per evidence_requirements
                     → publishes CompletionPacket to daveai.completions.close
                          │
                          ▼
4. ACCEPTANCE EVALUATION
   Acceptance Engine → receives CompletionPacket
                      → evaluates acceptance_criteria against acceptance_results
                      → determines pass/fail/partial
                          │
                          ▼
5. EVIDENCE ARCHIVAL
   Evidence Store → bundles trace, screenshots, logs, metrics
                  → stores with bundle_id
                  → publishes to daveai.evidence.expire for retention tracking
```

### Control Packet Flow

```
HEALTH CHECK LOOP:
  Health Monitor → daveai.control.heartbeat (every N seconds)
                ← daveai.control.heartbeat from all agents (every M seconds)
                
  If agent misses N heartbeats → mark agent unhealthy
                              → publish daveai.incidents.alert
                              → route around unhealthy agent

DELEGATION FLOW:
  Agent A → daveai.control.delegate (task_id, target_role, context)
         ← daveai.control.resolve from Agent B (result)
         
ESCALATION FLOW:
  Agent → daveai.control.escalate (task_id, reason, urgency)
        ← daveai.control.resolve from supervisor (decision)
```

### Repair Packet Flow

```
ERROR DETECTION:
  Executing Agent → detects error during task execution
                  → publishes RepairPacket to daveai.repairs.proposed
                  
REPAIR APPROVAL:
  Repair Broker → reviews repair_actions
                → validates against scope_boundaries
                → publishes to daveai.repairs.approved or daveai.repairs.cancelled
                  
REPAIR EXECUTION:
  Agent → receives approved RepairPacket
        → executes repair_actions in order
        → publishes daveai.repairs.in_progress (periodic)
        → publishes daveai.repairs.completed or daveai.repairs.failed
        
VALIDATION:
  Validation Engine → receives completed repair
                    → runs tests per validation_plan
                    → if tests pass: publish daveai.tasks.retry
                    → if tests fail: escalate to human
```

---

## Security Model

### Defense Layers

```
┌─────────────────────────────────────────────────────────────┐
│                    Layer 1: Network                         │
│  - TLS for all NATS connections                            │
│  - NATS authentication (token or nkeys)                    │
│  - Firewall rules restricting broker access                  │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                  Layer 2: Authentication                     │
│  - Bearer token auth for WebUI                             │
│  - API key auth for programmatic access                     │
│  - Role-based access control (RBAC)                        │
│  - Agent identity via signed assertions                     │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                 Layer 3: Authorization                       │
│  - Scope boundaries enforced on all file operations        │
│  - Tool permission system for dangerous operations           │
│  - Mode-based access restrictions (autonomous/supervised)   │
│  - Approval required for destructive actions               │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                  Layer 4: Audit                             │
│  - All packet send/receive events logged                   │
│  - Audit trail with hash chaining for tamper detection     │
│  - Mode transitions logged with approver identity          │
│  - Evidence bundles signed for integrity                   │
└─────────────────────────────────────────────────────────────┘
```

### Scope Boundaries

Every `TaskPacket` includes `scope_boundaries` that restrict where the executing agent can operate:

```yaml
scope_boundaries:
  allowed_dirs:
    - ~/projects/contract-kit
    - /opt/workspace
  denied_patterns:
    - "**/.env"
    - "**/secrets/**"
    - "**/node_modules/.cache/**"
  read_only_paths:
    - /usr/local/lib
    - ~/.ssh
```

The KiloCode lane **enforces** these boundaries at the file operation layer. Any attempted operation outside `allowed_dirs` or matching `denied_patterns` is rejected and logged.

### Mode Enforcement

The system operates in one of five modes, controlled by `modes.default_mode` and `modes.allowed_modes`:

| Mode | Description | Enforcement |
|------|-------------|-------------|
| `autonomous` | Full autonomous operation, no approvals needed | Permissive |
| `supervised` | Destructive actions require approval | Boundary enforced |
| `audit` | All actions logged with full detail | Fully enforced |
| `diagnostic` | Extended logging, reduced timeouts | Fully enforced |
| `frozen` | No actions permitted, read-only | Paranoid |

Mode transitions follow `mode_transition_policy`:
- Downgrade from `autonomous` to `supervised` requires approval
- Auto-downgrade on error when `auto_downgrade_on_error: true`
- All transitions logged with approver identity

### Secrets Management

Secrets are never stored in configuration files:

| Secret Type | Storage | Access |
|------------|---------|--------|
| Provider API keys | Environment variables or vault | Injected at runtime |
| Agent auth tokens | Environment variables | Passed via secure channel |
| Database credentials | Vault or secrets manager | Retrieved on demand |
| SSH keys | MCP SSH Agent (never exposed to agents) | Via constrained MCP interface |

### Provider Security

- Provider API keys are loaded from environment at startup
- Keys are never logged or included in evidence bundles
- Provider health checks do not expose key material
- Key rotation requires no downtime (hot reload)

---

## Deployment Architecture

### Single-Node Deployment

For development and small-scale deployments:

```
┌──────────────────────────────────────────────────────┐
│                    Host Machine                       │
│  ┌────────────────────────────────────────────────┐ │
│  │                   Docker Compose               │ │
│  │  ┌─────────────┐  ┌─────────────────────────┐ │ │
│  │  │    NATS     │  │    contract-kit        │ │ │
│  │  │   Server    │  │    (all lanes in one   │ │ │
│  │  │  (JetStream)│  │     container)        │ │ │
│  │  └─────────────┘  └─────────────────────────┘ │ │
│  │  ┌─────────────┐  ┌─────────────────────────┐ │ │
│  │  │  Evidence   │  │     Redis (optional)    │ │ │
│  │  │   Store     │  │     for session cache  │ │ │
│  │  └─────────────┘  └─────────────────────────┘ │ │
│  └────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────┘
```

### Multi-Node Production Deployment

```
┌──────────────────────────────────────────────────────────────────┐
│                         Load Balancer                             │
│                    (Nginx / HAProxy / ALB)                        │
└─────────────────────────────┬────────────────────────────────────┘
                              │
          ┌───────────────────┼───────────────────┐
          │                   │                   │
          ▼                   ▼                   ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│  Node 1         │ │  Node 2         │ │  Node 3         │
│  ┌───────────┐  │ │  ┌───────────┐  │ │  ┌───────────┐  │
│  │ WebUI Lane│  │ │  │ KiloCode  │  │ │  │ Runtime   │  │
│  │           │  │ │  │ Lane      │  │ │  │ Lane      │  │
│  └───────────┘  │ │  └───────────┘  │ │  └───────────┘  │
│  ┌───────────┐  │ │  ┌───────────┐  │ │  ┌───────────┐  │
│  │ Hermes    │  │ │  │ ZeroClaw  │  │ │  │ Evidence  │  │
│  │ Lane      │  │ │  │ Lane      │  │ │  │ Lane      │  │
│  └───────────┘  │ │  └───────────┘  │ │  └───────────┘  │
└─────────────────┘ └─────────────────┘ └─────────────────┘
          │                   │                   │
          └───────────────────┼───────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│                    Shared Infrastructure                           │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │   NATS Server   │  │  Evidence Store  │  │   PostgreSQL    │  │
│  │   (Cluster)     │  │  (S3-compatible) │  │   (Session DB)  │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
```

### Container Architecture

Each lane runs as an independent container with specific resource allocations:

| Lane | CPU | Memory | Storage | Dependencies |
|------|-----|--------|---------|-------------|
| WebUI | 1 core | 1 GB | 10 GB | Browser automation (Playwright) |
| KiloCode | 2 cores | 2 GB | 50 GB | Terminal tool, file tools |
| Runtime | 2 cores | 4 GB | 20 GB | All 4 LLM providers |
| Hermes | 1 core | 1 GB | 10 GB | CLI tools |
| ZeroClaw | 1 core | 1 GB | 10 GB | Docker, kubectl |
| Evidence | 1 core | 1 GB | 100+ GB | S3-compatible storage |
| Control | 1 core | 1 GB | 20 GB | NATS, Redis |

### NATS JetStream Clustering

For production, NATS runs as a cluster with JetStream enabled:

```yaml
# nats-cluster.yaml
cluster:
  name: contract-kit
  replicas: 3
  
jetstream:
  max_memory_store: 1GB
  max_file_store: 10GB
  store_dir: /data/jetstream
```

Streams are configured with replication factor 3 for durability:

```javascript
// Stream configuration
stream = {
  name: "CONTRACTTASKS",
  subjects: ["daveai.tasks.>"],
  retention: "limits",
  max_bytes: 5GB,
  max_age: 7d,
  replicas: 3,
  storage: "file"
}
```

### Database Schema (PostgreSQL)

Session and state persistence uses PostgreSQL:

```sql
-- Sessions table
CREATE TABLE sessions (
    session_id UUID PRIMARY KEY,
    project_id TEXT NOT NULL,
    owner_role TEXT NOT NULL,
    status TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    context_bytes INTEGER DEFAULT 0
);

-- Session search with FTS
CREATE INDEX sessions_fts ON sessions USING GIN (to_tsvector('english', project_id || ' ' || owner_role));

-- Task state table
CREATE TABLE task_states (
    task_id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    phase TEXT NOT NULL,
    status TEXT NOT NULL,
    assigned_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL,
    completed_at TIMESTAMPTZ
);
```

### ZeroClaw Integration

ZeroClaw handles deployment operations via its API:

```yaml
# zeroclaw integration config
integrations:
  zeroclaw:
    enabled: true
    endpoint: "https://api.zeroclaw.example.com"
    auth:
      type: "bearer"
      token_env: "ZEROCLAW_API_TOKEN"
    capabilities:
      deploy_services: true
      manage_infra: true
      monitor_resources: true
```

Deployment flow:
1. ZeroClaw lane receives `deploy` phase task
2. Executes deployment via ZeroClaw API
3. Monitors health checks
4. Reports completion via `CompletionPacket`

### Monitoring and Observability

```
┌─────────────────────────────────────────────────────────────────┐
│                     Metrics Collection                           │
│   ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│   │  Prometheus  │  │   Jaeger    │  │   ELK Stack  │          │
│   │  (metrics)   │  │  (traces)   │  │  (logs)      │          │
│   └──────┬───────┘  └──────┬───────┘  └──────┬───────┘         │
└──────────┼─────────────────┼─────────────────┼──────────────────┘
           │                 │                 │
           ▼                 ▼                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Grafana Dashboards                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐           │
│  │ Task Metrics │  │ Lane Health  │  │  Provider    │           │
│  │              │  │              │  │  Status      │           │
│  └──────────────┘  └──────────────┘  └──────────────┘           │
└─────────────────────────────────────────────────────────────────┘
```

Key metrics exported:
- `contract_kit_tasks_total` (counter): Total tasks by status
- `contract_kit_task_duration_seconds` (histogram): Task execution time
- `contract_kit_provider_requests_total` (counter): Provider API calls
- `contract_kit_provider_errors_total` (counter): Provider errors by type
- `contract_kit_token_usage_total` (counter): Token consumption by provider
- `contract_kit_lane_queue_depth` (gauge): Pending tasks per lane

---

## Component Interaction Summary

```
User/VCS/CI
    │
    │ (creates TaskPacket)
    ▼
WebUI / API Gateway
    │
    │ (publishes to daveai.tasks.incoming)
    ▼
NATS JetStream
    │
    ├─── daveai.control.> ────► Control Lane
    │                              │
    │                              ├──► Orchestrator
    │                              ├──► Route Manager
    │                              └──► Health Monitor
    │
    ├─── daveai.tasks.> ────► Task Lanes
    │                              │
    │                              ├──► WebUI Lane (human approvals)
    │                              ├──► KiloCode Lane (code gen)
    │                              ├──► Runtime Lane (LLM execution)
    │                              └──► ZeroClaw Lane (deployment)
    │
    ├─── daveai.completions.> ◄── Task Lanes
    │                              (CompletionPacket)
    │                              │
    │                              ▼
    │                         Acceptance Engine
    │                              │
    ├─── daveai.evidence.> ◄── Evidence Store
    │
    ├─── daveai.repairs.> ◄── Repair Broker
    │
    └─── daveai.incidents.> ◄── All components
                                  (alerts)
```

---

## Appendix: Configuration References

### Packet Schemas

- `configs/packet_schema.json`: All packet type definitions (ControlPacket, TaskPacket, CompletionPacket, RepairPacket)

### Runtime Settings

- `configs/runtime_settings_schema.json`: Provider configs, integration configs, automation settings, mode policies

### NATS Topology

- `configs/nats_subjects.json`: Subject namespace, stream configurations, consumer groups
