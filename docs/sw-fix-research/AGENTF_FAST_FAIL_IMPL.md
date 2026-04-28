# Agent F — Fast-Fail Service Worker Detection: Implementation Notes

**Date:** 2026-04-27
**Branch:** fix/dockerfile-copy-paths (kilocode-Azure2 repo)

---

## What Was Implemented

### Problem
VS Code's webview uses a two-frame architecture. The extension's `webview.js` runs in an inner iframe.
- SW registration happens in the outer `pre/index.html` frame — we cannot intercept it.
- When the SW race condition occurs, the extension previously waited for a 2000 ms phase-0 timer before detecting failure and resetting the webview.

### Solution: DOMContentLoaded probe (~50 ms detection)
A small inline script is injected into the webview HTML (before `webview.js` loads) that:
1. Calls `acquireVsCodeApi()` ONCE and caches it in a closure.
2. Overrides `window.acquireVsCodeApi` to return the cached instance, preventing the "called more than once" error when `vscode.tsx` (`getVSCodeAPI()`) calls it later.
3. At `DOMContentLoaded`, checks `navigator.serviceWorker.controller`:
   - `null` → posts `{ type: 'swRegistrationFailed', source: 'probe' }` → extension resets immediately
   - set → posts `{ type: 'swRegistrationOk', source: 'probe' }` → extension cancels retry timers
4. Also registers a `controllerchange` listener to catch the slow-install path (SW installs after DOMContentLoaded).

### Detection time improvement
| Before | After |
|--------|-------|
| ~2000 ms (phase-0 timer) | ~50 ms (DOMContentLoaded probe) |

---

## Files Modified

### `packages/kilo-vscode/src/utils.ts`
- Added SW probe `<script nonce="...">` block between the `ICONS_BASE_URI` script and the main `webview.js` script tag.
- The probe uses the same `nonce` variable already present in `buildWebviewHtml`, so it passes the existing CSP policy without changes.
- Key points:
  - `acquireVsCodeApi` is called and cached in an IIFE closure
  - `window.acquireVsCodeApi` is overridden to return the cached instance
  - `controllerchange` listener registered before `DOMContentLoaded` to avoid race
  - If `navigator.serviceWorker` is unavailable (non-SW context), posts `swRegistrationOk` as a safe fallback

### `packages/kilo-vscode/src/KiloProvider.ts`
Added two new `case` branches in the webview message handler `switch (message.type)`:

#### `case "swRegistrationFailed"`
- Cancels `_webviewReadyTimer` and `_webviewReinjectTimer`
- If `!this.isWebviewReady` and reset count < `WEBVIEW_MAX_RESETS`:
  - Increments `_webviewResetCount`
  - Sets `webview.html = ""`
  - After 300 ms, re-injects via `this._getHtmlForWebview(webview)`
- Respects the infinite-reset guard (`WEBVIEW_MAX_RESETS = 3`)

#### `case "swRegistrationOk"`
- Cancels `_webviewReadyTimer` and `_webviewReinjectTimer`
- The webview loaded OK; no further polling needed

---

## Design Decisions

1. **Why inline the probe rather than a separate file?**
   The CSP `script-src` policy only allows scripts with the page-specific `nonce`. A separate file would require a new `vscode-resource:` URI and nonce exemption. Inlining with the existing nonce is zero-config.

2. **Why override `window.acquireVsCodeApi` instead of modifying `vscode.tsx`?**
   The spec required not modifying `vscode.tsx`. The override ensures the single-call constraint is met transparently.

3. **Why not use `swRegistrationFailed` to skip the phase-1/2/3 timers entirely?**
   `swRegistrationFailed` triggers an immediate reset. The new webview load will either succeed (firing `webviewReady` which clears remaining timers) or fail again (triggering another probe). The existing phase chain serves as a backstop for non-probe environments and for the case where the probe message itself is lost.

4. **`WEBVIEW_MAX_RESETS` usage in the new case**
   The same module-level constant (`= 3`) used by `_scheduleWebviewReadyCheck`'s `doReset` is reused directly. The `_webviewResetCount` counter is shared, so fast-fail resets count toward the same guard.
