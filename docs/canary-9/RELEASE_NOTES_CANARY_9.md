# 🚀 KiloCode MAOS Edition — Release Notes

## Version 7.2.21-canary.9

**Release Date:** 2026-04-27
**Publisher:** kilocode
**VS Code Engine:** ^1.105.1
**License:** MIT
**Repository:** https://github.com/Kilo-Org/kilocode

---

## 📋 Summary Table

| Area | Changes | Impact |
|------|---------|--------|
| 🔧 Service Worker / Webview | Auto-clear cache, fast-fail probe, exponential backoff, deduplicated toolbar | Eliminates stale-UI reloads; ~50 ms faster SW detection |
| 🪪 Extension Identity | Resolved dual-ID conflict (`kilocode.kilo-code` vs `kilocode.kilocode-maos`) | Prevents activation race / duplicate sidebar |
| ⚙️ Settings Infrastructure | Lazy-loading for all 24 tabs, tab groups, Ctrl+K palette, Ctrl+S save, nav guard | 24-tab settings panel loads on-demand; no blank-screen flash |
| 🧩 Settings Rows & UX | Help tooltips, warning/error states, dirty indicator, collapsible sections | Consistent, accessible settings surface across all tabs |
| 🤖 Models Tab | Favorites, cost display, context badge, capability chips, virtualized list | Instant browsing of large model catalogs |
| 🔌 Providers Tab | Key-test with latency, health badge, quick-add 4 providers, env detection | One-click provider onboarding |
| 📄 Context Tab | Active rules display, quick-create, @mention cheatsheet, context bar | Real-time visibility into what reaches the model |
| 🎨 Display Tab | Live preview panel, font/line-height sliders, 7 code themes, layout presets | WYSIWYG chat appearance tuning |
| 🔔 Notifications Tab | 7 per-event toggles, quiet hours, per-event sounds, test button | Granular, non-intrusive notification control |
| 🌐 Browser Tab | Connection status, viewport selector, screenshot preview, Playwright accordion | Full browser-automation configuration in one place |
| ✏️ Autocomplete Tab | Trigger-delay slider, suggestions slider, ghost-text preview, per-language toggles | Tune autocomplete feel per language |
| 🧪 Experimental Tab | Stability badges, changelogs, search/filter, dependency pills, reset button | Safe exploration of bleeding-edge features |
| 💬 Commit Message Tab | Live preview, template editor with variable docs, 3 preset buttons, co-author toggle | Consistent, conventional commit hygiene |
| 🗂️ Mode Edit/Create Views | Live preview, step-limit slider, color picker, clone, import JSON | Full mode lifecycle management in the UI |
| 🔩 MCP Edit View | Connection test, tool-list preview, transport auto-detect, command builder | Visual MCP server configuration |
| 🏠 Hub Tab | Exponential backoff with countdown, phpMyAdmin port-conflict detection, URL presets, last-connected timestamp | Reliable Hub reconnection with diagnostics |
| 🖥️ VPS Tab (2nd pass) | Multi-server health monitor, SVG sparklines, copy SSH, two-step remove | Fleet-level VPS visibility |
| 🔐 SSH Tab (2nd pass) | Known hosts, key generation (ed25519/ecdsa/rsa), fingerprint, ProxyJump, history, export | Complete SSH lifecycle in VS Code |
| 🤝 Agent Behaviour Tab (2nd pass) | MAOS 21-agent matrix, ASCII dep-tree, step budget, per-agent timeout, priority queue, emergency stop | Full MAOS orchestration control surface |
| 🧠 Memory Tab (2nd pass) | Timeline, category filter, token bar chart, auto-compact threshold, health score, bulk ops, diff-on-save | Transparent, manageable agent memory |
| 🏷️ Checkpoints Tab (2nd pass) | Inline diff, branch-from-checkpoint, auto-checkpoint rules, compare two, labels, retention policy | Surgical checkpoint management |
| ⚡ ZeroClaw Tab (2nd pass) | Multi-target selector, rate-limit dashboard, retry policy, circuit breaker, alert thresholds, 24h error chart | Production-grade ZeroClaw observability |
| 📦 Presets Tab (2nd pass) | Versioning + history drawer, tags, comparison, inheritance, 5 community presets, usage stats, auto-apply globs | Shareable, composable configuration presets |
| 🔀 Routing Tab (2nd pass) | Traffic-split visualization, rule priority reorder, rule testing, latency & cost comparison | Data-driven model routing |
| ⚙️ Workflows Tab (2nd pass) | Run history, step timing, trigger config, clone, 5 built-in templates | Repeatable multi-step agent workflows |
| 🏛️ Governance Tab (2nd pass) | Policy audit log, simulation, compliance report, rule inheritance, risk-score dashboard | Enterprise-ready policy management |
| 📚 Training Tab (2nd pass) | Paginated dataset preview, quality filtering, training-run sparkline, annotation mode, export formats, dedup | Full fine-tune data pipeline |
| ✅ Auto-Approve Tab (2nd pass) | Recent log, frequency chart, trust score per tool, rate-limit slider, approval conditions | Auditable, tunable auto-approval |
| 📡 Hermes Tab (2nd pass) | Queue viz, per-channel health + reconnect, message trace, dead-letter queue with retry/discard, bandwidth usage | Observable, resilient message bus |
| 💾 Session List / History | Search/filter, metadata badges, starred pinned, bulk delete, export to Markdown, hover preview, resume | First-class session management |
| 🎨 CSS / Visual System | Tab transitions, card lift, button press, badge pulse, skeleton shimmer, custom scrollbars, chip system | Polished, consistent visual language |
| 🔗 Extension Host Stubs | 6 new IPC handlers: requestRulesFiles, createRulesFile, previewSystemPrompt, requestVSCodeLanguage, testNotification, testProviderKey, checkpointCreateBranch | Webview → extension host round-trips for new features |
| 🧭 Onboarding Wizard | Numbered dots, skip+back, MAOS quick-setup (21-agent grid), import kilo.json, completion celebration | Zero-to-MAOS in one wizard |
| 🔌 Provider Dialogs | Format hints, dashboard links, auto-connect on paste; quick-filter (All/Configured/Free/Local), categories | Frictionless provider onboarding |
| 🃏 Custom Provider Cards | Test with latency, capability badges, delete confirmation, copy model ID, drag-to-reorder, sort A-Z | Full custom-provider CRUD |

