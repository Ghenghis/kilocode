# Service Worker Fix — Technical Diagrams (canary.9)

**Date:** 2026-04-27  
**Component:** `packages/kilo-vscode/src/extension.ts` + `KiloProvider.ts`  
**Bug reference:** VS Code platform bug #125993 / Chromium `InvalidStateError`

---

## 1. Problem Statement

### VS Code Bug #125993 — InvalidStateError on Webview SW Registration

When a VS Code webview panel is opened, the outer VS Code iframe loads
`pre/index.html` which runs an async ES module script that calls
`navigator.serviceWorker.register()`. On affected machines, Chromium's embedded
renderer has a stale entry in its `Service Worker\ScriptCache` directory (e.g.
`2cc80dabc69f58b6_0`) plus an orphaned LevelDB registration record in
`Service Worker\Database`. Chromium's service worker subsystem detects that the
*document associated with the prior registration is in an "unloading" state*
(the old webview document was closed but never cleanly unregistered) and throws:

```
InvalidStateError: Failed to register a ServiceWorker:
  The document is in an invalid state.
```

The error propagates into the inner iframe (the KiloCode React webview), which
never reaches `DOMContentLoaded` with an active SW controller.  Without a SW
controller, all `vscode-resource://` asset requests fail with 404, rendering the
panel blank and unresponsive.

The bug has been open in the VS Code issue tracker since 2021 and affects any
extension that registers a service worker inside a webview.

---

