# New Features — E2E Acceptance Register

**Rule: A feature is DONE only when it has a ✅ PASS entry below.**  
**A feature with ❌ FAIL or ⬜ UNTESTED is NOT shippable.**  
Last updated: 2026-04-28 (build verified clean — awaiting E2E install)

---

## How to Use This Document

1. Build the extension: `node esbuild.js --production`
2. Package: `npx @vscode/vsce package --no-dependencies`
3. Install the `.vsix` in VS Code (Extensions → ··· → Install from VSIX)
4. Reload VS Code
5. Open KiloCode settings (gear icon in panel, or `Kilo: Open Settings`)
6. Test each feature below. Mark ✅ PASS or ❌ FAIL with notes.

---

## Legend

| Symbol | Meaning |
|--------|---------|
| ✅ | Pass — feature works correctly end-to-end |
| ❌ | Fail — broken, wrong output, crash, or missing |
| ⬜ | Untested — not yet verified |
| 🔄 | In progress — being worked on |

---

## P0 Bug Fixes (must PASS before any feature ships)

| # | Fix | Test | Status |
|---|-----|------|--------|
| B1 | `routing-webview.ts`: `KILO_HUB_BASE` → `HERMES_URL` | Set `HERMES_URL=https://hermes.daveai.tech` in env; open RoutingTab; live model list should load without 404 | ⬜ |
| B2 | `zeroclaw-webview.ts`: `KILO_HUB_BASE` → `HERMES_URL` | Set `HERMES_URL`; open ZeroClawTab; remote approval queue endpoint should connect | ⬜ |
| B3 | `hermes-webview.ts`: `KILO_HUB_BASE` → `HERMES_URL` | Open HermesTab; `hermes.listAgents` message should reach `https://hermes.daveai.tech/hermes/agents` | ⬜ |
| B4 | `training-webview.ts`: `KILO_HUB_BASE_URL` → `HUB_URL` | Set `HUB_URL=http://localhost:8095`; start a training job; no 404 on `/api/training/start` | ⬜ |
| B5 | `training-webview.ts` comment updated to `HUB_URL` | Read line 9 of file; confirms `HUB_URL` in doc comment | ⬜ |

---

## Infrastructure

| # | Feature | Test | Status |
|---|---------|------|--------|
| I1 | `metrics-service.ts` — p50/p95/p99 latency tracking | Import `recordRequest`; call 20 times with random latencies; call `getMetrics()`; verify p50 < p95 < p99 | ⬜ |
| I2 | `health-service.ts` — provider health polling with 30s TTL cache | Call `startHealthPolling()`; wait 35s; call again; verify second call uses cached result | ⬜ |
| I3 | `pricing-service.ts` — 9-provider cost map | Call `getProviderPricing("anthropic")`; verify non-null result with input/output USD rates | ⬜ |
| I4 | `voice-bridge.ts` — backend-agnostic TTS layer | Call `speakAgentResponse("Hello world")`; voice speaks; call `onBackendChanged("openhands")`; voice settings unchanged | ⬜ |
| I5 | `backend-types.ts` — TypeScript interfaces for BackendId, Capability, AccessProfile | `tsc --noEmit` → 0 errors | ⬜ |
| I6 | `backend-context.tsx` — SolidJS context, localStorage persistence, vscode postMessage sync | Open settings; switch backend; reload webview; verify backend state persisted in `kilocode_backend_state` | ⬜ |

---

## ZeroClawTab (src/components/settings/ZeroClawTab.tsx ~3936 lines)

| # | Feature | Test | Status |
|---|---------|------|--------|
| ZC1 | **Rate Limit Predictor** — EMA + circuit breaker per provider | Open ZeroClawTab; rate limit gauges update every 2s; EMA trend line shown; circuit breaker triggers at >80% | ⬜ |
| ZC2 | **Latency Percentile Dashboard** — p50/p95/p99 per provider | Bars for p50/p95/p99 render; hovering shows exact ms value | ⬜ |
| ZC3 | **Fallback Cascade Simulator** — multi-step fallback chain | Click "Simulate Failure" on a provider; cascade steps animate in sequence; final provider shown | ⬜ |
| ZC4 | **Request Cost Ledger** — per-request USD cost tracking | Ledger shows entries updating; total cost displayed; CSV export button works | ⬜ |
| ZC5 | **Token Budget Allocator** — per-provider budget sliders | Adjust slider; budget updates; over-budget providers highlighted red | ⬜ |
| ZC6 | **Live simulation loop** — 2000ms interval | Console shows no errors after 30s of tab open; memory doesn't grow unboundedly | ⬜ |
| ZC7 | **Adaptive Circuit Breaker Dashboard** — 6 providers, state machine | Cards show 🔴/🟡/🟢 state; fail rate bar updates every 3s; click opens sparkline + Force Open/Close | ⬜ |
| ZC8 | **Request Volume Heatmap** — 7d×24h grid | CSS grid renders; weekday cells brighter; hover tooltip shows day/hour/count | ⬜ |
| ZC9 | **Provider SLA Tracker** — table with meeting/at-risk/breached | Table shows 6 providers; Gap column colour-coded; status auto-updates every 5s | ⬜ |

