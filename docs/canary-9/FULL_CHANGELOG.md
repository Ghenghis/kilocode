# KiloCode MAOS Edition — Changelog

---

## 7.2.21-canary.10 (in development)

### Chat View

- **Message pinning** — persistent top drawer holds pinned messages across sessions; drag to reorder, collapse to single-line summary
- **Message reactions / ratings** — thumbs up/down on every assistant message; thumbs-down opens a "what was wrong?" dropdown (5 options + free text); ratings exportable for fine-tune dataset contribution
- **Chat split view / Compare mode** (Ctrl+Shift+C) — two side-by-side panes stream responses from different models simultaneously; diff-highlight overlay marks token-level differences when both complete
- **Message branching** — right-click any message → "Branch from here"; branch tab strip; branches renameable, mergeable, deleteable; persisted in session store
- **Inline code execution** — Run button on code blocks sends to VS Code terminal and captures stdout/stderr inline as a collapsible result pane
- **Smart scroll anchor** — auto-scroll pauses on user scroll; floating "↓ N new" badge shows unread token count; End key or badge click returns to live tail
- **Chat bookmarks** (Ctrl+B) — bookmark any message; side panel lists bookmarks across all sessions with direct navigation; export to Markdown

### AI Context Awareness

- **Context inspector panel** (Ctrl+I) — floating/dockable panel showing full AI context composition: system prompt, rules files, conversation history, attached files, tool definitions, and running token total vs. context window ceiling; updates live
- **Token optimizer** (Ctrl+Shift+T) — analyzes context, highlights highest-cost sections, one-click summarization of old messages with before/after token delta preview before committing
- **Context diff on file change** — amber banner when a file referenced in the conversation changes on disk; "Re-attach" injects updated content; dismissible per-file per-session
- **Live cost meter** — persistent micro-widget at bottom of chat showing running session cost ($X.XXXX); per-turn tooltip breakdown; configurable soft-warning threshold
- **AI thinking visualization** — animated slide-up panel showing agent name, current action, sub-step list with live checkmarks, elapsed time; collapses on turn completion; pinnable

### Input and UX

- **Floating action bar** — Attach file, Screenshot (captures active editor pane), Switch model, Presets; collapses to "+" button below 480 px input width
- **Global command bar** (Ctrl+Shift+K) — full-width command palette for AI actions: new chat, clear, switch mode/agent, apply preset, compact context; fuzzy search; recently used actions at top
- **Message templates with variables** — saved prompt templates support `{filename}`, `{selection}`, `{language}`, `{date}`, `{mode}`; managed in Templates drawer; import/export JSON
- **Drag and drop files** onto chat input — drop files from VS Code Explorer or OS file manager; multiple files supported
- **Input history navigation** — Up/Down arrow to cycle previous prompts in empty input; persists last 100 entries across sessions; Ctrl+Up opens full history browser with search
- **Multi-select messages** — Shift+click to select range; floating action bar: "Use as context", "Export selected", "Delete selected"
- **@ mention autocomplete** — `@` triggers dropdown for files, MAOS agents (kc-main, kc-01…kc-20), rules files, and recently visited URLs
- **/ command autocomplete** — `/` triggers dropdown for `/new`, `/clear`, `/mode`, `/agent`, `/preset`, `/compact`
- **Prompt enhancer** — sparkle button AI-rewrites current input for better structure; before/after diff popover before committing; configurable enhancement model
- **Follow-up suggestion chips** — up to 3 contextual follow-up chips after each response; clicking inserts into input (not auto-sent); individually dismissible
- **Live token estimate on input** — "~N tokens" label updates as user types, reflecting draft + current context

### Hub / Open WebUI Integration

- **Hub model browser** — lists all models on connected Hub with parameter count, quantization, RAM requirements, and pull status; one-click pull initiation; filterable
- **Direct API / Via Hub relay toggle** — route inference directly to provider or proxy through Hub instance; per-model and global toggle; requires Hub 0.4.0+
- **Model download progress bars** — pull progress shown in Hub Tab and inline in model switcher popover with speed and ETA
- **Hub connection status widget** — persistent dot in bottom-right of chat panel (green/amber/red/grey); click opens Hub Tab
- **Hub models in model switcher** — Hub-available models show "H" badge; models requiring a pull show download icon