## 2. Root Cause Diagram

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 700 400" width="700" height="400" font-family="monospace" font-size="12">

  <!-- Background -->
  <rect width="700" height="400" fill="#0d1117" rx="8"/>

  <!-- Title -->
  <text x="350" y="28" fill="#e6edf3" font-size="14" font-weight="bold" text-anchor="middle">Root Cause: VS Code Bug #125993 — InvalidStateError</text>

  <!-- VS Code Outer iframe box -->
  <rect x="20" y="48" width="300" height="120" fill="#161b22" stroke="#30363d" stroke-width="1.5" rx="6"/>
  <text x="170" y="66" fill="#8b949e" font-size="11" text-anchor="middle">VS Code Outer iframe</text>
  <text x="170" y="84" fill="#79c0ff" font-size="11" text-anchor="middle">pre/index.html</text>
  <text x="170" y="102" fill="#e6edf3" font-size="10" text-anchor="middle">async module script</text>
  <text x="170" y="118" fill="#e6edf3" font-size="10" text-anchor="middle">navigator.serviceWorker</text>
  <text x="170" y="134" fill="#e6edf3" font-size="10" text-anchor="middle">.register("service-worker.js?v=4")</text>
  <text x="170" y="158" fill="#ff7b72" font-size="10" font-weight="bold" text-anchor="middle">↓  InvalidStateError thrown here</text>

  <!-- Chromium ScriptCache box -->
  <rect x="380" y="48" width="300" height="160" fill="#161b22" stroke="#f0883e" stroke-width="1.5" rx="6"/>
  <text x="530" y="66" fill="#f0883e" font-size="11" font-weight="bold" text-anchor="middle">Chromium ScriptCache</text>
  <text x="530" y="84" fill="#8b949e" font-size="10" text-anchor="middle">Service Worker\ScriptCache\</text>
  <rect x="400" y="92" width="260" height="28" fill="#21262d" rx="4"/>
  <text x="530" y="106" fill="#ff7b72" font-size="10" font-weight="bold" text-anchor="middle">2cc80dabc69f58b6_0  (16,270 B)  STALE</text>
  <text x="530" y="118" fill="#8b949e" font-size="9" text-anchor="middle">born 17:53:46 — closed webview origin</text>
  <rect x="400" y="126" width="260" height="28" fill="#21262d" rx="4"/>
  <text x="530" y="140" fill="#3fb950" font-size="10" text-anchor="middle">4cb013792b196a35_0  (16,270 B)  active</text>
  <text x="530" y="152" fill="#8b949e" font-size="9" text-anchor="middle">born 19:57:34 — current webview session</text>
  <text x="530" y="172" fill="#8b949e" font-size="10" text-anchor="middle">LevelDB: 2 registrations (REGID 0 zombie,</text>
  <text x="530" y="186" fill="#8b949e" font-size="10" text-anchor="middle">REGID 1 active) — DB never pruned</text>
  <text x="530" y="202" fill="#8b949e" font-size="10" text-anchor="middle">Script hash shared: 1CBB8DD1...AF948E</text>

  <!-- Arrow: Outer iframe → ScriptCache lookup -->
  <line x1="320" y1="108" x2="378" y2="108" stroke="#8b949e" stroke-width="1.5" marker-end="url(#arr)"/>
  <text x="349" y="102" fill="#8b949e" font-size="9" text-anchor="middle">lookup</text>

  <!-- Arrow: ScriptCache → InvalidStateError back -->
  <line x1="378" y1="130" x2="320" y2="148" stroke="#ff7b72" stroke-width="1.5" stroke-dasharray="4,3" marker-end="url(#arrRed)"/>
  <text x="349" y="145" fill="#ff7b72" font-size="9" text-anchor="middle">zombie blocks</text>

  <!-- Inner iframe (KiloCode webview) -->
  <rect x="20" y="220" width="300" height="80" fill="#161b22" stroke="#30363d" stroke-width="1.5" rx="6"/>
  <text x="170" y="238" fill="#8b949e" font-size="11" text-anchor="middle">Inner iframe — KiloCode Webview</text>
  <text x="170" y="258" fill="#e6edf3" font-size="10" text-anchor="middle">DOMContentLoaded fires</text>
  <text x="170" y="274" fill="#ff7b72" font-size="10" text-anchor="middle">navigator.serviceWorker.controller === null</text>
  <text x="170" y="290" fill="#ff7b72" font-size="10" text-anchor="middle">→ posts swRegistrationFailed probe</text>

  <!-- Arrow: Outer iframe → Inner iframe (error propagates) -->
  <line x1="170" y1="168" x2="170" y2="218" stroke="#ff7b72" stroke-width="1.5" marker-end="url(#arrRed)"/>
  <text x="182" y="198" fill="#ff7b72" font-size="9">error propagates</text>

  <!-- KiloProvider reaction box -->
  <rect x="380" y="220" width="300" height="80" fill="#161b22" stroke="#58a6ff" stroke-width="1.5" rx="6"/>
  <text x="530" y="238" fill="#58a6ff" font-size="11" font-weight="bold" text-anchor="middle">KiloProvider (extension host)</text>
  <text x="530" y="256" fill="#e6edf3" font-size="10" text-anchor="middle">receives swRegistrationFailed message</text>
  <text x="530" y="272" fill="#3fb950" font-size="10" text-anchor="middle">→ clears _webviewReadyTimer</text>
  <text x="530" y="288" fill="#3fb950" font-size="10" text-anchor="middle">→ triggers exponential backoff recovery</text>

  <!-- Arrow: Inner iframe → KiloProvider -->
  <line x1="320" y1="265" x2="378" y2="265" stroke="#58a6ff" stroke-width="1.5" marker-end="url(#arrBlue)"/>
  <text x="349" y="258" fill="#58a6ff" font-size="9" text-anchor="middle">postMessage</text>

  <!-- Timeline note at bottom -->
  <text x="350" y="340" fill="#8b949e" font-size="10" text-anchor="middle">VS Code does NOT auto-prune SW registrations on version update.</text>
  <text x="350" y="356" fill="#8b949e" font-size="10" text-anchor="middle">Both ScriptCache entries share VERSION=4 blob — Chromium sees no reason to evict.</text>
  <text x="350" y="372" fill="#f0883e" font-size="10" font-weight="bold" text-anchor="middle">Bug open since 2021: https://github.com/microsoft/vscode/issues/125993</text>

  <!-- Arrow markers -->
  <defs>
    <marker id="arr" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
      <path d="M0,0 L0,6 L8,3 z" fill="#8b949e"/>
    </marker>
    <marker id="arrRed" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
      <path d="M0,0 L0,6 L8,3 z" fill="#ff7b72"/>
    </marker>
    <marker id="arrBlue" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
      <path d="M0,0 L0,6 L8,3 z" fill="#58a6ff"/>
    </marker>
  </defs>

