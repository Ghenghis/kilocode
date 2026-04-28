# AgentG — Exponential Backoff Implementation for SW Recovery Retries

**Date:** 2026-04-27  
**File modified:** `packages/kilo-vscode/src/KiloProvider.ts`

---

## Background

VS Code platform bug #125993 causes `navigator.serviceWorker.register()` to throw
`InvalidStateError` when the outer iframe document is in an "unloading" state during
the async module script evaluation.  The mitigation is to blank `webview.html` and
re-inject it, forcing a new document lifecycle and a clean SW registration.

The previous implementation used a hardcoded cascade of nested `setTimeout` calls
with fixed delays (phase-0: 2 s, phase-1: 5 s, phase-2: 10 s, error: 15 s),
totalling up to **32 seconds** worst-case before the user saw an error dialog.

---

## Implementation Plan

### Goal

Replace the nested cascade with a clean recursive `scheduleAttempt(attempt)` pattern
using exponential backoff so that:

1. Early failures are caught quickly (attempt 0 fires at ~150 ms).
2. Slow-start machines still get adequate recovery time.
3. Worst-case time-to-error-dialog is bounded and predictable.
4. All canary.6 safety guards are preserved.

### Formula

```
delay = Math.min(WEBVIEW_BACKOFF_BASE_MS * 2^attempt + jitter, 5000)
jitter = Math.random() * 50 - 25   // ±25 ms
```

| Attempt | Base delay | Approx. range |
|---------|-----------|---------------|
| 0       | 150 ms    | 125–175 ms    |
| 1       | 300 ms    | 275–325 ms    |
| 2       | 600 ms    | 575–625 ms    |
| 3       | 1200 ms   | 1175–1225 ms  |
| 4       | 2400 ms   | 2375–2425 ms  |
| 5       | (error dialog — no reset) | |

Worst-case wait total (pure delays): 150+300+600+1200+2400 = **4650 ms**  
Plus 5 × 200 ms re-inject gaps = **5650 ms** absolute worst case.

### Constants changed

| Removed | Replaced by |
|---------|------------|
| `WEBVIEW_RETRY_0_MS = 2000` | `WEBVIEW_BACKOFF_BASE_MS = 150` |
| `WEBVIEW_RETRY_1_MS = 5000` | `WEBVIEW_BACKOFF_MAX_ATTEMPTS = 5` |
| `WEBVIEW_RETRY_2_MS = 10000` | `WEBVIEW_REINJECT_DELAY_MS = 200` |
| `WEBVIEW_ERROR_MS = 15000` | _(implicit from backoff formula)_ |

`WEBVIEW_MAX_RESETS = 3` and `WEBVIEW_READY_TIMEOUT_MS = 30000` are unchanged.

### Safety guards preserved from canary.6

- `_webviewResetCount >= WEBVIEW_MAX_RESETS` check inside `doReset` prevents
  infinite-reset loops.
- `_webviewReinjectTimer` is cancelled before any new re-injection is scheduled,
  fixing the timer-leak bug.
- `if (this.isWebviewReady) return` guards at the top of `scheduleAttempt` and
  inside the `setTimeout` callback cancel the chain as soon as the webview reports
  ready.
- Re-inject delay changed from 300 ms (old) to `WEBVIEW_REINJECT_DELAY_MS = 200 ms`
  as requested.

---

## Code Changes Applied

### `_scheduleWebviewReadyCheck` (lines ~3527–3606)

Old structure:
```
setTimeout(2s) → doReset("phase-0")
  setTimeout(5s) → doReset("phase-1")
    setTimeout(10s) → doReset("phase-2")
      setTimeout(15s) → showErrorMessage
```

New structure:
```typescript
scheduleAttempt(0)          // ≈150 ms → doReset(0) → scheduleAttempt(1)
                            // ≈300 ms → doReset(1) → scheduleAttempt(2)
                            // ≈600 ms → doReset(2) → scheduleAttempt(3)
                            // ≈1200ms → doReset(3) → scheduleAttempt(4)
                            // ≈2400ms → doReset(4) → scheduleAttempt(5)
                            // attempt >= 5 → showErrorMessage
```

Each `doReset(attempt)` call:
1. Guards with `_webviewResetCount >= WEBVIEW_MAX_RESETS`.
2. Sets `webview.html = ""`.
3. Schedules re-injection after `WEBVIEW_REINJECT_DELAY_MS` (200 ms), cancelling
   any previous `_webviewReinjectTimer` first.

---

## Worst-Case Timeline

```
t=0        webview HTML injected
t≈150ms    attempt 0: reset + reinject
t≈350ms    attempt 0 reinject fires
t≈650ms    attempt 1: reset + reinject
t≈850ms    attempt 1 reinject fires
t≈1450ms   attempt 2: reset + reinject
t≈1650ms   attempt 2 reinject fires
t≈2850ms   attempt 3: reset + reinject
t≈3050ms   attempt 3 reinject fires
t≈5250ms   attempt 4: reset + reinject
t≈5450ms   attempt 4 reinject fires
t≈5650ms   attempt 5: error dialog shown
```

**Worst case: ~5650 ms** (down from ~32 s in the old implementation).
