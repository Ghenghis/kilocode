# KiloCode Contract Kit Version 17 - Merge Matrix

## Purpose

This document maps all source repositories and components to the five-lane architecture, specifying exactly what to copy, merge, adapt, or borrow.

---

## Merge Strategy Legend

| Symbol | Strategy | Description |
|--------|----------|-------------|
| ✅ COPY | Direct Copy | Clone entire source, integrate as-is |
| 🔄 MERGE | Merge | Combine multiple sources into unified component |
| ⚡ ADAPT | Adapt | Take specific files/patterns, modify for our use |
| 🎨 BORROW | Pattern Borrow | Study implementation, create similar but separate |
| 📚 RESEARCH | Research Only | Use as reference, no code integration |

---

## Lane 1: WebUI - Merge Matrix

### Control Center

| Source | Component | Strategy | Files | Action |
|--------|-----------|----------|-------|--------|
| opcode | Session/checkpoint patterns | 🎨 BORROW | `cc_agents/` | Implement similar checkpoint system |
| v16 | Control-center routes spec | 🔄 MERGE | `06_WEBUI_IMPLEMENTATION_CLOSURE.md` | Implement routes on Open WebUI |
| hermes-agent | Web UI (React) | 🔄 MERGE | `hermes-agent-2026.4.13/hermes-agent-2026.4.13/web/` | Integrate full React WebUI with api.ts, OAuth |
| kilocode-Azure2 | kilo-ui components | 🔄 MERGE | `kilocode-Azure2/packages/kilo-ui/` | Use for dashboard panels (107 components) |

### Providers Panel

| Source | Component | Strategy | Files | Action |
|--------|-----------|----------|-------|--------|
| kilocode-Azure2 | Routing service | ✅ COPY | `kilocode-Azure2/packages/kilo-vscode/src/services/routing/` | Integrate into WebUI |
| v16 | Provider health spec | 🔄 MERGE | `11_PROVIDER_ROUTING_AND_TOOLING_CLOSURE.md` | Implement health display |
| hermes-agent | Provider models | 🔄 MERGE | `hermes-agent-2026.4.13/hermes-agent-2026.4.13/agent/models_dev.py` | Add to provider list |

### Agents Panel

| Source | Component | Strategy | Files | Action |
|--------|-----------|----------|-------|--------|
| hermes-agent | Agent architecture | ✅ COPY | `hermes-agent-2026.4.13/hermes-agent-2026.4.13/src/core/base_agent.py` | Use as agent foundation |
| hermes-agent | Hierarchical crew | ✅ COPY | `hermes-agent-2026.4.13/hermes-agent-2026.4.13/src/patterns/hierarchical_crew.py` | Use for team management |
| hermes-agent | Voyager skills | 🔄 MERGE | `hermes-agent-2026.4.13/hermes-agent-2026.4.13/src/patterns/voyager_skills/` | Add skill chaining |
| hermes-agent | Reflexion agent | 🔄 MERGE | `hermes-agent-2026.4.13/hermes-agent-2026.4.13/src/patterns/reflexion_agent.py` | Add self-reflection |
| VPS | 5 Hermes agent roles | 🔄 MERGE | `VPS/docs/ORCHESTRATION-KIT-FRAMEWORK.md` | Integrate role definitions |
| VPS | Hermes orchestration kit | 🔄 MERGE | `VPS/_scripts/hermes/` (55+ scripts) | Automation scripts |

### Workflows Panel

| Source | Component | Strategy | Files | Action |
|--------|-----------|----------|-------|--------|
| v16 | Packet lifecycle spec | 🔄 MERGE | `configs/packet_schema.json` | Implement packet flow UI |
| kilocode-Azure2 | Command palette | 🎨 BORROW | `packages/kilo-vscode/src/services/` | Implement command palette |
| opcode | Timeline/checkpoints | 🎨 BORROW | `src-tauri/src/checkpoint/` | Implement workflow versioning |

### Evidence / DevTools

| Source | Component | Strategy | Files | Action |
|--------|-----------|----------|-------|--------|
| claude-devtools | Trace/evidence implementation | ⚡ ADAPT | Entire repo | Adapt session parsing, create evidence panels |
| VPS | Evidence ledger | ✅ COPY | `VPS/docs/HERMES-RUN-LEDGER.md` | Use ledger schema |
| VPS | Run ledger | ✅ COPY | `VPS/docs/HERMES-RUN-LEDGER.md` | Execution tracking system |
| v16 | Evidence requirements | ✅ COPY | `09_SETTINGS_AUTOFILL_AND_SCREENSHOT_REGISTERS.md` | Use as spec |

