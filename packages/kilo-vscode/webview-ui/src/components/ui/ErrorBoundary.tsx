/**
 * SectionErrorBoundary — SolidJS ErrorBoundary wrapper for major UI panels.
 *
 * Wraps a section (ChatView, Settings, HubPanel, etc.). On error it shows:
 *  - Friendly "Something went wrong" message
 *  - Error message in dev mode / generic text in production
 *  - "Try again" button — resets the boundary
 *  - "Copy error" button — copies error + stack to clipboard
 *  - Extension version + model info in the collapsible details
 *
 * Usage:
 *   <SectionErrorBoundary name="ChatView">
 *     <ChatView ... />
 *   </SectionErrorBoundary>
 */

import {
  Component,
  createSignal,
  ErrorBoundary,
  JSX,
  Show,
} from "solid-js"

// ─────────────────────────────────────────────────────────────────────────────
// Dev-mode detection
// ─────────────────────────────────────────────────────────────────────────────

const IS_DEV =
  typeof process !== "undefined"
    ? process.env.NODE_ENV !== "production"
    : !((window as { __KILO_PROD__?: boolean }).__KILO_PROD__)

// ─────────────────────────────────────────────────────────────────────────────
// Version / model meta (injected by extension or available globally)
// ─────────────────────────────────────────────────────────────────────────────

function getExtensionVersion(): string {
  return (window as { __KILO_VERSION__?: string }).__KILO_VERSION__ ?? "unknown"
}

function getActiveModel(): string {
  return (window as { __KILO_MODEL__?: string }).__KILO_MODEL__ ?? "unknown"
}

// ─────────────────────────────────────────────────────────────────────────────
// Fallback UI component
// ─────────────────────────────────────────────────────────────────────────────

interface ErrorFallbackProps {
  name: string
  error: unknown
  reset: () => void
}

const ErrorFallback: Component<ErrorFallbackProps> = (props) => {
  const [detailsOpen, setDetailsOpen] = createSignal(false)
  const [copied, setCopied] = createSignal(false)

  const errorObj = (): Error | undefined =>
    props.error instanceof Error ? props.error : undefined

  const displayMessage = (): string => {
    if (IS_DEV && errorObj()) return errorObj()!.message
    return "An unexpected error occurred in this panel."
  }

  const copyError = async () => {
    const err = errorObj()
    const text = [
      `Section: ${props.name}`,
      `Extension version: ${getExtensionVersion()}`,
      `Active model: ${getActiveModel()}`,
      ``,
      `Error: ${err?.message ?? String(props.error)}`,
      ``,
      `Stack:`,
      err?.stack ?? "(no stack available)",
    ].join("\n")

    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard API may be blocked; fall back to console
      console.error("[ErrorBoundary] Error details:\n" + text)
    }
  }

  return (
    <div class="kc-error-boundary" role="alert">
      <div class="kc-error-boundary-icon" aria-hidden="true">⚠</div>

      <h2 class="kc-error-boundary-title">Something went wrong</h2>

      <p class="kc-error-boundary-message">{displayMessage()}</p>

      {/* Actions */}
      <div class="kc-error-boundary-actions">
        <button
          class="kc-error-boundary-btn kc-error-boundary-btn--primary"
          onClick={() => props.reset()}
          type="button"
        >
          Try again
        </button>
        <button
          class="kc-error-boundary-btn kc-error-boundary-btn--ghost"
          onClick={copyError}
          type="button"
        >
          {copied() ? "Copied!" : "Copy error"}
        </button>
      </div>

      {/* Collapsible technical details */}
      <div class="kc-error-boundary-details">
        <button
          class="kc-error-boundary-details-toggle"
          onClick={() => setDetailsOpen((v) => !v)}
          type="button"
          aria-expanded={detailsOpen()}
        >
          <span class={`kc-error-boundary-chevron ${detailsOpen() ? "kc-error-boundary-chevron--open" : ""}`}>
            ›
          </span>
          Technical details
        </button>

        <Show when={detailsOpen()}>
          <pre class="kc-error-boundary-pre">
            {[
              `Section:  ${props.name}`,
              `Version:  ${getExtensionVersion()}`,
              `Model:    ${getActiveModel()}`,
              ``,
              `Error: ${errorObj()?.message ?? String(props.error)}`,
              ``,
              errorObj()?.stack ?? "",
            ].join("\n")}
          </pre>
        </Show>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Public component
// ─────────────────────────────────────────────────────────────────────────────

interface SectionErrorBoundaryProps {
  /** Human-readable name shown in the error details (e.g. "ChatView") */
  name: string
  children: JSX.Element
}

/**
 * Wrap any major section in this to catch render errors gracefully.
 *
 * @example
 * <SectionErrorBoundary name="ChatView">
 *   <ChatView ... />
 * </SectionErrorBoundary>
 */
export const SectionErrorBoundary: Component<SectionErrorBoundaryProps> = (props) => {
  return (
    <ErrorBoundary
      fallback={(err, reset) => (
        <ErrorFallback
          name={props.name}
          error={err}
          reset={reset}
        />
      )}
    >
      {props.children}
    </ErrorBoundary>
  )
}
