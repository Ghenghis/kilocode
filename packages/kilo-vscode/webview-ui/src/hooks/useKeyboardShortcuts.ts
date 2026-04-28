/**
 * useKeyboardShortcuts — Global keyboard shortcut registry for KiloCode canary.10
 *
 * Provides:
 *  - A document-level keydown listener that dispatches to registered handlers
 *  - Scope-aware dispatch: "global" shortcuts always fire; scoped shortcuts fire
 *    only when the active scope matches
 *  - registerShortcut / unregisterShortcut API
 *  - useShortcutRegistry() context accessor
 *  - formatChord() helper for VS Code-style notation (⌘K / Ctrl+K)
 */

import { createContext, useContext, onMount, onCleanup } from "solid-js"
import { createStore, produce } from "solid-js/store"

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type ShortcutScope = "global" | "chat" | "settings" | "history"

export interface ShortcutConfig {
  /** Unique identifier, used as the de-dup / unregister key  */
  id: string
  /** The key value as returned by KeyboardEvent.key (e.g. "Enter", "f", "?") */
  key: string
  /** Modifier flags */
  ctrl?: boolean
  alt?: boolean
  shift?: boolean
  meta?: boolean
  /** Human-readable description shown in the help modal */
  description: string
  /** Which view/panel this shortcut belongs to */
  scope: ShortcutScope
  /** The handler — return true to stop other handlers from running */
  handler: (e: KeyboardEvent) => boolean | void
}

export interface ShortcutRegistry {
  /** All currently registered shortcuts (reactive) */
  shortcuts: ShortcutConfig[]
  /** Active scope — determines which scoped shortcuts are dispatched */
  activeScope: ShortcutScope
  /** Set the active scope */
  setScope: (scope: ShortcutScope) => void
  /** Register a shortcut (replaces any existing with same id) */
  registerShortcut: (config: ShortcutConfig) => void
  /** Remove a shortcut by id */
  unregisterShortcut: (id: string) => void
  /** Format a shortcut as a human-readable chord notation */
  formatChord: (config: Pick<ShortcutConfig, "key" | "ctrl" | "alt" | "shift" | "meta">) => string
}

// ─────────────────────────────────────────────────────────────────────────────
// Context
// ─────────────────────────────────────────────────────────────────────────────

const ShortcutRegistryContext = createContext<ShortcutRegistry>()

export function useShortcutRegistry(): ShortcutRegistry {
  const ctx = useContext(ShortcutRegistryContext)
  if (!ctx) throw new Error("useShortcutRegistry must be used inside ShortcutRegistryProvider")
  return ctx
}

export { ShortcutRegistryContext }

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const isMac = typeof navigator !== "undefined" && /Mac|iPod|iPhone|iPad/.test(navigator.platform)

/**
 * Format a chord as VS Code-style notation.
 * On macOS: ⌘⇧⌥⌃ symbols; on Windows/Linux: Ctrl+Shift+Alt+
 */
export function formatChord(
  config: Pick<ShortcutConfig, "key" | "ctrl" | "alt" | "shift" | "meta">,
): string {
  const parts: string[] = []
  if (isMac) {
    if (config.ctrl) parts.push("⌃")
    if (config.alt) parts.push("⌥")
    if (config.shift) parts.push("⇧")
    if (config.meta) parts.push("⌘")
  } else {
    if (config.ctrl) parts.push("Ctrl")
    if (config.alt) parts.push("Alt")
    if (config.shift) parts.push("Shift")
    if (config.meta) parts.push("Meta")
  }
  const key = keyLabel(config.key)
  if (isMac) {
    return parts.join("") + key
  }
  return [...parts, key].join("+")
}

function keyLabel(key: string): string {
  const map: Record<string, string> = {
    ArrowUp: "↑",
    ArrowDown: "↓",
    ArrowLeft: "←",
    ArrowRight: "→",
    Enter: "Enter",
    Escape: "Esc",
    " ": "Space",
    "/": "/",
    "?": "?",
  }
  return map[key] ?? (key.length === 1 ? key.toUpperCase() : key)
}

// ─────────────────────────────────────────────────────────────────────────────
// Core store factory — used by ShortcutRegistryProvider
// ─────────────────────────────────────────────────────────────────────────────

export function createShortcutRegistry(): ShortcutRegistry {
  const [store, setStore] = createStore<{
    shortcuts: ShortcutConfig[]
    activeScope: ShortcutScope
  }>({ shortcuts: [], activeScope: "global" })

  const setScope = (scope: ShortcutScope) => setStore("activeScope", scope)

  const registerShortcut = (config: ShortcutConfig) => {
    setStore(
      produce((s) => {
        const idx = s.shortcuts.findIndex((sc) => sc.id === config.id)
        if (idx >= 0) {
          s.shortcuts[idx] = config
        } else {
          s.shortcuts.push(config)
        }
      }),
    )
  }

  const unregisterShortcut = (id: string) => {
    setStore(
      produce((s) => {
        const idx = s.shortcuts.findIndex((sc) => sc.id === id)
        if (idx >= 0) s.shortcuts.splice(idx, 1)
      }),
    )
  }

  /** Dispatches a keydown event to matching handlers. */
  const dispatch = (e: KeyboardEvent): void => {
    // Skip when typing in an input / textarea that isn't specifically opted-in
    const tag = (e.target as HTMLElement)?.tagName
    const isEditable = tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement)?.isContentEditable
    const scope = store.activeScope

    // Cross-platform: treat `ctrl` flag as "Ctrl OR Meta (⌘)" to match the
    // convention used throughout the rest of this codebase (e.ctrlKey || e.metaKey).
    // A shortcut with `meta: true` still only matches metaKey (for ⌃ on macOS).
    const eventCtrlOrMeta = e.ctrlKey || e.metaKey

    for (const sc of store.shortcuts) {
      // Scope gate
      if (sc.scope !== "global" && sc.scope !== scope) continue

      // Key match
      if (sc.key.toLowerCase() !== e.key.toLowerCase()) continue

      // Modifier match — `ctrl` maps to ctrlKey|metaKey for cross-platform compatibility.
      // `meta` is a separate flag for explicit Meta-only shortcuts.
      const wantsCtrl = !!(sc.ctrl)
      const wantsMeta = !!(sc.meta)
      if (wantsCtrl !== eventCtrlOrMeta) continue
      if (wantsMeta && !e.metaKey) continue
      if (!!(sc.shift) !== e.shiftKey) continue
      if (!!(sc.alt) !== e.altKey) continue

      // For single-key shortcuts (no modifiers), skip when focus is inside a text input
      const hasModifier = sc.ctrl || sc.meta || sc.alt
      if (!hasModifier && isEditable) continue

      const consumed = sc.handler(e)
      if (consumed !== false) break
    }
  }

  // Attach global listener once (called from provider's onMount)
  const attach = () => {
    document.addEventListener("keydown", dispatch, { capture: true })
    onCleanup(() => document.removeEventListener("keydown", dispatch, { capture: true }))
  }

  return {
    get shortcuts() {
      return store.shortcuts
    },
    get activeScope() {
      return store.activeScope
    },
    setScope,
    registerShortcut,
    unregisterShortcut,
    formatChord,
    // Expose internal attach for provider use
    _attach: attach,
  } as ShortcutRegistry & { _attach: () => void }
}
