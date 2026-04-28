# MAOS Agent Matrix — KiloCode 21-Agent Workforce

> Reference document for the Multi-Agent Orchestration System (MAOS).
> Source files: `packages/opencode/src/kilocode/agent/index.ts`, `docs/agent-reference/07_MODES_AGENTS_MAOS.md`
> Generated: 2026-04-27

---

## 1. System Overview

MAOS implements a **star-topology** multi-agent workforce where a single primary orchestrator (`kc-main`) receives all user requests and delegates subtasks to up to 20 specialised subagents (`kc-01` through `kc-20`).

### Architecture Principles

| Principle | Detail |
|-----------|--------|
| Topology | Star (hub-and-spoke) — `kc-main` is the sole hub |
| Communication | `kc-main` issues task tool calls; subagents respond with results |
| Isolation | Each subagent runs with isolated context unless memory scope is `shared` |
| Permission model | Subagents inherit `mode: "subagent"` bash allow-list; orchestrator has `bash: deny` |
| Step budgets | `kc-main` default 10 steps (configurable); all kc-01..kc-20 default 5 steps |
| Routing | `ACP.prompt()` → `AgentService.get(modeId)` → `Session.run(agentConfig)` |

### Agent Loading

All kc-agents are patched into the native agent registry via `patchAgents()` at extension activation. They are available on the `/app/agents` endpoint and selectable via `@kc-XX` autocomplete.

```
User prompt
    │
    ▼
kc-main (Orchestrator, steps=10, mode=primary)
    │
    ├── delegates via task() tool calls
    │
    ├── kc-01 Integration Lead        (steps=5, mode=subagent)
    ├── kc-02 Creative Brainstormer   (steps=5, mode=subagent)
    ├── kc-03 System Architect        (steps=5, mode=subagent)
    ├── ...
    └── kc-20 Prompt Engineer         (steps=5, mode=subagent)
```

---

## 2. SVG Agent Dependency Tree

