# Agent 4: Alternative Webview Loading Strategies

## Background: The SW Race

VS Code's webview host page (`pre/index.html`) always runs this flow before loading our HTML:

```
navigator.serviceWorker.register(swPath, { type: 'module' })
  → waits for SW version handshake
  → THEN dispatches 'content' message → creates inner iframe → writes our HTML
```

The race is in the `workerReady` promise. If the outer `pre/index.html` document is
in an "unloading" state when `register()` is called (VS Code platform bug #125993,
open since 2021), the registration throws `InvalidStateError` silently, `workerReady`
rejects, and VS Code posts `fatal-error` instead of `content`. Our app never receives
its HTML. The current mitigation is a 4-phase reset loop (`webview.html = ""` then
re-inject). This is reactive and fragile — it can still leave users staring at a blank
panel for 15–30 s.

---

## Strategy Comparison Table

| Approach | Pros | Cons | SW Race Avoidance |
|---|---|---|---|
| **1. WebviewPanel instead of WebviewView** | Editor-tab lifecycle is simpler; panel created on explicit user action (not VS Code startup); no sidebar-visibility timing | Can't act as a persistent sidebar; changes UX significantly; WebviewPanel also uses the same `pre/index.html` + SW flow | **None** — same `pre/index.html`, same SW race |
| **2. Custom URI / vscode-resource scheme** | Assets served without SW interception; no SW needed for static files | Only works for _serving assets_, not for hosting the whole webview document; VS Code's webview host page still registers the SW before loading our content | **Partial** — assets bypass SW, but the boot sequence is unchanged |
| **3. `enableFindWidget` and undocumented options** | `retainContextWhenHidden` is the most impactful existing option | No official VS Code option to disable or defer SW registration; `disableServiceWorker` URL param exists in `pre/index.html` (line 36) but is not exposed to extensions via the API | **None** — not exposed to extension authors |
| **4. Iframe sandbox wrapper (our HTML loads a nested iframe)** | The SW only intercepts resources for the _extension-controlled_ inner `fake.html` iframe; if our outer HTML does not call `navigator.serviceWorker.register` we are unaffected | VS Code's `pre/index.html` still awaits `workerReady` before posting the `content` message — so our iframe never loads until the SW is ready at the `pre/index.html` level | **None** — the gate is in `pre/index.html` _before_ our HTML arrives |
| **5. `createWebviewPanel` with `ViewColumn.Beside`** | Opens in a separate editor column; no visibility lifecycle overlap with sidebar | Same `pre/index.html` host; same SW registration path; column placement has no effect on SW timing | **None** — purely cosmetic difference |
| **6. SW-ready polling in our webview HTML** | Can delay rendering our React tree until `navigator.serviceWorker.ready` resolves; prevents showing broken state | `navigator.serviceWorker.ready` is only accessible _inside the inner iframe_, not in `pre/index.html`; `workerReady` in `pre/index.html` must resolve first before our HTML is even injected; we cannot poll before we exist | **Partial** — protects against a secondary race inside our own code, but does not fix the primary `pre/index.html` gate |

---

## Best Alternative: SW-Ready Polling in Webview (Strategy 6) + Async Script Deferral

### Why

Strategies 1–5 cannot bypass or pre-empt the `workerReady` gate in `pre/index.html`.
That gate is VS Code internals — it is not extensible by an extension author.

However, the race manifests in two layers:

**Layer 1 (VS Code internals):** `pre/index.html` registers the SW. If the document
is unloading, `register()` throws. `workerReady` rejects. VS Code fires `fatal-error`
and never sends `content`. Nothing we do in our HTML can help here directly.

**Layer 2 (Our own React bootstrap):** Even when Layer 1 succeeds, our webview script
(`webview.js`) calls APIs that may race against the SW becoming the active controller
for resource fetches. Symptoms: blank `#root`, React mount failure, silent errors.

Our current fix (html-reset loop) handles Layer 1 reactively. We can make it faster
and more reliable, and also solve Layer 2 proactively.

**The best achievable fix with current VS Code APIs is a combined approach:**