### Repairs / Safemode

| Source | Component | Strategy | Files | Action |
|--------|-----------|----------|-------|--------|
| hermes-agent | Self-healing scripts | ✅ COPY | `hermes-agent-2026.4.13/hermes-agent-2026.4.13/scripts/self-healing/` | Integrate automated repair |
| v16 | Boot gate/repair flow | ✅ COPY | `10_BOOT_GATE_SAFEMODE_REPAIR_RESTART_SAFETY.md` | Implement health matrix UI |
| v16 | SVG diagram | ✅ COPY | `diagrams/boot_gate_repair.svg` | Reference for UI flow |
| VPS | Diagnostic scripts | 🔄 MERGE | `VPS/_scripts/diagnostics/` (60+ scripts) | Health check automation |

### Settings / Missing Questions

| Source | Component | Strategy | Files | Action |
|--------|-----------|----------|-------|--------|
| v16 | Settings closure spec | ✅ COPY | `09_SETTINGS_AUTOFILL_AND_SCREENSHOT_REGISTERS.md` | Implement question flow |
| v16 | SVG diagram | ✅ COPY | `diagrams/settings_closure.svg` | Reference for UI flow |
| kilocode-Azure2 | kilo-gateway auth | 🔄 MERGE | `kilocode-Azure2/packages/kilo-gateway/` | Use for settings API |

---

## Lane 2: KiloCode - Merge Matrix

### Runtime Sync

| Source | Component | Strategy | Files | Action |
|--------|-----------|----------|-------|--------|
| v16 | Canonical settings spec | ✅ COPY | `configs/runtime_settings_schema.json` | Implement sync protocol |
| hermes-agent | Settings loading | 🔄 MERGE | `hermes_cli/config.py` | Adapt for KiloCode |

### Active Task Panel

| Source | Component | Strategy | Files | Action |
|--------|-----------|----------|-------|--------|
| kilocode-Azure2 | VSIX agent-manager | ⚡ ADAPT | `kilocode-Azure2/packages/kilo-vscode/webview-ui/agent-manager/` | Adapt for task display |
| kilocode-Azure2 | VSIX services (21) | 🔄 MERGE | `kilocode-Azure2/packages/kilo-vscode/src/services/` | Use existing services |
| opcode | Session list | 🎨 BORROW | `src/` | Implement similar task list |
| claude-devtools | Turn-based context | 🎨 BORROW | `src/` | Implement context display |

### Completion Packet Submitter

| Source | Component | Strategy | Files | Action |
|--------|-----------|----------|-------|--------|
| VPS | Completion packet schema | ✅ COPY | `VPS/docs/` | Implement submitter |
| VPS | Evidence ledger | ✅ COPY | `VPS/docs/HERMES-RUN-LEDGER.md` | Use ledger format |
| VPS | Orchestration framework | 🔄 MERGE | `VPS/docs/ORCHESTRATION-KIT-FRAMEWORK.md` | 5-agent setup integration |

### Provider/Mode Status

| Source | Component | Strategy | Files | Action |
|--------|-----------|----------|-------|--------|
| kilocode-Azure2 | Routing service | ✅ COPY | `kilocode-Azure2/packages/kilo-vscode/src/services/routing/` | Already complete |
| hermes-agent | Mode enforcement | 🔄 MERGE | `hermes-agent-2026.4.13/hermes-agent-2026.4.13/toolsets.py` | Add mode indicators |

### Evidence Return Panel

| Source | Component | Strategy | Files | Action |
|--------|-----------|----------|-------|--------|
| claude-devtools | Tool call inspector | ⚡ ADAPT | `src/` | Adapt for evidence display |
| claude-devtools | Context reconstruction | ⚡ ADAPT | `src/` | Adapt token attribution |

### Settings Autofill

| Source | Component | Strategy | Files | Action |
|--------|-----------|----------|-------|--------|
| v16 | Autofill spec | ✅ COPY | `09_SETTINGS_AUTOFILL_AND_SCREENSHOT_REGISTERS.md` | Implement autofill logic |
| kilocode-Azure2 | Onboarding service | 🔄 MERGE | `kilocode-Azure2/packages/kilo-vscode/src/services/onboarding/` | Extend for settings |

### Command Palette Actions

| Source | Component | Strategy | Files | Action |
|--------|-----------|----------|-------|--------|
| opcode | Command palette | 🎨 BORROW | `src/` | Implement similar palette |
| kilocode-Azure2 | kilo-ui command system | 🔄 MERGE | `kilocode-Azure2/packages/kilo-ui/` | Extend command system |

