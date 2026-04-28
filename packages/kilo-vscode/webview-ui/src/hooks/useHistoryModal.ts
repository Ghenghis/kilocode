/**
 * useHistoryModal — Ctrl+Up opens a fuzzy-search modal over prompt history.
 * When input is empty and user presses Ctrl+Up, the modal appears.
 * Typing filters history with fuzzy matching; clicking or pressing Enter fills input.
 */

import { createSignal } from "solid-js"
import type { Accessor } from "solid-js"

/** Simple fuzzy match: every char in `query` appears in `str` in order. */
function fuzzyMatch(str: string, query: string): boolean {
  if (!query) return true
  const s = str.toLowerCase()
  const q = query.toLowerCase()
  let si = 0
  for (let qi = 0; qi < q.length; qi++) {
    const idx = s.indexOf(q[qi]!, si)
    if (idx === -1) return false
    si = idx + 1
  }
  return true
}

export interface HistoryModal {
  /** Whether the modal is open */
  open: Accessor<boolean>
  /** Current filter query inside the modal */
  query: Accessor<string>
  /** Filtered history entries */
  results: Accessor<string[]>
  /** Currently highlighted result index */
  index: Accessor<number>
  /** Open the modal */
  show: () => void
  /** Close the modal */
  close: () => void
  /** Set query text */
  setQuery: (q: string) => void
  /** Set highlighted index */
  setIndex: (i: number) => void
  /** Handle keydown inside modal — returns true if event was consumed */
  onKeyDown: (e: KeyboardEvent, onSelect: (entry: string) => void) => boolean
  /** Handle keydown on the main textarea — returns true if event was consumed (opens modal) */
  onTextareaKeyDown: (e: KeyboardEvent, currentText: string, onSelect: (entry: string) => void) => boolean
}

export function useHistoryModal(entries: () => string[]): HistoryModal {
  const [open, setOpen] = createSignal(false)
  const [query, setQuerySignal] = createSignal("")
  const [index, setIndex] = createSignal(0)

  const results = () => {
    const q = query()
    const all = entries()
    if (!q) return all
    return all.filter((e) => fuzzyMatch(e, q))
  }

  const show = () => {
    setQuerySignal("")
    setIndex(0)
    setOpen(true)
  }

  const close = () => {
    setOpen(false)
    setQuerySignal("")
    setIndex(0)
  }

  const setQuery = (q: string) => {
    setQuerySignal(q)
    setIndex(0)
  }

  const onKeyDown = (e: KeyboardEvent, onSelect: (entry: string) => void): boolean => {
    if (!open()) return false
    if (e.key === "Escape") {
      e.preventDefault()
      e.stopPropagation()
      close()
      return true
    }
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setIndex((i) => Math.min(i + 1, Math.max(results().length - 1, 0)))
      return true
    }
    if (e.key === "ArrowUp") {
      e.preventDefault()
      setIndex((i) => Math.max(i - 1, 0))
      return true
    }
    if (e.key === "Enter") {
      const entry = results()[index()]
      if (entry) {
        e.preventDefault()
        onSelect(entry)
        close()
      }
      return true
    }
    return false
  }

  const onTextareaKeyDown = (
    e: KeyboardEvent,
    currentText: string,
    onSelect: (entry: string) => void,
  ): boolean => {
    // Ctrl+Up when input is empty — open modal
    if (e.key === "ArrowUp" && e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey && !currentText.trim()) {
      e.preventDefault()
      show()
      return true
    }
    return false
  }

  return { open, query, results, index, show, close, setQuery, setIndex, onKeyDown, onTextareaKeyDown }
}