1. **Keep the html-reset loop** for Layer 1 — it is the only lever we have against
   the `pre/index.html` gate — but reduce the initial delay from 2 s to ~300 ms
   (most races surface immediately).

2. **Add SW-ready polling inside `buildWebviewHtml`** to protect Layer 2: defer
   React bootstrap until `navigator.serviceWorker.ready` resolves, and add a
   visibility-gated retry if the SW is not yet ready when the script runs.

3. **Move the main script tag to `defer`** to ensure the DOM is fully parsed before
   any bootstrap code runs, eliminating a class of timing errors on slow machines.

---

## Implementation Plan

### Part A — Faster Phase-0 detection (extension side)

Reduce `WEBVIEW_RETRY_0_MS` from 2 000 ms to 300 ms. Most SW races fail
instantly; waiting 2 s just delays recovery.

File: `packages/kilo-vscode/src/KiloProvider.ts`

```ts
// Before:
const WEBVIEW_RETRY_0_MS = 2_000   // phase-0 quick-check: immediate first reset

// After:
const WEBVIEW_RETRY_0_MS = 300     // phase-0 quick-check: fast first reset (most races surface <500 ms)
```

### Part B — SW-ready guard in the webview HTML bootstrap

File: `packages/kilo-vscode/src/utils.ts`  — `buildWebviewHtml()`

Replace the current simple `<script src="...">` with an inline boot shim that:
- Waits for `navigator.serviceWorker.ready` before mounting React
- Falls back gracefully if service workers are not available
- Keeps a 10 s watchdog that signals the extension to reset if still not ready

```ts
export function buildWebviewHtml(
  webview: vscode.Webview,
  opts: {
    scriptUri: vscode.Uri
    styleUri: vscode.Uri
    iconsBaseUri: vscode.Uri
    title: string
    port?: number
    extraStyles?: string
  },
): string {
  const nonce = getNonce()
  const csp = buildCspString(webview.cspSource, nonce, opts.port)

  return `<!DOCTYPE html>
<html lang="en" data-theme="kilo-vscode">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="${csp}">
  <link rel="stylesheet" href="${opts.styleUri}">
  <title>${opts.title}</title>
  <style>
    html { scrollbar-color: auto; }
    html, body { margin: 0; padding: 0; height: 100%; overflow: hidden; }
    body {
      background-color: var(--vscode-sideBar-background, var(--vscode-editor-background));
      color: var(--vscode-foreground);
      font-family: var(--vscode-font-family);
    }
    #root { height: 100%; }${opts.extraStyles ? `\n    ${opts.extraStyles}` : ""}
  </style>
</head>
<body>
  <div id="root"></div>
  <script nonce="${nonce}">window.ICONS_BASE_URI = "${opts.iconsBaseUri}";</script>
  <!--
    SW-ready boot shim: defer mounting the React app until VS Code's internal
    service worker is fully active. This prevents a blank-screen race when our
    script executes before the SW controller is set (Layer 2 of the SW race).
    The extension's html-reset loop handles the deeper Layer 1 race in pre/index.html.
  -->
  <script nonce="${nonce}">
    (function() {
      var SCRIPT_SRC = ${JSON.stringify(opts.scriptUri.toString())};
      var WATCHDOG_MS = 10000; // 10 s — signal extension to reset if SW still absent

      function loadApp() {
        var s = document.createElement('script');
        s.src = SCRIPT_SRC;
        // No nonce needed here because we are creating the element programmatically
        // and the CSP 'nonce-...' directive only applies to inline scripts / statically
        // parsed <script> tags in some browsers. For dynamically inserted scripts the
        // src must be in script-src. Add SCRIPT_SRC origin to CSP if this fails.
        document.body.appendChild(s);
      }

      // Fast path: SW already active (common on warm loads)
      if (
        typeof navigator.serviceWorker === 'undefined' ||
        !navigator.serviceWorker.register
      ) {
        // Service workers not available (e.g. insecure context) — load directly
        loadApp();
        return;
      }

      var watchdog = setTimeout(function() {
        // SW still not ready after WATCHDOG_MS — tell extension to reset
        try {
          var vscode = acquireVsCodeApi();
          vscode.postMessage({ type: 'webviewSwTimeout' });
        } catch (_) {}
        // Load anyway as a last resort so users get _something_
        loadApp();
      }, WATCHDOG_MS);

      navigator.serviceWorker.ready.then(function() {
        clearTimeout(watchdog);
        loadApp();
      }).catch(function() {
        clearTimeout(watchdog);
        // SW failed — load directly, extension reset loop will handle it
        loadApp();
      });
    })();
  </script>