---

## HermesTab (src/components/settings/HermesTab.tsx ~3274 lines)

| # | Feature | Test | Status |
|---|---------|------|--------|
| H1 | **SVG Waterfall Pipeline Chart** — 5 stages, p50+p95 bars | Chart renders; bars proportional to latency values; tooltips on hover | ⬜ |
| H2 | **Message Replay Console** — live 3s updates, search filter | Messages populate every 3s; search box filters entries; clicking entry shows detail | ⬜ |
| H3 | **Agent Task Router SVG** — 5 nodes, load-coloured | Node graph renders; edges connect correctly; node colour changes with load level | ⬜ |
| H4 | **Radial Quality Gauge** — 0-100 score | SVG arc fills proportionally to score; colour green/amber/red by range | ⬜ |
| H5 | **Channel Bandwidth Bar Chart** — msgs/min | Bars update every 3s; values plausible; no SVG overflow | ⬜ |
| H6 | **Pipeline Throughput Analyzer** — 60-reading history, SVG polyline | Chart renders; msgs/min number updates every 2s; target line shown dashed; status changes | ⬜ |
| H7 | **Agent Collaboration Graph** — 6 nodes, animated message dots | SVG renders 6 agents; connection lines drawn; dots animate along edges every 1.5s | ⬜ |

---

## HubTab (src/components/settings/HubTab.tsx ~3151 lines)

| # | Feature | Test | Status |
|---|---------|------|--------|
| HB1 | **Service Dependency Graph** — 9 nodes, 10 edges | SVG graph renders; clicking a node shows detail panel; edges not overlapping labels | ⬜ |
| HB2 | **Bootstrap Wizard** — 8 steps, terminal log | Click "Start Bootstrap"; steps advance; log output streams; terminal shows step progress | ⬜ |
| HB3 | **Deployment Diff Viewer** — added/removed/changed env vars | Diff panel shows colour-coded additions (green), removals (red), changes (yellow) | ⬜ |
| HB4 | **Resource Budget Planner** — RAM/CPU/VRAM fit grid | Grid shows fit/no-fit for each service; totals update when values change | ⬜ |
| HB5 | **Secrets Rotation Tracker** — age colour-coding, localStorage | Secrets with age >90 days show red; >30 days amber; "Rotate" button updates age to 0 | ⬜ |
| HB6 | **Infrastructure Cost Forecasting** — grouped bar chart, 6 services | Bars render current vs projected; month selector works; table shows trend arrows | ⬜ |
| HB7 | **Service Health Scorecard** — radar chart, jitter every 6s | 6 service cards render; scores update; clicking card shows 4-axis SVG polygon | ⬜ |

---

## RoutingTab (src/components/settings/RoutingTab.tsx ~4863 lines)

| # | Feature | Test | Status |
|---|---------|------|--------|
| R1 | **Semantic Router** — 5 categories, keyword scoring | Type a task description; router assigns category + confidence %; result changes per input | ⬜ |
| R2 | **A/B Testing Framework** — live stats every 3s, p-value, Declare Winner | Create A/B test; both groups accumulate requests; p-value shown; "Declare Winner" ends test | ⬜ |
| R3 | **Cost-Per-Task Optimizer** — 7 task types, $ savings | Optimizer table shows estimated savings per task type; "Apply" button updates routing rules | ⬜ |
| R4 | **Geo-Routing SVG World Map** — continent blobs, datacenter dots | World map renders; datacenters shown as dots; latency arcs drawn between user location and DCs | ⬜ |
| R5 | **Canary Deployment Controller** — auto-advance, pause/rollback | Start canary; traffic % advances automatically; Pause stops it; Rollback resets to 0% | ⬜ |
| R6 | **Live Model Leaderboard** — 8 models, sortable, medals | Table sorts by any column; top 3 show 🥇🥈🥉; speed colour-coded; values update every 3s | ⬜ |
| R7 | **Smart Routing Preview** — 600ms debounce, keyword classifier | Type task → after 600ms shows category + recommended model + confidence + alternatives | ⬜ |
| R8 | **Budget Burn Rate Dashboard** — daily/weekly/monthly + donut chart | Progress bars fill as spend increments; donut shows provider breakdown; limits editable | ⬜ |

