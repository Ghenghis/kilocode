# E2E Test Matrix — KiloCode Custom Settings Tabs

**Version:** 7.2.21  
**Date:** 2026-04-28  
**Scope:** 11 custom (KiloCode-only) settings tabs  
**Framework:** Manual E2E / Playwright (`playwright.config.ts`)

---

## How to Use This Matrix

1. Open the KiloCode settings panel (`Ctrl+Shift+P` → "KiloCode: Open Settings").
2. Navigate to each tab listed below.
3. For each test row, perform the described action and verify the expected result.
4. Mark **Pass** or **Fail** in the P/F column. Record the build/VSIX version.

**Severity codes:**  
- `CRIT` — blocks a release  
- `HIGH` — must be fixed before stable ship  
- `MED`  — should be fixed before stable  
- `LOW`  — cosmetic / nice-to-have

---

## Tab 1 — ZeroClaw (`zeroclaw`)

ZeroClaw is an isolated task-execution subsystem with network, file-write, and approval policies.

| Test ID | Feature Section | What to Verify | Expected Result | P/F | Severity |
|---------|----------------|----------------|-----------------|-----|----------|
| ZC-01 | Tab Render | Tab label "ZeroClaw" appears in the Integrations group sidebar | Tab is visible, no error boundary | | CRIT |
| ZC-02 | Tab Render | Tab renders without blank screen after first click | Content area shows at least one section heading | | CRIT |
| ZC-03 | Task List | Empty-state message shows when no tasks exist | "No tasks yet" or equivalent placeholder visible | | HIGH |
| ZC-04 | Task List | Task status badges render with correct colours | queued=grey, running=blue, completed=green, failed=red, blocked=orange | | MED |
| ZC-05 | Network Policy | Network policy dropdown shows "deny / allowlist / open" | All three options present, default is "deny" | | HIGH |
| ZC-06 | Write Policy | Write policy dropdown shows "read_only / buffered / approved" | All three options present | | HIGH |
| ZC-07 | Risk Level | Risk level selector shows "low / medium / high" | All three options, default "low" | | HIGH |
| ZC-08 | Task Limits | Timeout, memory, and CPU fields accept numeric input | Values persist after leaving field; non-numeric input rejected | | HIGH |
| ZC-09 | Approval | Tasks with `requiresApproval = true` show an Approve/Reject UI | Approve/Reject buttons present; clicking Approve records approvedBy | | CRIT |
| ZC-10 | Approval Log | Approval records list shows past decisions | Records display approver, action (approved/rejected), timestamp | | MED |
| ZC-11 | Task Templates | Template dropdown pre-populates fields when a template is selected | Fields populated with template.command values | | MED |
| ZC-12 | Circuit Breaker | Circuit breaker state badges show closed/open/half-open | Correct colour: closed=green, open=red, half-open=yellow | | MED |
| ZC-13 | Monitoring | Monitored endpoints list renders | Each endpoint shows name, URL, and enabled toggle | | MED |
| ZC-14 | Rate Limit | Rate-limit status shows limit, remaining, reset countdown | Countdown ticks down in real-time (if endpoint is live) | | LOW |
| ZC-15 | Retry Policy | Retry policy fields (maxRetries, baseDelayMs, backoffMultiplier, jitter) visible | All four fields editable; jitter is a checkbox | | MED |
| ZC-16 | Cost Ledger | Cost entries show provider, tokens, and USD cost | Numeric values formatted correctly; no NaN or undefined | | MED |
| ZC-17 | Token Budget | Token budget bars show role, budget, used, icon | Used/budget renders as progress bar; not overflowing | | LOW |
| ZC-18 | Fallback Cascade | Fallback simulator shows steps with provider + reason | Simulation dialog/panel opens without crash | | LOW |

---

## Tab 2 — Hermes (`hermes`)

Hermes is the orchestration pipeline / message-bridge with approval modes, channel management, and DLQ.

