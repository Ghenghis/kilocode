/**
 * VS Code API context provider
 * Provides access to the VS Code webview API for posting messages
 */

import { createContext, useContext, onCleanup, ParentComponent } from "solid-js"
import type { VSCodeAPI, WebviewMessage, ExtensionMessage } from "../types/messages"

// Get the VS Code API (only available in webview context)
let vscodeApi: VSCodeAPI | undefined

export function getVSCodeAPI(): VSCodeAPI {
  if (!vscodeApi) {
    // In VS Code webview, acquireVsCodeApi is available globally
    if (typeof acquireVsCodeApi === "function") {
      vscodeApi = acquireVsCodeApi()
    } else {
      // Mock for development/testing outside VS Code
      console.warn("[Kilo New] Running outside VS Code, using mock API")
      vscodeApi = {
        postMessage: (msg) => console.log("[Kilo New] Mock postMessage:", msg),
        getState: () => undefined,
        setState: () => {},
      }
    }
  }
  return vscodeApi
}

// Context value type
interface VSCodeContextValue {
  postMessage: (message: WebviewMessage) => void
  onMessage: (handler: (message: ExtensionMessage) => void) => () => void
  getState: <T>() => T | undefined
  setState: <T>(state: T) => void
}

const VSCodeContext = createContext<VSCodeContextValue>()

// Instrumentation: when window.__KILO_MSG_TRACE__ is true, log every send/recv
// to console + push into the global ring buffer maintained by lib/message-bus.
// Off by default; enabled per-user from DevTools console for freeze diagnosis.
function traceEnabled(): boolean {
  return typeof window !== "undefined" && (window as unknown as { __KILO_MSG_TRACE__?: boolean }).__KILO_MSG_TRACE__ === true
}
interface TraceEntry { t: number; dir: "in" | "out"; type: string; payload: unknown }
function pushTrace(entry: TraceEntry): void {
  const w = window as unknown as { __KILO_MSG_LOG__?: TraceEntry[] }
  const buf = w.__KILO_MSG_LOG__
  if (Array.isArray(buf)) {
    buf.push(entry)
    if (buf.length > 2000) buf.shift()
  }
  // eslint-disable-next-line no-console
  console.debug(`[msg-trace ${entry.dir.toUpperCase()} +${entry.t.toFixed(1)}ms]`, entry.type, entry.payload)
}

export const VSCodeProvider: ParentComponent = (props) => {
  const api = getVSCodeAPI()
  const handlers = new Set<(message: ExtensionMessage) => void>()

  // Listen for messages from the extension
  const messageListener = (event: MessageEvent) => {
    const message = event.data as ExtensionMessage
    if (traceEnabled()) {
      const t = (message as { type?: string } | undefined)?.type ?? "<no-type>"
      pushTrace({
        t: typeof performance !== "undefined" ? performance.now() : Date.now(),
        dir: "in",
        type: t,
        payload: message,
      })
    }
    handlers.forEach((handler) => handler(message))
  }

  window.addEventListener("message", messageListener)

  onCleanup(() => {
    window.removeEventListener("message", messageListener)
    handlers.clear()
  })

  const value: VSCodeContextValue = {
    postMessage: (message: WebviewMessage) => {
      if (traceEnabled()) {
        const t = (message as { type?: string } | undefined)?.type ?? "<no-type>"
        pushTrace({
          t: typeof performance !== "undefined" ? performance.now() : Date.now(),
          dir: "out",
          type: t,
          payload: message,
        })
      }
      api.postMessage(message)
    },
    onMessage: (handler: (message: ExtensionMessage) => void) => {
      handlers.add(handler)
      return () => handlers.delete(handler)
    },
    getState: <T,>() => api.getState() as T | undefined,
    setState: <T,>(state: T) => api.setState(state),
  }

  return <VSCodeContext.Provider value={value}>{props.children}</VSCodeContext.Provider>
}

export function useVSCode(): VSCodeContextValue {
  const context = useContext(VSCodeContext)
  if (!context) {
    throw new Error("useVSCode must be used within a VSCodeProvider")
  }
  return context
}