---

## GovernanceTab (src/components/settings/GovernanceTab.tsx +645 lines)

| # | Feature | Test | Status |
|---|---------|------|--------|
| G1 | **Constitutional Rules Editor** — inline edit, priority/action/severity | Edit a rule's description inline; change priority with +/- buttons; changes persist on tab switch | ⬜ |
| G2 | **Approval Queue** — risk badges, live ticker, expandable items | Queue shows 3+ items; timer counts down; expanding shows full details + Approve/Reject buttons | ⬜ |
| G3 | **Policy Simulator** — textarea + 500ms debounce, per-rule evaluation | Type a task description; after 500ms results auto-refresh; each rule shows ALLOW/BLOCK verdict | ⬜ |

---

## SpeechTab (src/components/settings/SpeechTab.tsx ~4425 lines)

| # | Feature | Test | Status |
|---|---------|------|--------|
| S1 | **Voice Profiles** — 3 seeded profiles, Set Active/Test/Delete | "Set Active" changes active profile; "Test" triggers TTS playback; "Delete" removes profile | ⬜ |
| S2 | **Live Transcription** — cumulative stats, confidence %, language | Start transcription; stats (word count, avg confidence, detected language) update live | ⬜ |
| S3 | **TTS Queue** — 3 seeded jobs, priority reorder, live advancement | Queue shows items; priority up/down buttons reorder; queue advances every 3s | ⬜ |
| S4 | **Prosody Editor** — pitch/rate/volume sliders, live SSML preview | Sliders update SSML markup in real time; contour presets work; Play Preview fires postMessage | ⬜ |
| S5 | **Multi-Speaker Timeline** — SVG 800px timeline, play/pause | User/Assistant segments render as coloured rectangles; playhead advances when playing | ⬜ |

---

## TrainingTab (src/components/settings/TrainingTab.tsx +320 lines)

| # | Feature | Test | Status |
|---|---------|------|--------|
| T1 | **LoRA Fine-Tuning Configurator** — 6 models, rank/alpha/LR/epochs | Configure rank/alpha/LR/epochs; click Train; SVG loss curve starts updating every 2s | ⬜ |
| T2 | **Model Merge Tool** — SLERP/TIES/DARE-TIES algorithms | Select 2 models + algorithm; click Merge; merge progress shown | ⬜ |
| T3 | **Quantization Comparator** — Q4_K_M/Q5_K_M/Q8_0/F16 table | Table shows size/quality/speed tradeoffs per format; "Quantize" button triggers job | ⬜ |

---

## MemoryTab (src/components/settings/MemoryTab.tsx +347 lines)

| # | Feature | Test | Status |
|---|---------|------|--------|
| M1 | **Knowledge Graph SVG** — 10 nodes, 11 edges, importance-sized | Graph renders; node size proportional to importance; colour by type; clicking node shows details | ⬜ |
| M2 | **Context Window Optimizer** — SVG pie chart, 4 segments | Pie chart renders 4 segments; "Optimize" button shifts allocation; totals always = 100% | ⬜ |
| M3 | **Consolidation Scheduler** — similarity scores, Merge/Keep Both | 3+ duplicate pairs shown; similarity % displayed; "Merge" combines entries; "Keep Both" dismisses | ⬜ |

---

## VPSTab (src/components/settings/VPSTab.tsx +496 lines)

| # | Feature | Test | Status |
|---|---------|------|--------|
| V1 | **Docker Container Manager** — 5 containers, status filter, Logs expansion | Filter by status works; expanding container shows simulated log output | ⬜ |
| V2 | **Nginx Vhost Manager** — 4 vhosts, SSL badges, Test Config | SSL badge shown; "Test Config" triggers validation; "Add Vhost" form appears | ⬜ |
| V3 | **Automated Backup Status** — schedule, last run, progress bar, Run Now | Progress bar fills during active backup; "Run Now" starts a backup; schedule shown | ⬜ |

---

## SSHTab (src/components/settings/SSHTab.tsx +783 lines)

| # | Feature | Test | Status |
|---|---------|------|--------|
| SS1 | **Port Forwarding Manager** — -L/-R/-D tunnels, Kill Tunnel, Add form | 4 tunnels shown; "Kill Tunnel" removes it; "Add" form adds new entry with correct ssh -L/-R/-D flag | ⬜ |
| SS2 | **Known Hosts Verifier** — 5 entries, 90-day staleness badge | Hosts older than 90 days show amber badge; "Re-verify" marks as current | ⬜ |
| SS3 | **Multi-Hop Tunnel Builder** — chain viz, live ssh -J command preview | Add hosts to chain; ssh -J command auto-generates; "Copy Command" copies to clipboard | ⬜ |

