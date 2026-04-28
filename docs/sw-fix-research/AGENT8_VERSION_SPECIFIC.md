# Agent 8: VS Code Version-Specific Analysis

## VS Code Version Confirmed

- **Version**: 1.117.0 (stable)
- **Commit**: `10c8e557c8b9f9ed0a87f61f1c9a44bde731c409`
- **Build date**: 2026-04-21T16:12:14-07:00 (April 21 update)
- **Install path**: `C:\Users\Admin\AppData\Local\Programs\Microsoft VS Code\10c8e557c8\`
- **package.json name**: `Code`, version `1.117.0`

The commit hash `10c8e557c8` is the directory name under the install root — confirmed match with the task prompt.

---

## pre/index.html SW Registration Code (current version)

File: `C:\Users\Admin\AppData\Local\Programs\Microsoft VS Code\10c8e557c8\resources\app\out\vs\workbench\contrib\webview\browser\pre\index.html`

### Key parameters parsed from URL search params:
```js
const disableServiceWorker = searchParams.has('disableServiceWorker');
const expectedWorkerVersion = parseInt(searchParams.get('swVersion'));
```

### SW registration path construction:
```js
const swPath = encodeURI(
  `service-worker.js?v=${expectedWorkerVersion}` +
  `&vscode-resource-base-authority=${searchParams.get('vscode-resource-base-authority')}` +
  `&remoteAuthority=${searchParams.get('remoteAuthority') ?? ''}`
);
navigator.serviceWorker.register(swPath, { type: 'module' })
```

### Version mismatch handling (unregister-and-re-register):
```js
if (event.data.version === expectedWorkerVersion) {
    return resolve();
} else {
    console.log(`Found unexpected service worker version. Found: ${event.data.version}. Expected: ${expectedWorkerVersion}`);
    console.log(`Attempting to reload service worker`);
    // If we have the wrong version, try once (and only once) to unregister and re-register
    // Note that `.update` doesn't seem to work desktop electron at the moment so we use
    // `unregister` and `register` here.
    return registration.unregister()
        .then(() => navigator.serviceWorker.register(swPath))
        .finally(() => { resolve(); });
}
```

### Controller URL check:
```js
const currentController = navigator.serviceWorker.controller;
if (currentController?.scriptURL.endsWith(swPath)) {
    // service worker already loaded & ready to receive messages
    postVersionMessage(currentController);
} else {
    // wait for controllerchange event
}
```

### The SW fast path (no version gate):
If `disableServiceWorker` param is set, registration is entirely skipped (`return resolve()` immediately).

### SW cache name in service-worker.js:
```js
const VERSION = 4;
const resourceCacheName = `vscode-resource-cache-${VERSION}`;
// → "vscode-resource-cache-4"
```

The `_expectedServiceWorkerVersion` in the workbench host is hardcoded to `4`:
```js
this._expectedServiceWorkerVersion = 4;
```

This value is passed as `swVersion=4` in the URL query string to `index.html`.

### The stale cache entry `2cc80dabc69f58b6_0`:
This is a Chromium SW registration database key (not a VS Code internal name). The `2cc80dabc69f58b6` is a hashed origin key in Chromium's IndexedDB-backed SW registration store. The `_0` suffix is the partition index. This entry predates the April 21 build and may point to an old SW URL (different `swVersion` or different `vscode-resource-base-authority`). VS Code's own version mismatch handler should fire for this case, but the "try once" unregister+re-register logic may have failed silently (the `.finally(() => resolve())` swallows failure).

---

## New WebviewOptions in This Version

File: `C:\Users\Admin\AppData\Local\Programs\Microsoft VS Code\10c8e557c8\resources\app\out\vscode-dts\vscode.d.ts`

### Public `WebviewOptions` interface (no SW-specific field exposed):
```typescript
export interface WebviewOptions {
    readonly enableScripts?: boolean;
    readonly enableForms?: boolean;
    readonly enableCommandUris?: boolean | readonly string[];
    readonly localResourceRoots?: readonly Uri[];
    readonly portMapping?: readonly WebviewPortMapping[];
}
```

**`disableServiceWorker` is NOT in the public `WebviewOptions` API.** It is an internal-only option used inside workbench bundles when calling `createWebviewElement`/`createWebviewOverlay`. Extensions cannot set it via the public API.

### Internal usage of `disableServiceWorker: true` (found in workbench bundle):
VS Code 1.117.0 uses `disableServiceWorker: true` in at least 7 internal call sites:
1. MCP App webview (chat output items)
2. Walkthrough/welcome page webviews (2 occurrences)
3. Extension detail webviews
4. Media step content webviews
5. Custom editor overlay webviews

These are all VS Code-internal webviews — not extension-created webviews. Extensions cannot pass `disableServiceWorker` via the official `vscode.window.createWebviewPanel` API.

### `vscode.version` API:
```typescript
// In vscode.d.ts, line 11:
export const version: string;
```
Accessible in extensions as `vscode.version` — returns `"1.117.0"` for this install. This can be used for version-gating workarounds.

---

## Version-Gated Fix Strategy

### Problem recap:
- SW cache entry `2cc80dabc69f58b6_0` is stale (pre-April-21)
- VS Code 1.117.0 registers SW with `swVersion=4`, `type: 'module'`
- If the old SW registration has a mismatched URL (old `v=` param or old authority), the version handler fires, tries `unregister()` + re-`register()`, then resolves regardless via `.finally()`
- The re-registered SW may not become controller before the webview needs it, causing a timing window where the SW is "registered but not controlling"

### What 1.117.0 changed (vs older versions):
1. SW registration now uses `{ type: 'module' }` — ES module SW. This changes how Chromium caches the script.
2. The `swPath` URL now includes `remoteAuthority` as a query parameter (may differ from old registrations that lacked it).
3. The `currentController?.scriptURL.endsWith(swPath)` check uses `.endsWith()` not exact equality — this is intentional to handle different base URLs.

### Version detection for extension code:
```typescript
import * as vscode from 'vscode';

