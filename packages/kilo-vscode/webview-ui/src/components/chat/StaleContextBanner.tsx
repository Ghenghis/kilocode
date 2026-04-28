/**
 * StaleContextBanner — Feature 3
 *
 * When a file that was @mentioned in the current context has changed on disk
 * (signalled by a "contextFileChanged" extension message), shows an amber
 * banner: "Referenced file changed — context may be stale. [Refresh]"
 *
 * The extension host must send:
 *   { type: "contextFileChanged", path: string }
 *
 * Clicking "Refresh" posts { type: "refreshContext" } back to the extension,
 * which can re-read the file contents into the next turn's editorContext.
 */

import { Component, For, Show, createSignal, onCleanup, onMount } from "solid-js"
import { useVSCode } from "../../context/vscode"
import type { ExtensionMessage } from "../../types/messages"

export const StaleContextBanner: Component = () => {
  const vscode = useVSCode()
  const [changedFiles, setChangedFiles] = createSignal<string[]>([])

  onMount(() => {
    const unsub = vscode.onMessage((msg: ExtensionMessage) => {
      // The extension may send this custom message when a watched file changes.
      const m = msg as { type: string; path?: string }
      if (m.type === "contextFileChanged" && m.path) {
        setChangedFiles((prev) => {
          if (prev.includes(m.path!)) return prev
          return [...prev, m.path!]
        })
      }
      // Clear on new session or new message send
      if (m.type === "sessionCreated" || m.type === "clearPendingPrompts") {
        setChangedFiles([])
      }
    })
    onCleanup(unsub)
  })

  const handleRefresh = () => {
    vscode.postMessage({ type: "refreshContext" })
    setChangedFiles([])
  }

  const handleDismiss = () => setChangedFiles([])

  const firstName = () => changedFiles()[0]

  return (
    <Show when={changedFiles().length > 0}>
      <div class="stale-context-banner" role="alert">
        <span class="stale-context-icon">⚠</span>
        <span class="stale-context-text">
          <strong>{firstName()}</strong>
          <Show when={changedFiles().length > 1}>
            {" "}and {changedFiles().length - 1} other file{changedFiles().length > 2 ? "s" : ""}
          </Show>
          {" "}changed — context may be stale.
        </span>
        <button class="stale-context-refresh" onClick={handleRefresh}>
          Refresh
        </button>
        <button
          class="stale-context-dismiss"
          onClick={handleDismiss}
          aria-label="Dismiss"
        >
          ×
        </button>
      </div>
    </Show>
  )
}
