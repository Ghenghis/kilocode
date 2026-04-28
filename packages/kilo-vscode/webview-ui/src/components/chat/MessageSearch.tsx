/**
 * MessageSearch — floating search bar for the chat message list.
 *
 * Features:
 * - Triggered by Ctrl/Cmd+F (wired externally by the caller) or programmatically
 * - Highlights all matches in the DOM with <mark data-search-highlight="N">
 * - Shows "Match X of Y" counter
 * - Up/down navigation jumps between matches
 * - ESC dismisses and clears highlights
 * - Exposes open/close/navigate imperatively via ref; reactive signals for display
 *
 * Usage:
 *   const [searchOpen, setSearchOpen] = createSignal(false)
 *   let searchRef: MessageSearchHandle | undefined
 *
 *   <MessageSearch
 *     ref={(r) => (searchRef = r)}
 *     open={searchOpen()}
 *     contentRoot={messageListContentRef}
 *     onClose={() => setSearchOpen(false)}
 *   />
 *
 *   // Open from keyboard handler:
 *   setSearchOpen(true)
 *   searchRef?.focus()
 */

import { Component, Show, createSignal, onMount, onCleanup, createEffect, on } from "solid-js"
import { Icon } from "@kilocode/kilo-ui/icon"

// ──────────────────────────────────────────────────────────────────────────────
// DOM helpers (same logic previously inline in MessageList)
// ──────────────────────────────────────────────────────────────────────────────

const SEARCH_HIGHLIGHT_ATTR = "data-search-highlight"
const SEARCH_CURRENT_ATTR = "data-search-current"

/**
 * Walk all visible text nodes inside `root`, wrap matching text in <mark>
 * elements, and return the count of matches.
 */
function applySearchHighlights(root: HTMLElement, query: string): number {
  clearSearchHighlights(root)
  if (!query) return 0

  const re = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi")
  let count = 0

  const walk = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent ?? ""
      if (!re.test(text)) { re.lastIndex = 0; return }
      re.lastIndex = 0
      const frag = document.createDocumentFragment()
      let last = 0
      let m: RegExpExecArray | null
      while ((m = re.exec(text)) !== null) {
        if (m.index > last) frag.appendChild(document.createTextNode(text.slice(last, m.index)))
        const mark = document.createElement("mark")
        mark.setAttribute(SEARCH_HIGHLIGHT_ATTR, String(count))
        mark.textContent = m[0]
        frag.appendChild(mark)
        count++
        last = m.index + m[0].length
      }
      if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)))
      node.parentNode?.replaceChild(frag, node)
    } else if (
      node.nodeType === Node.ELEMENT_NODE &&
      (node as Element).tagName !== "MARK" &&
      (node as Element).tagName !== "SCRIPT" &&
      (node as Element).tagName !== "STYLE"
    ) {
      Array.from(node.childNodes).forEach(walk)
    }
  }

  Array.from(root.childNodes).forEach(walk)
  return count
}

export function clearSearchHighlights(root: HTMLElement): void {
  const marks = root.querySelectorAll(`mark[${SEARCH_HIGHLIGHT_ATTR}]`)
  marks.forEach((mark) => {
    const parent = mark.parentNode
    if (!parent) return
    parent.replaceChild(document.createTextNode(mark.textContent ?? ""), mark)
    parent.normalize()
  })
}

function scrollToMatch(root: HTMLElement, index: number): void {
  const marks = root.querySelectorAll<HTMLElement>(`mark[${SEARCH_HIGHLIGHT_ATTR}]`)
  marks.forEach((m, i) => {
    if (i === index) {
      m.setAttribute(SEARCH_CURRENT_ATTR, "")
      m.scrollIntoView({ block: "center", behavior: "smooth" })
    } else {
      m.removeAttribute(SEARCH_CURRENT_ATTR)
    }
  })
}

// ──────────────────────────────────────────────────────────────────────────────
// Public handle type (for programmatic control)
// ──────────────────────────────────────────────────────────────────────────────

export interface MessageSearchHandle {
  focus(): void
  selectAll(): void
}