---

## 🔧 Service Worker & Webview Fixes

These fixes eliminate the most common cause of stale/blank webview panels after VS Code update.

### Auto-Clear Stale SW Cache on Version Change
- `clearSwCacheOnVersionChange()` is called during `activate()`.
- On each activation the extension version is compared to the value stored in the SW's cache manifest.
- When a mismatch is detected, all stale cache buckets are purged before the webview reloads.
- Result: users never see a blank or outdated panel after an extension update.

### Fast-Fail SW Probe (~50 ms)
- The webview now probes `navigator.serviceWorker.controller` with a 50 ms timeout before falling back to a direct fetch.
- Detection latency is cut from several hundred milliseconds (previous polling loop) to ~50 ms in the common case.

### Exponential Backoff Retry
- Failed SW operations retry up to **5 attempts** with the formula: `delay = 150 ms × 2^attempt ± jitter`.
- Prevents thundering-herd reconnects after a transient network or worker failure.
- Backoff sequence (approximate): 150 ms → 300 ms → 600 ms → 1.2 s → 2.4 s.

### Fixed Doubled Toolbar Icons
- Removed 4 duplicate command entries from the `editor/title` contribution point.
- Previously, opening a second tab caused icons to appear twice in the toolbar.

### Resolved Conflicting Extension IDs
- The extension was registered under both `kilocode.kilo-code` and `kilocode.kilocode-maos`, causing activation races.
- A single canonical ID is now enforced throughout `package.json` and all contributed command namespaces.

---

## ⚙️ Settings Infrastructure

The settings system has been comprehensively overhauled. All 24 tabs now load lazily and are kept alive after the first visit, so navigating back to a tab is instant.

### Tab Lazy-Loading & Keep-Alive
- All 24 settings tabs are wrapped in `React.lazy()` + `<Suspense fallback={<TabSkeleton />}>`.
- A tab's component bundle is fetched only when that tab is first opened.
- After the first visit the rendered tree is preserved in a keep-alive cache, so switching back incurs zero re-render cost.

### Tab Groups with Breadcrumb Navigation
Four top-level groups organise the 24 tabs:

| Group | Tabs |
|-------|------|
| 🤖 AI Models | Models, Providers, Custom Providers, Routing, ZeroClaw |
| ⚙️ Workflow | Autocomplete, Commit Message, Auto-Approve, Workflows, Checkpoints, Presets, Training |
| 🔗 Integrations | Browser, Hub, VPS, SSH, Hermes, MCP |
| 🖥️ System | Display, Notifications, Context, Experimental, Governance, Memory, Agent Behaviour |