---

## Lane 3: Runtime + Provider - Merge Matrix

### Canonical Settings Truth

| Source | Component | Strategy | Files | Action |
|--------|-----------|----------|-------|--------|
| v16 | Settings schema | ✅ COPY | `configs/runtime_settings_schema.json` | Implement settings store |
| hermes-agent | Config loading | 🔄 MERGE | `hermes-agent-2026.4.13/hermes-agent-2026.4.13/hermes_cli/config.py` | Use as reference |
| kilocode-Azure2 | kilo-gateway | 🔄 MERGE | `kilocode-Azure2/packages/kilo-gateway/` | Use for API |

### Queue + Event Bus

| Source | Component | Strategy | Files | Action |
|--------|-----------|----------|-------|--------|
| v16 | NATS subjects spec | ⚡ ADAPT | `configs/nats_subjects.json` | Implement event bus (or use Redis) |
| hermes-agent | Event handling | 🔄 MERGE | `hermes-agent-2026.4.13/hermes-agent-2026.4.13/gateway/run.py` | Adapt for packet events |

### Provider Router

| Source | Component | Strategy | Files | Action |
|--------|-----------|----------|-------|--------|
| kilocode-Azure2 | Routing service | ✅ COPY | `kilocode-Azure2/packages/kilo-vscode/src/services/routing/` | Already complete |
| kilocode-Azure2 | Circuit breaker | ✅ COPY | `kilocode-Azure2/packages/kilo-vscode/src/services/routing/` | Already complete |

### Missing-Settings Question Flow

| Source | Component | Strategy | Files | Action |
|--------|-----------|----------|-------|--------|
| v16 | Question flow spec | ✅ COPY | `09_SETTINGS_AUTOFILL_AND_SCREENSHOT_REGISTERS.md` | Implement question UI |
| hermes-agent | CLI prompts | 🔄 MERGE | `hermes-agent-2026.4.13/hermes-agent-2026.4.13/cli.py` | Adapt for settings questions |

### Mode Enforcement

| Source | Component | Strategy | Files | Action |
|--------|-----------|----------|-------|--------|
| hermes-agent | Mode system | ✅ COPY | `hermes-agent-2026.4.13/hermes-agent-2026.4.13/toolsets.py` | Already exists |
| kilocode-Azure2 | Mode config | 🔄 MERGE | `kilocode-Azure2/packages/kilo-vscode/` | Add mode indicators |

### Audit Logging

| Source | Component | Strategy | Files | Action |
|--------|-----------|----------|-------|--------|
| hermes-agent | Logging system | ✅ COPY | `hermes-agent-2026.4.13/hermes-agent-2026.4.13/hermes_logging.py` | Already exists |
| hermes-agent | Trajectory saving | 🔄 MERGE | `hermes-agent-2026.4.13/hermes-agent-2026.4.13/agent/trajectory.py` | Extend for audit |

### SSH MCP Tool

| Source | Component | Strategy | Files | Action |
|--------|-----------|----------|-------|--------|
| MCP SSH Agent | Full implementation | ✅ COPY | `server-simple.mjs`, `src/` | Direct integration |
| hermes-agent | MCP tool | 🔄 MERGE | `hermes-agent-2026.4.13/hermes-agent-2026.4.13/tools/mcp_tool.py` | Add SSH functions |

---

## Lane 4: Hermes + ZeroClaw - Merge Matrix

### Intake Normalization

| Source | Component | Strategy | Files | Action |
|--------|-----------|----------|-------|--------|
| VPS | 5 Hermes agent roles | ✅ COPY | `VPS/docs/ORCHESTRATION-KIT-FRAMEWORK.md` | Integrate role system |
| VPS | Hermes scripts | 🔄 MERGE | `VPS/_scripts/hermes/` (55+ scripts) | Automation |
| hermes-agent | Delegate tool | 🔄 MERGE | `hermes-agent-2026.4.13/hermes-agent-2026.4.13/tools/delegate_tool.py` | Add intake processing |

### Contract Creation

| Source | Component | Strategy | Files | Action |
|--------|-----------|----------|-------|--------|
| VPS | Task packet schema | ✅ COPY | `VPS/docs/` | Use as contract |
| v16 | Packet schema | 🔄 MERGE | `configs/packet_schema.json` | Merge schemas |
| VPS | KiloCode-Hermes Pipeline Plan | 🔄 MERGE | `VPS/docs/KILOCODE-HERMES-PIPELINE-IMPLEMENTATION-PLAN.md` | Integration roadmap |