// ──────────────────────────────────────────────────────────────────────────────
// Props
// ──────────────────────────────────────────────────────────────────────────────

export interface MessageSearchProps {
  open: boolean
  /** Root element that contains the rendered message list */
  contentRoot: HTMLElement | undefined
  onClose: () => void
  /** Called with the search handle so the parent can imperatively focus it */
  ref?: (handle: MessageSearchHandle) => void
}

// ──────────────────────────────────────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────────────────────────────────────

export const MessageSearch: Component<MessageSearchProps> = (props) => {
  const [query, setQuery] = createSignal("")
  const [matchCount, setMatchCount] = createSignal(0)
  const [currentIndex, setCurrentIndex] = createSignal(0)

  let inputRef: HTMLInputElement | undefined

  // Expose imperative handle
  if (props.ref) {
    props.ref({
      focus: () => requestAnimationFrame(() => inputRef?.focus()),
      selectAll: () => requestAnimationFrame(() => { inputRef?.focus(); inputRef?.select() }),
    })
  }

  // Run search when query changes and bar is open
  createEffect(
    on(query, (q) => {
      if (!props.open || !props.contentRoot) return
      const count = applySearchHighlights(props.contentRoot, q)
      setMatchCount(count)
      setCurrentIndex(0)
      if (count > 0 && props.contentRoot) scrollToMatch(props.contentRoot, 0)
    }),
  )

  // Clear highlights when bar closes
  createEffect(
    on(() => props.open, (open) => {
      if (!open && props.contentRoot) {
        clearSearchHighlights(props.contentRoot)
        setQuery("")
        setMatchCount(0)
        setCurrentIndex(0)
      }
    }),
  )

  // Focus input when bar opens
  createEffect(
    on(() => props.open, (open) => {
      if (open) requestAnimationFrame(() => inputRef?.focus())
    }),
  )

  // Keyboard: Ctrl+F to focus/reopen, Escape to close
  onMount(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "f") {
        e.preventDefault()
        if (props.open) {
          inputRef?.focus()
          inputRef?.select()
        }
        // If not open, parent's Ctrl+F handler sets open = true
        return
      }
      if (e.key === "Escape" && props.open) {
        e.preventDefault()
        props.onClose()
      }
    }
    window.addEventListener("keydown", handler)
    onCleanup(() => window.removeEventListener("keydown", handler))
  })

  const navigateMatch = (dir: 1 | -1) => {
    const count = matchCount()
    if (count === 0 || !props.contentRoot) return
    const next = (currentIndex() + dir + count) % count
    setCurrentIndex(next)
    scrollToMatch(props.contentRoot, next)
  }

  return (
    <Show when={props.open}>
      <div class="message-search-bar" role="search" aria-label="Search messages">
        <Icon name="search" size="small" />
        <input
          ref={inputRef}
          class="message-search-input"
          type="text"
          placeholder="Search messages…"
          value={query()}
          onInput={(e) => setQuery(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") navigateMatch(e.shiftKey ? -1 : 1)
            if (e.key === "Escape") { e.preventDefault(); props.onClose() }
          }}
          aria-label="Search messages"
          aria-controls="message-list"
        />
        <Show when={query()}>
          <span class="message-search-count" aria-live="polite" aria-atomic="true">
            {matchCount() === 0
              ? "No matches"
              : `${currentIndex() + 1} of ${matchCount()}`}
          </span>
          <button
            class="message-search-nav"
            onClick={() => navigateMatch(-1)}
            title="Previous match (Shift+Enter)"
            aria-label="Previous match"
            type="button"
          >
            <Icon name="chevron-up" size="small" />
          </button>
          <button
            class="message-search-nav"
            onClick={() => navigateMatch(1)}
            title="Next match (Enter)"
            aria-label="Next match"
            type="button"
          >
            <Icon name="chevron-down" size="small" />
          </button>
        </Show>
        <button
          class="message-search-close"
          onClick={props.onClose}
          title="Close search (Esc)"
          aria-label="Close search"
          type="button"
        >
          <Icon name="x" size="small" />
        </button>
      </div>
    </Show>
  )
}