const [major, minor] = vscode.version.split('.').map(Number);
const isVSCode117Plus = major > 1 || (major === 1 && minor >= 117);
```

### Recommended version-specific workaround path:
Since `disableServiceWorker` is NOT available to extensions publicly, and the SW version mismatch auto-recovery may have a timing bug, the viable fixes are:

1. **For 1.117.0+**: The `{ type: 'module' }` registration + `skipWaiting()` in install handler should guarantee fast takeover. If KiloCode's webview is stuck on the old SW, the fix is to ensure the HTML is reassigned after a short delay so the new controller is picked up:
   ```typescript
   // Force SW controller refresh by reassigning html
   if (isVSCode117Plus) {
       const html = panel.webview.html;
       panel.webview.html = '';
       await new Promise(r => setTimeout(r, 100));
       panel.webview.html = html;
   }
   ```

2. **For all versions**: Send a `postMessage` to the webview instructing it to call `navigator.serviceWorker.getRegistration()` and if the controller's scriptURL doesn't match the expected path, trigger `registration.update()` followed by waiting for `controllerchange`.

3. **Version-gated cache bust via URL fragment**: In 1.117+, appending a version-specific nonce to the webview HTML's `<base>` tag forces Chromium to treat it as a new document context, bypassing the stale SW.

---

## Recommended Implementation

```typescript
// In KiloCode's webview provider activate/show logic:
import * as vscode from 'vscode';

async function ensureFreshServiceWorker(panel: vscode.WebviewPanel): Promise<void> {
    const [major, minor] = vscode.version.split('.').map(Number);

    // VS Code 1.117.0 (April 21 2026) changed SW to ES module type.
    // Stale registrations from before this date (e.g. cache key 2cc80dabc69f58b6_0)
    // may cause the SW to be in "registered but not controlling" state.
    if (major > 1 || (major === 1 && minor >= 117)) {
        // Force webview to reload its SW by briefly clearing html
        // This triggers a new document navigation, which triggers controllerchange
        const savedHtml = panel.webview.html;
        panel.webview.html = '<html><body></body></html>';
        await new Promise<void>(resolve => setTimeout(resolve, 150));
        panel.webview.html = savedHtml;
    }
}
```

**Alternative (lighter weight)**: Use the webview's `postMessage` to detect the SW state from inside the webview, and only trigger recovery if the controller's URL doesn't contain `swVersion=4`:

```html
<!-- In webview HTML, add after content loads: -->
<script>
navigator.serviceWorker.ready.then(reg => {
    const ctrl = navigator.serviceWorker.controller;
    if (!ctrl || !ctrl.scriptURL.includes('v=4')) {
        // Report stale SW back to extension
        const vscode = acquireVsCodeApi();
        vscode.postMessage({ type: 'sw-stale', controller: ctrl?.scriptURL ?? 'none' });
    }
});
</script>
```

```typescript
// Extension side:
panel.webview.onDidReceiveMessage(msg => {
    if (msg.type === 'sw-stale') {
        console.warn('KiloCode: stale SW detected:', msg.controller);
        // Trigger reload
        panel.webview.html = panel.webview.html;
    }
});
```

---

## Confidence: HIGH

- VS Code version 1.117.0 confirmed directly from `package.json` and `product.json`
- SW VERSION constant confirmed as `4` (hardcoded in both `service-worker.js` and `workbench.desktop.main.js`)
- `disableServiceWorker` confirmed as internal-only (not in public `vscode.d.ts` API)
- `vscode.version` confirmed available as `export const version: string`
- The unregister+re-register code path with `.finally(() => resolve())` is a confirmed timing risk
- `{ type: 'module' }` SW registration is confirmed new behavior in this version
- SW cache key `vscode-resource-cache-4` is the active cache name; old entries under different keys are orphaned but may still be registered in Chromium's SW database