| Test ID | Feature Section | What to Verify | Expected Result | P/F | Severity |
|---------|----------------|----------------|-----------------|-----|----------|
| HM-01 | Tab Render | "Hermes" tab visible under Integrations | Tab renders without error boundary | | CRIT |
| HM-02 | Enable Toggle | Enable/disable toggle visible | Toggle reflects current enabled state from extension state | | CRIT |
| HM-03 | Bridge URL | URL text field pre-populated | Default or saved URL shown; empty field shows placeholder | | HIGH |
| HM-04 | Approval Mode | Approval mode selector shows "auto-all / auto-low / manual" | All three options present | | HIGH |
| HM-05 | Workspace Scope | "Workspace scope only" toggle is present | Toggle state persists after settings save | | HIGH |
| HM-06 | Health Check | "Ping" / "Check Health" button is present | Clicking triggers a health check; status badge updates (reachable/unreachable) | | HIGH |
| HM-07 | Health Status | Live health indicator shows latency and version | latency_ms and version string displayed when connected | | MED |
| HM-08 | API Key | Store API key button present | Entering a key and saving shows "Key stored" confirmation; `keySource` changes to "secret" | | HIGH |
| HM-09 | API Key Clear | Clear API key button present | Clicking shows confirmation; `keySource` changes to "none" | | HIGH |
| HM-10 | Active Tasks | Active task list shows task_id, state, description | Each row shows correct state badge; no undefined values | | MED |
| HM-11 | Agent Assist | Agent-Assist panel section is visible | "Fill Settings" / "Audit Settings" buttons present | | MED |
| HM-12 | Channel Info | Channel info list shows id, name, status, queueDepth | Status badge: active=green, stale=yellow, error=red | | MED |
| HM-13 | Message Trace | Message trace table shows timestamp, direction, size, status | Direction shown as "in"/"out" arrow icons or labels | | LOW |
| HM-14 | Dead Letter Queue | DLQ section shows id, channelId, timestamp, reason | "Retry" or "Dismiss" buttons present per entry | | MED |
| HM-15 | Queue Stats | Queue stats bar shows pendingCount and throughputPerMin | Numeric values; throughput formatted (e.g. "12/min") | | LOW |
| HM-16 | Auto-Refresh | Auto-refresh toggle or interval selector visible | Toggling off stops periodic status calls | | LOW |

---

## Tab 3 — VPS & Infra (`vps`)

VPS tab manages remote servers, metrics, Docker containers, virtual hosts, and deploy history.

| Test ID | Feature Section | What to Verify | Expected Result | P/F | Severity |
|---------|----------------|----------------|-----------------|-----|----------|
| VP-01 | Tab Render | "VPS & Infra" tab visible under Integrations | Tab renders without error boundary | | CRIT |
| VP-02 | Server List | Server list shows hostname, IP, region, status badge | Status badge: online=green, offline=grey, degraded=yellow, unknown=dim | | HIGH |
| VP-03 | Server Details | Clicking a server row expands detail panel | Expanded panel shows OS, tags, SSH profile name | | HIGH |
| VP-04 | CPU/RAM Metrics | Metrics panel shows cpu%, ramUsed/ramTotal | Numbers formatted; never shows NaN or undefined | | HIGH |
| VP-05 | Disk Metrics | Disk usage list shows mount, used, total | At least the root "/" mount listed if data is available | | MED |
| VP-06 | Services | Service list shows name, status, PID, cpu%, mem% | Status badges: running=green, stopped=grey, failed=red | | MED |
| VP-07 | Docker Containers | Docker section shows id, name, image, status, ports | Status string matches Docker format (e.g. "Up 2 hours") | | MED |
| VP-08 | Managed Containers | Managed container cards show uptime, cpuPercent, memoryMB | Progress bars or numeric values; port list rendered | | MED |
| VP-09 | Vhosts | Virtual host table shows domain, SSL expiry, proxy target, enabled toggle | SSL expiry shown as date or "N/A" if null | | MED |
| VP-10 | Deploy History | Deploy log shows timestamp, action, status, rollback availability | "Rollback" button only visible when rollbackAvailable=true | | HIGH |
| VP-11 | Backup Entries | Backup list shows timestamp, size, status | Empty-state message when no backups exist | | LOW |
| VP-12 | SSH Profile Link | "SSH Profile" field links to SSH tab or shows profile name | Clicking opens SSH tab or shows profile name in context | | LOW |

---

## Tab 4 — SSH & Remote (`ssh`)

SSH tab manages connection profiles, known hosts, key generation, and session logs.