The tree below shows `kc-main` as the root, branching into five category lanes. Each circle is an agent; colours match the category.

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" width="800" height="600" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="11">

  <!-- Background -->
  <rect width="800" height="600" fill="#0f1117"/>

  <!-- ── Legend ── -->
  <rect x="20" y="560" width="14" height="14" rx="3" fill="#6C63FF"/>
  <text x="38" y="572" fill="#ccc" font-size="10">Orchestration</text>
  <rect x="130" y="560" width="14" height="14" rx="3" fill="#45B7D1"/>
  <text x="148" y="572" fill="#ccc" font-size="10">Analysis</text>
  <rect x="220" y="560" width="14" height="14" rx="3" fill="#DDA0DD"/>
  <text x="238" y="572" fill="#ccc" font-size="10">Generation</text>
  <rect x="330" y="560" width="14" height="14" rx="3" fill="#96CEB4"/>
  <text x="348" y="572" fill="#ccc" font-size="10">Quality</text>
  <rect x="420" y="560" width="14" height="14" rx="3" fill="#16A085"/>
  <text x="438" y="572" fill="#ccc" font-size="10">Specialist</text>

  <!-- ── Root: kc-main ── -->
  <circle cx="400" cy="55" r="34" fill="#6C63FF" stroke="#a09cf7" stroke-width="2"/>
  <text x="400" y="50" text-anchor="middle" fill="#fff" font-weight="bold" font-size="12">kc-main</text>
  <text x="400" y="64" text-anchor="middle" fill="#ddd" font-size="9">Orchestrator</text>

  <!-- ── Category nodes (row 2, y=155) ── -->

  <!-- Orchestration -->
  <line x1="400" y1="89" x2="110" y2="138" stroke="#6C63FF" stroke-width="1.5" stroke-dasharray="4,3"/>
  <circle cx="110" cy="155" r="26" fill="#6C63FF" opacity="0.85"/>
  <text x="110" y="151" text-anchor="middle" fill="#fff" font-size="10" font-weight="bold">Orches-</text>
  <text x="110" y="163" text-anchor="middle" fill="#fff" font-size="10" font-weight="bold">tration</text>

  <!-- Analysis -->
  <line x1="400" y1="89" x2="245" y2="138" stroke="#45B7D1" stroke-width="1.5" stroke-dasharray="4,3"/>
  <circle cx="245" cy="155" r="26" fill="#45B7D1" opacity="0.85"/>
  <text x="245" y="158" text-anchor="middle" fill="#fff" font-size="10" font-weight="bold">Analysis</text>

  <!-- Generation -->
  <line x1="400" y1="89" x2="400" y2="129" stroke="#DDA0DD" stroke-width="1.5" stroke-dasharray="4,3"/>
  <circle cx="400" cy="155" r="26" fill="#DDA0DD" opacity="0.85"/>
  <text x="400" y="158" text-anchor="middle" fill="#fff" font-size="10" font-weight="bold">Generation</text>

  <!-- Quality -->
  <line x1="400" y1="89" x2="555" y2="138" stroke="#96CEB4" stroke-width="1.5" stroke-dasharray="4,3"/>
  <circle cx="555" cy="155" r="26" fill="#96CEB4" opacity="0.85"/>
  <text x="555" y="158" text-anchor="middle" fill="#333" font-size="10" font-weight="bold">Quality</text>

  <!-- Specialist -->
  <line x1="400" y1="89" x2="690" y2="138" stroke="#16A085" stroke-width="1.5" stroke-dasharray="4,3"/>
  <circle cx="690" cy="155" r="26" fill="#16A085" opacity="0.85"/>
  <text x="690" y="158" text-anchor="middle" fill="#fff" font-size="10" font-weight="bold">Specialist</text>

  <!-- ══════════════════════════════════════════════════════
       ORCHESTRATION branch  →  kc-01 only
  ══════════════════════════════════════════════════════ -->
  <line x1="110" y1="181" x2="110" y2="238" stroke="#6C63FF" stroke-width="1.2"/>
  <circle cx="110" cy="252" r="22" fill="#FF6B6B" stroke="#6C63FF" stroke-width="1.5"/>
  <text x="110" y="248" text-anchor="middle" fill="#fff" font-size="9" font-weight="bold">kc-01</text>
  <text x="110" y="260" text-anchor="middle" fill="#fee" font-size="8">Integration</text>
  <text x="110" y="270" text-anchor="middle" fill="#fee" font-size="8">Lead</text>

  <!-- ══════════════════════════════════════════════════════
       ANALYSIS branch  →  kc-02, kc-03, kc-05, kc-13, kc-19
  ══════════════════════════════════════════════════════ -->
  <!-- kc-02 -->
  <line x1="245" y1="181" x2="170" y2="238" stroke="#45B7D1" stroke-width="1.2"/>
  <circle cx="170" cy="252" r="22" fill="#4ECDC4" stroke="#45B7D1" stroke-width="1.5"/>
  <text x="170" y="248" text-anchor="middle" fill="#fff" font-size="9" font-weight="bold">kc-02</text>
  <text x="170" y="260" text-anchor="middle" fill="#e0fffe" font-size="8">Creative</text>
  <text x="170" y="270" text-anchor="middle" fill="#e0fffe" font-size="8">Brainstorm</text>

  <!-- kc-03 -->
  <line x1="245" y1="181" x2="220" y2="238" stroke="#45B7D1" stroke-width="1.2"/>
  <circle cx="220" cy="252" r="22" fill="#45B7D1" stroke="#45B7D1" stroke-width="1.5"/>
  <text x="220" y="248" text-anchor="middle" fill="#fff" font-size="9" font-weight="bold">kc-03</text>
  <text x="220" y="260" text-anchor="middle" fill="#e8f7ff" font-size="8">System</text>
  <text x="220" y="270" text-anchor="middle" fill="#e8f7ff" font-size="8">Architect</text>

  <!-- kc-05 -->
  <line x1="245" y1="181" x2="270" y2="238" stroke="#45B7D1" stroke-width="1.2"/>
  <circle cx="270" cy="252" r="22" fill="#FFEAA7" stroke="#45B7D1" stroke-width="1.5"/>
  <text x="270" y="248" text-anchor="middle" fill="#333" font-size="9" font-weight="bold">kc-05</text>
  <text x="270" y="260" text-anchor="middle" fill="#444" font-size="8">Root Cause</text>
  <text x="270" y="270" text-anchor="middle" fill="#444" font-size="8">Analyst</text>

  <!-- kc-13 -->
  <line x1="245" y1="181" x2="320" y2="238" stroke="#45B7D1" stroke-width="1.2"/>
  <circle cx="320" cy="252" r="22" fill="#F39C12" stroke="#45B7D1" stroke-width="1.5"/>
  <text x="320" y="248" text-anchor="middle" fill="#fff" font-size="9" font-weight="bold">kc-13</text>
  <text x="320" y="260" text-anchor="middle" fill="#fee" font-size="8">Perf.</text>
  <text x="320" y="270" text-anchor="middle" fill="#fee" font-size="8">Analyst</text>

  <!-- kc-19 -->
  <line x1="245" y1="181" x2="245" y2="238" stroke="#45B7D1" stroke-width="1.2"/>
  <circle cx="245" cy="252" r="22" fill="#34495E" stroke="#45B7D1" stroke-width="1.5"/>
  <text x="245" y="248" text-anchor="middle" fill="#fff" font-size="9" font-weight="bold">kc-19</text>
  <text x="245" y="260" text-anchor="middle" fill="#cee" font-size="8">Research</text>
  <text x="245" y="270" text-anchor="middle" fill="#cee" font-size="8">Analyst</text>

  <!-- ══════════════════════════════════════════════════════
       GENERATION branch  →  kc-06, kc-11
  ══════════════════════════════════════════════════════ -->
  <!-- kc-06 -->
  <line x1="400" y1="181" x2="375" y2="238" stroke="#DDA0DD" stroke-width="1.2"/>
  <circle cx="375" cy="252" r="22" fill="#DDA0DD" stroke="#bb7dbb" stroke-width="1.5"/>
  <text x="375" y="248" text-anchor="middle" fill="#fff" font-size="9" font-weight="bold">kc-06</text>
  <text x="375" y="260" text-anchor="middle" fill="#ffe" font-size="8">Code</text>
  <text x="375" y="270" text-anchor="middle" fill="#ffe" font-size="8">Generator</text>

  <!-- kc-11 -->
  <line x1="400" y1="181" x2="425" y2="238" stroke="#DDA0DD" stroke-width="1.2"/>
  <circle cx="425" cy="252" r="22" fill="#85C1E2" stroke="#bb7dbb" stroke-width="1.5"/>
  <text x="425" y="248" text-anchor="middle" fill="#fff" font-size="9" font-weight="bold">kc-11</text>
  <text x="425" y="260" text-anchor="middle" fill="#e8f7ff" font-size="8">Docu-</text>
  <text x="425" y="270" text-anchor="middle" fill="#e8f7ff" font-size="8">menter</text>

  <!-- ══════════════════════════════════════════════════════
       QUALITY branch  →  kc-04, kc-07, kc-08, kc-09, kc-10, kc-12
  ══════════════════════════════════════════════════════ -->
  <!-- kc-04 -->
  <line x1="555" y1="181" x2="470" y2="238" stroke="#96CEB4" stroke-width="1.2"/>
  <circle cx="470" cy="252" r="22" fill="#96CEB4" stroke="#6aaa8a" stroke-width="1.5"/>
  <text x="470" y="248" text-anchor="middle" fill="#222" font-size="9" font-weight="bold">kc-04</text>
  <text x="470" y="260" text-anchor="middle" fill="#335" font-size="8">Bug</text>
  <text x="470" y="270" text-anchor="middle" fill="#335" font-size="8">Triage</text>

  <!-- kc-07 -->
  <line x1="555" y1="181" x2="510" y2="238" stroke="#96CEB4" stroke-width="1.2"/>
  <circle cx="510" cy="252" r="22" fill="#FFB6C1" stroke="#6aaa8a" stroke-width="1.5"/>
  <text x="510" y="248" text-anchor="middle" fill="#333" font-size="9" font-weight="bold">kc-07</text>
  <text x="510" y="260" text-anchor="middle" fill="#444" font-size="8">Code</text>
  <text x="510" y="270" text-anchor="middle" fill="#444" font-size="8">Reviewer</text>

  <!-- kc-08 -->
  <line x1="555" y1="181" x2="555" y2="238" stroke="#96CEB4" stroke-width="1.2"/>
  <circle cx="555" cy="252" r="22" fill="#98D8C8" stroke="#6aaa8a" stroke-width="1.5"/>
  <text x="555" y="248" text-anchor="middle" fill="#222" font-size="9" font-weight="bold">kc-08</text>
  <text x="555" y="260" text-anchor="middle" fill="#334" font-size="8">Test</text>
  <text x="555" y="270" text-anchor="middle" fill="#334" font-size="8">Writer</text>

  <!-- kc-09 -->
  <line x1="555" y1="181" x2="600" y2="238" stroke="#96CEB4" stroke-width="1.2"/>
  <circle cx="600" cy="252" r="22" fill="#F7DC6F" stroke="#6aaa8a" stroke-width="1.5"/>
  <text x="600" y="248" text-anchor="middle" fill="#333" font-size="9" font-weight="bold">kc-09</text>
  <text x="600" y="260" text-anchor="middle" fill="#444" font-size="8">Debugger</text>

  <!-- kc-10 -->
  <line x1="555" y1="181" x2="643" y2="238" stroke="#96CEB4" stroke-width="1.2"/>
  <circle cx="643" cy="252" r="22" fill="#BB8FCE" stroke="#6aaa8a" stroke-width="1.5"/>
  <text x="643" y="248" text-anchor="middle" fill="#fff" font-size="9" font-weight="bold">kc-10</text>
  <text x="643" y="260" text-anchor="middle" fill="#efe" font-size="8">Refactorer</text>

  <!-- kc-12 -->
  <line x1="555" y1="181" x2="685" y2="238" stroke="#96CEB4" stroke-width="1.2"/>
  <circle cx="685" cy="252" r="22" fill="#E74C3C" stroke="#6aaa8a" stroke-width="1.5"/>
  <text x="685" y="248" text-anchor="middle" fill="#fff" font-size="9" font-weight="bold">kc-12</text>
  <text x="685" y="260" text-anchor="middle" fill="#fee" font-size="8">Security</text>
  <text x="685" y="270" text-anchor="middle" fill="#fee" font-size="8">Auditor</text>

  <!-- ══════════════════════════════════════════════════════
       SPECIALIST branch  →  kc-14, kc-15, kc-16, kc-17, kc-18, kc-20
  ══════════════════════════════════════════════════════ -->
  <!-- kc-14 -->
  <line x1="690" y1="181" x2="690" y2="310" stroke="#16A085" stroke-width="1.2"/>
  <circle cx="690" cy="326" r="22" fill="#16A085" stroke="#0d7060" stroke-width="1.5"/>
  <text x="690" y="322" text-anchor="middle" fill="#fff" font-size="9" font-weight="bold">kc-14</text>
  <text x="690" y="334" text-anchor="middle" fill="#cfe" font-size="8">API</text>
  <text x="690" y="344" text-anchor="middle" fill="#cfe" font-size="8">Integrator</text>

  <!-- kc-15 -->
  <line x1="690" y1="181" x2="630" y2="310" stroke="#16A085" stroke-width="1.2"/>
  <circle cx="630" cy="326" r="22" fill="#8E44AD" stroke="#0d7060" stroke-width="1.5"/>
  <text x="630" y="322" text-anchor="middle" fill="#fff" font-size="9" font-weight="bold">kc-15</text>
  <text x="630" y="334" text-anchor="middle" fill="#efe" font-size="8">Database</text>
  <text x="630" y="344" text-anchor="middle" fill="#efe" font-size="8">Specialist</text>

  <!-- kc-16 -->
  <line x1="690" y1="181" x2="750" y2="310" stroke="#16A085" stroke-width="1.2"/>
  <circle cx="750" cy="326" r="22" fill="#27AE60" stroke="#0d7060" stroke-width="1.5"/>
  <text x="750" y="322" text-anchor="middle" fill="#fff" font-size="9" font-weight="bold">kc-16</text>
  <text x="750" y="334" text-anchor="middle" fill="#dfd" font-size="8">DevOps</text>
  <text x="750" y="344" text-anchor="middle" fill="#dfd" font-size="8">Engineer</text>

  <!-- kc-17 -->
  <line x1="690" y1="181" x2="570" y2="310" stroke="#16A085" stroke-width="1.2"/>
  <circle cx="570" cy="326" r="22" fill="#E67E22" stroke="#0d7060" stroke-width="1.5"/>
  <text x="570" y="322" text-anchor="middle" fill="#fff" font-size="9" font-weight="bold">kc-17</text>
  <text x="570" y="334" text-anchor="middle" fill="#fee" font-size="8">Frontend</text>
  <text x="570" y="344" text-anchor="middle" fill="#fee" font-size="8">Specialist</text>

  <!-- kc-18 -->
  <line x1="690" y1="181" x2="510" y2="310" stroke="#16A085" stroke-width="1.2"/>
  <circle cx="510" cy="326" r="22" fill="#2C3E50" stroke="#0d7060" stroke-width="1.5"/>
  <text x="510" y="322" text-anchor="middle" fill="#fff" font-size="9" font-weight="bold">kc-18</text>
  <text x="510" y="334" text-anchor="middle" fill="#cde" font-size="8">Backend</text>
  <text x="510" y="344" text-anchor="middle" fill="#cde" font-size="8">Specialist</text>

  <!-- kc-20 -->
  <line x1="690" y1="181" x2="450" y2="310" stroke="#16A085" stroke-width="1.2"/>
  <circle cx="450" cy="326" r="22" fill="#9B59B6" stroke="#0d7060" stroke-width="1.5"/>
  <text x="450" y="322" text-anchor="middle" fill="#fff" font-size="9" font-weight="bold">kc-20</text>
  <text x="450" y="334" text-anchor="middle" fill="#edf" font-size="8">Prompt</text>
  <text x="450" y="344" text-anchor="middle" fill="#edf" font-size="8">Engineer</text>

  <!-- Title -->
  <text x="400" y="20" text-anchor="middle" fill="#888" font-size="13" font-weight="bold">MAOS 21-Agent Dependency Tree</text>
  <text x="400" y="34" text-anchor="middle" fill="#555" font-size="10">kc-main orchestrates kc-01..kc-20 via task() tool delegation</text>