</svg>
```

---

## 3. Three-Layer Fix Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│  LAYER 1 — Auto-clear cache on version change  (PERMANENT FIX)      │
│                                                                      │
│  extension.ts: activate()                                            │
│    └─ clearSwCacheOnVersionChange(context, log)                      │
│         checks globalState["kilocode.swCache.lastClearedVersion"]    │
│         if different from current version:                           │
│           fs.rmSync(ScriptCache, { recursive, force })               │
│           fs.rmSync(Database,    { recursive, force })               │
│           globalState.update(key, currentVersion)                    │
│                                                                      │
│  Effect: Every KiloCode upgrade atomically wipes stale SW state.     │
│  Files are NOT exclusively locked while VS Code is running.          │
│  Fresh SW registration occurs on the next webview load.              │
├─────────────────────────────────────────────────────────────────────┤
│  LAYER 2 — Fast-fail SW probe  (50 ms detection)                     │
│                                                                      │
│  pre/index.html (inner iframe) on DOMContentLoaded:                  │
│    if (navigator.serviceWorker.controller === null)                  │
│      postMessage({ type: "swRegistrationFailed" })                   │
│    else                                                              │
│      postMessage({ type: "swRegistrationOk" })                       │
│                                                                      │
│  KiloProvider.ts case "swRegistrationFailed":                        │
│    clearTimeout(_webviewReadyTimer)   ← cancels 30 s timeout         │
│    trigger scheduleAttempt(0)         ← start backoff chain NOW      │
│                                                                      │
│  Effect: Failure detected in ~50 ms instead of waiting 30 s.        │
├─────────────────────────────────────────────────────────────────────┤
│  LAYER 3 — Exponential backoff recovery  (150 ms × 2^n ± jitter)    │
│                                                                      │
│  WEBVIEW_BACKOFF_BASE_MS     = 150  ms                               │
│  WEBVIEW_BACKOFF_MAX_ATTEMPTS = 5   (attempts 0-4)                   │
│  WEBVIEW_REINJECT_DELAY_MS   = 200  ms                               │
│  WEBVIEW_MAX_RESETS          = 3    (infinite-reset guard)           │
│                                                                      │
│  scheduleAttempt(n):                                                 │
│    delay = min(150 × 2^n ± 25 ms jitter, 5000 ms)                   │
│    after delay: webview.html = ""   ← forces new document            │
│    after 200 ms: re-inject html     ← triggers clean SW register     │
│    recurse to scheduleAttempt(n+1) if not ready                      │
│                                                                      │
│  Attempt delays:                                                     │
│    0 ≈  150 ms    1 ≈  300 ms    2 ≈  600 ms                        │
│    3 ≈ 1200 ms    4 ≈ 2400 ms                                        │
│  Worst-case total: ~4650 ms wait + 5 × 200 ms re-inject ≈ 5650 ms  │
│                                                                      │
│  After attempt 4 exhausted:                                          │
│    showErrorMessage("KiloCode: webview could not load after 5        │
│    auto-recovery attempts — VS Code service-worker race…")           │
│    offers "Fix: Clear SW Cache (instructions)" + "Reload Window Now" │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 4. Timeline Comparison: canary.3 (broken) vs canary.9 (fixed)

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 700 260" width="700" height="260" font-family="monospace" font-size="11">

  <!-- Background -->
  <rect width="700" height="260" fill="#0d1117" rx="8"/>
  <text x="350" y="24" fill="#e6edf3" font-size="13" font-weight="bold" text-anchor="middle">Recovery Timeline: canary.3 vs canary.9</text>

  <!-- ── canary.3 row ── -->
  <text x="8" y="60" fill="#ff7b72" font-size="11" font-weight="bold">canary.3</text>
  <text x="8" y="74" fill="#8b949e" font-size="9">(broken)</text>

  <!-- Timeline rail -->
  <line x1="90" y1="62" x2="680" y2="62" stroke="#30363d" stroke-width="1"/>

  <!-- Tick marks for canary.3 -->
  <!-- t=0: SW error -->
  <line x1="90" y1="56" x2="90" y2="68" stroke="#ff7b72" stroke-width="2"/>
  <text x="90" y="50" fill="#ff7b72" font-size="9" text-anchor="middle">t=0</text>
  <text x="90" y="82" fill="#ff7b72" font-size="9" text-anchor="middle">SW error</text>

  <!-- 30s timeout span -->
  <rect x="90" y="55" width="530" height="14" fill="#ff7b72" fill-opacity="0.15" rx="2"/>
  <text x="355" y="64" fill="#ff7b72" font-size="9" text-anchor="middle">waiting 30 s (_webviewReadyTimer — no fast-fail probe)</text>

  <!-- t=30s: timeout fires -->
  <line x1="620" y1="56" x2="620" y2="68" stroke="#ff7b72" stroke-width="2"/>
  <text x="620" y="50" fill="#ff7b72" font-size="9" text-anchor="middle">t=30 s</text>
  <text x="620" y="82" fill="#ff7b72" font-size="9" text-anchor="middle">timeout</text>

  <!-- t=30s+: error dialog -->
  <rect x="625" y="52" width="52" height="18" fill="#ff7b72" fill-opacity="0.35" rx="3"/>
  <text x="651" y="64" fill="#ff7b72" font-size="9" text-anchor="middle">error dlg</text>

  <!-- ── canary.9 row ── -->
  <text x="8" y="128" fill="#3fb950" font-size="11" font-weight="bold">canary.9</text>
  <text x="8" y="142" fill="#8b949e" font-size="9">(fixed)</text>

  <!-- Timeline rail -->
  <line x1="90" y1="130" x2="680" y2="130" stroke="#30363d" stroke-width="1"/>

  <!-- t=0: SW error -->
  <line x1="90" y1="124" x2="90" y2="136" stroke="#ff7b72" stroke-width="2"/>
  <text x="90" y="118" fill="#ff7b72" font-size="9" text-anchor="middle">t=0</text>
  <text x="90" y="148" fill="#ff7b72" font-size="9" text-anchor="middle">SW error</text>

  <!-- 50ms probe detection span -->
  <rect x="90" y="123" width="28" height="14" fill="#f0883e" fill-opacity="0.5" rx="2"/>
  <text x="104" y="132" fill="#f0883e" font-size="8" text-anchor="middle">50 ms</text>

  <!-- t=50ms: fast-fail probe -->
  <line x1="118" y1="124" x2="118" y2="136" stroke="#f0883e" stroke-width="2"/>
  <text x="118" y="118" fill="#f0883e" font-size="9" text-anchor="middle">~50 ms</text>
  <text x="118" y="148" fill="#f0883e" font-size="9" text-anchor="middle">probe</text>

  <!-- Backoff attempt 0: 150ms -->
  <rect x="118" y="123" width="40" height="14" fill="#58a6ff" fill-opacity="0.4" rx="2"/>
  <text x="138" y="132" fill="#58a6ff" font-size="8" text-anchor="middle">150 ms</text>

  <!-- t=~300ms: attempt 0 reset -->
  <line x1="158" y1="124" x2="158" y2="136" stroke="#58a6ff" stroke-width="2"/>
  <text x="158" y="148" fill="#58a6ff" font-size="9" text-anchor="middle">reset 0</text>

  <!-- reinject 200ms -->
  <rect x="158" y="123" width="27" height="14" fill="#58a6ff" fill-opacity="0.25" rx="2"/>
  <text x="171" y="132" fill="#58a6ff" font-size="8" text-anchor="middle">200ms</text>

  <!-- If recovered (green happy path) -->
  <rect x="185" y="119" width="80" height="22" fill="#3fb950" fill-opacity="0.3" rx="4" stroke="#3fb950" stroke-width="1"/>
  <text x="225" y="132" fill="#3fb950" font-size="10" font-weight="bold" text-anchor="middle">RECOVERED</text>

  <!-- OR path label -->
  <text x="290" y="132" fill="#8b949e" font-size="10" text-anchor="middle">— OR —</text>

  <!-- Auto-clear on next launch path -->
  <rect x="320" y="119" width="200" height="22" fill="#3fb950" fill-opacity="0.15" rx="4" stroke="#3fb950" stroke-width="1" stroke-dasharray="4,3"/>
  <text x="420" y="128" fill="#3fb950" font-size="9" text-anchor="middle">auto-clear on next launch</text>
  <text x="420" y="139" fill="#3fb950" font-size="9" text-anchor="middle">(Layer 1 — version change)</text>

  <!-- Legend -->
  <rect x="30" y="175" width="12" height="12" fill="#ff7b72" fill-opacity="0.6" rx="2"/>
  <text x="46" y="185" fill="#e6edf3" font-size="10">SW error / timeout</text>
  <rect x="140" y="175" width="12" height="12" fill="#f0883e" fill-opacity="0.7" rx="2"/>
  <text x="156" y="185" fill="#e6edf3" font-size="10">Fast-fail probe (Layer 2)</text>
  <rect x="295" y="175" width="12" height="12" fill="#58a6ff" fill-opacity="0.6" rx="2"/>
  <text x="311" y="185" fill="#e6edf3" font-size="10">Exponential backoff recovery (Layer 3)</text>
  <rect x="510" y="175" width="12" height="12" fill="#3fb950" fill-opacity="0.5" rx="2"/>
  <text x="526" y="185" fill="#e6edf3" font-size="10">Recovered / auto-clear</text>

  <!-- Summary comparison -->
  <text x="90" y="215" fill="#ff7b72" font-size="10">canary.3: error  ──────────────  30 000 ms  ──────────────▶  error dialog shown</text>
  <text x="90" y="232" fill="#3fb950" font-size="10">canary.9: error  ──  50 ms probe  ──  ~350 ms reset  ──▶  recovered (typical case)</text>
  <text x="90" y="249" fill="#3fb950" font-size="10">         OR: stale cache cleared automatically on next KiloCode version upgrade (Layer 1)</text>

</svg>
```