Breadcrumbs (e.g. **System › Memory**) appear in the header; clicking a crumb segment collapses back to the group list.

### Settings Command Palette (Ctrl+K)
- Opens a floating fuzzy-search palette over the settings panel.
- Supports category grouping, deep-link breadcrumbs, and a live preview pane on the right.
- Shows **pinned commands**, **recently used commands**, and a **recent searches** history.
- Full keyboard navigation: `↑` / `↓` to move, `Tab` to focus preview, `Home` / `End` to jump, `Enter` to activate, `Escape` to close.

### Global Save Shortcut (Ctrl+S)
- Pressing `Ctrl+S` anywhere inside the settings panel commits all pending changes.
- `Escape` closes the panel and discards unsaved changes (with a confirmation toast if the dirty count > 0).

### Unsaved Changes Badge
- A numeric badge on the settings panel header shows the count of tabs with unsaved changes.
- The badge pulses when new dirty changes are detected (CSS `@keyframes badge-pulse`).

### Navigation Guard Toast
When navigating away from a tab with unsaved changes, a toast appears:

> **"Settings not saved — changes will be lost"**
> `[Undo]` `[Save]`

Clicking **Save** persists all dirty tabs. Clicking **Undo** reverts the pending changes in memory.

### Config Deep-Equality Check
- Before posting a `updateConfig` IPC message, the new value is deep-compared to the current value.
- `postMessage` is skipped entirely when the value has not changed, eliminating spurious round-trips.

---

## 🧩 SettingsRow Component

The `SettingsRow` primitive used by every setting has been extended:

| Feature | Description |
|---------|-------------|
| Help tooltip (`?`) | A `?` icon renders inline; hovering shows the full description string. |
| Warning state | Orange left border + warning icon when a value is valid but potentially risky. |
| Error state | Red left border + error message string rendered below the control. |
| Required indicator | A red `*` asterisk appended to the label for required fields. |
| Dirty indicator | A 6 px blue dot appears next to the label when the field has an unsaved change. |
| Section separators | `<SettingsRow type="separator" label="Section Title" />` renders a full-width divider with label. |
| Collapsible rows | `collapsible` prop with `defaultOpen`; animated expand/collapse (CSS max-height transition). |
| Copy-value button | A clipboard icon on hover copies the current value to the clipboard. |

---

## 🤖 Models Tab

| Feature | Detail |
|---------|--------|
| Favorites | Star icon; starred models are pinned to the top of the list. |
| Cost display | `$X.XX/M in · $X.XX/M out` shown under each model name. |
| Context window badge | `Xk ctx` chip (e.g. `200k ctx`) pulled from model metadata. |
| Capability chips | `Vision`, `Tools`, `Streaming` chips rendered per model. |
| Search / filter | Debounced text input filters by model name, provider, or capability. |
| Sort options | Sort by: Name A→Z, Cost (cheapest first), Context (largest first), Provider. |
| Active model indicator | Currently-active model is highlighted with a teal left border. |
| Virtualized list | React-window virtualization kicks in automatically when the model count exceeds 50, keeping scroll smooth. |
| Stable memoization | Model cards are wrapped in `React.memo` with a stable comparator; renders only when a model's data actually changes. |

---

## 🔌 Providers Tab

| Feature | Detail |
|---------|--------|
| API key test button | Fires a live call to the provider; shows latency (e.g. `243 ms`) and a `PASS` / `FAIL` badge. |
| Health status badge | `Healthy` / `Degraded` / `Down` derived from the last test result and provider status page. |
| Key masking toggle | Reveals / hides the last 4 characters of the stored key. |
| Base URL override warning | A yellow banner appears when a non-default base URL is set, to prevent silent routing errors. |
| Quick-add popular providers | One-click add buttons for **Anthropic**, **OpenAI**, **Gemini**, and **Ollama**. |
| Env variable detection | Scans `process.env` (extension host) for known key names; surfaces a "Use from env" option. |
| Debounced test | The key-test call is debounced at **800 ms** from the last keystroke to avoid hammering provider APIs. |
| Provider sorting by source | Groups: Configured → Environment → Unconfigured. |

---

## 📄 Context Tab

| Feature | Detail |
|---------|--------|
| Active rules display | Lists every active `.kilo/rules` file with a source badge (`workspace` / `user` / `project`). |
| Quick-create rules file | Button opens a file dialog pre-filled with the correct path for a new rules file. |
| @mention syntax cheatsheet | Collapsible accordion listing all supported `@file`, `@folder`, `@url`, `@git` mentions. |
| Context window usage bar | Progress bar showing tokens used / total context window with a colour scale (green → amber → red). |
| System prompt preview panel | Read-only textarea showing the fully-assembled system prompt for the current session. |
| File inclusion limits display | Shows `maxFiles`, `maxFileSize`, and `maxTokens` from the active config. |

