/**
 * useDocumentVisible — reactive `document.visibilityState === "visible"`.
 *
 * Used by polling tabs (HermesTab, VPSTab, HubTab, ZeroClawTab) to suspend
 * timers when the user switches to a different VS Code panel or another
 * settings tab unmounts our content. VS Code webviews fire
 * `visibilitychange` whenever the entire panel is hidden, so this is enough
 * to drop the bulk of background CPU + extension-host message traffic.
 *
 * Pattern:
 *   const isVisible = useDocumentVisible()
 *   const id = setInterval(() => { if (isVisible()) doWork() }, 30_000)
 *   onCleanup(() => clearInterval(id))
 */
import type { Accessor } from "solid-js"
import { createSignal, onCleanup } from "solid-js"

export function useDocumentVisible(): Accessor<boolean> {
  // Default to true on SSR / non-DOM environments so behavior is unchanged.
  const initial = typeof document === "undefined" ? true : document.visibilityState === "visible"
  const [visible, setVisible] = createSignal(initial)

  if (typeof document !== "undefined") {
    const onChange = () => setVisible(document.visibilityState === "visible")
    document.addEventListener("visibilitychange", onChange)
    onCleanup(() => document.removeEventListener("visibilitychange", onChange))
  }

  return visible
}