| Test ID | Feature Section | What to Verify | Expected Result | P/F | Severity |
|---------|----------------|----------------|-----------------|-----|----------|
| SS-01 | Tab Render | "SSH & Remote" tab visible under Integrations | Tab renders without error boundary | | CRIT |
| SS-02 | Profile List | SSH profile list shows name, host, port, user, authMode | Each profile row renders; no undefined property shown | | HIGH |
| SS-03 | Add Profile | "Add Profile" / "New Profile" button is present | Clicking opens a form/dialog for creating a new profile | | HIGH |
| SS-04 | Auth Mode | Auth mode selector shows "key / password" | Switching to "key" shows keyPath field; "password" hides it | | HIGH |
| SS-05 | Jump Host | Jump host field visible in profile form | Field accepts a hostname or empty string | | MED |
| SS-06 | Timeout Field | connectionTimeoutMs field visible (optional) | Accepts numeric value; empty means use default | | MED |
| SS-07 | Connect | "Connect" button triggers session | Session status changes to "connecting" → "connected" or "error" | | HIGH |
| SS-08 | Session Status | Session status badge shows disconnected/connecting/connected/error | Correct colour: connected=green, error=red, connecting=yellow | | HIGH |
| SS-09 | File Browser | Remote file tree renders after successful connection | Directories expandable; files shown with name and path | | MED |
| SS-10 | Connection Log | Log lines show timestamp + text | Scrollable list; newest entry at bottom | | LOW |
| SS-11 | Error History | SSH error entries show message, code, profileName, timestamp | No raw "[object Object]" displayed | | MED |
| SS-12 | Known Hosts | Known hosts list shows hostPattern, keyType, keyData (truncated) | "Remove" button per entry; confirmation before deletion | | MED |
| SS-13 | Key Generation | "Generate Key" button present | Clicking shows GeneratedKey result: publicKey + privateKeyPath + fingerprint | | MED |
| SS-14 | Key Fingerprint | "Show Fingerprint" for existing keys | Displays md5 and sha256 fingerprint strings | | LOW |
| SS-15 | Connection History | Connection attempt history shows profileName, timestamp, outcome | Attempts sorted newest-first | | LOW |
| SS-16 | Group Labels | Profiles grouped by `group` field in sidebar or list | Group headers visible when profiles have different groups | | LOW |

---

## Tab 5 — Governance (`governance`)

Governance tab manages authority tiers, approval workflows, dangerous-action lists, audit logs, and constitutional AI rules.

| Test ID | Feature Section | What to Verify | Expected Result | P/F | Severity |
|---------|----------------|----------------|-----------------|-----|----------|
| GV-01 | Tab Render | "Governance" tab visible under System | Tab renders without error boundary | | CRIT |
| GV-02 | Authority Tiers | Tier list shows observer / operator / admin / superadmin with permissions | Each tier row shows level number and permissions array | | HIGH |
| GV-03 | Tier Assignments | User-to-tier assignment list shows user, tier, assignedAt, assignedBy | Table renders; timestamps formatted as relative or absolute time | | HIGH |
| GV-04 | Approval Records | Approval queue shows actionDescription, actor, riskScore, riskLevel, status | Pending items highlighted; resolved items shown as approved/rejected | | HIGH |
| GV-05 | Risk Level Badge | riskLevel badges use consistent colours | low=green, medium=yellow, high=orange, critical=red | | MED |
| GV-06 | Dangerous Actions | Dangerous action list shows name, severity, minimumTier, blocked toggle | "warning" actions show orange badge; "critical" show red badge | | HIGH |
| GV-07 | Action Block Toggle | Toggling "blocked" on a dangerous action updates its state | blocked=true shows the action as blocked in the list | | HIGH |
| GV-08 | Audit Log | Audit entries list shows timestamp, actor, action, riskLevel, result, details | Entries sorted newest-first; no truncation of the details column | | MED |
| GV-09 | Release Verdicts | Release verdict cards show scope, criticalDefects, decision | decision badge: pass=green, conditional_pass=yellow, fail=red | | MED |
| GV-10 | Risk Thresholds | Numeric fields for low/medium/high/critical min/max visible | Values accepted as numbers; invalid range shows validation error | | MED |
| GV-11 | Constitutional Rules | Constitutional AI rule list shows text, severity, enabled toggle | severity: info=blue, warning=orange, block=red | | MED |
| GV-12 | Add Rule | "Add Rule" button opens rule creation form | Form accepts text and severity; saved rule appears in list | | MED |