---

## 5. Cache Auto-Clear Flow (activate → rmSync)

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 700 420" width="700" height="420" font-family="monospace" font-size="11">

  <!-- Background -->
  <rect width="700" height="420" fill="#0d1117" rx="8"/>
  <text x="350" y="24" fill="#e6edf3" font-size="13" font-weight="bold" text-anchor="middle">Layer 1: Cache Auto-Clear Flow (extension.ts)</text>

  <!-- activate() entry -->
  <rect x="270" y="40" width="160" height="32" fill="#1f6feb" fill-opacity="0.6" rx="6" stroke="#58a6ff" stroke-width="1.5"/>
  <text x="350" y="61" fill="#e6edf3" font-size="11" text-anchor="middle">activate(context)</text>

  <!-- Arrow down -->
  <line x1="350" y1="72" x2="350" y2="96" stroke="#8b949e" stroke-width="1.5" marker-end="url(#a1)"/>

  <!-- clearSwCacheOnVersionChange() -->
  <rect x="215" y="96" width="270" height="32" fill="#161b22" stroke="#58a6ff" stroke-width="1.5" rx="6"/>
  <text x="350" y="117" fill="#79c0ff" font-size="11" text-anchor="middle">clearSwCacheOnVersionChange(context, log)</text>

  <!-- Arrow down -->
  <line x1="350" y1="128" x2="350" y2="152" stroke="#8b949e" stroke-width="1.5" marker-end="url(#a1)"/>

  <!-- getSwCacheDirs() -->
  <rect x="245" y="152" width="210" height="32" fill="#161b22" stroke="#30363d" stroke-width="1.5" rx="6"/>
  <text x="350" y="173" fill="#e6edf3" font-size="11" text-anchor="middle">getSwCacheDirs()</text>

  <!-- Returns annotation -->
  <text x="465" y="173" fill="#8b949e" font-size="9">→ [ScriptCache, Database]</text>

  <!-- Arrow down -->
  <line x1="350" y1="184" x2="350" y2="208" stroke="#8b949e" stroke-width="1.5" marker-end="url(#a1)"/>

  <!-- Diamond: lastClearedVersion === currentVersion? -->
  <polygon points="350,208 470,232 350,256 230,232" fill="#21262d" stroke="#f0883e" stroke-width="1.5"/>
  <text x="350" y="228" fill="#e6edf3" font-size="10" text-anchor="middle">lastClearedVersion</text>
  <text x="350" y="243" fill="#e6edf3" font-size="10" text-anchor="middle">=== currentVersion?</text>

  <!-- YES branch (right → return) -->
  <line x1="470" y1="232" x2="560" y2="232" stroke="#3fb950" stroke-width="1.5" marker-end="url(#a2)"/>
  <text x="513" y="226" fill="#3fb950" font-size="10" text-anchor="middle">YES</text>
  <rect x="560" y="218" width="100" height="28" fill="#161b22" stroke="#3fb950" stroke-width="1" rx="6"/>
  <text x="610" y="236" fill="#3fb950" font-size="10" text-anchor="middle">return (no-op)</text>

  <!-- NO branch (down) -->
  <line x1="350" y1="256" x2="350" y2="280" stroke="#ff7b72" stroke-width="1.5" marker-end="url(#a1)"/>
  <text x="362" y="272" fill="#ff7b72" font-size="10">NO</text>

  <!-- rmSync ScriptCache + Database -->
  <rect x="200" y="280" width="300" height="44" fill="#161b22" stroke="#ff7b72" stroke-width="1.5" rx="6"/>
  <text x="350" y="298" fill="#ff7b72" font-size="10" text-anchor="middle">fs.rmSync(ScriptCache, &#123; recursive: true, force: true &#125;)</text>
  <text x="350" y="314" fill="#ff7b72" font-size="10" text-anchor="middle">fs.rmSync(Database,    &#123; recursive: true, force: true &#125;)</text>

  <!-- Arrow down -->
  <line x1="350" y1="324" x2="350" y2="348" stroke="#8b949e" stroke-width="1.5" marker-end="url(#a1)"/>

  <!-- globalState.update -->
  <rect x="210" y="348" width="280" height="32" fill="#161b22" stroke="#3fb950" stroke-width="1.5" rx="6"/>
  <text x="350" y="369" fill="#3fb950" font-size="11" text-anchor="middle">globalState.update(key, currentVersion)</text>

  <!-- Arrow down -->
  <line x1="350" y1="380" x2="350" y2="400" stroke="#8b949e" stroke-width="1.5" marker-end="url(#a1)"/>

  <!-- Done -->
  <text x="350" y="414" fill="#8b949e" font-size="10" text-anchor="middle">Fresh SW registration will occur on next webview load</text>

  <!-- Markers -->
  <defs>
    <marker id="a1" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
      <path d="M0,0 L0,6 L8,3 z" fill="#8b949e"/>
    </marker>
    <marker id="a2" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
      <path d="M0,0 L0,6 L8,3 z" fill="#3fb950"/>
    </marker>
  </defs>

</svg>
```

---

## 6. Cross-Platform Cache Paths

| Platform | ScriptCache path | Database path |
|----------|-----------------|---------------|
| **Windows** | `%APPDATA%\Code\Service Worker\ScriptCache` | `%APPDATA%\Code\Service Worker\Database` |
| **macOS** | `~/Library/Application Support/Code/Service Worker/ScriptCache` | `~/Library/Application Support/Code/Service Worker/Database` |
| **Linux** | `~/.config/Code/Service Worker/ScriptCache` | `~/.config/Code/Service Worker/Database` |

**Implementation reference** (`extension.ts` `getSwCacheDirs()`):

```typescript
function getSwCacheDirs(): string[] {
  let base: string
  if (process.platform === "win32") {
    base = path.join(process.env.APPDATA ?? os.homedir(), "Code", "Service Worker")
  } else if (process.platform === "darwin") {
    base = path.join(os.homedir(), "Library", "Application Support", "Code", "Service Worker")
  } else {
    base = path.join(os.homedir(), ".config", "Code", "Service Worker")
  }
  return [path.join(base, "ScriptCache"), path.join(base, "Database")]
}
```

**Safety note:** VS Code does NOT hold exclusive locks on these files while running.
Confirmed by live test on VS Code 1.117.0 (Agent A, 2026-04-27). `fs.rmSync` is safe
to call from `activate()` without killing or pausing VS Code.

---

## 7. Stale Entry Analysis (Agent A Findings)

### LevelDB Registration Records

The `Service Worker\Database` (LevelDB) stores one record per webview origin using
the prefix scheme `REG:`, `REGID_TO_ORIGIN:`, `INITDATA_UNIQUE_ORIGIN:`. On the
affected machine two registrations were present simultaneously:

| Registration | REGID | Origin subdomain | ScriptCache entry | Born | Status |
|---|---|---|---|---|---|
| **Registration 0** | 0 | `vscode-webview://1b9ujhlce718co96gdhi6h0gl4sm3lu61b741ptvp54khuclm32i/` | `2cc80dabc69f58b6_0` | 17:53:46 | **ZOMBIE (stale)** |
| **Registration 1** | 1 | `vscode-webview://15gdepo4qhojd3b7nmdfad94m1kcv0b4v25i6g4h29odl6v5jj28/` | `4cb013792b196a35_0` | 19:57:34 | Active |

### Why REGID 0 is a Zombie

Each VS Code webview gets a cryptographically random subdomain in the
`vscode-webview://` protocol. When a webview panel is closed or the window
reloads, the associated document is destroyed. Chromium's embedded renderer
marks the service worker as *redundant* in memory, but **never writes a
corresponding deletion to the LevelDB** — the registration record for REGID 0
persists indefinitely.

When VS Code opens a new webview with a different random origin and that webview's
`pre/index.html` calls `navigator.serviceWorker.register()`, Chromium walks the
LevelDB and finds REGID 0. The associated document context is gone (document
state = "unloading" / destroyed), so Chromium's registration check throws:

```
InvalidStateError: Failed to register a ServiceWorker:
  The document is in an invalid state.
```

### Shared Script Hash

Both registrations cached the **identical script blob**:

```
VERSION = 4  →  cache name "vscode-resource-cache-4"
SHA-256: 1CBB8DD18C998B2D9287D2C43DC80A40B928FB8761CECE8B40C8360ED1AF948E
Size:    16,270 bytes (Chrome SimpleCache entry, magic 30 5C 72 A7 1B 6D FB FC)
```

Because the script hash is identical, Chromium's HTTP cache sees no reason to
evict either entry. The `the-real-index` file (updated 19:57:54) references both
`2cc80dabc69f58b6_0` (REGID 0, stale) and `4cb013792b196a35_0` (REGID 1, active)
— neither is evicted by normal cache pressure.

### What VS Code Does NOT Do on Version Upgrade

- Does **not** prune orphaned SW registrations from LevelDB
- Does **not** evict ScriptCache entries with the same script version (`VERSION=4`)
- Does **not** call `serviceWorkerRegistration.unregister()` for old webview origins
- The SW `activate` handler sweeps *named runtime caches* (`vscode-resource-cache-*`)
  but has no access to the Chromium HTTP ScriptCache layer

### Resolution

Wiping both `ScriptCache\` and `Database\` forces Chromium to start with zero
registrations on the next VS Code launch. The KiloCode `clearSwCacheOnVersionChange`
function does this automatically once per extension version, ensuring all users
are protected after any upgrade — without requiring manual intervention.

---

## Source Files

- `packages/kilo-vscode/src/extension.ts` — `getSwCacheDirs()`, `clearSwCacheOnVersionChange()`, `activate()` (lines 50–105)
- `packages/kilo-vscode/src/KiloProvider.ts` — `WEBVIEW_BACKOFF_BASE_MS`, `WEBVIEW_BACKOFF_MAX_ATTEMPTS`, `scheduleAttempt()`, `case "swRegistrationFailed"`, `case "swRegistrationOk"` (lines 141–162, 1244–1285, 3688–3770)
- `docs/sw-fix-research/AGENTA_SW_CACHE.md` — Agent A live filesystem investigation, LevelDB record dump, stale entry confirmation