### Task Packet Fan-Out

| Source | Component | Strategy | Files | Action |
|--------|-----------|----------|-------|--------|
| hermes-agent | Delegate tool | ✅ COPY | `hermes-agent-2026.4.13/hermes-agent-2026.4.13/tools/delegate_tool.py` | Already exists |
| hermes-agent | Hierarchical crew | 🔄 MERGE | `hermes-agent-2026.4.13/hermes-agent-2026.4.13/src/patterns/hierarchical_crew.py` | Add fan-out |

### Validation Callbacks

| Source | Component | Strategy | Files | Action |
|--------|-----------|----------|-------|--------|
| VPS | Evidence requirements | ✅ COPY | `VPS/docs/HERMES-RUN-LEDGER.md` | Implement validators |
| VPS | Run ledger | ✅ COPY | `VPS/docs/HERMES-RUN-LEDGER.md` | Use as template |

### Repair Packet Routing

| Source | Component | Strategy | Files | Action |
|--------|-----------|----------|-------|--------|
| hermes-agent | Self-healing scripts | ✅ COPY | `hermes-agent-2026.4.13/hermes-agent-2026.4.13/scripts/self-healing/` | Integrate automated repair |
| VPS | Diagnostic scripts | 🔄 MERGE | `VPS/_scripts/diagnostics/` (60+ scripts) | Health check automation |
| v16 | Repair flow spec | ✅ COPY | `10_BOOT_GATE_SAFEMODE_REPAIR_RESTART_SAFETY.md` | Implement routing |
| v16 | SVG diagram | ✅ COPY | `diagrams/boot_gate_repair.svg` | Reference for flow |

### ZeroClaw Adapters

| Source | Component | Strategy | Files | Action |
|--------|-----------|----------|-------|--------|
| kilocode-Azure2 | ZeroClaw service | ✅ COPY | `kilocode-Azure2/packages/kilo-vscode/src/services/zeroclaw/` | Already exists |
| VPS | ZeroClaw kit | 🔄 MERGE | `VPS/_scripts/deploy/` | Merge contracts |
| hermes-agent | Git tools | 🔄 MERGE | `hermes-agent-2026.4.13/hermes-agent-2026.4.13/tools/` | Add as ZeroClaw adapters |
| hermes-agent | Terminal tool | 🔄 MERGE | `hermes-agent-2026.4.13/hermes-agent-2026.4.13/tools/terminal_tool.py` | Add as adapter |
| hermes-agent | File tools | 🔄 MERGE | `hermes-agent-2026.4.13/hermes-agent-2026.4.13/tools/file_tools.py` | Add as adapter |
| hermes-agent | Web tools | 🔄 MERGE | `hermes-agent-2026.4.13/hermes-agent-2026.4.13/tools/web_tools.py` | Add as research adapter |

### Memory Integration

| Source | Component | Strategy | Files | Action |
|--------|-----------|----------|-------|--------|
| VPS | Shiba memory integration | ✅ COPY | `VPS/docs/SHIBA-MEMORY-INTEGRATION.md` | Integrate with Hermes memory |
| hermes-agent | Memory manager | 🔄 MERGE | `hermes-agent-2026.4.13/hermes-agent-2026.4.13/src/core/` | Extend memory system |

---

## Lane 5: Proof / Testing - Merge Matrix

### Playwright UI Tests

| Source | Component | Strategy | Files | Action |
|--------|-----------|----------|-------|--------|
| hermes-agent | Test structure | 🔄 MERGE | `hermes-agent-2026.4.13/hermes-agent-2026.4.13/tests/` | Adapt for Playwright |
| kilocode-Azure2 | E2E structure | ⚡ ADAPT | `kilocode-Azure2/packages/app/e2e/` | Extend for contract kit |
| claude-devtools | Test patterns | 🎨 BORROW | `test/` | Study for patterns |

### Restart/Boot-Gate Tests

| Source | Component | Strategy | Files | Action |
|--------|-----------|----------|-------|--------|
| hermes-agent | Self-healing scripts | 🔄 MERGE | `hermes-agent-2026.4.13/hermes-agent-2026.4.13/scripts/self-healing/` | Create test scripts |
| VPS | Diagnostic scripts | 🔄 MERGE | `VPS/_scripts/diagnostics/` (60+ scripts) | Health check tests |
| v16 | Boot gate scripts | ✅ COPY | `deploy/scripts/run_boot_gate.sh` | Create test scripts |
| v16 | Safemode spec | 🔄 MERGE | `10_BOOT_GATE_SAFEMODE_REPAIR_RESTART_SAFETY.md` | Implement tests |