---

## Tab 6 — Provider Routing (`routing`)

Routing tab manages multi-provider routing rules, health dashboards, fallback chains, and cost tracking.

| Test ID | Feature Section | What to Verify | Expected Result | P/F | Severity |
|---------|----------------|----------------|-----------------|-----|----------|
| RT-01 | Tab Render | "Provider Routing" tab visible under AI Models | Tab renders without error boundary | | CRIT |
| RT-02 | Routing Mode | Mode selector shows "auto / manual" | Default is "auto"; switching to "manual" enables rule reordering | | HIGH |
| RT-03 | Provider Health | Health dashboard shows each provider with status badge | Status: healthy=green, degraded=yellow, offline=red, unconfigured=grey | | HIGH |
| RT-04 | Circuit Breaker | Circuit breaker state shown per provider | closed=green, open=red, half-open=yellow | | HIGH |
| RT-05 | Request Stats | requestCount, failureCount, estimatedCost visible per provider | Numeric values; estimatedCost formatted as currency | | MED |
| RT-06 | Wrong Role Blocks | wrongRoleBlocks and retriesUsed shown per provider | Numeric values; zero is displayed not blank | | MED |
| RT-07 | Latency Sparkline | recentLatencies rendered as sparkline or list | Sparkline shows last 10 values; no empty space | | LOW |
| RT-08 | Route Decisions | Decision log shows taskType, primaryProvider, fallbackProvider, reason | fallbackUsed=true rows highlighted; fallbackDepth shown as badge | | MED |
| RT-09 | Route Trace | Expanding a decision shows trace steps | Each step shows provider, result (selected/skipped/blocked/failed), reason | | MED |
| RT-10 | Fallback Order | Fallback order drag list shows configured providers | Reordering updates fallbackOrder; save persists order | | HIGH |
| RT-11 | Privacy Mode | Privacy mode selector shows "local_preferred / cloud_ok" | Changing persists to config | | MED |
| RT-12 | Cost Threshold | Cost threshold numeric field visible | Accepts decimal; invalid input rejected | | MED |
| RT-13 | Routing Rules | Named routing rules list shows condition, targetProvider, priority, enabled | Rules sorted by priority ascending | | MED |
| RT-14 | Rule Toggle | Enabling/disabling a rule updates its enabled badge | Disabled rules shown as greyed out | | MED |
| RT-15 | Health Summary | Summary bar shows totalRequests, totalFailures, totalCost | Figures aggregate all providers correctly | | MED |
| RT-16 | Role Visibility | ALL_ROLES list (Contract Writing, Architecture, Audits, etc.) shown | All roles present in provider role assignment UI | | LOW |

---

## Tab 7 — Memory / Shiba (`memory`)

Memory tab manages the Shiba memory store: entries, recall, write history, agent permissions, health checks.

| Test ID | Feature Section | What to Verify | Expected Result | P/F | Severity |
|---------|----------------|----------------|-----------------|-----|----------|
| MM-01 | Tab Render | "Memory (Shiba)" tab visible under Workflow | Tab renders without error boundary | | CRIT |
| MM-02 | Connection Badge | Connection status badge shows connected/disconnected/error | connected=green, error=red, disconnected=grey | | HIGH |
| MM-03 | Connection Endpoint | Endpoint URL visible next to status badge | Non-empty string shown; last ping time if available | | HIGH |
| MM-04 | Entry Count | entryCount and storageBytesEstimate shown | Numeric values; bytes formatted as KB/MB | | MED |
| MM-05 | Memory Entries | Entry list shows project, scope, factType, summary, traceRef, timestamp | Entries grouped by scope or project when multiple | | HIGH |
| MM-06 | Recall Search | Search / recall input field present | Entering a query and submitting shows RecallResult list with relevanceScore | | HIGH |
| MM-07 | Recall Results | Recall result rows show summary, matchReason, relevanceScore | relevanceScore displayed as percentage or 0-1 float | | MED |
| MM-08 | Write History | Write history list shows summary, factType, project, scope, timestamp | Newest entries first; empty state message when empty | | MED |
| MM-09 | Agent Permissions | Agent permission list shows agentId + scope checkboxes (global/project/task) | Toggling a scope persists the permission change | | MED |
| MM-10 | Health Check | Health status shows status, errorRate, consecutiveFailures | status: healthy=green, degraded=yellow, unavailable=red | | HIGH |
| MM-11 | Diagnostic | "Run Diagnostics" button present | Clicking shows MemoryDiagnosticResult: connectivity, writeTest, recallTest, latencyMs | | MED |
| MM-12 | Export | "Export" button present | Clicking triggers download/copy of MemoryExportPayload JSON | | MED |
| MM-13 | Clear All | "Clear All" button present | Clicking requires confirmation dialog before executing | | HIGH |
| MM-14 | Token Usage | Context window token estimate visible | Shown as "X tokens used / Y total" or progress bar | | LOW |
| MM-15 | Recall Traces | Recall trace list shows requestingAgent, query, entriesSearched, permissionChecks | permissionCheck rows show scope and granted=true/false | | LOW |
| MM-16 | Connection History | Connection event history shows type, timestamp, endpoint | Events sorted newest-first | | LOW |

