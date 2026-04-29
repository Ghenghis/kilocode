# Audit Source Locations

Complete source locations for auditing across all referenced codebases.

---

## hermes-agent-2026.4.13

### Core Agent Implementation
| File | Lines | Description | Audit Focus |
|------|-------|-------------|-------------|
| `src/core/base_agent.py` | 70-150 | Base agent class | Method implementations, inheritance |
| `src/core/orchestrator.py` | 100-200 | Orchestrator core | Fan-out patterns, delegation |
| `src/core/event_bus.py` | 50-120 | Event bus base | Event subscription patterns |
| `src/core/agent_loop.py` | 1-100 | Main agent loop | Loop control, iteration |
| `src/core/message_handler.py` | 80-160 | Message handling | Handler registration, dispatch |

### WebUI Source Patterns
| File | Lines | Description | Audit Focus |
|------|-------|-------------|-------------|
| `web/src/app.py` | 1-150 | Main app component | App structure, state management |
| `web/src/components/control_center.py` | 1-200 | Control center | Component patterns |
| `web/src/components/provider_panel.py` | 1-150 | Provider panel | Panel implementation |
| `web/src/components/agent_panel.py` | 1-150 | Agent panel | Agent display patterns |
| `web/src/components/workflow_panel.py` | 1-150 | Workflow panel | Workflow visualization |
| `web/src/components/evidence_panel.py` | 1-150 | Evidence panel | Evidence collection |
| `web/src/components/repair_panel.py` | 1-150 | Repair panel | Repair workflow |
| `web/src/components/settings_panel.py` | 1-150 | Settings panel | Settings management |
| `web/src/services/api_client.py` | 1-100 | API client | HTTP client patterns |
| `web/src/services/event_bus_client.py` | 1-80 | Event bus client | WebSocket patterns |

### Gateway Source Patterns
| File | Lines | Description | Audit Focus |
|------|-------|-------------|-------------|
| `gateway/run.py` | 1-100 | Main gateway loop | Gateway initialization |
| `gateway/run.py` | 100-200 | Slash commands | Command routing |
| `gateway/run.py` | 200-300 | Message dispatch | Message handling |
| `gateway/session.py` | 1-100 | Session store | Session management |
| `gateway/platforms/telegram.py` | 1-100 | Telegram adapter | Platform integration |
| `gateway/platforms/discord.py` | 1-100 | Discord adapter | Platform integration |

### Runtime Source Patterns
| File | Lines | Description | Audit Focus |
|------|-------|-------------|-------------|
| `src/runtime/event_bus.py` | 1-150 | Runtime event bus | NATS integration |
| `src/runtime/api.py` | 1-200 | Runtime API | FastAPI routes |
| `src/runtime/circuit_breaker.py` | 1-100 | Circuit breaker | Fault tolerance |
| `src/runtime/provider_router.py` | 1-150 | Provider router | Load balancing, failover |

### Hermes Source Patterns
| File | Lines | Description | Audit Focus |
|------|-------|-------------|-------------|
| `src/hermes/orchestrator.py` | 1-200 | Hermes orchestrator | Intake, contract, fanout |
| `src/hermes/validation.py` | 1-100 | Validation logic | Input validation |
| `src/patterns/zeroclaw/` | All | ZeroClaw adapters | Adapter patterns |

### Tool Patterns
| File | Lines | Description | Audit Focus |
|------|-------|-------------|-------------|
| `tools/registry.py` | 1-100 | Tool registry | Tool registration |
| `tools/delegate_tool.py` | 1-150 | Delegate tool | Subagent delegation |
| `model_tools.py` | 1-100 | Model tools | Tool orchestration |

---

## VPS (_scripts)

### Deployment Patterns
| File | Purpose | Audit Focus |
|------|---------|-------------|
| `_scripts/hermes/deploy_hermes.py` | Deployment automation | Deployment pattern compliance |
| `_scripts/hermes/setup_hermes.sh` | Setup script | Environment setup |
| `_scripts/hermes/configure.sh` | Configuration | Config management |

### Diagnostic Patterns
| File | Purpose | Audit Focus |
|------|---------|-------------|
| `_scripts/diagnostics/complete_e2e_audit.py` | End-to-end audit | Audit methodology |
| `_scripts/diagnostics/health_check.py` | Health monitoring | Health check patterns |
| `_scripts/diagnostics/performance_check.py` | Performance diagnostics | Performance patterns |

### Health & Monitoring
| File | Purpose | Audit Focus |
|------|---------|-------------|
| `_scripts/health/monitor.py` | System monitoring | Monitoring patterns |
| `_scripts/health/alert.py` | Alert handling | Alert patterns |

---

## kilocode-Azure2

### Provider Routing
| File | Lines | Purpose | Audit Focus |
|------|-------|---------|-------------|
| `packages/kilo-vscode/src/services/routing/provider_router.ts` | All | Provider routing | Routing algorithms |
| `packages/kilo-vscode/src/services/routing/load_balancer.ts` | All | Load balancing | Balancer implementation |
| `packages/kilo-vscode/src/services/routing/failover.ts` | All | Failover logic | Failover patterns |

### Agent Core
| File | Lines | Purpose | Audit Focus |
|------|-------|---------|-------------|
| `packages/kilo-core/src/agent/base_agent.ts` | All | Base agent | Agent patterns |
| `packages/kilo-core/src/agent/orchestrator.ts` | All | Orchestrator | Orchestration patterns |
| `packages/kilo-core/src/agent/message_handler.ts` | All | Message handling | Handler patterns |

### Service Layer
| File | Lines | Purpose | Audit Focus |
|------|-------|---------|-------------|
| `packages/kilo-core/src/services/event_bus.ts` | All | Event bus | Event patterns |
| `packages/kilo-core/src/services/api_client.ts` | All | API client | Client patterns |

---

## Pattern Mapping

### Source → Target Pattern Reference

| Source (hermes-agent) | Target (contract-kit) | Pattern Type |
|----------------------|----------------------|--------------|
| `web/src/components/*.py` | `src/webui/components/` | Component structure |
| `gateway/run.py` | `src/runtime/fastapi_app.py` | Server setup |
| `src/core/orchestrator.py` | `src/hermes/orchestrator.py` | Orchestration |
| `tools/delegate_tool.py` | `src/zeroclaw/adapters/delegate.py` | Delegation |
| `gateway/session.py` | `src/runtime/session_store.py` | Session management |

---

## Audit Checkpoints

### 10% Milestone
- [ ] All source locations verified accessible
- [ ] Pattern mapping complete
- [ ] Initial audit scope confirmed

### 50% Milestone
- [ ] 50% of patterns audited
- [ ] Cross-reference validation complete
- [ ] Issue log 100% documented

### 90% Milestone
- [ ] All patterns audited
- [ ] Fix verification complete
- [ ] Final compliance check passed
