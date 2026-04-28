/**
 * VirtualMessageList — high-performance virtualized message list for long
 * conversations (500+ turns).
 *
 * Architecture
 * ────────────
 * • Delegates actual DOM virtualisation to `virtua/solid`'s `<Virtualizer>`,
 *   which is already a project dependency (used in MessageList.tsx).
 * • Maintains a sliding window via virtua's built-in overscan + its own
 *   scroll management — we do not reinvent that wheel.
 * • Adds:
 *     - Per-row ResizeObserver to track real heights and feed them back to
 *       virtua so variable-height messages render without layout jitter.
 *     - Sticky-to-bottom: auto-scrolls as new messages arrive unless the
 *       user has scrolled up.
 *     - Imperative handles: `scrollToMessage(id)` and `scrollToBottom()`.
 *     - Buffer of 10 items above and below the visible window (overscan=10).
 *
 * Props
 * ─────
 * • `turns` — reactive accessor returning `MessageTurn[]`.
 * • `renderTurn(turn, index)` — render callback for each row.
 * • `working` — reactive accessor; when true the list sticks to the bottom.
 * • `shift` — passed to virtua when messages are prepended (load-older).
 * • `ref` — receives a `VirtualMessageListHandle` with imperative methods.
 *
 * Wire-in note
 * ────────────
 * ChatView → MessageList already wraps turns in a `<Virtualizer>` directly.
 * VirtualMessageList is a thin, drop-in wrapper around that same Virtualizer
 * that adds the extra capabilities listed above.  MessageList passes its
 * scroll element ref through the existing `createAutoScroll` hook, so we
 * expose our scroll container via a `scrollRef` callback prop for integration.
 */

import {
  Component,
  JSX,
  createEffect,
  createMemo,
  createSignal,
  on,
  onCleanup,
  onMount,
} from "solid-js"
import { Virtualizer } from "virtua/solid"
import type { MessageTurn } from "../../context/session-queue"

// ── Public handle exposed via ref ─────────────────────────────────────────────

export interface VirtualMessageListHandle {
  /** Scroll so the turn with the given user-message id is visible. */
  scrollToMessage: (id: string) => void
  /** Scroll to the very bottom of the list. */
  scrollToBottom: () => void
}

// ── Props ─────────────────────────────────────────────────────────────────────

export interface VirtualMessageListProps {
  /** Reactive accessor for the array of turns to render. */
  turns: () => MessageTurn[]
  /** Render callback — return the JSX for a single row. */
  renderTurn: (turn: MessageTurn, index: () => number) => JSX.Element
  /** When true the list will auto-scroll to the bottom as new items arrive. */
  working: () => boolean
  /**
   * When true, virtua shifts the scroll position to compensate for
   * items prepended at the top (used when loading older messages).
   */
  shift?: boolean
  /**
   * Called with the scroll container element (or undefined on cleanup).
   * Wire this into your `createAutoScroll` or outer scroll handler.
   */
  scrollRef?: (el: HTMLElement | undefined) => void
  /** Extra CSS class applied to the scroll container. */
  class?: string
  /** ref callback — receives the imperative handle. */
  ref?: (handle: VirtualMessageListHandle) => void
}

// ── Component ─────────────────────────────────────────────────────────────────