### Provider Failover Tests

| Source | Component | Strategy | Files | Action |
|--------|-----------|----------|-------|--------|
| kilocode-Azure2 | Circuit breaker | ✅ COPY | `kilocode-Azure2/packages/kilo-vscode/src/services/routing/` | Test failover |
| hermes-agent | Error classifier | 🔄 MERGE | `hermes-agent-2026.4.13/hermes-agent-2026.4.13/agent/error_classifier.py` | Add failover tests |

### Settings/Autofill Tests

| Source | Component | Strategy | Files | Action |
|--------|-----------|----------|-------|--------|
| v16 | Settings schema | ✅ COPY | `configs/runtime_settings_schema.json` | Create schema tests |
| hermes-agent | Config tests | 🔄 MERGE | `hermes-agent-2026.4.13/hermes-agent-2026.4.13/tests/` | Adapt settings tests |

### Repair/Unlock Tests

| Source | Component | Strategy | Files | Action |
|--------|-----------|----------|-------|--------|
| hermes-agent | Self-healing scripts | 🔄 MERGE | `hermes-agent-2026.4.13/hermes-agent-2026.4.13/scripts/self-healing/` | Create repair tests |
| VPS | Deploy scripts | 🔄 MERGE | `VPS/_scripts/deploy/` (15+ scripts) | Create test scenarios |
| v16 | Repair flow | ✅ COPY | `10_BOOT_GATE_SAFEMODE_REPAIR_RESTART_SAFETY.md` | Create repair tests |

---

## External Repository Merge Summary

### Directly Adapt/Integrate

| Repository | Items | Integration Point |
|------------|-------|-------------------|
| MCP SSH Agent | `server-simple.mjs`, SSH functions | hermes-agent tools |
| claude-devtools | Session parsing, evidence UI | WebUI Evidence panel |
| Aider | Edit/patch workflow patterns | KiloCode workflow system |
| AiDave71/kilocode | Multi-provider TTS, Hermes pipeline scaffolding, V4 kit | TTS system, pipeline templates |

### Borrow Patterns Only (AGPL - Implement Separately)

| Repository | Patterns | Implementation |
|------------|----------|----------------|
| opcode | Command center surfaces, session checkpoints | New WebUI components |
| claudecodeui | Mobile-first UI/UX | Open WebUI theming |

### Research Inventory

| Repository | Use |
|------------|-----|
| awesome-claude-code | Pattern catalog, skill ideas |
| AiDave71/kilocode | TTS system architecture, pipeline patterns | Study for integration |

---

## Implementation Priority

### Phase 1: Core Infrastructure
1. ✅ COPY v16 packet schemas → `configs/`
2. ✅ COPY VPS evidence ledger → `src/hermes/`
3. ✅ COPY hermes-agent base → `src/hermes/`
4. ⚡ ADAPT MCP SSH Agent → `src/hermes/tools/`
5. ✅ COPY hermes-agent self-healing scripts → `src/hermes/repair/`
6. ✅ COPY VPS Shiba memory integration → `src/hermes/memory/`

### Phase 2: WebUI + KiloCode
7. ⚡ ADAPT claude-devtools → `src/webui/evidence/`
8. 🔄 MERGE v16 + opcode → `src/webui/control-center/`
9. 🔄 MERGE hermes-agent web UI → `src/webui/`
10. 🔄 MERGE kilocode-Azure2 → `src/kilocode/`

### Phase 3: Runtime + Provider
11. ⚡ ADAPT NATS spec → Implement event bus
12. ✅ COPY routing service → `src/runtime/`
13. 🔄 MERGE hermes-agent config → `src/runtime/settings/`

### Phase 4: Hermes + ZeroClaw
14. ✅ COPY VPS orchestration framework → `src/hermes/roles/`
15. ✅ COPY VPS Hermes scripts → `src/hermes/scripts/`
16. ✅ COPY VPS deploy scripts → `src/hermes/deploy/`
17. ✅ COPY VPS diagnostic scripts → `src/hermes/diagnostics/`
18. 🔄 MERGE hermes tools → `src/zeroclaw/adapters/`
19. ⚡ ADAPT v16 repair flow → `src/hermes/repair/`

### Phase 5: Proof
20. 🔄 MERGE hermes-agent tests → `tests/`
21. ⚡ ADAPT v16 deploy scripts → `tests/e2e/`
22. Create Playwright suite → `tests/e2e/playwright/`

---

*Document Version: 17.0*
*Generated: 2026-04-20*