---

## Tab 8 — Training & GPU (`training`)

Training tab manages fine-tuning datasets, training jobs, hyperparameters, checkpoints, and HuggingFace sync.

| Test ID | Feature Section | What to Verify | Expected Result | P/F | Severity |
|---------|----------------|----------------|-----------------|-----|----------|
| TR-01 | Tab Render | "Training & GPU" tab visible under AI Models | Tab renders without error boundary | | CRIT |
| TR-02 | Dataset List | Dataset list shows name, format, validationStatus, rowCount, sizeBytes | validationStatus: pending=grey, passed=green, failed=red | | HIGH |
| TR-03 | Dataset Register | "Register Dataset" / "Add Dataset" button present | Clicking opens form with sourcePath, format fields | | HIGH |
| TR-04 | Dataset Validation | "Validate" button triggers validation check | Status updates to passed/failed; errors/warnings listed | | HIGH |
| TR-05 | Dataset Preview | "Preview" action shows DatasetPreview rows | Table shows first N rows; truncated notice if truncated=true | | MED |
| TR-06 | Duplicate Check | "Check Duplicates" button present | Shows pairCount for the dataset; zero means no duplicates | | MED |
| TR-07 | Dataset Item Review | Individual DatasetItem shows input, expectedOutput, qualityScore, annotation | Annotation buttons: "Accept / Reject / Edit" | | MED |
| TR-08 | Training Job List | Job list shows name, preset, status, progress% | Status badges: queued=grey, running=blue, paused=yellow, completed=green, failed=red | | HIGH |
| TR-09 | Create Job | "New Training Job" button opens job creation form | Form has preset selector (lora/qlora/custom), datasetId, target (local_gpu/remote_gpu) | | HIGH |
| TR-10 | Hyperparameters | Hyperparameter fields: learningRate, epochs, batchSize, warmupSteps | All four fields present and accept numeric input | | HIGH |
| TR-11 | Resource Limits | maxGpuMemoryMB and timeoutMinutes fields visible | Values validated as positive integers | | MED |
| TR-12 | Progress Bar | Running job shows progress bar | Progress 0-100%, currentEpoch/currentStep/totalSteps displayed | | HIGH |
| TR-13 | Loss History | lossHistory rendered as chart or list | Sparkline or table with numeric loss values; no NaN | | MED |
| TR-14 | Checkpoints | Checkpoint list shows step, loss, path, sizeBytes | "Restore" button per checkpoint; sizeBytes formatted as MB | | MED |
| TR-15 | Consent Settings | Consent panel shows allowTelemetry, allowDataUpload, allowHuggingFaceSync toggles | Each toggle persists its state | | HIGH |
| TR-16 | HuggingFace Sync | allowHuggingFaceSync toggle visible | Enabling shows HuggingFace repo name / token field | | MED |

---

## Tab 9 — Hub (`hub`)

Hub tab embeds a compact view of the contract-kit Hub: services, audit gates, PR queue, quotas, secret-scan.