### Task and Agent Awareness

- **Live MAOS agent status panel** — collapsible sidebar panel listing all 21 agents (kc-main + kc-01…kc-20) with status (Idle/Active/Waiting/Error), current action string, and step count; real-time SSE updates
- **Task timeline** — horizontal Gantt-style bar chart showing each agent's contribution across task duration; hover for action detail; scrollable and zoomable; SVG export
- **Task progress estimation with ETA** — progress bar + "~N min remaining" label derived from rolling averages of historical tasks
- **Agent workload distribution donut chart** — per-agent share of total step count; hover highlights corresponding agent row in status panel
- **Interrupt and redirect** — Interrupt button stops agents gracefully mid-task; Redirect input allows new instruction before resuming; interrupt logged to session history

### File Change Tracking

- **Inline file diff preview in chat messages** — collapsible unified diff with syntax highlighting per agent edit message; Apply / Revert buttons; "View in editor" link
- **File change timeline panel** — "Changes (N)" badge on chat toolbar; chronological list of all file changes in current session with timestamp, change type, and per-entry diff view; filterable by agent, file type, time range
- **Multi-file edit preview card** — before applying multi-file edits, a preview card lists all files with per-file line delta; "Apply all", "Apply selected", "Cancel"; each row expands to full diff
- **Checkpoint auto-create toast badge** — brief toast "Checkpoint created — N files" on auto-checkpoint; click navigates to Checkpoints Tab

### Keyboard and Accessibility

- **Global shortcut registry with Ctrl+? help modal** — all shortcuts listed in a searchable reference modal; Ctrl+Enter send, Escape cancel, Ctrl+N new, Ctrl+H history, Ctrl+F search, Ctrl+I inspector, Ctrl+B bookmarks, Ctrl+Shift+K command bar, Ctrl+Shift+C compare, Alt+Up/Down navigate
- **Full focus trapping for modals** — all modal dialogs trap Tab correctly; Escape returns focus to triggering element
- **Skip links** — "Skip to chat input", "Skip to message list", "Skip to agent status panel"; visible on keyboard focus; WCAG 2.1 AA 2.4.1 compliant

### Theme and Visual Customization

- **Custom accent color picker** (Settings → Display) — color applied to borders, focus rings, badges, chips, progress bars; auto-adjusted for WCAG contrast compliance
- **Chat message density** — Compact / Normal / Spacious presets controlling line height and padding
- **Chat bubble style** — Bubble (rounded card), Flat (left border accent only), Minimal (plain text)
- **Custom font family selector** — System UI, VS Code Editor Font, Inter, JetBrains Mono, Fira Code, Source Code Pro, or custom free-text entry
- **Code block theme** — properly wired to CSS custom-property layer; changes apply instantly without webview reload (themes: default, github-dark, dracula, monokai, nord, solarized-dark, one-dark)
- **Reduced motion toggle** — force on/off independently of OS `prefers-reduced-motion`; disables transitions and replaces animated panels with static indicators
- **High contrast mode toggle** — force-applies high contrast CSS layer (WCAG AAA contrast ratios, no decorative shadows, 3 px focus rings)

---

## 7.2.21-canary.9

### Service Worker and Webview

- `clearSwCacheOnVersionChange()` called on activation; purges stale cache buckets on version mismatch — eliminates blank/outdated panels after extension updates
- Fast-fail SW probe: 50 ms timeout before fallback to direct fetch (~50 ms detection latency vs. several hundred ms previously)
- Exponential backoff retry: up to 5 attempts, formula `150 ms × 2^attempt ± jitter` (sequence: 150 → 300 → 600 → 1200 → 2400 ms)
- Fixed doubled toolbar icons: removed 4 duplicate `editor/title` command entries
- Resolved conflicting extension IDs (`kilocode.kilo-code` vs `kilocode.kilocode-maos`): single canonical ID enforced throughout `package.json`