</svg>
```

---

## 3. Complete Capability Matrix

All 21 agents. Step limit of `0` means unlimited (text-only fallback applies after configured steps).

| Agent ID | Display Name | Category | Default Enabled | Step Limit | Memory Scope | Mode | Key Capabilities |
|----------|-------------|----------|:--------------:|:----------:|:------------:|------|-----------------|
| **kc-main** | MAOS Orchestrator | Orchestration | Yes | 10 | shared | primary | Task decomposition, subagent delegation via `task()`, result synthesis, session-level coordination |
| **kc-01** | Integration Lead | Orchestration | Yes | 5 | shared | subagent | Multi-agent task routing, cross-team coordination, result merging, dependency graph management |
| **kc-02** | Creative Brainstormer | Analysis | Yes | 5 | isolated | subagent | Ideation, alternative approach generation, lateral thinking, brainstorm facilitation |
| **kc-03** | System Architect | Analysis | Yes | 5 | isolated | subagent | System design, component boundary definition, data-flow diagrams, technology selection |
| **kc-04** | Bug Triage Specialist | Quality | Yes | 5 | isolated | subagent | Bug classification, severity scoring, reproduction steps, assignment routing |
| **kc-05** | Root Cause Analyst | Analysis | Yes | 5 | isolated | subagent | Failure investigation, causal chain analysis, hypothesis testing, incident post-mortems |
| **kc-06** | Code Generator | Generation | Yes | 5 | isolated | subagent | New file/function scaffolding, boilerplate generation, requirement-to-code translation |
| **kc-07** | Code Reviewer | Quality | Yes | 5 | readonly | subagent | Style review, logic correctness, convention adherence, change-request authoring |
| **kc-08** | Test Writer | Quality | Yes | 5 | isolated | subagent | Unit/integration/e2e test authoring, edge-case identification, coverage gap analysis |
| **kc-09** | Debugger | Quality | Yes | 5 | isolated | subagent | Runtime error tracing, breakpoint strategy, log analysis, patch authoring |
| **kc-10** | Refactorer | Quality | Yes | 5 | isolated | subagent | Code cleanup, extract-function, rename, dead-code removal, readability improvements |
| **kc-11** | Documenter | Generation | Yes | 5 | isolated | subagent | Docstrings, README authoring, changelog updates, inline comment writing, API docs |
| **kc-12** | Security Auditor | Quality | Yes | 5 | readonly | subagent | OWASP scanning, secrets detection, injection vulnerability analysis, dependency CVE checks |
| **kc-13** | Performance Analyst | Analysis | Yes | 5 | readonly | subagent | CPU/memory profiling, algorithmic complexity review, I/O bottleneck identification |
| **kc-14** | API Integrator | Specialist | Yes | 5 | isolated | subagent | REST/GraphQL/gRPC client+server implementation, OpenAPI contract authoring, auth flows |
| **kc-15** | Database Specialist | Specialist | Yes | 5 | isolated | subagent | Schema design, migration authoring, query optimisation, index strategy, ORM config |
| **kc-16** | DevOps Engineer | Specialist | Yes | 5 | isolated | subagent | CI/CD pipeline authoring, Dockerfile/K8s manifests, IaC (Terraform/Pulumi), deployment scripts |
| **kc-17** | Frontend Specialist | Specialist | Yes | 5 | isolated | subagent | UI component authoring, state management, accessibility (a11y), responsive layouts |
| **kc-18** | Backend Specialist | Specialist | Yes | 5 | isolated | subagent | Server-side logic, business rules, background workers, caching, data persistence layers |
| **kc-19** | Research Analyst | Analysis | Yes | 5 | readonly | subagent | Library evaluation, best-practice surveys, competitive analysis, findings summarisation |
| **kc-20** | Prompt Engineer | Specialist | Yes | 5 | isolated | subagent | System prompt authoring, few-shot example curation, instruction refinement, LLM task optimisation |

### Memory Scope Key

| Scope | Meaning |
|-------|---------|
| `shared` | Agent can read and write session-level shared context (used by orchestrators) |
| `isolated` | Agent operates on its own context window; output returned to caller only |
| `readonly` | Agent reads shared context but cannot mutate it (auditors, reviewers, researchers) |

---

## 4. Preset Configurations

Presets are defined in `AgentBehaviourTab.tsx` (`AGENT_PRESETS`) and exposed on the **Presets** subtab of Agent Behaviour settings. Enabling a preset disables all agents not in `enabledIds`.

| Preset | Label | kc-main | kc-01 | kc-02 | kc-03 | kc-04 | kc-05 | kc-06 | kc-07 | kc-08 | kc-09 | kc-10 | kc-11 | kc-12 | kc-13 | kc-14 | kc-15 | kc-16 | kc-17 | kc-18 | kc-19 | kc-20 |
|--------|-------|:-------:|:-----:|:-----:|:-----:|:-----:|:-----:|:-----:|:-----:|:-----:|:-----:|:-----:|:-----:|:-----:|:-----:|:-----:|:-----:|:-----:|:-----:|:-----:|:-----:|:-----:|
| `dev-all` | Dev mode (all) | ON | ON | ON | ON | ON | ON | ON | ON | ON | ON | ON | ON | ON | ON | ON | ON | ON | ON | ON | ON | ON |
| `review-only` | Review only | ON | — | — | — | ON | — | — | ON | — | — | — | — | ON | ON | — | — | — | — | — | — | — |
| `write-only` | Write only | ON | — | — | — | — | — | ON | — | — | — | ON | ON | — | — | — | — | — | — | — | — | — |
| `research-only` | Research only | ON | ON | — | ON | — | ON | — | — | — | — | — | — | — | ON | — | — | — | — | — | ON | — |

> `ON` = enabled, `—` = disabled. `kc-main` is always enabled as the entry-point orchestrator.

### Preset Details

**`dev-all` — Dev mode (all)**
All 21 agents enabled. Full development workflow: plan → research → architect → generate → test → review → document → deploy.
_Use when_: Starting a new feature, onboarding a greenfield project, or running a comprehensive autonomous task.

**`review-only`**
Enabled: `kc-main`, `kc-04` (Bug Triage), `kc-07` (Code Reviewer), `kc-12` (Security Auditor), `kc-13` (Performance Analyst).
_Use when_: Reviewing a pull request or auditing existing code without generating any changes.

**`write-only`**
Enabled: `kc-main`, `kc-06` (Code Generator), `kc-10` (Refactorer), `kc-11` (Documenter).
_Use when_: Implementing a well-specified feature or writing documentation where analysis agents are not required.

**`research-only`**
Enabled: `kc-main`, `kc-01` (Integration Lead), `kc-03` (System Architect), `kc-05` (Root Cause Analyst), `kc-13` (Performance Analyst), `kc-19` (Research Analyst).
_Use when_: Exploring a problem space, evaluating technology options, or diagnosing a systemic issue without writing code.

---

## 5. SVG Priority Queue Visualization

Default agent scheduling priority is determined by task dependency order within a typical development cycle. `kc-main` always dispatches first; within a parallel batch, agents are ordered by the priority lane below.

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 340" width="800" height="340" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="11">

  <rect width="800" height="340" fill="#0f1117"/>

  <!-- Title -->
  <text x="400" y="22" text-anchor="middle" fill="#aaa" font-size="13" font-weight="bold">MAOS Default Scheduling Priority (left = highest priority)</text>

  <!-- Lane labels -->
  <text x="10" y="58"  fill="#6C63FF" font-size="10" font-weight="bold">ORCH</text>
  <text x="10" y="108" fill="#45B7D1" font-size="10" font-weight="bold">ANLYS</text>
  <text x="10" y="158" fill="#DDA0DD" font-size="10" font-weight="bold">GEN</text>
  <text x="10" y="208" fill="#96CEB4" font-size="10" font-weight="bold">QUAL</text>
  <text x="10" y="258" fill="#16A085" font-size="10" font-weight="bold">SPEC</text>

  <!-- Lane backgrounds -->
  <rect x="55" y="40"  width="730" height="30" rx="4" fill="#6C63FF" opacity="0.12"/>
  <rect x="55" y="88"  width="730" height="30" rx="4" fill="#45B7D1" opacity="0.10"/>
  <rect x="55" y="138" width="730" height="30" rx="4" fill="#DDA0DD" opacity="0.10"/>
  <rect x="55" y="188" width="730" height="30" rx="4" fill="#96CEB4" opacity="0.10"/>
  <rect x="55" y="238" width="730" height="30" rx="4" fill="#16A085" opacity="0.10"/>

  <!-- Priority tick marks -->
  <text x="60"  y="300" fill="#555" font-size="9">P1</text>
  <text x="145" y="300" fill="#555" font-size="9">P2</text>
  <text x="230" y="300" fill="#555" font-size="9">P3</text>
  <text x="315" y="300" fill="#555" font-size="9">P4</text>
  <text x="400" y="300" fill="#555" font-size="9">P5</text>
  <text x="485" y="300" fill="#555" font-size="9">P6</text>
  <text x="570" y="300" fill="#555" font-size="9">P7</text>
  <text x="655" y="300" fill="#555" font-size="9">P8</text>
  <text x="740" y="300" fill="#555" font-size="9">P9</text>
  <line x1="55" y1="292" x2="785" y2="292" stroke="#333" stroke-width="1"/>
  <!-- tick lines -->
  <line x1="72"  y1="288" x2="72"  y2="296" stroke="#444" stroke-width="1"/>
  <line x1="157" y1="288" x2="157" y2="296" stroke="#444" stroke-width="1"/>
  <line x1="242" y1="288" x2="242" y2="296" stroke="#444" stroke-width="1"/>
  <line x1="327" y1="288" x2="327" y2="296" stroke="#444" stroke-width="1"/>
  <line x1="412" y1="288" x2="412" y2="296" stroke="#444" stroke-width="1"/>
  <line x1="497" y1="288" x2="497" y2="296" stroke="#444" stroke-width="1"/>
  <line x1="582" y1="288" x2="582" y2="296" stroke="#444" stroke-width="1"/>
  <line x1="667" y1="288" x2="667" y2="296" stroke="#444" stroke-width="1"/>
  <line x1="752" y1="288" x2="752" y2="296" stroke="#444" stroke-width="1"/>

  <!-- ORCH lane: kc-main (P1), kc-01 (P2) -->
  <rect x="58"  y="44" width="80" height="22" rx="3" fill="#6C63FF"/>
  <text x="98"  y="59" text-anchor="middle" fill="#fff" font-size="9" font-weight="bold">kc-main</text>
  <rect x="145" y="44" width="80" height="22" rx="3" fill="#FF6B6B"/>
  <text x="185" y="59" text-anchor="middle" fill="#fff" font-size="9">kc-01 Integ.</text>

  <!-- ANLYS lane: kc-19 (P2), kc-02 (P3), kc-03 (P3), kc-05 (P4), kc-13 (P5) -->
  <rect x="145" y="92"  width="80" height="22" rx="3" fill="#34495E"/>
  <text x="185" y="107" text-anchor="middle" fill="#ccc" font-size="9">kc-19 Rsrch</text>
  <rect x="230" y="92"  width="80" height="22" rx="3" fill="#4ECDC4"/>
  <text x="270" y="107" text-anchor="middle" fill="#fff" font-size="9">kc-02 Brnst</text>
  <rect x="315" y="92"  width="80" height="22" rx="3" fill="#45B7D1"/>
  <text x="355" y="107" text-anchor="middle" fill="#fff" font-size="9">kc-03 Arch.</text>
  <rect x="400" y="92"  width="80" height="22" rx="3" fill="#FFEAA7"/>
  <text x="440" y="107" text-anchor="middle" fill="#333" font-size="9">kc-05 RCA</text>
  <rect x="485" y="92"  width="80" height="22" rx="3" fill="#F39C12"/>
  <text x="525" y="107" text-anchor="middle" fill="#fff" font-size="9">kc-13 Perf.</text>

  <!-- GEN lane: kc-06 (P4), kc-11 (P6) -->
  <rect x="315" y="142" width="80" height="22" rx="3" fill="#DDA0DD"/>
  <text x="355" y="157" text-anchor="middle" fill="#fff" font-size="9">kc-06 Gen.</text>
  <rect x="485" y="142" width="80" height="22" rx="3" fill="#85C1E2"/>
  <text x="525" y="157" text-anchor="middle" fill="#333" font-size="9">kc-11 Docs</text>

  <!-- QUAL lane: kc-04 (P3), kc-09 (P5), kc-07 (P6), kc-08 (P6), kc-10 (P7), kc-12 (P7) -->
  <rect x="230" y="192" width="80" height="22" rx="3" fill="#96CEB4"/>
  <text x="270" y="207" text-anchor="middle" fill="#222" font-size="9">kc-04 Triage</text>
  <rect x="400" y="192" width="80" height="22" rx="3" fill="#F7DC6F"/>
  <text x="440" y="207" text-anchor="middle" fill="#333" font-size="9">kc-09 Debug</text>
  <rect x="485" y="192" width="80" height="22" rx="3" fill="#FFB6C1"/>
  <text x="525" y="207" text-anchor="middle" fill="#333" font-size="9">kc-07 Rev.</text>
  <rect x="570" y="192" width="80" height="22" rx="3" fill="#98D8C8"/>
  <text x="610" y="207" text-anchor="middle" fill="#222" font-size="9">kc-08 Tests</text>
  <rect x="655" y="192" width="80" height="22" rx="3" fill="#BB8FCE"/>
  <text x="695" y="207" text-anchor="middle" fill="#fff" font-size="9">kc-10 Refact</text>
  <rect x="740" y="192" width="40" height="22" rx="3" fill="#E74C3C"/>
  <text x="760" y="207" text-anchor="middle" fill="#fff" font-size="9">kc-12</text>

  <!-- SPEC lane: kc-14..kc-18, kc-20 starting P4 -->
  <rect x="315" y="242" width="80" height="22" rx="3" fill="#16A085"/>
  <text x="355" y="257" text-anchor="middle" fill="#fff" font-size="9">kc-14 API</text>
  <rect x="400" y="242" width="80" height="22" rx="3" fill="#8E44AD"/>
  <text x="440" y="257" text-anchor="middle" fill="#fff" font-size="9">kc-15 DB</text>
  <rect x="485" y="242" width="80" height="22" rx="3" fill="#27AE60"/>
  <text x="525" y="257" text-anchor="middle" fill="#fff" font-size="9">kc-16 DevOps</text>
  <rect x="570" y="242" width="80" height="22" rx="3" fill="#E67E22"/>
  <text x="610" y="257" text-anchor="middle" fill="#fff" font-size="9">kc-17 FE</text>
  <rect x="655" y="242" width="80" height="22" rx="3" fill="#2C3E50"/>
  <text x="695" y="257" text-anchor="middle" fill="#fff" font-size="9">kc-18 BE</text>
  <rect x="740" y="242" width="40" height="22" rx="3" fill="#9B59B6"/>
  <text x="760" y="257" text-anchor="middle" fill="#fff" font-size="9">kc-20</text>

  <text x="400" y="325" text-anchor="middle" fill="#555" font-size="10">Agents in the same priority column may run in parallel. Higher P = earlier dispatch.</text>
</svg>
```