---

## 🎨 Display Tab

| Feature | Detail |
|---------|--------|
| Live chat preview panel | A simulated chat thread updates in real time as settings change. |
| Font size slider | Range 10–22 px; changes propagate instantly to the preview and the live chat view. |
| Line height slider | Range 1.2–2.0; live update. |
| Code block theme selector | 7 themes: `default`, `github-dark`, `dracula`, `monokai`, `nord`, `solarized-dark`, `one-dark`. |
| Layout preset buttons | **Compact** / **Comfortable** / **Spacious** apply a named set of spacing and font values in one click. |
| Reset to defaults | Reverts all display settings to factory values. |

---

## 🔔 Notifications Tab

| Feature | Detail |
|---------|--------|
| 7 per-event granularity toggles | Events: task-complete, error, checkpoint, mention, agent-message, approval-required, low-memory. |
| Test notification button | Fires a test notification for each event type to verify delivery. |
| Quiet hours | `from` / `until` time pickers; notifications are suppressed in the window. |
| Per-event sound selectors | Choose from 5 sounds (or "none") per event type. |
| Priority level filter | Show / suppress notifications below a chosen priority: **Low** / **Med** / **High**. |

---

## 🌐 Browser Tab

| Feature | Detail |
|---------|--------|
| Connection status indicator | Four states: `Connected` (green), `Registering` (amber), `Disconnected` (grey), `Failed` (red). |
| Viewport size selector | Presets: **Mobile** (375×812), **Tablet** (768×1024), **Desktop** (1920×1080), **Custom** (free input). |
| Screenshot preview panel | Live thumbnail of the last Playwright screenshot; click to expand. |
| Playwright MCP tools accordion | Expandable list of registered Playwright MCP tools with descriptions and last-used timestamps. |

---

## ✏️ Autocomplete Tab

| Feature | Detail |
|---------|--------|
| Trigger delay slider | Range 200 ms – 2000 ms; labelled **Fast**, **Balanced**, **Relaxed** at breakpoints. |
| Max suggestions slider | Range 1 – 10 suggestions per trigger. |
| Live ghost-text preview | A synthetic code snippet shows the current ghost-text rendering with chosen settings. |
| Acceptance rate display | Rolling 7-day acceptance rate shown as a progress bar + percentage. |
| Per-language toggles | 8 languages: TypeScript, JavaScript, Python, Rust, Go, Java, C/C++, Ruby. |

---

## 🧪 Experimental Tab

| Feature | Detail |
|---------|--------|
| Stability badges | Each flag is labelled **Stable** / **Beta** / **Alpha** / **Prototype**. |
| Description + changelog per flag | Accordion with a one-line description and a "What changed" note for the last 3 canary versions. |
| Search / filter flags | Instant text search across flag names and descriptions. |
| Dependency pills | Some flags require others; dependency names appear as clickable chips that scroll to the required flag. |
| Reset all experimental | Single button reverts every experimental flag to its published default. |

---

## 💬 Commit Message Tab

| Feature | Detail |
|---------|--------|
| Live commit message preview | A rendered commit message updates as the template or variables change. |
| Character limit indicator | Colour-coded character counter on the subject line (green < 72, amber 72–100, red > 100). |
| Template editor with variable docs | Full-height textarea; a sidebar lists all available variables (`{type}`, `{scope}`, `{description}`, etc.). |
| Preset buttons | **Conventional Commits**, **Angular**, **Semantic** — each sets a complete template. |
| Co-author settings toggle | Toggle `Co-Authored-By` footer on/off; free-text field for additional co-author lines. |

---

## 🗂️ Mode Edit / Create Views

### ModeEditView
| Feature | Detail |
|---------|--------|
| Live preview panel | Shows a rendered mode card with the current name, color, icon, and description. |
| Step limit slider | Range 1 – 500 steps; visual warning above 200. |
| Color picker | Full HSL picker with hex input and recent-colors row. |
| Clone button | Duplicates the current mode with a `Copy of …` name prefix. |
| Unsaved warning | Nav guard prevents closing with unsaved changes. |
| Import JSON | Accepts a raw mode JSON string; validates structure before applying. |

### ModeCreateView
- All features from `ModeEditView`, plus:
- **Clone seed support**: pick an existing mode as a starting point from a dropdown, then customise.