### Settings Infrastructure

- All 24 settings tabs wrapped in `React.lazy()` + `<Suspense>`; tab bundles fetched on first visit; keep-alive cache eliminates re-render on return
- Four tab groups with breadcrumb navigation: AI Models, Workflow, Integrations, System
- Settings command palette (Ctrl+K): fuzzy search, category grouping, deep-link breadcrumbs, live preview pane, pinned commands, recently used, keyboard navigation
- Global save shortcut (Ctrl+S); Escape discards with confirmation toast when dirty count > 0
- Unsaved changes badge on panel header with `@keyframes badge-pulse`
- Navigation guard toast: "Settings not saved — changes will be lost" with Save / Undo actions
- Deep-equality check before `updateConfig` IPC — skips `postMessage` when value unchanged

### Settings Rows and UX

- `SettingsRow` extended: help tooltip (?), warning state (orange border), error state (red border + message), required indicator (*), dirty indicator (blue dot), section separators, collapsible rows, copy-value button

### Per-Tab Enhancements (24 tabs — second pass)

- **Models**: favorites/starring, cost display, context window badge, capability chips, debounced search/filter, 4 sort options, active model highlight, React-window virtualization above 50 models
- **Providers**: API key test with latency badge, health status (Healthy/Degraded/Down), key masking toggle, base URL override warning, quick-add Anthropic/OpenAI/Gemini/Ollama, env variable detection, 800 ms debounced test, sort by source
- **Context**: active rules display, quick-create rules file, @mention cheatsheet accordion, context window usage bar (green→amber→red), system prompt preview panel, file inclusion limits display
- **Display**: live chat preview panel, font size slider (10–22 px), line height slider (1.2–2.0), 7 code block themes, layout preset buttons (Compact/Comfortable/Spacious), reset to defaults
- **Notifications**: 7 per-event toggles, test notification button, quiet hours time pickers, per-event sound selectors (5 options), priority level filter
- **Browser**: connection status (4 states), viewport size selector (Mobile/Tablet/Desktop/Custom), screenshot preview panel, Playwright MCP tools accordion
- **Autocomplete**: trigger delay slider (200–2000 ms), max suggestions slider (1–10), live ghost-text preview, 7-day acceptance rate display, per-language toggles (8 languages)
- **Experimental**: stability badges (Stable/Beta/Alpha/Prototype), description + 3-canary changelog per flag, text search, dependency pills, reset all button
- **Commit Message**: live preview, character limit indicator (green/amber/red), template editor with variable docs sidebar, Conventional Commits / Angular / Semantic presets, co-author toggle
- **Mode Edit/Create**: live preview panel, step limit slider (1–500), full HSL color picker, clone button, nav guard, import JSON; Create adds clone-seed dropdown
- **MCP Edit**: connection test (connected/timeout/auth-failed), tool list preview, transport auto-detect (stdio/sse/websocket), chip-list command builder
- **Hub**: exponential backoff with countdown (1→2→4→…→30 s cap), phpMyAdmin port-conflict detection, URL presets, configurable timeout, Refresh Now button, URL format validation, last-connected timestamp, copy URL
- **VPS** (2nd pass): multi-server health monitor table, 30 s polling, SVG sparklines (10-point, 5 min), copy SSH command, two-step remove confirmation
- **SSH** (2nd pass): known hosts management, key generation (ed25519/ecdsa/rsa), fingerprint display, ProxyJump field, connection history (last 5), export SSH config
- **Agent Behaviour** (2nd pass): 21-agent capability matrix, ASCII dependency tree, global step budget, per-agent timeout, priority queue with drag/▲▼, emergency stop config, memory scope per agent, Dev/Review/Write/Research presets
- **Memory** (2nd pass): timeline view, category tags + filter, per-entry token bar chart, auto-compact threshold slider, health score (0–100), bulk delete/tag/export, diff-on-save preview
- **Checkpoints** (2nd pass): inline diff viewer, branch-from-checkpoint, auto-checkpoint rules, size indicators, compare two checkpoints, labels/rename, retention policy
- **ZeroClaw** (2nd pass): multi-target selector, rate limit dashboard (RPS/burst/queue), retry policy config, circuit breaker status + manual reset, alert thresholds, 24-hour error bar chart, JSON rules editor
- **Presets** (2nd pass): versioning with 20-snapshot history drawer, tags + filter, side-by-side comparison, preset inheritance, 5 community presets, usage stats, auto-apply glob rules
- **Routing** (2nd pass): traffic-split visualization, drag-and-drop rule priority reorder, rule testing input, P50/P95 latency comparison, cost estimate per 1 M tokens
- **Workflows** (2nd pass): run history with status/duration/steps, per-step timing stacked bar, trigger config (manual/on-file-save/on-git-commit/cron), clone workflow, 5 built-in templates
- **Governance** (2nd pass): policy audit log, simulation, compliance Markdown report, rule inheritance, risk score dashboard (0–100)
- **Training** (2nd pass): paginated dataset preview (20 rows/page), quality filtering (score slider/annotation status/source), training run progress + 20-point loss sparkline, annotation mode (A/R/E shortcuts), 4 export formats, fuzzy dedup scan
- **Auto-Approve** (2nd pass): last-50 auto-approve log, 7-day frequency bar chart, trust score per tool (0–100), rate-limit slider (ceil 60/min), visual approval conditions rule builder
- **Hermes** (2nd pass): queue depth bar chart per channel, per-channel health badge + manual reconnect, last-5-message trace accordion, dead letter queue with Retry/Discard, bandwidth usage per channel

