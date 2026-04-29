# Kilo Code — Freeze Diagnostic Procedure

This guide walks you through capturing diagnostic information when VS Code
becomes unresponsive while interacting with the Kilo Code sidebar (typically
after clicking through several settings tabs).

The goal is to get **a single artifact** out of a frozen webview that the
maintainers can use to identify the offending code path:

1. A stack/snapshot of what was running at the moment of the freeze.
2. A trace of every webview ↔ extension `postMessage` exchange leading
   up to the freeze.
3. The shape of the heap (so we can tell if something is leaking).

---

## 0. Before you start (one-time setup)

Open VS Code, then open the Kilo Code sidebar. Leave it on the chat view for
a few seconds before you start. **Do not open the settings tabs yet.**

---

## 1. Open DevTools

`Help` → `Toggle Developer Tools`

A Chromium DevTools window will appear, attached to the VS Code process.

> If `Help → Toggle Developer Tools` is missing, run the command
> `Developer: Toggle Developer Tools` from the command palette
> (`Ctrl+Shift+P` / `Cmd+Shift+P`).

---

## 2. Switch to the Kilo Code webview frame

In the **Console** panel of DevTools, the very top dropdown lets you pick
which frame the console is attached to. By default it shows `top`. Switch
it to the entry that ends with `kilocode-maos.kilo-code-MAIN-VIEW` (or
similar — anything containing `kilo-code` and the word `webview`).

You'll know you picked the right one when typing `acquireVsCodeApi`
returns `ƒ acquireVsCodeApi()` (a function, not `undefined`).

---

## 3. Enable the message trace

In that console, paste:

```js
window.__KILO_MSG_TRACE__ = true
window.__KILO_MSG_LOG_CLEAR__()
```

You'll now see lines like
`[msg-trace OUT +123.4ms] requestHermesStatus {...}` for every message the
webview sends to the extension and every message the extension sends back.

**The trace is OFF by default and lives only in memory** — turning it on adds
two `console.debug` lines per message and one push to a 2000-entry ring
buffer. It does not write to disk and does not survive a webview reload.

---

## 4. Reproduce the freeze

Click through Kilo Code's settings tabs in the order that triggered the
freeze before. Typical pattern:

```
Settings → Models → Providers → Hermes → ZeroClaw → Memory → Hub → ...
```

Continue clicking tabs at the rate that previously caused the hang.

---

## 5. When the freeze occurs — what to look for

When VS Code stops responding to clicks, check each DevTools tab in order:

### 5a. Console

- Scan for **red error lines**. Anything like `Maximum call stack size`,
  `RangeError`, or repeated identical error spam = strong signal of an
  infinite loop. Right-click → `Save as…` to capture.
- Look for **the last few `[msg-trace …]` lines**. If you see the same
  message type repeating 50+ times in a row with sub-millisecond gaps,
  that's a postMessage loop and the offender's name is in the line.

### 5b. Network tab

The "network" panel for a webview won't show HTTP — but the **count at the
bottom-left corner** still increments for every fetch the webview made.
Check for:

- A "pending" count that keeps climbing → outstanding requests piling up.
- A specific URL repeating → polling that escaped its bounds.

### 5c. Performance tab → "Memory" toggle

Click `Memory` checkbox at the top, then click the record (●) button, wait
3-5 seconds, click stop. Look at the JS Heap line:

- A heap that keeps climbing without dropping = leak.
- A heap that's flat at a high number (200+ MB) but CPU is pinned = busy
  loop, not a leak.

### 5d. Memory tab → Heap snapshot

`Memory` panel → `Heap snapshot` → `Take snapshot`. (This will take 5-30s
even on a frozen webview because the snapshot uses a separate thread.)

In the snapshot, sort by `Retained Size` and screenshot the top 10
constructors. Counts of identical detached DOM nodes or arrays of solid-js
objects are diagnostic.

---

## 6. Capture the trace + state

In the Console, paste these one at a time. Each prints to console; right-click
the printed value and choose `Save as…` to dump as JSON/text.

### 6a. Dump the message log as plain text

```js
copy(window.__KILO_MSG_LOG_DUMP__())
```

`copy()` puts the trace on your clipboard. Paste into a text file named
`msg-trace.txt` and attach to the bug report.

### 6b. Get the raw entries (objects)

```js
window.__KILO_MSG_LOG__
```

Right-click the printed array → `Store as global variable` → `temp1` → then
`copy(JSON.stringify(temp1))`. Paste into `msg-trace.json`.

### 6c. Sample what's currently subscribed (live diagnostic)

```js
// Count of in-flight debounced messages
window.__KILO_MSG_LOG__.length
// Last 20 entries grouped by type
Object.entries(
  window.__KILO_MSG_LOG__.slice(-20).reduce((acc, e) => {
    acc[e.type] = (acc[e.type] || 0) + 1
    return acc
  }, {})
)
```

If one type dominates the last 20 entries (e.g., `requestHermesStatus: 18`),
that's almost certainly your culprit.

### 6d. Stack trace from the live event loop

In the **Sources** tab of DevTools, hit the pause (`||`) button. DevTools
will break into whatever the webview is currently doing. The **Call Stack**
panel on the right names the function. Screenshot it.

If pause "succeeds" but the stack is empty or shows `(idle)`, the freeze is
in the **extension host process**, not the webview — see §7.

---

## 7. Extension-host freeze (different procedure)

If §6d shows the webview is idle but VS Code is still unresponsive, the
freeze is in the extension host (Node.js). Capture it via:

1. Command palette → `Developer: Show Running Extensions`.
2. Find `Kilo Code MAOS` row → click the bug-with-clock icon
   (`Start Extension Host Profile`).
3. Wait 10s, click again to stop. A `.cpuprofile` file is offered — save it.
4. Run command `Developer: Open Process Explorer` and screenshot the
   `Extension Host` row's CPU + memory columns.

---

## 8. Disable tracing afterwards

```js
window.__KILO_MSG_TRACE__ = false
window.__KILO_MSG_LOG_CLEAR__()
```

(Or just reload the webview: command palette → `Developer: Reload Webviews`.)

---

## 9. What to send the maintainers

Bundle and attach:

- `msg-trace.txt` (from §6a)
- `heap-snapshot.heapsnapshot` (from §5d, exported via the `Save…` button)
- Screenshot of Console with red errors (if any)
- Screenshot of Sources → Call Stack at the moment of pause (§6d)
- The output of §6c
- If extension-host: the `.cpuprofile` from §7

With those five artifacts the maintainer can usually pinpoint the freeze
to a specific function within ~10 minutes.

---

## Appendix — what the trace lines mean

```
[msg-trace OUT +12345.6ms] hermesUpdateConfig {type: "hermesUpdateConfig", key: "baseUrl", value: "..."}
   │         │   │           │
   │         │   │           └─ message payload (the object passed to postMessage)
   │         │   └─ message type
   │         └─ ms since the webview loaded (high-resolution monotonic)
   │
   └─ direction: OUT = webview → extension; IN = extension → webview
```

A healthy session has **bursts** of activity (50-100 lines on tab open,
then quiet) separated by **idle gaps** of seconds. Pathological patterns:

| Pattern in trace                              | Likely cause                                |
| --------------------------------------------- | ------------------------------------------- |
| Same OUT type repeating <2ms apart            | Mount-time post in a loop or signal effect  |
| Continuous IN/OUT alternation, no gap         | Echo loop (handler causes its own re-fire)  |
| OUTs only, no INs after first                 | Extension host is busy/stuck                |
| Memory snapshot grows monotonically per click | Listener leak — handlers not unsubscribing  |