---

## 🔩 MCP Edit View

| Feature | Detail |
|---------|--------|
| Connection test button | Fires `mcp.test` and displays result (connected / timeout / auth-failed). |
| Tool list preview | Shows all tools exposed by the server after a successful connection test. |
| Transport auto-detect | Infers `stdio` / `sse` / `websocket` from the command/URL pattern. |
| Command builder | Chip-list input: type a token and press Enter to add; drag to reorder; click × to remove. |

---

## 🏠 Hub Tab

| Feature | Detail |
|---------|--------|
| Exponential backoff reconnect | 1 s → 2 s → 4 s → 8 s → … → 30 s cap; countdown displayed in the UI. |
| phpMyAdmin port-conflict detection | Warns when port 8080 is already bound by phpMyAdmin. |
| URL presets dropdown | Pre-filled options for common local / Docker / remote Hub URLs. |
| Connection timeout config | Configurable timeout (default 10 s) before a connection attempt is abandoned. |
| Prominent Refresh Now button | Manual reconnect trigger independent of the backoff timer. |
| URL format validation | Inline error for malformed URLs (missing scheme, trailing slash, etc.). |
| Last connected timestamp | Shows "Last connected: 3 minutes ago" below the URL field. |
| Copy URL button | Copies the current Hub URL to the clipboard. |

---

## 🖥️ VPS Tab — 2nd Pass

| Feature | Detail |
|---------|--------|
| Multi-server health monitor | All configured VPS instances listed in a table with per-row status (online / degraded / offline). |
| 30-second polling | Status is refreshed every 30 s; a small spinner shows during an in-flight check. |
| SVG sparklines | 10-point response-time sparkline (last 5 minutes) per server. |
| Copy SSH command | One-click copy of `ssh user@host -p port` for each server. |
| Two-step remove confirmation | Clicking Remove reveals an "Are you sure?" inline confirmation; no accidental deletes. |

---

## 🔐 SSH Tab — 2nd Pass

| Feature | Detail |
|---------|--------|
| Known hosts management | List, add, and remove entries from the known-hosts store. |
| SSH key generation | Generate **ed25519** (default), **ecdsa**, or **rsa** keys; passphrase optional. |
| Fingerprint display | SHA-256 fingerprint shown for every stored key. |
| ProxyJump field | Free-text field for multi-hop SSH configurations. |
| Connection history | Last 5 successful connections with timestamp and latency. |
| Export SSH config | Generates a standards-compliant `~/.ssh/config` block ready to copy. |

---

## 🤝 Agent Behaviour Tab — 2nd Pass

| Feature | Detail |
|---------|--------|
| MAOS 21-agent capability matrix | Each of kc-main + kc-01 through kc-20 listed with role, capabilities, and status; rows expand for details. |
| ASCII dependency tree | Visualises inter-agent dependencies as a text tree for quick topology review. |
| Global step budget | Numeric input; a warning badge appears when the sum of per-agent budgets exceeds the global limit. |
| Per-agent timeout | Override timeout (seconds) per agent. |
| Priority queue with ▲/▼ | Drag or use arrows to reorder agents in the execution priority queue. |
| Emergency stop config | Set the condition (error count / time elapsed / cost threshold) that triggers a full MAOS halt. |
| Memory scope per agent | Dropdown: `session` / `workspace` / `global`. |
| Preset buttons | **Dev**, **Review**, **Write**, **Research** — apply a named agent-behaviour configuration in one click. |

---

## 🧠 Memory Tab — 2nd Pass

| Feature | Detail |
|---------|--------|
| Timeline view | Memories listed chronologically with relative timestamps (e.g. "2 hours ago"). |
| Category tags + filter | Tags: `fact`, `preference`, `code`, `decision`, `task`; filter bar above the timeline. |
| Per-entry token bar chart | Inline bar showing each memory's token footprint relative to the largest entry. |
| Auto-compact threshold | Slider: trigger compaction when memory usage exceeds X% of the context window. |
| Health score (0–100) | Composite score based on deduplication, freshness, and coverage. |
| Bulk operations | Multi-select with checkbox; bulk actions: **Delete**, **Tag**, **Export**. |
| Diff-on-save preview | When editing a memory entry, a before/after diff is shown before committing. |

---

## 🏷️ Checkpoints Tab — 2nd Pass

