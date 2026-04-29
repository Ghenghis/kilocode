# KiloCode 21-Agent System — E2E Test Report

**Date:** 2026-04-23  
**Version:** EVO2 (v2.0.0 pipeline)  
**Reporter:** Cascade / DaveAI  

---

## 1. Overview

This report documents the end-to-end integration of the KiloCode 21-agent system across all deployment surfaces. The agent definitions were cherry-picked from the official KiloCode source at https://github.com/Kilo-Org/kilocode.

### Agent Architecture
| Agent | Role |
|-------|------|
| kc-main | Primary coordinator — delegates to specialists |
| kc-01 | Integration Lead |
| kc-02 | Creative Brainstormer |
| kc-03 | System Architect |
| kc-04 | Bug Triage Specialist |
| kc-05 | Root Cause Analyst |
| kc-06 | Code Generator |
| kc-07 | Code Reviewer |
| kc-08 | Test Writer |
| kc-09 | Debugger |
| kc-10 | Refactorer |
| kc-11 | Documenter |
| kc-12 | Security Auditor |
| kc-13 | Performance Analyst |
| kc-14 | API Integrator |
| kc-15 | Database Specialist |
| kc-16 | DevOps Engineer |
| kc-17 | Frontend Specialist |
| kc-18 | Backend Specialist |
| kc-19 | Research Analyst |
| kc-20 | Prompt Engineer |

---

## 2. Deployment Surfaces

### 2.1 Open WebUI Pipeline (hermes.daveai.tech)
- **File:** `deploy/pipelines/kilocode_agents_pipeline.py`
- **Status:** ✅ DEPLOYED & VERIFIED
- **Container:** `pipelines` on VPS 187.77.30.206
- **Pipeline loaded:** `INFO:root:Loaded module: kilocode_agents_pipeline`

### 2.2 Hub v2 Backend
- **File:** `src/webui/hub/routers/agents.py`
- **Status:** ✅ UPDATED
- **21 agents registered** with proper names, roles, colors

### 2.3 KiloCode VS Code Extension
- **Version:** 7.2.21-EVO2
- **Status:** ✅ BUILT & INSTALLED
- **20 agents embedded** in `patchAgents()` function

### 2.4 Agent .md Files
- **Locations:** `G:\Github\kilocode-Azure2\.kilo\agents\` and `C:\Users\Admin\.kilo\agents\`
- **Status:** ✅ SYNCED

---

## 3. Provider Configuration

### Primary Provider: MiniMax
| Setting | Value |
|---------|-------|
| Model | `MiniMax-M2.7-highspeed` (was `MiniMax-Text-01`) |
| Base URL | `https://api.minimaxi.chat/v1` |
| API Key | `sk-api-...` (from `.env.secret`) |
| Status | ⚠️ **Insufficient balance** (HTTP 429) |

> **Note:** MiniMax renamed models in 2026. `MiniMax-Text-01` no longer exists.  
> Current models: `MiniMax-M2.7`, `MiniMax-M2.7-highspeed`, `MiniMax-M2.5`, `MiniMax-M2.5-highspeed`  
> Token plan: https://platform.minimax.io/user-center/payment/token-plan  
> Anthropic-compatible endpoint also available: `https://api.minimax.io/anthropic`

### Fallback Provider: LM Studio
| Setting | Value |
|---------|-------|
| Base URL | `http://100.117.190.97:1234/v1` |
| Model | `default` (auto-selects loaded model) |
| Status | ✅ **OPERATIONAL** |

---

## 4. E2E Test Results

### Test 1: Agent Prefix Routing (`@kc-09`)
- **Input:** `@kc-09 I have a null pointer exception in my Java app`
- **Expected:** Route to kc-09 (Debugger)
- **Result:** ✅ **PASS**
- **Agent:** `[Debugger — kc-09] (LM Studio default)`
- **Response:** Systematic debugging methodology — 7 NPE hypotheses, diagnostic patch template
- **Provider:** LM Studio fallback (MiniMax returned 429)

### Test 2: Keyword Routing ("security vulnerabilities")
- **Input:** `Review this code for security vulnerabilities`
- **Expected:** Route to kc-12 (Security Auditor)
- **Result:** ✅ **PASS**
- **Agent:** `[Security Auditor — kc-12] (LM Studio default)`
- **Response:** OWASP-aligned security audit framework — injection, access control, crypto, data exposure

### Test 3: Pipeline Load
- **Expected:** All 21 agents loaded, pipeline starts without errors
- **Result:** ✅ **PASS**
- **Log:** `INFO:root:Updated valves for module: kilocode_agents_pipeline`

### Test 4: Valve Configuration
- **Expected:** API keys, model, URLs configurable via valves
- **Result:** ✅ **PASS**
- **Valves set:** MiniMax key, base URL, model, LM Studio fallback, temperature, max_tokens

### Test 5: Provider Failover
- **Expected:** If MiniMax fails, auto-fallback to LM Studio
- **Result:** ✅ **PASS**
- **MiniMax:** Failed (429 insufficient balance)
- **LM Studio:** Took over seamlessly — no user-visible error

### Test 6: Hub v2 Agent Registry
- **Expected:** 21 agents with correct metadata
- **Result:** ✅ **PASS**
- **Model default:** `MiniMax-M2.7-highspeed`

---

## 5. Known Issues

| # | Issue | Severity | Fix |
|---|-------|----------|-----|
| 1 | MiniMax `sk-api-...` key has insufficient balance | Medium | Top up at https://platform.minimax.io/user-center/payment/token-plan |
| 2 | Old MiniMax `sk-cp-...` key is invalid (401) | Low | Retired — replaced by `sk-api-...` key |
| 3 | MiniMax model `MiniMax-Text-01` no longer exists | Fixed | Updated to `MiniMax-M2.7-highspeed` |
| 4 | API base was `api.minimax.chat` | Fixed | Updated to `api.minimaxi.chat` |

---

## 6. Source Files

| File | Purpose |
|------|---------|
| `deploy/pipelines/kilocode_agents_pipeline.py` | Open WebUI pipeline (21 agents + dual provider) |
| `src/webui/hub/routers/agents.py` | Hub v2 backend agent registry |
| `packages/opencode/src/agent/agent.ts` | KiloCode native agent definitions (source) |
| `packages/opencode/src/kilocode/agent/index.ts` | KiloCode patchAgents() — 20 subagents (source) |
| `packages/opencode/src/agent/prompt/*.txt` | Agent system prompts (source) |

---

## 7. Action Items

- [ ] Top up MiniMax token balance to re-enable primary cloud provider
- [ ] Test all 21 agents individually after MiniMax is funded
- [ ] Add streaming support to pipeline for better UX with long responses
- [ ] Consider adding SiliconFlow as a third fallback provider

---

## 8. Summary

| Metric | Value |
|--------|-------|
| **Total agents** | 21 (kc-main + kc-01…kc-20) |
| **Deployment surfaces** | 4 (Open WebUI, Hub v2, VSIX, .md files) |
| **Tests passed** | 6/6 |
| **Primary provider** | MiniMax M2.7-highspeed (needs balance top-up) |
| **Active provider** | LM Studio (100.117.190.97:1234) — fully operational |
| **Pipeline version** | 2.0.0 (EVO2) |
| **Routing methods** | @prefix, keyword match, fallback to kc-main |

**Overall Status: ✅ DEPLOYED & OPERATIONAL** (via LM Studio fallback)
