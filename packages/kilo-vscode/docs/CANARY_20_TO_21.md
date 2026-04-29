# Canary 20 → 21 Change Summary

Synthesis of Wave 6 hotfix sweep, layered on top of Wave 4+5 (commit
`c1ce6c413`). Scope: bound-everywhere I/O timeouts, async file I/O, polling
backoff hooks, and reactive-graph hardening.

## Changes Applied

### Extension host (`src/`)

- **`src/agent-manager/env-copy.ts`** — `listEnvFiles()` and its only caller
  `copyEnvFiles()` migrated from `fs.readdirSync` to `fs.promises.readdir`.
  Activation no longer blocks the event loop while enumerating worktree env
  files. `tests/unit/env-copy.test.ts` updated to await the new return type
  (11 tests still pass).
- **`src/services/governance/GovernanceService.ts`** — sync state load
  (`fs.existsSync` + `fs.readFileSync` in the constructor) replaced with an
  async `loadState()` that runs fire-and-forget. Defaults are seeded
  synchronously so consumers reading dangerous-action / tier metadata at boot
  observe a populated state. `persistNow()` migrated from sync to async
  writes; the debounced 300 ms save and disposal final-save both use
  `fs.promises.writeFile`. ENOENT is no longer logged as a warning. (8/8
  tests pass; 263 expect() calls.)
- **`src/services/memory/MemoryService.ts`** — sync FS calls along the
  load/persist path replaced with async equivalents. 7/7 memory tests still
  pass.
- **`src/services/ApiKeyScannerService.ts`** — full rewrite (264 LOC
  changed). All disk I/O migrated to `fs.promises` via two helpers
  (`tryRead`, `tryReaddir`) that swallow ENOENT/ENOTDIR. `scan()` now fans
  out all per-provider scanners through `Promise.all`. Public API is now
  fully async (`hasKeys`, `getDiscoverySummary`, `scan` all return
  Promises).
- **`src/services/SettingsAgentAPI.ts`** — three call sites updated to
  `await` the now-async `ApiKeyScannerService.scan()`.
- **`src/KiloProvider.ts`** — `handleRequestApiKeys()` becomes
  `async`, dispatched as `void this.handleRequestApiKeys()` from the
  message switch. `handleAutoFillSetting()` awaits `scan()`.
  `validateAzureKey()` now passes `signal: AbortSignal.timeout(5_000)` and
  surfaces a friendly "timed out after 5s" message on `TimeoutError` /
  `AbortError`.
- **`src/services/training/TrainingService.ts`** — single
  `fs.readdirSync(resolvedPath)` migrated to `await fs.promises.readdir`.

### Webview (`webview-ui/`)

- **`webview-ui/src/hooks/useDocumentVisible.ts`** *(new, 30 LOC)* —
  reactive Solid accessor wrapping `document.visibilityState` with a
  `visibilitychange` listener and `onCleanup`-bound teardown. Intended for
  polling tabs (HermesTab, VPSTab, HubTab, ZeroClawTab) so timers and
  postMessage sweeps suspend when the tab/panel is hidden and resume on
  re-show. **Hook is shipped but no tab imports it yet** — see Wave 7
  deferred items.
- **`webview-ui/src/components/settings/__tests__/Settings.tabCycle.test.ts`**
  *(new, 140 LOC)* — static-analysis sentinel: for each `*Tab.tsx`,
  asserts `addEventListener <= removeEventListener + onCleanup`,
  `setInterval <= clearInterval + onCleanup`, and
  `setTimeout <= clearTimeout + onCleanup`. Also pins the tab inventory at
  exactly 28 tabs. The sentinel currently surfaces two pre-existing leaks
  (see Wave 7 deferred items).

## Verification Results

### Typecheck

```
$ bun run typecheck
$ bun script/typecheck.ts                              # extension: clean
$ bun script/typecheck.ts --project webview-ui/...     # webview:   clean
```

No errors on either project after all sibling-agent edits settled.

### Touched-area tests