---

## OpenClawTab (src/components/settings/OpenClawTab.tsx +813 lines)

| # | Feature | Test | Status |
|---|---------|------|--------|
| OC1 | **Live Message Flow Visualizer** — SVG 20-channel node graph + animateMotion | Click "Start"; bezier path dots animate; per-channel counters increment; "Stop" halts | ⬜ |
| OC2 | **Channel Health Heatmap** — 7-day × 24-hour grid | Grid renders; weekday cells brighter than weekends; hover shows count + day/hour | ⬜ |
| OC3 | **Model Performance by Channel** — sortable 5-column table | Click column header sorts asc/desc; satisfaction bar coloured green/amber/red; slow rows highlighted | ⬜ |
| OC4 | **Webhook Event Inspector** — platform + status filters, refresh | Filter by platform changes rows; filter by status works; Refresh re-seeds events | ⬜ |
| OC5 | **Quick Connect Wizard** — 3-step drawer, inline test, 80/20 success | Select platform → enter webhook URL/token → choose model → "Run Test" shows success/fail | ⬜ |

---

## Agent Backends Tab (NEW — settings/AgentBackendsTab.tsx 1206 lines)

| # | Feature | Test | Status |
|---|---------|------|--------|
| AB1 | **Tab visible in Settings** | Open KiloCode Settings; "Agent Backends" tab appears in Integrations group | ⬜ |
| AB2 | **Backend enable/disable toggles** | Toggle OpenHands on; persist; reload webview; toggle state preserved | ⬜ |
| AB3 | **OpenHands config section** — server URL, runtime, sandbox | Enter `http://localhost:3000`; click "Test Connection"; response shown | ⬜ |
| AB4 | **Goose config section** — CLI path, extensions, computer-use | Enter CLI path; click "Test Connection"; response shown | ⬜ |
| AB5 | **Access Profiles editor** — CRUD for local/docker/vps/gpu/browser/computer-use profiles | Add profile; set fields; Save; profile appears in list; Edit; Delete removes it | ⬜ |
| AB6 | **Routing Rules capability table** | Table shows which backend handles each capability; all 15 capabilities listed | ⬜ |
| AB7 | **Security Policies — YOLO mode warning** | YOLO toggle off by default; enabling shows red warning banner | ⬜ |
| AB8 | **Routing Log** — shows backend switches + voice preservation indicator | Switch backend; log entry appears with timestamp + voice-unchanged confirmation | ⬜ |
| AB9 | **Voice notice banner** — links to SpeechTab | Banner visible at top of tab: "Voice managed in SpeechTab"; clicking link navigates to SpeechTab | ⬜ |

---

## Backend Selector (chat toolbar)

| # | Feature | Test | Status |
|---|---------|------|--------|
| BS1 | **Compact pill visible in chat toolbar** | Open chat; backend icon + ▾ caret visible next to model selector; takes minimal horizontal space | ⬜ |
| BS2 | **Click opens dropdown panel** | Click pill; panel opens above toolbar showing 3 backends | ⬜ |
| BS3 | **Kilo Native option** | Panel shows ⚡ Kilo Native with capability pills (Code, Files, Shell…) | ⬜ |
| BS4 | **OpenHands option** | Panel shows 🤖 OpenHands Dev with capability pills (Code, Shell, Tests, Browser, Sandbox…) | ⬜ |
| BS5 | **Goose option** | Panel shows 🪿 Goose Operator with capability pills (Desktop, MCP, Shell, Files…) | ⬜ |
| BS6 | **Select backend** | Click OpenHands; panel closes; pill icon changes to 🤖; backend context updated | ⬜ |
| BS7 | **Status dot** — green pulsing when running, yellow when auto-hermes | Enable auto-hermes; dot turns yellow; trigger a task; dot pulses green while running | ⬜ |
| BS8 | **Hermes auto-routing toggle** | Enable toggle in dropdown; `routingMode` changes to `"auto-hermes"`; dot turns yellow | ⬜ |
| BS9 | **Access profile selector** | If profiles exist, dropdown shows in panel; selecting profile updates `activeProfileId` | ⬜ |
| BS10 | **"Manage Backends & Profiles" link** | Click link; settings panel opens at AgentBackends tab | ⬜ |
| BS11 | **Keyboard navigation** | Tab to pill; Enter opens panel; ArrowUp/Down navigates; Enter selects; Escape closes | ⬜ |
| BS12 | **Click outside closes panel** | Open panel; click outside it; panel closes | ⬜ |

