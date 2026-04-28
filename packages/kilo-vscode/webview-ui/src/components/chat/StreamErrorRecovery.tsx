/**
 * StreamErrorRecovery — stall detection and error recovery for streaming responses.
 *
 * Behaviour:
 *  1. Stall detection
 *     While the session is "busy", counts time since the last token arrived.
 *     If no new token appears for STALL_TIMEOUT_MS (15 000 ms), shows an
 *     inline "Response seems stuck — Continue streaming?" button that posts
 *     `resumeStreamRequest` to the extension.
 *
 *  2. streamError messages
 *     Listens for `{ type: "streamError", message: string }` from the extension.
 *     Shows an inline error banner with a "Retry" button that posts
 *     `retryStream` to the extension and clears the banner.
 *
 * Wire this component inside the chat view, around / below the message list area.
 *
 * Usage:
 *   <StreamErrorRecovery lastTokenTime={lastTokenTime}>
 *     {children}
 *   </StreamErrorRecovery>
 *
 * The parent must supply `lastTokenTime` — an Accessor<number> updated on every
 * token arrival.  When `lastTokenTime` is 0 the stall detection is paused.
 */

import {
  Accessor,
  Component,
  createEffect,
  createSignal,
  JSX,
  onCleanup,
  onMount,
  Show,
} from "solid-js"
import { useVSCode } from "../../context/vscode"
import { useSession } from "../../context/session"

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

/** Milliseconds of silence before we consider the stream stalled */
const STALL_TIMEOUT_MS = 15_000
/** Polling interval for the stall check */
const STALL_POLL_MS = 1_000

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────

interface StreamErrorRecoveryProps {
  /**
   * Accessor returning the timestamp (Date.now()) of the most-recent token.
   * Set to 0 when no stream is active.
   */
  lastTokenTime: Accessor<number>
  children?: JSX.Element
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export const StreamErrorRecovery: Component<StreamErrorRecoveryProps> = (props) => {
  const vscode = useVSCode()
  const session = useSession()

  // ── Stall state ────────────────────────────────────────────────────────────
  const [stalled, setStalled] = createSignal(false)

  // Stall detection: poll every second while busy
  let stalledPoll: ReturnType<typeof setInterval> | undefined

  const startPoll = () => {
    if (stalledPoll !== undefined) return
    stalledPoll = setInterval(() => {
      if (session.status() !== "busy") {
        setStalled(false)
        return
      }
      const last = props.lastTokenTime()
      if (last === 0) return // no stream started yet
      const elapsed = Date.now() - last
      if (elapsed >= STALL_TIMEOUT_MS) {
        setStalled(true)
      }
    }, STALL_POLL_MS)
  }

  const stopPoll = () => {
    if (stalledPoll !== undefined) {
      clearInterval(stalledPoll)
      stalledPoll = undefined
    }
  }

  // Start/stop poll in sync with busy status
  createEffect(() => {
    if (session.status() === "busy") {
      startPoll()
    } else {
      stopPoll()
      setStalled(false)
    }
  })

  onCleanup(stopPoll)

  // Reset stall when a new token arrives
  createEffect(() => {
    const _t = props.lastTokenTime()
    setStalled(false)
  })

  const handleContinueStream = () => {
    setStalled(false)
    vscode.postMessage({ type: "resumeStreamRequest" })
  }

  // ── Stream error state ─────────────────────────────────────────────────────
  const [streamError, setStreamError] = createSignal<string | undefined>(undefined)

  onMount(() => {
    const unsub = vscode.onMessage((msg) => {
      const m = msg as { type: string; error?: string }
      if (m.type === "streamError") {
        setStreamError(m.error ?? "Stream error occurred")
        setStalled(false) // error supersedes stall
      }
      // Clear error when a new stream starts or succeeds
      if (
        m.type === "sessionStatusUpdated" ||
        m.type === "partUpdated" ||
        m.type === "partAdded"
      ) {
        setStreamError(undefined)
      }
    })
    onCleanup(unsub)
  })

  const handleRetry = () => {
    setStreamError(undefined)
    vscode.postMessage({ type: "retryLastRequest" })
  }

  return (
    <>
      {props.children}

      {/* Stall recovery inline banner */}
      <Show when={stalled() && !streamError()}>
        <div class="kc-stream-stall" role="status">
          <span class="kc-stream-stall__icon" aria-hidden="true">⏳</span>
          <span class="kc-stream-stall__text">
            Response seems stuck — Continue streaming?
          </span>
          <button
            class="kc-stream-stall__btn"
            onClick={handleContinueStream}
            type="button"
          >
            Continue streaming
          </button>
          <button
            class="kc-stream-stall__dismiss"
            onClick={() => setStalled(false)}
            type="button"
            aria-label="Dismiss"
            title="Dismiss"
          >
            ×
          </button>
        </div>
      </Show>

      {/* Stream error inline card */}
      <Show when={streamError()}>
        {(err) => (
          <div class="kc-stream-error-card" role="alert">
            <span class="kc-stream-error-card__icon" aria-hidden="true">✗</span>
            <span class="kc-stream-error-card__text">
              {err()}
            </span>
            <button
              class="kc-stream-error-card__btn"
              onClick={handleRetry}
              type="button"
            >
              Retry
            </button>
            <button
              class="kc-stream-error-card__dismiss"
              onClick={() => setStreamError(undefined)}
              type="button"
              aria-label="Dismiss"
              title="Dismiss"
            >
              ×
            </button>
          </div>
        )}
      </Show>
    </>
  )
}
