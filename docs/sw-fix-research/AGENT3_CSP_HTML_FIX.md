# Agent 3: CSP & HTML Construction Fix

## Current CSP Analysis

### Files examined

- `packages/kilo-vscode/src/utils.ts` — `buildWebviewHtml()` assembles the full HTML string
- `packages/kilo-vscode/src/webview-html-utils.ts` — `buildCspString()` builds the CSP header
- `packages/kilo-vscode/src/KiloProvider.ts` — `resolveWebviewView()` / `_getHtmlForWebview()` set `webview.html`

### Current CSP directives (verbatim from `webview-html-utils.ts`)

```
default-src 'none';
style-src 'unsafe-inline' <cspSource>;
script-src 'nonce-<nonce>' 'wasm-unsafe-eval';
font-src <cspSource>;
connect-src <cspSource> http://127.0.0.1:* http://localhost:* ws://127.0.0.1:* ws://localhost:* https://*.tts.speech.microsoft.com https://texttospeech.googleapis.com https://api.openai.com https://api.elevenlabs.io https://polly.*.amazonaws.com;
img-src <cspSource> data: https:;
worker-src <cspSource> blob:;
```

`<cspSource>` = `webview.cspSource` at runtime (e.g. `vscode-webview://...`).

### Key observations

1. `worker-src <cspSource> blob:` is already present with an explicit comment explaining *why* (VS Code bug #125993). This is the critical directive needed for the VS Code internal SW (`vscode-webview://<id>/service-worker.js`).

2. `script-src` uses a per-load nonce. The SW script itself is served by VS Code's own webview preloader — it does NOT need to pass through the extension's `script-src` because it is loaded at the platform level, before the CSP meta tag takes effect. However, any inline `<script>` added by the extension *does* require a matching nonce.

3. `connect-src` already includes `<cspSource>`, which covers the VS Code internal origin. SW fetch interception happens at the platform level, so `connect-src` is not the bottleneck for SW registration itself.

4. `default-src 'none'` means everything not explicitly allowed is blocked — the current policy is already restrictive and intentional.

### CSP verdict: **already correct for SW registration**

The `worker-src` directive with `<cspSource> blob:` is the only CSP change needed to unblock VS Code's internal SW, and it is already present as of the current code. The InvalidStateError is NOT caused by a missing or wrong CSP directive — it is caused by the outer iframe being in an "unloading" state when `navigator.serviceWorker.register()` is called (VS Code platform bug #125993, open since 2021).

---

## What CSP Changes Could Help

### No CSP changes are needed for the core bug

The root cause is a document lifecycle race, not a policy restriction. Adding more permissive CSP directives would have no effect on the `InvalidStateError`.

### One marginal improvement: add `'self'` to `worker-src`

Current: `worker-src <cspSource> blob:`

The VS Code webview preloader is accessed via `<cspSource>` (the `vscode-webview://` origin), so technically already covered. However, some older VS Code builds use a slightly different origin string. Adding `'self'` as a belt-and-suspenders measure costs nothing:

```
worker-src 'self' <cspSource> blob:
```

This change would go in `buildCspString()` in `webview-html-utils.ts`:

```ts
`worker-src 'self' ${cspSource} blob:`,
```

### Confidence for this change: LOW value (belt-and-suspenders only)

---

## SW Interception Script (code)

This script should be injected as the **first** `<script nonce="...">` tag in the webview `<head>`, before the main `webview.js` bundle loads. It wraps `navigator.serviceWorker.register()` and immediately posts a message back to the extension when registration fails, enabling sub-2 s fast-fail detection.

```html
<script nonce="${nonce}">
(function() {
  // SW registration fast-fail interceptor.
  // Wraps navigator.serviceWorker.register() to catch InvalidStateError
  // (VS Code platform bug #125993) and notify the extension immediately
  // instead of waiting for the 2 s polling timer.
  if (!navigator.serviceWorker) return;

  const _originalRegister = navigator.serviceWorker.register.bind(navigator.serviceWorker);
  navigator.serviceWorker.register = function(scriptURL, options) {
    const vscode = typeof acquireVsCodeApi === 'function' ? acquireVsCodeApi() : null;
    const registration = _originalRegister(scriptURL, options);
    registration.catch(function(err) {
      // Post failure signal back to extension host immediately.
      const isInvalidState =
        err && (err.name === 'InvalidStateError' || (err.message && err.message.includes('invalid state')));
      if (vscode) {
        vscode.postMessage({
          type: 'swRegistrationFailed',
          errorName: err ? err.name : 'unknown',
          errorMessage: err ? err.message : 'unknown',
          isInvalidState: !!isInvalidState,
          scriptURL: String(scriptURL),
        });
      }
      // Also emit to console so devtools captures it.
      console.warn('[Kilo] SW registration failed:', err);
    });
    return registration;
  };
})();
</script>
```

### Where to inject in `utils.ts`

In `buildWebviewHtml()`, add the interceptor script tag immediately before `window.ICONS_BASE_URI`:

```ts
// In buildWebviewHtml(), replace the body section:
<body>
  <div id="root"></div>
  <script nonce="${nonce}">${swInterceptorScript}</script>
  <script nonce="${nonce}">window.ICONS_BASE_URI = "${opts.iconsBaseUri}";</script>
  <script nonce="${nonce}" src="${opts.scriptUri}"></script>
</body>
```

Where `swInterceptorScript` is the inline function above, templated out as a constant.

**Important:** `acquireVsCodeApi()` may only be called once per webview load. The interceptor should check whether it was already called and cache the result, or use a module-level singleton. In practice, since the interceptor runs before `webview.js` (which calls `acquireVsCodeApi()` itself), we must pass the vscode handle via a shared global:

```ts
// Alternative — store vscode handle globally for reuse by both the interceptor
// and the main bundle:
<script nonce="${nonce}">
window.__vscodeApi = acquireVsCodeApi();
// SW interceptor uses window.__vscodeApi
...
</script>
```

However, if `webview.js` already calls `acquireVsCodeApi()` internally, the simplest approach is to set `window.__swFailed = true` in the catch handler, and have `webview.js` check that flag on startup and post the message itself. This avoids the double-acquisition problem entirely.

---

## Fast-fail detection implementation

### Extension side (KiloProvider.ts)

Add a new `case "swRegistrationFailed":` handler in `setupWebviewMessageHandler()`:

```ts
case "swRegistrationFailed": {
  const { errorName, errorMessage, isInvalidState } = message as {
    errorName: string;
    errorMessage: string;
    isInvalidState: boolean;
  };
  console.warn(
    `[Kilo] SW registration failure reported by webview: ${errorName}: ${errorMessage}`,
  );
  // Cancel the slow polling chain — we already know SW failed.
  if (this._webviewReadyTimer !== null) {
    clearTimeout(this._webviewReadyTimer);
    this._webviewReadyTimer = null;
  }
  if (this._webviewReinjectTimer !== null) {
    clearTimeout(this._webviewReinjectTimer);
    this._webviewReinjectTimer = null;
  }
  // Immediately trigger a reset instead of waiting for WEBVIEW_RETRY_0_MS (2 s).
  if (isInvalidState && this._webviewResetCount < WEBVIEW_MAX_RESETS) {
    this._webviewResetCount++;
    const webview = this.webview;
    if (webview) {
      console.log("[Kilo] Fast-fail SW reset triggered by webview report");
      webview.html = "";
      this._webviewReinjectTimer = setTimeout(() => {
        this._webviewReinjectTimer = null;
        if (!this.isWebviewReady && webview) {
          webview.html = this._getHtmlForWebview(webview);
          this._scheduleWebviewReadyCheck(WEBVIEW_READY_TIMEOUT_MS);
        }
      }, 300);
    }
  }
  break;
}
```

### Timing improvement

| Scenario | Current (polling) | With fast-fail |
|----------|-------------------|----------------|
| SW fails immediately | First reset at 2 s | Reset at ~50 ms |
| SW fails slowly | First reset at 2–5 s | Reset at ~50 ms after SW rejects |
| SW succeeds | No reset | No reset (interceptor silent) |

The 2 s `WEBVIEW_RETRY_0_MS` constant was specifically introduced as a "quick-check" for fast-failing races. The interception approach replaces the need for this constant entirely, reducing time-to-recovery from ~2 s to ~50 ms (network round-trip + `postMessage` latency).

### Flag-based fallback (avoids double acquireVsCodeApi)

If integrating `acquireVsCodeApi()` in the interceptor is too risky, use a flag:

**In the interceptor script (injected inline):**
```js
window.__kiloSwFailed = null; // null = pending, true/false = known
navigator.serviceWorker.register = function(scriptURL, options) {
  const p = _originalRegister(scriptURL, options);
  p.then(function() { window.__kiloSwFailed = false; })
   .catch(function(err) {
     window.__kiloSwFailed = { name: err.name, message: err.message };
   });
  return p;
};
```

**In webview.js app startup code (after acquireVsCodeApi()):**
```ts
// Called early in app init, before SW is expected to be active:
if (window.__kiloSwFailed) {
  vscode.postMessage({
    type: 'swRegistrationFailed',
    ...window.__kiloSwFailed,
    isInvalidState: window.__kiloSwFailed.name === 'InvalidStateError',
  });
}
```

This approach is safer because `acquireVsCodeApi()` is called exactly once (inside `webview.js`), and the flag is just a plain object set by the interceptor.

---

## Confidence: HIGH

**Why HIGH:**

1. The CSP analysis is definitive — `worker-src` is already correct and the bug is confirmed as a document lifecycle race, not a policy issue. This rules out CSP as a root cause with high confidence.

2. The interceptor pattern is well-established for VS Code webview extensions (wrapping `navigator.serviceWorker.register` and posting messages is a standard pattern).

3. The fast-fail mechanism directly addresses the 2 s delay that makes the SW race so visible to users. The reduction from ~2 s to ~50 ms is a meaningful UX improvement.

4. The flag-based fallback is robust against the `acquireVsCodeApi()` single-call constraint.

**One risk:** If VS Code's internal SW registration occurs before the interceptor script executes (i.e., the webview preloader registers the SW synchronously before the document `<script>` tags run), the wrapper would never fire. In practice, VS Code registers its SW asynchronously as part of the module-script loader, so the interceptor executes first. This should be verified with a devtools trace on an affected machine.