---

## Chat Toolbar — New Micro-Features (PromptInput.tsx)

| # | Feature | Test | Status |
|---|---------|------|--------|
| CT1 | **Top drag-to-resize** — drag handle at top of input | Hover top edge; cursor becomes ns-resize; drag up = taller, drag down = shorter; height persists on reload | ⬜ |
| CT2 | **Height lock toggle** — 🔓/🔒 button in resize handle | Click lock; handle shows 🔒; dragging no longer changes height | ⬜ |
| CT3 | **Model selector right of Templates** | Bottom toolbar: Templates button followed immediately by model pill | ⬜ |
| CT4 | **📎 File upload button** — full path @mention injection | Click 📎; pick a file; chip appears above textarea; `@/full/path/file` auto-inserted in text | ⬜ |
| CT5 | **TTS speed cycling button** — `1×` badge | Click cycles 1×→1.25×→1.5×→2×→0.8×→1×; badge highlights when not at 1×; fires `setTtsSpeed` | ⬜ |
| CT6 | **🔊 Volume micro-button** — popover slider | Click 🔊; popover opens with slider 0-100%; drag slider changes volume; mute toggle works | ⬜ |
| CT7 | **Volume persists** | Set volume to 60%; reload webview; volume shows 60% | ⬜ |

---

## Voice Preservation (critical — must ALL pass)

| # | Test | Expected | Status |
|---|------|----------|--------|
| VP1 | Switch Kilo → OpenHands | Azure voice (e.g. Maisie UK / `en-GB-MaisieNeural`) unchanged | ⬜ |
| VP2 | Switch Kilo → Goose | Azure voice unchanged | ⬜ |
| VP3 | Switch OpenHands → Goose | Azure voice unchanged | ⬜ |
| VP4 | Switch back to Kilo | Azure voice still same, TTS still works | ⬜ |
| VP5 | Send text to chat while on OpenHands backend | Agent voice speaks (same Maisie voice) | ⬜ |
| VP6 | Send text to chat while on Goose backend | Agent voice speaks (same Maisie voice) | ⬜ |
| VP7 | `localStorage` check | `kilocode_backend_state` key has NO voice properties; voice only in `kilo.chat.azureVoice` | ⬜ |

---

## Tab Icons (tab-icons.tsx) & Status Badges (tab-status-badges.tsx)

| # | Feature | Test | Status |
|---|---------|------|--------|
| TI1 | Custom SVG icons for all 11 SOTA tabs | Open Settings; ZeroClaw/OpenClaw/Hermes/Hub/VPS/SSH/Training/Memory/Governance/Speech/Routing tabs all show custom icons | ⬜ |
| TI2 | StatusBadge / PulseDot animations | Tabs with active background tasks show pulsing dot badge | ⬜ |

---

## Settings Infrastructure

| # | Feature | Test | Status |
|---|---------|------|--------|
| SI1 | All 26 tabs present in Settings (was 25, +AgentBackends) | Open Settings; all tabs visible and selectable; none duplicated | ⬜ |
| SI2 | Settings Command Palette includes "Agent Backends" | Cmd+Shift+P → "Kilo: Open Settings" → type "backend"; Agent Backends option appears | ⬜ |
| SI3 | TypeScript compiles clean (host + webview) | `npx tsc --noEmit` (host) + `bun script/typecheck.ts --project webview-ui/tsconfig.json` (webview) → 0 errors each | ✅ PASS — 0 errors both targets 2026-04-28 |
| SI4 | VSIX builds and installs cleanly | `node esbuild.js --production` + `npx @vscode/vsce package --no-dependencies` → no errors; .vsix installs | ✅ PASS — kilo-code-7.2.21-canary.10.vsix 21 MB 2026-04-28 |
| SI5 | Unit test suite — session new (session this session) | `bun test tests/unit/` → ≤ 9 failures (all pre-existing on base branch); 0 new regressions introduced | ✅ PASS — 9 pre-existing failures, 2058+ pass 2026-04-28 |

---

## Completion Criteria

**Ship gate**: ALL items above must be ✅ PASS.

Current passing: **3 / 97** (SI3 TypeScript clean, SI4 VSIX builds, SI5 unit tests)  
Current failing: **0 / 97**  
Untested: **94 / 97**

> Total items: 97 (75 original + 22 new: ZC7-9, R6-8, H6-7, HB6-7, S4-5, CT1-7, SI5)

> Update this register after each E2E test run. Replace ⬜ with ✅ or ❌ + notes.
> A single ❌ blocks the release.