| Feature | Detail |
|---------|--------|
| Inline diff viewer | Clicking a checkpoint expands a split-pane diff of all changed files. |
| Branch from checkpoint | Creates a new git worktree branched from the selected checkpoint. |
| Auto-checkpoint rules | Configure triggers: on-task-complete, every-N-steps, on-tool-use. |
| Size indicators | File count + total delta bytes shown per checkpoint. |
| Compare two checkpoints | Select any two checkpoints for a side-by-side or unified diff. |
| Labels / rename | Free-text label per checkpoint; inline rename in the list. |
| Retention policy | Keep last N checkpoints; or keep by age (days); auto-prune toggle. |

---

## ⚡ ZeroClaw Tab — 2nd Pass

| Feature | Detail |
|---------|--------|
| Multi-target selector | Configure rate limits and policies per-target endpoint independently. |
| Rate limit dashboard | Current RPS, burst capacity, and queue depth per target. |
| Retry policy config | Choose: none, fixed interval, exponential backoff; max retries. |
| Circuit breaker status | `Closed` / `Half-Open` / `Open` badge per target; manual reset button. |
| Alert thresholds | Set error-rate % and latency P95 (ms) thresholds that trigger a VS Code notification. |
| 24-hour error chart | Bar chart of error counts across the last 24 hours, 1-hour buckets. |
| Rules editor | Full JSON editor for advanced ZeroClaw rule definitions with schema validation. |

---

## 📦 Presets Tab — 2nd Pass

| Feature | Detail |
|---------|--------|
| Versioning with history drawer | Every save creates a versioned snapshot; a drawer lists the last 20 versions with timestamps. |
| Tags + filter | Free-text tags per preset; filter by tag in the list. |
| Side-by-side comparison | Select two presets and view their configs in a two-column diff view. |
| Preset inheritance | A preset can declare a `parent`; only overridden keys are shown (rest inherited). |
| 5 community presets | Bundled: `minimal-dev`, `review-focused`, `write-mode`, `research-deep`, `full-maos`. |
| Usage stats | Times applied, last applied, and sessions active per preset. |
| Auto-apply glob rules | Define file-path globs that automatically switch to a preset when matched files are opened. |

---

## 🔀 Routing Tab — 2nd Pass

| Feature | Detail |
|---------|--------|
| Traffic-split visualization | Horizontal bar showing % of requests routed to each provider / model. |
| Rule priority reorder | Drag-and-drop to change rule evaluation order; numbers update live. |
| Rule testing input | Type a sample prompt; the panel shows which rule would match and which model it routes to. |
| Latency comparison | P50 / P95 latency per route, pulled from the last 1 h of telemetry. |
| Cost estimate | Estimated cost per 1 M tokens for the current routing config. |

---

## ⚙️ Workflows Tab — 2nd Pass

| Feature | Detail |
|---------|--------|
| Run history | List of past workflow runs with status, start time, duration, and step count. |
| Step timing breakdown | Expand a run to see per-step latency as a stacked bar. |
| Trigger config | Triggers: manual, on-file-save, on-git-commit, on-schedule (cron expression). |
| Workflow clone | Duplicate any workflow with all steps and triggers. |
| Template library | 5 built-in templates: `code-review`, `daily-standup`, `pr-prep`, `refactor-assist`, `test-generation`. |

---

## 🏛️ Governance Tab — 2nd Pass

| Feature | Detail |
|---------|--------|
| Policy audit log | Timestamped log of every policy evaluation with outcome (allow / deny / escalate). |
| Simulation | Run a hypothetical prompt against the current policy set and see the predicted outcome. |
| Compliance report | Generate a Markdown report of all active policies, last-modified dates, and audit summaries. |
| Rule inheritance | Policies can inherit from a parent workspace policy, with local overrides. |
| Risk score dashboard | Composite risk score (0–100) based on policy coverage, audit failures, and model capabilities. |

---

## 📚 Training Tab — 2nd Pass

| Feature | Detail |
|---------|--------|
| Paginated dataset preview | Browse the training dataset 20 rows at a time; click a row for full detail. |
| Quality filtering | Filter by quality score (slider), annotation status, and source label. |
| Training run progress + sparkline | Live progress bar for active runs; 20-point loss sparkline. |
| Annotation mode | Keyboard shortcuts: `A` = Accept, `R` = Reject, `E` = Edit inline. |
| Export formats | JSONL, CSV, Alpaca, ShareGPT. |
| Deduplication check | Runs a fuzzy-dedup scan and reports duplicate pairs with similarity score. |

---

## ✅ Auto-Approve Tab — 2nd Pass