---

## 6. Emergency Stop Behavior

### Overview

An emergency stop (E-Stop) is triggered when:

1. The user presses **Escape** or clicks the stop button in the webview
2. A session receives a `cancelSession` ACP message
3. An agent exceeds its `steps` budget (soft stop — model switches to text-only)
4. A tool call is denied and the session enters `Error` state

### State Transitions on Stop

| Trigger | Current State | Action | Result |
|---------|---------------|--------|--------|
| User Escape / cancel | `Running` | `session.cancel()` issued | All pending tool calls aborted; stream closed |
| Steps exceeded | `Running` → `ToolCall` | No further tool calls permitted | Agent responds in text-only mode |
| Permission denied | `ToolCall` → `Denied` | Error event emitted | Session enters `Error`; user sees denial reason |
| kc-main cancelled | Any subagent `Running` | Parent context cancelled | All child task() calls receive cancellation signal |

### Flowchart

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 680 500" width="680" height="500" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="11">

  <rect width="680" height="500" fill="#0f1117"/>

  <text x="340" y="24" text-anchor="middle" fill="#aaa" font-size="13" font-weight="bold">Emergency Stop — Decision Flowchart</text>

  <!-- START -->
  <ellipse cx="340" cy="56" rx="70" ry="20" fill="#6C63FF"/>
  <text x="340" y="61" text-anchor="middle" fill="#fff" font-size="11" font-weight="bold">Agent Running</text>

  <!-- Arrow down -->
  <line x1="340" y1="76" x2="340" y2="100" stroke="#555" stroke-width="1.5" marker-end="url(#arr)"/>

  <!-- Decision: Stop signal? -->
  <polygon points="340,100 430,130 340,160 250,130" fill="#2C3E50" stroke="#45B7D1" stroke-width="1.5"/>
  <text x="340" y="127" text-anchor="middle" fill="#45B7D1" font-size="10">Stop signal</text>
  <text x="340" y="141" text-anchor="middle" fill="#45B7D1" font-size="10">received?</text>

  <!-- NO branch → check steps -->
  <text x="450" y="126" fill="#96CEB4" font-size="9">NO</text>
  <line x1="430" y1="130" x2="510" y2="130" stroke="#555" stroke-width="1.5" marker-end="url(#arr)"/>
  <polygon points="510,130 575,155 510,180 445,155" fill="#2C3E50" stroke="#F39C12" stroke-width="1.5"/>
  <text x="510" y="151" text-anchor="middle" fill="#F39C12" font-size="10">Steps</text>
  <text x="510" y="165" text-anchor="middle" fill="#F39C12" font-size="10">exceeded?</text>

  <!-- YES → steps exceeded → text-only -->
  <text x="612" y="151" fill="#96CEB4" font-size="9">YES</text>
  <line x1="575" y1="155" x2="620" y2="155" stroke="#555" stroke-width="1.5" marker-end="url(#arr)"/>
  <rect x="620" y="140" width="50" height="30" rx="4" fill="#F39C12" opacity="0.8"/>
  <text x="645" y="153" text-anchor="middle" fill="#fff" font-size="9">Text-only</text>
  <text x="645" y="164" text-anchor="middle" fill="#fff" font-size="9">fallback</text>

  <!-- NO from steps → continue running -->
  <text x="508" y="195" fill="#96CEB4" font-size="9">NO</text>
  <line x1="510" y1="180" x2="510" y2="220" stroke="#555" stroke-width="1.5" marker-end="url(#arr)"/>
  <rect x="470" y="220" width="80" height="24" rx="4" fill="#27AE60" opacity="0.7"/>
  <text x="510" y="236" text-anchor="middle" fill="#fff" font-size="10">Continue</text>

  <!-- YES stop signal received -->
  <text x="338" y="175" fill="#E74C3C" font-size="9">YES</text>
  <line x1="340" y1="160" x2="340" y2="190" stroke="#555" stroke-width="1.5" marker-end="url(#arr)"/>

  <!-- Decision: subagent or main? -->
  <polygon points="340,190 430,218 340,246 250,218" fill="#2C3E50" stroke="#E74C3C" stroke-width="1.5"/>
  <text x="340" y="215" text-anchor="middle" fill="#E74C3C" font-size="10">Is kc-main</text>
  <text x="340" y="229" text-anchor="middle" fill="#E74C3C" font-size="10">stopped?</text>

  <!-- YES → cancel all children -->
  <text x="338" y="261" fill="#E74C3C" font-size="9">YES</text>
  <line x1="340" y1="246" x2="340" y2="274" stroke="#555" stroke-width="1.5" marker-end="url(#arr)"/>
  <rect x="280" y="274" width="120" height="28" rx="4" fill="#E74C3C" opacity="0.85"/>
  <text x="340" y="290" text-anchor="middle" fill="#fff" font-size="10">Cancel all</text>
  <text x="340" y="303" text-anchor="middle" fill="#fff" font-size="10">child task() calls</text>

  <line x1="340" y1="302" x2="340" y2="326" stroke="#555" stroke-width="1.5" marker-end="url(#arr)"/>
  <rect x="280" y="326" width="120" height="24" rx="4" fill="#8E44AD" opacity="0.85"/>
  <text x="340" y="342" text-anchor="middle" fill="#fff" font-size="10">Close SSE streams</text>

  <line x1="340" y1="350" x2="340" y2="374" stroke="#555" stroke-width="1.5" marker-end="url(#arr)"/>
  <rect x="280" y="374" width="120" height="24" rx="4" fill="#2C3E50" stroke="#6C63FF" stroke-width="1.5"/>
  <text x="340" y="390" text-anchor="middle" fill="#fff" font-size="10">Emit cancelSession</text>

  <line x1="340" y1="398" x2="340" y2="420" stroke="#555" stroke-width="1.5" marker-end="url(#arr)"/>
  <ellipse cx="340" cy="440" rx="70" ry="20" fill="#333" stroke="#E74C3C" stroke-width="1.5"/>
  <text x="340" y="445" text-anchor="middle" fill="#E74C3C" font-size="11" font-weight="bold">Session Idle</text>

  <!-- NO → only subagent stopped -->
  <text x="250" y="214" fill="#96CEB4" font-size="9">NO</text>
  <line x1="250" y1="218" x2="150" y2="218" stroke="#555" stroke-width="1.5" marker-end="url(#arr)"/>
  <rect x="60" y="204" width="90" height="28" rx="4" fill="#96CEB4" opacity="0.85"/>
  <text x="105" y="219" text-anchor="middle" fill="#222" font-size="10">Abort subagent</text>
  <text x="105" y="231" text-anchor="middle" fill="#222" font-size="10">tool call only</text>

  <line x1="105" y1="232" x2="105" y2="260" stroke="#555" stroke-width="1.5" marker-end="url(#arr)"/>
  <rect x="60" y="260" width="90" height="28" rx="4" fill="#45B7D1" opacity="0.8"/>
  <text x="105" y="275" text-anchor="middle" fill="#fff" font-size="10">Return error</text>
  <text x="105" y="287" text-anchor="middle" fill="#fff" font-size="10">to kc-main</text>

  <line x1="105" y1="288" x2="105" y2="316" stroke="#555" stroke-width="1.5" marker-end="url(#arr)"/>
  <rect x="55" y="316" width="100" height="28" rx="4" fill="#2C3E50" stroke="#45B7D1" stroke-width="1.5"/>
  <text x="105" y="331" text-anchor="middle" fill="#fff" font-size="10">kc-main decides</text>
  <text x="105" y="343" text-anchor="middle" fill="#fff" font-size="10">retry / skip</text>

  <!-- Arrow marker def -->
  <defs>
    <marker id="arr" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
      <path d="M0,0 L0,6 L8,3 z" fill="#555"/>
    </marker>
  </defs>

