/**
 * OfflineBanner — connection state banners for the chat view.
 *
 * Shows two types of banners:
 *
 *  1. Amber "offline" banner  (window `online`/`offline` events)
 *     "No internet connection — responses may fail"
 *
 *  2. Red "disconnected" banner  (extensionDisconnected message)
 *     "Extension disconnected — please reload VS Code window"
 *     + "Reload" button that posts `reloadWindowRequest` to the extension
 *
 * Both banners are dismissible. The offline banner auto-clears when connectivity
 * is restored. The disconnected banner stays until the user reloads.
 */

import { Component, createSignal, onCleanup, onMount, Show } from "solid-js"
import { useVSCode } from "../../context/vscode"
import type { ExtensionMessage } from "../../types/messages"

export const OfflineBanner: Component = () => {
  const vscode = useVSCode()

  // ── Network offline state ─────────────────────────────────────────────────
  const [offline, setOffline] = createSignal(!navigator.onLine)
  const [offlineDismissed, setOfflineDismissed] = createSignal(false)

  // ── Extension disconnected state ──────────────────────────────────────────
  const [extDisconnected, setExtDisconnected] = createSignal(false)
  const [extDismissed, setExtDismissed] = createSignal(false)

  // Network listeners
  const handleOnline = () => {
    setOffline(false)
    setOfflineDismissed(false) // re-show if we go offline again later
  }
  const handleOffline = () => {
    setOffline(true)
    setOfflineDismissed(false)
  }

  // Extension message listener
  onMount(() => {
    window.addEventListener("online", handleOnline)
    window.addEventListener("offline", handleOffline)

    const unsub = vscode.onMessage((msg: ExtensionMessage) => {
      const m = msg as { type: string }
      if (m.type === "extensionDisconnected") {
        setExtDisconnected(true)
        setExtDismissed(false)
      }
      // If the extension reconnects, clear the banner
      if (m.type === "extensionConnected" || m.type === "extensionDataReady") {
        setExtDisconnected(false)
      }
    })

    onCleanup(() => {
      window.removeEventListener("online", handleOnline)
      window.removeEventListener("offline", handleOffline)
      unsub()
    })
  })

  const handleReload = () => {
    vscode.postMessage({ type: "reloadWindowRequest" })
  }

  // Show offline banner only when actually offline and not dismissed
  const showOffline = () => offline() && !offlineDismissed()
  // Show disconnected banner only when disconnected and not dismissed
  const showDisconnected = () => extDisconnected() && !extDismissed()

  return (
    <>
      {/* 1. Amber offline banner */}
      <Show when={showOffline()}>
        <div class="kc-offline-banner kc-offline-banner--warn" role="alert">
          <span class="kc-offline-banner-icon" aria-hidden="true">⚡</span>
          <span class="kc-offline-banner-text">
            No internet connection — responses may fail
          </span>
          <button
            class="kc-offline-banner-dismiss"
            onClick={() => setOfflineDismissed(true)}
            type="button"
            aria-label="Dismiss"
            title="Dismiss"
          >
            ×
          </button>
        </div>
      </Show>

      {/* 2. Red extension disconnected banner */}
      <Show when={showDisconnected()}>
        <div class="kc-offline-banner kc-offline-banner--error" role="alert">
          <span class="kc-offline-banner-icon" aria-hidden="true">✗</span>
          <span class="kc-offline-banner-text">
            Extension disconnected — please reload VS Code window
          </span>
          <button
            class="kc-offline-banner-action"
            onClick={handleReload}
            type="button"
          >
            Reload
          </button>
          <button
            class="kc-offline-banner-dismiss"
            onClick={() => setExtDismissed(true)}
            type="button"
            aria-label="Dismiss"
            title="Dismiss"
          >
            ×
          </button>
        </div>
      </Show>
    </>
  )
}