export const VirtualMessageList: Component<VirtualMessageListProps> = (props) => {
  // Scroll container element
  const [scrollEl, setScrollEl] = createSignal<HTMLElement>()

  // Whether the user has manually scrolled away from the bottom
  const [userScrolled, setUserScrolled] = createSignal(false)

  // Track average measured row height (fed back to virtua as initial itemSize)
  const [avgHeight, setAvgHeight] = createSignal(260)

  // Accumulated height measurements: messageId → height in px
  const heightMap = new Map<string, number>()

  // ResizeObservers keyed by messageId
  const observers = new Map<string, ResizeObserver>()

  // ── Height tracking ─────────────────────────────────────────────────────────

  const recordHeight = (id: string, h: number) => {
    if (h <= 0) return
    heightMap.set(id, h)
    // Recompute average lazily — only update signal if value changed noticeably
    if (heightMap.size > 0) {
      let sum = 0
      heightMap.forEach((v) => (sum += v))
      const next = Math.round(sum / heightMap.size)
      if (Math.abs(next - avgHeight()) > 4) setAvgHeight(next)
    }
  }

  const observeRow = (id: string, el: HTMLElement) => {
    if (observers.has(id)) return
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        recordHeight(id, entry.contentRect.height)
      }
    })
    ro.observe(el)
    observers.set(id, ro)
  }

  const unobserveRow = (id: string) => {
    const ro = observers.get(id)
    if (ro) {
      ro.disconnect()
      observers.delete(id)
    }
    heightMap.delete(id)
  }

  onCleanup(() => {
    observers.forEach((ro) => ro.disconnect())
    observers.clear()
    heightMap.clear()
  })

  // ── Scroll behaviour ────────────────────────────────────────────────────────

  const BOTTOM_THRESHOLD = 48 // px from bottom to consider "at bottom"

  const isAtBottom = (): boolean => {
    const el = scrollEl()
    if (!el) return true
    return el.scrollHeight - el.scrollTop - el.clientHeight < BOTTOM_THRESHOLD
  }

  const scrollToBottomImmediate = () => {
    const el = scrollEl()
    if (!el) return
    el.scrollTop = el.scrollHeight
  }

  const handleScroll = () => {
    setUserScrolled(!isAtBottom())
  }

  // When new turns arrive while working, snap to bottom unless user scrolled up
  const turnCount = createMemo(() => props.turns().length)

  createEffect(
    on(turnCount, () => {
      if (!userScrolled()) {
        // Use rAF to let virtua render the new item first
        requestAnimationFrame(scrollToBottomImmediate)
      }
    }),
  )

  // When working transitions busy → idle, also snap to bottom
  createEffect(
    on(props.working, (nowWorking, wasWorking) => {
      if (wasWorking && !nowWorking && !userScrolled()) {
        requestAnimationFrame(scrollToBottomImmediate)
      }
    }),
  )

  // ── Scroll container ref callback ───────────────────────────────────────────

  const setScrollRef = (el: HTMLElement | undefined) => {
    setScrollEl(el)
    props.scrollRef?.(el)
  }

  // ── Imperative handle ───────────────────────────────────────────────────────

  const scrollToMessage = (id: string) => {
    const el = scrollEl()
    if (!el) return
    // Try to find the rendered DOM node by data attribute
    const target = el.querySelector(`[data-message="${id}"]`) as HTMLElement | null
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "nearest" })
    }
  }

  const scrollToBottom = () => {
    setUserScrolled(false)
    scrollToBottomImmediate()
  }

  // Expose handle via ref callback prop
  onMount(() => {
    if (props.ref) {
      props.ref({ scrollToMessage, scrollToBottom })
    }
  })

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div
      ref={(el) => setScrollRef(el)}
      class={props.class}
      onScroll={handleScroll}
      style={{ overflow: "auto", height: "100%", position: "relative" }}
    >
      <Virtualizer
        data={props.turns()}
        scrollRef={scrollEl()}
        shift={props.shift ?? false}
        overscan={10}
        itemSize={avgHeight()}
      >
        {(turn, index) => {
          // Attach a ResizeObserver once the row element mounts
          const rowRef = (el: HTMLElement) => {
            if (!el) {
              unobserveRow(turn.user.id)
              return
            }
            observeRow(turn.user.id, el)
          }

          return (
            <div ref={rowRef} data-vml-row={turn.user.id}>
              {props.renderTurn(turn, index)}
            </div>
          )
        }}
      </Virtualizer>
    </div>
  )
}

export default VirtualMessageList