</svg>
```

### Key Behaviors

1. **Graceful teardown** — When `kc-main` receives a stop signal, it propagates a cancellation token to all active `task()` calls before closing. Subagents currently executing a tool call will complete that call then abort rather than being killed mid-write.

2. **Partial-work safety** — File edits already committed to disk are not rolled back on E-Stop. The session records the last completed step; the user may resume manually.

3. **Step-budget soft-stop** — Reaching the `steps` limit is not an error condition. The agent transitions to text-only response mode and informs the user that tool-use has been exhausted for this turn. A new message resets the counter.

4. **Permission denial hard-stop** — A `deny` permission result immediately terminates the current tool chain and emits an `Error` event to the session. kc-main treats this as a terminal error for the delegated subtask.

5. **Re-entry** — After E-Stop, the session returns to `Idle`. The user may send a new message to resume work. kc-main is re-initialized with a fresh steps counter; subagents that were aborted are treated as timed-out and may be re-dispatched.

---

## Appendix: Agent Color Reference

| Agent | Hex Color | Category |
|-------|-----------|----------|
| kc-main | `#6C63FF` | Orchestration |
| kc-01 | `#FF6B6B` | Orchestration |
| kc-02 | `#4ECDC4` | Analysis |
| kc-03 | `#45B7D1` | Analysis |
| kc-04 | `#96CEB4` | Quality |
| kc-05 | `#FFEAA7` | Analysis |
| kc-06 | `#DDA0DD` | Generation |
| kc-07 | `#FFB6C1` | Quality |
| kc-08 | `#98D8C8` | Quality |
| kc-09 | `#F7DC6F` | Quality |
| kc-10 | `#BB8FCE` | Quality |
| kc-11 | `#85C1E2` | Generation |
| kc-12 | `#E74C3C` | Quality |
| kc-13 | `#F39C12` | Analysis |
| kc-14 | `#16A085` | Specialist |
| kc-15 | `#8E44AD` | Specialist |
| kc-16 | `#27AE60` | Specialist |
| kc-17 | `#E67E22` | Specialist |
| kc-18 | `#2C3E50` | Specialist |
| kc-19 | `#34495E` | Analysis |
| kc-20 | `#9B59B6` | Specialist |