| Feature | Detail |
|---------|--------|
| Recent auto-approve log | Last 50 auto-approved actions with tool name, timestamp, and arguments summary. |
| Frequency chart | 7-day bar chart of auto-approve counts per tool. |
| Trust score per tool | 0–100 score derived from approval history; shown as a colour-coded badge. |
| Rate limiting slider | Max auto-approvals per minute; hardcoded ceiling at 60. |
| Approval conditions | Visual rule builder: `tool is X AND argument matches Y` → auto-approve. |

---

## 📡 Hermes Tab — 2nd Pass

| Feature | Detail |
|---------|--------|
| Queue visualization | Horizontal bar showing message queue depth per channel; colour = load level. |
| Per-channel health + reconnect | Status badge per channel; manual reconnect button per channel. |
| Message trace (last 5) | Expandable accordion per channel showing the last 5 messages with headers and payload. |
| Dead letter queue | Messages that failed delivery appear in a DLQ pane; **Retry** or **Discard** per message. |
| Bandwidth usage | Total in/out bytes per channel over the last hour. |

---

## 💾 Chat / Session Management

### SessionList
| Feature | Detail |
|---------|--------|
| Search / filter | Searches session titles and message content. |
| Metadata badges | Agent count, message count, model name, and creation date shown per session. |
| Starred sessions pinned | Star a session to pin it at the top of the list. |
| Bulk delete | Multi-select sessions and delete all with one confirmation. |
| Sort options | By: most recent, oldest first, message count, name A–Z. |
| Export to Markdown | Exports a session's full transcript as a formatted `.md` file. |
| Session preview on hover | Hovering over a session shows a popover with the first 3 messages. |
| Resume session | "Resume" button re-opens the session and scrolls to the last message. |
| Empty states | Illustrated empty state when no sessions match the current filter. |

### HistoryView
- When a session is selected in the session list, the chat view auto-navigates to that session and restores the full message history.

---

## 🎨 CSS / Visual System (`settings.css`)

| Improvement | Detail |
|-------------|--------|
| Tab transition animation | Smooth `opacity` + `translateX` transition between tab panels (120 ms ease-out). |
| Card hover lift | Settings cards apply a `box-shadow` elevation on `:hover` (4 px → 8 px). |
| Button press feedback | Buttons scale to 98% on `:active` for tactile response. |
| Badge pulse | `@keyframes badge-pulse` on unsaved-changes and notification badges. |
| Skeleton shimmer | `@keyframes shimmer` applied to `<TabSkeleton>` and all loading placeholders. |
| Status color custom properties | `--status-ok`, `--status-warn`, `--status-error`, `--status-info` applied consistently. |
| Custom scrollbars | Thin (4 px) scrollbars in settings panel; auto-hide on non-hover. |
| Consistent focus rings | `outline: 2px solid var(--focus-ring)` on all interactive elements; respects `prefers-reduced-motion`. |
| Chip / badge system | 5 variants: `default`, `success`, `warning`, `error`, `info`; used across capability chips, status badges, and tags. |
| Collapsible animation | Max-height transition for collapsible rows and accordions; no layout reflow. |

---

## 🔗 Extension Host IPC Stubs

Six new message handlers were added to the extension host to support webview-initiated operations:

| Handler | Purpose |
|---------|---------|
| `requestRulesFiles` | Returns a list of all `.kilo/rules` files in the current workspace. |
| `createRulesFile` | Creates a new rules file at the specified path with a template skeleton. |
| `previewSystemPrompt` | Assembles and returns the full system prompt for the current session. |
| `requestVSCodeLanguage` | Returns the VS Code locale/language setting (`vscode.env.language`). |
| `testNotification` | Fires a test notification for the specified event type. |
| `testProviderKey` | Calls the provider API with the stored key and returns latency + pass/fail. |
| `checkpointCreateBranch` | Creates a new git worktree branched from the specified checkpoint hash. |

---

## 🧭 Onboarding Wizard

A new multi-step onboarding wizard replaces the previous single-page welcome screen:

| Step | Content |
|------|---------|
| 1 — Welcome | Product overview, numbered progress dots, skip+back navigation. |
| 2 — Provider Setup | `ProviderConnectDialog` with key format hints and dashboard links. |
| 3 — MAOS Quick-Setup | 21-agent grid (kc-main + kc-01…kc-20) with one-click enable. |
| 4 — Import Config | Drag-and-drop or file-picker to import an existing `kilo.json`. |
| 5 — Done | Completion celebration animation, summary of configured providers + agents. |

---

## 🔌 Provider Onboarding Dialogs