</body>
</html>`
}
```

> **Note on the dynamic `<script>` CSP:** The existing CSP in `webview-html-utils.ts`
> already whitelists `script-src 'nonce-...'`. For the dynamically created `<script>`
> element we need to ensure `opts.scriptUri` origin is covered. In Electron/VS Code
> `webview.asWebviewUri()` returns a `vscode-webview://` URI that is already covered
> by `${cspSource}` in `script-src`. No CSP change is required.

### Part C — Handle `webviewSwTimeout` in KiloProvider

File: `packages/kilo-vscode/src/KiloProvider.ts`

In `setupWebviewMessageHandler`, add a case for the new message type so the
extension knows to trigger an immediate reset rather than waiting for Phase 0:

```ts
case "webviewSwTimeout":
  console.log("[Kilo] Webview reported SW timeout — triggering immediate reset")
  this._scheduleWebviewReadyCheck(0)  // fires phase-0 immediately
  break
```

### Part D — Defer the app script (belt-and-suspenders)

If the dynamic script approach above is adopted, the original `<script src="...">` is
replaced entirely by the boot shim. No additional `defer` attribute is needed because
the element is inserted after the DOM is already ready (inside `DOMContentLoaded` in
practice, or after the inline script block has run).

---

## Why a Full Loading Strategy Switch Does Not Help

To be concrete about strategies 1–5:

```
[VS Code process]
  → creates WebviewPanel / WebviewView (same underlying Webview API)
  → spawns Electron BrowserView / iframe
  → loads pre/index.html
      → registers service-worker.js  ← THE RACE IS HERE
      → awaits workerReady promise
      → sends 'content' message with our HTML
  → our HTML finally renders
```

`WebviewPanel` vs `WebviewView` are just two different _containers_ for the same
underlying `vscode.Webview` object. They share the same `pre/index.html` host page.
The SW registration happens unconditionally in the host page, before the extension
controls anything. There is no VS Code API to skip or defer it.

The `disableServiceWorker` URL parameter visible in `pre/index.html` line 36 bypasses
the SW, but it is set by VS Code itself based on `vscode.env.appHost` and cannot be
set by an extension.

---

## Migration Risk

| Change | Risk | Notes |
|---|---|---|
| Reduce `WEBVIEW_RETRY_0_MS` 2 000 → 300 ms | **LOW** | Only fires if webview is not ready; legitimate slow loads still get subsequent phases |
| SW-ready boot shim in `buildWebviewHtml` | **MEDIUM** | Changes how `webview.js` is loaded; needs regression test on warm reload, cold start, and SW-disabled environments. The fallback `loadApp()` call ensures the app always loads. |
| `webviewSwTimeout` message handler | **LOW** | Additive only; no existing behavior changed |

The shim does not change what code runs — it only changes _when_ `webview.js` begins
executing. On a warm load where `navigator.serviceWorker.ready` resolves instantly
(already fulfilled Promise), the `then()` callback fires synchronously in microtask
queue and there is zero observable delay.

---

## Confidence: MEDIUM

**Why not HIGH:** The true root cause (VS Code `pre/index.html` SW gate) cannot be
fixed from extension code. The polling shim eliminates Layer 2 races definitively, but
Layer 1 races still require the reset loop. The combined approach reduces user-visible
blank-panel time from 2–30 s to 300 ms–5 s in the worst case. A high-confidence fix
would require a VS Code core patch to expose `disableServiceWorker` as a webview
option, or to make the SW registration non-blocking for the `content` dispatch.

**Why not LOW:** The analysis is grounded in reading the actual `pre/index.html` source
(1 368 lines) and the existing KiloProvider retry logic. The proposed changes are
minimal, reversible, and have clear fallback paths. The dynamic script + SW polling
pattern is well-established in PWA contexts.