### Chat and Session Management

- `SessionList`: search/filter, metadata badges (agent count, message count, model, date), starred sessions pinned, bulk delete, 4 sort options, export to Markdown, hover preview (first 3 messages), Resume button, empty state illustrations
- `HistoryView`: selecting a session auto-navigates and restores full message history

### CSS and Visual System

- Tab transition: `opacity` + `translateX` (120 ms ease-out)
- Card hover lift: `box-shadow` 4 px → 8 px on `:hover`
- Button press: scale to 98% on `:active`
- `@keyframes badge-pulse` on unsaved-changes and notification badges
- `@keyframes shimmer` on `<TabSkeleton>` and loading placeholders
- `--status-ok`, `--status-warn`, `--status-error`, `--status-info` custom properties applied consistently
- 4 px thin scrollbars with auto-hide on non-hover
- Consistent 2 px focus rings; respects `prefers-reduced-motion`
- Chip/badge system: 5 variants (default, success, warning, error, info)
- Collapsible max-height transition; no layout reflow

### Extension Host IPC

- 7 new handlers: `requestRulesFiles`, `createRulesFile`, `previewSystemPrompt`, `requestVSCodeLanguage`, `testNotification`, `testProviderKey`, `checkpointCreateBranch`

### Onboarding Wizard

- 5-step wizard: Welcome, Provider Setup, MAOS Quick-Setup (21-agent grid), Import `kilo.json`, Done (celebration animation)
- Numbered progress dots, skip + back navigation

### Provider Dialogs

- `ProviderConnectDialog`: key format hints, dashboard deep-links, auto-connect on paste detection
- `ProviderSelectDialog`: All/Configured/Free/Local tabs; Commercial/Open-Source/Local categories; configured-indicator checkmarks
- `CustomProviderModelCard`: test with latency, inferred capability badges, inline delete confirmation, copy model ID, drag-to-reorder, sort A–Z
- `CustomProviderDialog`: connection test, /v1 URL warning, detect from env, 7 provider presets, arbitrary headers editor

---

## 7.2.21-canary.8

- SW fast-fail probe + exponential backoff recovery
- Auto-clear stale SW cache on version change
- Fixed doubled toolbar icons
- 13 settings tabs first-pass enhancements
- Agent-reference docs (13 files, 6,121 lines)

---

## 7.2.21-canary.7

- Exponential backoff + fast-fail probe (initial implementation)
- Settings tabs enhancement wave 1

---

## 7.2.21-canary.6

- SW hardening Phase 0 (reset counter, visibility hook, timer leak fix)