| Test ID | Feature Section | What to Verify | Expected Result | P/F | Severity |
|---------|----------------|----------------|-----------------|-----|----------|
| HB-01 | Tab Render | "Hub" tab visible under Integrations | Tab renders without error boundary | | CRIT |
| HB-02 | URL Field | Hub URL field shows default "http://localhost:8082" | Field editable; placeholder shown when empty | | HIGH |
| HB-03 | URL Preset Dropdown | Preset dropdown offers localhost:8082 / :8090 / :3000 / :5000 / Custom | Selecting a preset populates the URL field | | HIGH |
| HB-04 | URL Validation | Invalid URL (missing http:// prefix) shows validation error | Error message "URL must start with http:// or https://" | | HIGH |
| HB-05 | Copy URL | "Copy URL" button copies current URL to clipboard | Toast or confirmation shown; clipboard contains the URL | | MED |
| HB-06 | Connection Timeout | Timeout config field visible (default 5s) | Accepts numeric value in seconds | | MED |
| HB-07 | Refresh Now | "Refresh Now" button is large and always visible | Clicking triggers a fresh fetch; spinner shown during fetch | | HIGH |
| HB-08 | Auto-Refresh | Auto-refresh toggle with interval selector (5s/15s/30s/60s) visible | Toggling off stops periodic fetches; selected interval persisted in localStorage | | MED |
| HB-09 | Status Badge | Connection status badge shows idle/connecting/connected/error | idle=grey, connecting=yellow, connected=green, error=red | | HIGH |
| HB-10 | Retry Counter | Retry counter visible when connection fails | Shows current retry attempt number | | MED |
| HB-11 | Backoff Countdown | Exponential backoff countdown timer shown during failures | Countdown ticks down from current backoff delay | | MED |
| HB-12 | Last Connected | "Last connected: X ago" timestamp visible | Relative time updates each render cycle | | MED |
| HB-13 | Services Summary | Services up/total counter visible | e.g. "3/4 services up" | | HIGH |
| HB-14 | Audit Gates | Audit gate summary shows pass/fail/unknown counts | fail count highlighted in red | | HIGH |
| HB-15 | PR Queue | Open PR list shows repo, number, title, URL | URLs rendered as clickable links (or copy-to-clipboard) | | HIGH |
| HB-16 | Quota Bar | Quota usage progress bar per provider shows used_pct | Bar fills proportionally; >80% shown in warning colour | | MED |
| HB-17 | Secret Scan | Secret-scan status shows ran_at, hits, by_kind breakdown | hits > 0 triggers warning icon | | HIGH |
| HB-18 | Port Conflict | phpMyAdmin port conflict warning shown if applicable | Warning banner "Unexpected service on this port" shown | | MED |
| HB-19 | HubContext | HubContext.Provider wraps the panel correctly | No "context is null" console error | | CRIT |

---

## Tab 10 — Commit Message (`commitMessage`)

Commit message tab configures the AI-generated commit message format: templates, char limits, co-author.

| Test ID | Feature Section | What to Verify | Expected Result | P/F | Severity |
|---------|----------------|----------------|-----------------|-----|----------|
| CM-01 | Tab Render | "Commit Message" tab visible under Workflow | Tab renders without error boundary | | CRIT |
| CM-02 | Enable Toggle | "Enable AI commit messages" toggle present | Toggle off hides the prompt/template fields | | HIGH |
| CM-03 | Preset Selector | Preset dropdown shows "Conventional Commits / Angular / Semantic" | Selecting a preset populates template and charLimit fields | | HIGH |
| CM-04 | Template Field | Template text area shows the template string | `{type}`, `{scope}`, `{description}` etc. tokens visible in default template | | HIGH |
| CM-05 | Char Limit | Character limit numeric field visible | Default 72 for Conventional Commits; accepts positive integers | | MED |
| CM-06 | Live Preview | Preview section renders a sample commit with substituted values | Subject line shown; `over` state highlights subject in red when > charLimit | | HIGH |
| CM-07 | Preview Over-Limit | Setting charLimit=10 causes preview to highlight subject | Subject line shown in red/warning colour | | MED |
| CM-08 | Co-Author Toggle | "Co-author" toggle present | Toggling on adds co-author config key to persisted config | | MED |
| CM-09 | Custom Prompt | Custom prompt textarea shown when expanded | Accepts multi-line text; persisted to commit_message.prompt | | MED |
| CM-10 | Save Persistence | Changing preset and saving; reopening tab | Selected preset, template, charLimit, and co_author are restored | | HIGH |

---

## Tab 11 — OpenClaw (`openclaw`)

OpenClaw is a local AI gateway routing messages from 20+ platforms to local models.

| Test ID | Feature Section | What to Verify | Expected Result | P/F | Severity |
|---------|----------------|----------------|-----------------|-----|----------|
| OC-01 | Tab Render | "OpenClaw" tab visible under Integrations | Tab renders without error boundary | | CRIT |
| OC-02 | Status Card | Status card shows connected, gatewayUrl, version, latency_ms | Default gatewayUrl = "http://localhost:18789" | | HIGH |
| OC-03 | Active Channels | activeChannels count and totalMessagesToday shown | Numeric values; zero is shown as "0" not blank | | HIGH |
| OC-04 | Channel List | Channels list shows name, type, enabled, status, messagesHandled | type badge shows platform icon or label (telegram, discord, etc.) | | HIGH |
| OC-05 | Channel Enable Toggle | Toggling a channel's enabled flag updates its row | Disabled channels show as greyed out | | HIGH |
| OC-06 | Channel Status Badge | Channel status: active=green, idle=yellow, error=red, unconfigured=grey | All four states renderable | | MED |
| OC-07 | Channel Token | Token field editable per channel | Token shown as masked (password input) | | MED |
| OC-08 | Webhook URL | Webhook URL field shown for applicable channel types | Clickable copy-to-clipboard button beside field | | MED |
| OC-09 | Model List | OpenClawModel list shows id, name, provider, baseUrl, available, latency | available=true items shown normally; unavailable items greyed | | HIGH |
| OC-10 | Model Latency | latency_ms shown per model | Formatted as "Xms"; "N/A" if not tested | | LOW |
| OC-11 | Agent List | OpenClawAgent list shows name, model, channels, status, stats | Status: running=green, idle=grey, error=red | | HIGH |
| OC-12 | Agent Stats | messagesProcessed, avgResponseMs, errorCount displayed | Numeric values; errorCount > 0 shown in warning colour | | MED |
| OC-13 | Routing Rules | Routing rules list shows name, pattern, action, priority, enabled | action badge: route_to_agent / respond_direct / ignore / forward | | MED |
| OC-14 | Rule Priority | Rules sorted by priority ascending | Lower number = higher priority rendered at top | | MED |
| OC-15 | Live Pricing | fetchLivePricing() results shown for models if available | Prices formatted with formatPrice(); FALLBACK_PRICING used if fetch fails | | LOW |
| OC-16 | WebChat Link | "Open WebChat UI" link to http://localhost:18789/webchat visible | Link opens in browser (vscode.env.openExternal) | | MED |
| OC-17 | Error State | When gateway is unreachable, error message shown | error string from OpenClawStatus displayed; retry button visible | | HIGH |

---

## Regression Guard — Tab Navigation

These tests cover cross-tab behaviour and should be run after every settings panel change.

| Test ID | Feature Section | What to Verify | Expected Result | P/F | Severity |
|---------|----------------|----------------|-----------------|-----|----------|
| NAV-01 | Sidebar Groups | All 4 sidebar groups visible: AI Models, Workflow, Integrations, System | Group headings rendered in correct order | | CRIT |
| NAV-02 | Command Palette | Ctrl+K / Cmd+K opens settings command palette | Palette opens; typing filters tab list | | HIGH |
| NAV-03 | Keep-Alive | Navigating away from a tab and back does not re-fetch | Tab content appears instantly (keep-alive cache active) | | MED |
| NAV-04 | Recent Tabs | Up to 3 recently visited tabs shown in sidebar | Recent tabs list updates as user navigates | | LOW |
| NAV-05 | Unsaved Changes | Modifying a field shows unsaved-changes indicator | Dirty indicator visible in header/save button | | HIGH |
| NAV-06 | Discard Changes | "Discard" button reverts all draft changes | Config reverts to last saved state | | HIGH |
| NAV-07 | Save | "Save" button persists all dirty config keys | Toast "Settings saved" appears; isDirty clears | | CRIT |
| NAV-08 | Error Boundary | Deliberately bad state does not crash the whole settings panel | ErrorBoundary catches error; "Something went wrong" shown per tab | | CRIT |
| NAV-09 | Tab Skeleton | Suspense/lazy tab shows skeleton during load | Skeleton visible for ~100ms before tab content mounts | | MED |

---

*Generated: 2026-04-28*  
*Source files: `webview-ui/src/components/settings/`*
