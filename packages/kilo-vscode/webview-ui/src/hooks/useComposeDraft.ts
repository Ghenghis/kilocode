/**
 * useComposeDraft — per-session compose draft with history navigation.
 *
 * Features:
 * - Draft text persisted to sessionStorage (keyed by sessionId), debounced 300 ms
 * - Last 50 sent messages stored in a per-session in-memory history array
 * - Navigate history with `navigateHistory("up" | "down")`
 * - Commit a sent message to history with `commitToHistory(text)`
 * - On construction the saved draft is restored from sessionStorage
 *
 * SolidJS only — no React hooks, no external libraries.
 */

import { createSignal, onCleanup } from "solid-js"
import type { Accessor } from "solid-js"

// Maximum number of history entries kept per session
const MAX_HISTORY = 50

// Debounce delay (ms) for sessionStorage writes
const SAVE_DEBOUNCE_MS = 300

// ──────────────────────────────────────────────────────────────────────────────
// Storage helpers
// ──────────────────────────────────────────────────────────────────────────────

function storageKey(sessionId: string): string {
  return `kilo.compose-draft.v1.${sessionId}`
}

function loadDraft(sessionId: string): string {
  try {
    return sessionStorage.getItem(storageKey(sessionId)) ?? ""
  } catch {
    return ""
  }
}

function persistDraft(sessionId: string, value: string): void {
  try {
    if (value) {
      sessionStorage.setItem(storageKey(sessionId), value)
    } else {
      sessionStorage.removeItem(storageKey(sessionId))
    }
  } catch {
    // storage quota or private-browsing — silently ignore
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Public interface
// ──────────────────────────────────────────────────────────────────────────────

export interface ComposeDraft {
  /** Reactive accessor for the current draft text. */
  draft: Accessor<string>
  /** Update the draft text (also schedules a sessionStorage save). */
  setDraft: (text: string) => void
  /** Current history navigation index (-1 = not browsing). */
  historyIndex: Accessor<number>
  /**
   * Navigate history in the given direction.
   * Returns the text to display, or `null` if navigation was not possible.
   * Saves the in-progress draft when entering history navigation.
   */
  navigateHistory: (dir: "up" | "down") => string | null
  /**
   * Commit a sent message to history.
   * Deduplicates consecutive identical entries; resets navigation index.
   */
  commitToHistory: (text: string) => void
  /**
   * Whether history entries are available.
   * Useful for showing/hiding the "↑↓ history" hint.
   */
  hasHistory: Accessor<boolean>
}

/**
 * Create a compose draft context for a given session ID.
 *
 * @param sessionId  Stable identifier for the chat session (used as storage key).
 */
export function createComposeDraft(sessionId: string): ComposeDraft {
  // ── Reactive state ──────────────────────────────────────────────────────────
  const [draft, _setDraft] = createSignal<string>(loadDraft(sessionId))
  const [historyIndex, setHistoryIndex] = createSignal(-1)

  // ── Internal mutable state ──────────────────────────────────────────────────
  /** Newest-first history array (mirrors the shape used in usePromptHistory). */
  const historyEntries: string[] = []
  /** The draft text that was in the box before entering history browse mode. */
  let savedDraft: string | null = null

  // ── Debounced sessionStorage persistence ───────────────────────────────────
  let saveTimer: ReturnType<typeof setTimeout> | undefined

  const scheduleSave = (text: string): void => {
    if (saveTimer !== undefined) clearTimeout(saveTimer)
    saveTimer = setTimeout(() => {
      persistDraft(sessionId, text)
      saveTimer = undefined
    }, SAVE_DEBOUNCE_MS)
  }

  onCleanup(() => {
    if (saveTimer !== undefined) {
      clearTimeout(saveTimer)
      // Flush final value synchronously on cleanup
      persistDraft(sessionId, draft())
    }
  })

  // ── Public API ───────────────────────────────────────────────────────────────

  const setDraft = (text: string): void => {
    _setDraft(text)
    scheduleSave(text)
  }

  const hasHistory: Accessor<boolean> = () => historyEntries.length > 0

  const navigateHistory = (dir: "up" | "down"): string | null => {
    const currentIdx = historyIndex()

    if (dir === "up") {
      if (historyEntries.length === 0) return null

      if (currentIdx === -1) {
        // First navigation up: save current draft
        savedDraft = draft()
        setHistoryIndex(0)
        return historyEntries[0] ?? null
      }

      const next = currentIdx + 1
      if (next >= historyEntries.length) return null
      setHistoryIndex(next)
      return historyEntries[next] ?? null
    }

    // dir === "down"
    if (currentIdx < 0) return null

    if (currentIdx > 0) {
      const next = currentIdx - 1
      setHistoryIndex(next)
      return historyEntries[next] ?? null
    }

    // Back to the saved in-progress draft
    setHistoryIndex(-1)
    const restored = savedDraft ?? ""
    savedDraft = null
    return restored
  }

  const commitToHistory = (text: string): void => {
    const trimmed = text.trim()
    if (!trimmed) return

    // Deduplicate: if top entry is identical, skip
    if (historyEntries[0] === trimmed) {
      setHistoryIndex(-1)
      savedDraft = null
      return
    }

    // Remove duplicate entry further down the list
    const existing = historyEntries.indexOf(trimmed)
    if (existing > 0) historyEntries.splice(existing, 1)

    historyEntries.unshift(trimmed)
    if (historyEntries.length > MAX_HISTORY) historyEntries.length = MAX_HISTORY

    // Reset navigation
    setHistoryIndex(-1)
    savedDraft = null
  }

  return { draft, setDraft, historyIndex, navigateHistory, commitToHistory, hasHistory }
}