### ProviderConnectDialog
- **Key format hints**: provider-specific placeholder (e.g. `sk-…` for OpenAI, `claude-…` for Anthropic).
- **Direct dashboard links**: "Get API key" deep-links to the provider's key management page.
- **Auto-connect on paste detection**: when a valid key is pasted, the test call fires immediately without needing to click "Test".

### ProviderSelectDialog
- **Quick-filter tabs**: All / Configured / Free / Local.
- **Provider categories**: Commercial, Open-Source, Local.
- **Configured indicators**: Checkmark badge on already-configured providers.

---

## 🃏 Custom Provider Cards & Dialog

### CustomProviderModelCard
| Feature | Detail |
|---------|--------|
| Test button with latency | Per-card test; shows latency in ms and pass/fail. |
| Capability badges (inferred) | Badges inferred from model ID patterns (e.g. `-vision` suffix → Vision badge). |
| Delete confirmation inline | Clicking Delete shows an inline "Confirm?" without a modal. |
| Copy model ID | Click to copy the model ID string to the clipboard. |
| Drag-to-reorder | Cards are draggable; order is persisted. |
| Sort A–Z | Button sorts all cards alphabetically by model ID. |

### CustomProviderDialog
| Feature | Detail |
|---------|--------|
| Connection test | Full end-to-end test with the entered base URL and key. |
| /v1 URL warning | Yellow banner if the URL does not end in `/v1` (common misconfiguration). |
| Detect from env | Scans `process.env` for matching key / URL variables. |
| Provider presets (7 choices) | Pre-fills URL and key-variable name for: OpenAI-compatible, Together, Fireworks, Groq, Mistral, Perplexity, DeepInfra. |
| Headers editor | Add arbitrary HTTP headers as key-value pairs (useful for auth, rate-limit bypass headers). |

---

## 🏗️ Architecture Context

KiloCode MAOS Edition operates a **21-agent workforce** (kc-main orchestrator + kc-01…kc-20 workers) backed by a local CLI server. The webview communicates with the extension host via postMessage IPC (see `08_IPC_PROTOCOL.md`), which in turn talks to the CLI backend over HTTP + SSE.

```
VS Code Extension Host
  └─ KiloProvider (WebviewViewProvider)
       ├─ Webview (React, 24 settings tabs)
       ├─ KiloConnectionService (SSE + HTTP)
       └─ ServerManager (spawns CLI binary)

CLI Backend (:PORT)
  ├─ Session Service   ─── AI Providers
  ├─ Permission Service
  ├─ MCP Service
  ├─ File Service
  ├─ PTY Service
  └─ Snapshot Service  ─── Git (worktrees)
```

Config persists in two stores:
- **`kilo.json` / CLI server**: model, provider, agent, MCP, permissions, instructions, experimental flags.
- **VS Code globalState**: browser automation, autocomplete, notifications, routing, memory, training, governance, hub, SSH, VPS, Hermes, ZeroClaw.

---

## 📦 Package Metadata

```json
{
  "name": "kilo-code",
  "displayName": "KiloCode MAOS Edition",
  "version": "7.2.21-canary.9",
  "publisher": "kilocode",
  "engines": { "vscode": "^1.105.1" },
  "license": "MIT"
}
```

**Categories:** AI, Chat, Programming Languages, Education, Snippets, Testing

---

## 🔄 Upgrade Notes

1. **Service Worker**: On first launch after upgrading, the old SW cache is automatically cleared. A brief reload of the webview panel is expected.
2. **Extension ID**: If you have both `kilocode.kilo-code` and `kilocode.kilocode-maos` installed, disable or uninstall the older copy before upgrading to avoid activation conflicts.
3. **Settings Migration**: All existing settings are forward-compatible. New tab groups are applied to the existing 24 tabs; no settings are lost.
4. **`kilo.json` Compatibility**: The schema is backward-compatible. New fields added in canary.9 default to their documented values if absent.

---

## 🐛 Known Issues in canary.9

- Sparklines in the VPS Tab may not render on VS Code themes that override `--vscode-editor-background` with a non-standard value.
- The Annotation Mode keyboard shortcuts (`A`/`R`/`E`) in the Training Tab can conflict with VS Code's vim-mode extension. Workaround: focus the annotation panel first by clicking it.
- `checkpointCreateBranch` requires git 2.38+; on older git versions the handler returns an error toast and no branch is created.

---

*KiloCode MAOS Edition is open source — MIT License. Contributions welcome at https://github.com/Kilo-Org/kilocode.*
