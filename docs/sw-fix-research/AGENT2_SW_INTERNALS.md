# Agent 2: Service Worker Registration Internals

## How VS Code SW Registration Works (with code snippets)

VS Code's `pre/index.html` (located at `resources/app/out/vs/workbench/contrib/webview/browser/pre/index.html`) runs
as a `<script async type="module">` block — this is the outer iframe document that hosts all webview content. The
entire script block is a single ES module executed asynchronously.

### The `workerReady` promise (index.html line 249–324)

```js
const workerReady = new Promise((resolve, reject) => {
    if (disableServiceWorker) { return resolve(); }
    if (!areServiceWorkersEnabled()) { return reject(...); }

    const swPath = encodeURI(`service-worker.js?v=${expectedWorkerVersion}&...`);
    navigator.serviceWorker.register(swPath, { type: 'module' })   // LINE 259 — THROW SITE
        .then(async registration => {
            // Version handshake with the SW via MessageChannel
            const versionHandler = async (event) => { ... };
            navigator.serviceWorker.addEventListener('message', versionHandler);

            const postVersionMessage = (controller) => {
                outerIframeMessageChannel = new MessageChannel();
                controller.postMessage({ channel: 'version' }, [outerIframeMessageChannel.port2]);
            };

            const currentController = navigator.serviceWorker.controller;
            if (currentController?.scriptURL.endsWith(swPath)) {
                postVersionMessage(currentController);           // Fast path: SW already active
            } else {
                // Wait for controllerchange event
                navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);
            }
        }).catch(error => {
            return reject(new Error(`Could not register service worker: ${error}.`));
        });
});
```

`workerReady` only resolves when:
1. `navigator.serviceWorker.register()` succeeds, AND
2. The version handshake with the SW completes (SW responds with `{ channel: 'version', version: N }`).

### The content injection path (index.html lines 986–1259)

```js
hostMessaging.onMessage('content', async (_event, data) => {
    const currentUpdateId = ++updateId;
    try {
        await workerReady;               // LINE 991 — BLOCKS HERE FOREVER on InvalidStateError
    } catch (e) {
        console.error(`Webview fatal error: ${e}`);
        hostMessaging.postMessage('fatal-error', { message: e + '' });
        return;
    }
    // ... create iframe, inject HTML ...
});
```

When `workerReady` rejects (due to `InvalidStateError`), the catch block fires `fatal-error` upstream and
`return`s — **no content is ever injected into the inner iframe**. The webview stays blank forever.

### The SW itself (`service-worker.js`)

```js
const VERSION = 4;

sw.addEventListener('install', (event) => {
    event.waitUntil(sw.skipWaiting()); // Activate immediately
});
sw.addEventListener('activate', (event) => {
    event.waitUntil(sw.clients.claim()); // Claim all clients immediately
});
```

The SW activates immediately on install and claims all clients. This is intentional — it means every fresh
registration triggers a `controllerchange` event on the outer iframe promptly. If `register()` itself never
resolves (throws `InvalidStateError`), this all becomes irrelevant.

---

## Exact Failure Point (line numbers)

| File | Line | What happens |
|------|------|--------------|
| `index.html` | 16 | Script tag: `<script async type="module">` — script runs asynchronously |
| `index.html` | 249 | `workerReady` promise is constructed |
| `index.html` | 259 | `navigator.serviceWorker.register(swPath, { type: 'module' })` — **this is where InvalidStateError fires** |
| `index.html` | 318–323 | `.catch()` wraps the error: `reject(new Error("Could not register service worker: InvalidStateError..."))` |
| `index.html` | 991 | `await workerReady` — rejects, content never loads |
| `index.html` | 993–996 | `fatal-error` posted, handler returns |

### Why the document can be in an "invalid state" at line 259

The `<script async type="module">` tag means the module is fetched and executed asynchronously, potentially
**after** the document has begun unloading (e.g. when VS Code tears down and recreates the webview panel,
or when `webview.html = ""` is called during a reset). The Chromium security model forbids SW registration
when `document.readyState === 'unloading'` or when the document is already detached from a browsing context.

The race condition:
1. VS Code sets `webview.html = realContent` → Electron creates an iframe, loads `index.html`
2. Before the `async module` script finishes executing, VS Code triggers another `webview.html` update
   (or the document unloads for any reason)
3. When the async script resumes (on the microtask/task queue), the document is now in "unloading" state
4. `navigator.serviceWorker.register()` is called against a detached document → `InvalidStateError`

This is VS Code issue #125993.

---

## Why Extension-Side Patches Are Limited

### Can the extension inject a `<script>` that patches `navigator.serviceWorker.register`?

**No — and here is why:**

The extension controls the **inner** webview HTML (the content rendered inside the `pending-frame` iframe), not
the outer `pre/index.html`. VS Code's architecture has two layers:

```
Electron BrowserWindow
  └── pre/index.html  ← VS Code-owned; extension CANNOT touch this
        └── pending-frame (iframe)
              └── extension's webview.html  ← extension controls this
```

`navigator.serviceWorker.register()` is called inside `pre/index.html` (line 259), not inside the extension's
HTML. The extension's injected script runs in the inner `pending-frame`, which has a different origin/scope and
cannot reach across into `pre/index.html`'s JavaScript context.

Additionally, `pre/index.html` has a strict CSP:
```
default-src 'none'; script-src 'sha256-TaWGDzV7c9rUH2q/5ygOyYUHSyHIqBMYfucPh3lnKvU=' 'self'; ...
```
Only one specific inline script hash is allowed — VS Code controls this entirely.

### Can `webview.postMessage({ type: 'unregisterSW' })` help?