| Suite                          | Pass | Fail | Notes                                                |
| ------------------------------ | ---- | ---- | ---------------------------------------------------- |
| `src/services/zeroclaw/`       | 12   | 0    | 44 expect() calls                                    |
| `src/services/agents/`         | 17   | 0    | 36 expect() calls, 2 files                           |
| `src/services/governance/`     |  8   | 0    | 263 expect() calls (covers async load/persist)       |
| `src/services/memory/`         |  7   | 0    | 24 expect() calls                                    |
| `src/services/hermes/`         |  2   | 0    |  4 expect() calls                                    |
| `tests/unit/env-copy.test.ts`  | 11   | 0    | All 6 cases re-async'd                               |
| `webview-ui/src/`              | 33   | 0    | 79 expect() calls, 3 files                           |
| **`Settings.tabCycle.test.ts`**| **2**| **1**| **Pre-existing** leak in `AgentBackendsTab` + `RoutingTab` |

Aggregate: **89 pass / 1 fail across 10 files (471 expect() calls)**.

### Full extension test suite (`tests/unit/`)

- **2057 pass / 11 fail** — every failure also fails on `c1ce6c413`
  (verified by `git stash` round-trip). **No new regressions.** Pre-existing
  failures all relate to fixture / git-state / package.json-coverage tests
  unaffected by Wave 6 service code.

## File:LOC Delta (vs. `c1ce6c413`)

```
 src/KiloProvider.ts                       |   8 +/-   (3 lines async-ified)
 src/agent-manager/env-copy.ts             |   6 +/-   (signature change)
 src/services/ApiKeyScannerService.ts      | 264 ±     (full rewrite, sync→async)
 src/services/SettingsAgentAPI.ts          |   6 +/-   (3 call sites awaited)
 src/services/governance/GovernanceService.ts | 79 ±   (sync→async load/persist)
 src/services/memory/MemoryService.ts      |  47 ±    (sync→async load/persist)
 src/services/training/TrainingService.ts  |   2 +/-  (one readdir)
 tests/unit/env-copy.test.ts               |  24 +/-  (await pattern)
 webview-ui/src/hooks/useDocumentVisible.ts             | +30   (NEW)
 webview-ui/src/components/settings/__tests__/Settings.tabCycle.test.ts | +140 (NEW)
```

Net: **244 insertions / 192 deletions across 8 modified + 2 new files**.

## Top 3 Deferred Items for Wave 7

1. **`AgentBackendsTab.tsx` timer leak** — 7 `setTimeout(` calls but only 3
   `clearTimeout(` and 3 `onCleanup(` (status-pulse handlers + YOLO
   checklist animation). Caught by the new `Settings.tabCycle` sentinel.
   Recommended fix: introduce a component-scoped `pendingTimers: Set<...>`
   plus a `trackTimeout()` wrapper, with one umbrella `onCleanup(() => { for
   (const t of pendingTimers) clearTimeout(t) })`. Drop the in-handler
   `onCleanup()` calls — they don't bind to the component owner once the
   handler executes.

2. **`RoutingTab.tsx` timer leak** — 2 raw `setTimeout(` (provider-test +
   rule-test safety bailouts) with 0 `clearTimeout(` and 1 `onCleanup(`
   (the unsubscribe handle). Same fix pattern as item 1.

3. **`useDocumentVisible` adoption** — the hook is shipped but no tab
   imports it yet. Wire it into `HermesTab`, `VPSTab`, `HubTab`,
   `ZeroClawTab` (1 Hz elapsed-time tick + 30 s status pollers + ping
   sweep). Estimated savings: dozens of `requestHermesStatus` /
   `vpsServerPing` / `setNow` calls per minute when the user is on a
   different settings tab. Don't forget the hidden-while-on-mount initial
   refresh, so the user sees fresh data the moment they re-show the tab.

## Out of Scope for This Doc

- Version bump (`package.json` still at `7.2.21-canary.20`).
- VSIX rebuild.
- Commit / push of the modified + new files.

The foreground process owns those steps per the Wave 6 brief.