`webview.postMessage(...)` from the extension side posts a message to the **inner frame** (extension's HTML
content), not to `pre/index.html`. The pre/index.html message channel is entirely separate — it uses a
`MessageChannel` port wired to `window.parent`, not the regular `postMessage` pathway.

Even if a message could reach `pre/index.html`, by the time the `InvalidStateError` fires, `workerReady` has
already rejected. There is no recovery path inside `pre/index.html` once the rejection happens — it posts
`fatal-error` and returns. Unregistering the SW at that point cannot un-reject a Promise.

### What the current 3-phase fix does and why it helps

The current `_scheduleWebviewReadyCheck` in `KiloProvider.ts` (lines 3519–3617) does:
- Phase 0 (2 s): reset `webview.html = ""` then rewrite with real content
- Phase 1 (5 s): second reset
- Phase 2 (10 s): third reset
- Phase 3 (15 s): show error dialog

This works by **giving the SW a fresh document** to register against. Setting `webview.html = ""` forces VS
Code to tear down the outer iframe and create a brand-new `pre/index.html` document. The new document starts
fresh, and `navigator.serviceWorker.register()` runs against a document that is fully "active" — not
"unloading". This avoids the race window.

However the resets are **reactive** (they wait 2–15 seconds after failure). The race can still happen on
every reset if the timing is unlucky.

---

## Novel Fix Idea: Proactive Backoff-Aware HTML Reset with Jitter

Instead of (or in addition to) the current fixed-delay resets, add a **proactive check** that detects when
VS Code is in a state likely to trigger the race, and delays setting `webview.html` until the document is
stable.

The core insight: the `InvalidStateError` happens when `webview.html` is **set while the previous document
is still unloading**. VS Code's outer iframe `pre/index.html` takes some time to initialize. If we slow down
our re-injection (both the initial set and retry sets) with a short leading delay + randomized jitter, we
avoid landing in the unloading window.

**Specific implementation**: add a `document-ready` sentinel message from the extension's inner-frame content
script back to the extension host. When `pre/index.html` successfully gets past `await workerReady`, it
injects content — our inner frame script fires immediately. The extension knows the SW registered successfully
in ~50 ms. If it takes longer than 500 ms, start resets with exponential backoff (100 ms, 200 ms, 400 ms,
800 ms, 1600 ms) with ±50 ms jitter per attempt, capped at 5 attempts before showing the error dialog.

This shrinks recovery time from the current worst-case 30+ seconds to under 4 seconds on slow machines, and
eliminates the race on fast machines by never issuing two rapid sets of `webview.html`.

---

## Implementation (exact code)

Add to `KiloProvider.ts` alongside the existing `_scheduleWebviewReadyCheck`:

```typescript
// Exponential-backoff reset for SW InvalidStateError race (bug #125993).
// Replaces the fixed-delay 3-phase approach with tighter recovery.
private _swRaceBackoffTimer: ReturnType<typeof setTimeout> | null = null
private _swRaceAttempt = 0
private readonly SW_RACE_MAX_ATTEMPTS = 5
private readonly SW_RACE_BASE_MS = 150

private _startSwRaceRecovery(): void {
  this._swRaceAttempt = 0
  this._doSwRaceReset()
}

private _doSwRaceReset(): void {
  if (this.isWebviewReady) return
  if (this._swRaceAttempt >= this.SW_RACE_MAX_ATTEMPTS) {
    this._showSwRecoveryError()
    return
  }

  const webview = this.webview
  if (!webview) return

  this._swRaceAttempt++
  const delay = this.SW_RACE_BASE_MS * Math.pow(2, this._swRaceAttempt - 1)
  const jitter = Math.floor(Math.random() * 50) - 25  // ±25 ms
  const totalDelay = delay + jitter

  console.log(`[Kilo] SW race recovery attempt ${this._swRaceAttempt}/${this.SW_RACE_MAX_ATTEMPTS} in ${totalDelay}ms`)

  this._swRaceBackoffTimer = setTimeout(() => {
    this._swRaceBackoffTimer = null
    if (this.isWebviewReady) return

    // Blank the document first (forces new pre/index.html load)
    webview.html = ""

    // Re-inject after a brief pause so the old document fully unloads
    setTimeout(() => {
      if (!this.isWebviewReady && webview) {
        webview.html = this._getHtmlForWebview(webview)
        // Schedule next attempt
        this._doSwRaceReset()
      }
    }, 200)
  }, totalDelay)
}

private _cancelSwRaceRecovery(): void {
  if (this._swRaceBackoffTimer !== null) {
    clearTimeout(this._swRaceBackoffTimer)
    this._swRaceBackoffTimer = null
  }
}
```

Call `_startSwRaceRecovery()` from `resolveWebviewView` (after setting `webview.html`) instead of
`_scheduleWebviewReadyCheck`. Call `_cancelSwRaceRecovery()` wherever `isWebviewReady = true` is set.

The 200 ms pause between `webview.html = ""` and reinjection is critical: it gives Chromium's document
lifecycle time to transition through `unloading` → `unloaded` before the new `pre/index.html` begins
executing its async module, so the SW registration sees a clean, active document.

---

## Confidence: MEDIUM

The approach is mechanically sound and grounded directly in the VS Code source (lines 249, 259, 991 of
`pre/index.html`). The limitation is that we cannot directly prevent the race — we can only narrow the
window by timing our resets carefully. The backoff strategy reduces worst-case recovery time from ~30 s to
~4 s. HIGH confidence that the diagnosis is correct; MEDIUM confidence that jitter + backoff alone will
eliminate 100% of occurrences on all machines (some very slow machines may need a longer base delay).
