/**
 * ChatFeatures — game-changing chat features for KiloCode canary.10
 *
 * Features:
 * 1. Message pinning — pin any message to a persistent top drawer
 * 2. Message reactions/ratings — thumbs up/down on assistant messages
 * 3. Chat split view — compare mode with two panes and different models
 * 4. Message branching — branch chat from any message point
 * 5. Inline code execution — run code blocks in VS Code terminal
 * 6. Smart scroll anchor — new-messages badge when scrolled up
 * 7. Chat bookmarks — bookmark messages for quick reference
 */

import {
  Component,
  For,
  Show,
  createSignal,
  createMemo,
  onCleanup,
  onMount,
  JSX,
  Accessor,
  Setter,
} from "solid-js"
import { Icon } from "@kilocode/kilo-ui/icon"
import { useVSCode } from "../../context/vscode"
import { useSession } from "../../context/session"

// ─────────────────────────────────────────────────────────────────────────────
// Shared types
// ─────────────────────────────────────────────────────────────────────────────

export interface PinnedMessage {
  messageId: string
  sessionId: string
  text: string
  pinnedAt: number
}

export interface Reaction {
  messageId: string
  rating: "up" | "down"
  feedback?: string
}

export interface Bookmark {
  messageId: string
  sessionId: string
  text: string
  bookmarkedAt: number
  label?: string
}

export interface BranchInfo {
  branchId: string
  fromMessageId: string
  label: string
  createdAt: number
}

export type FeedbackOption = "Inaccurate" | "Incomplete" | "Off-topic" | "Harmful"

// ─────────────────────────────────────────────────────────────────────────────
// Feature 1 — Message Pinning
// ─────────────────────────────────────────────────────────────────────────────

interface PinnedDrawerProps {
  pins: PinnedMessage[]
  onUnpin: (messageId: string) => void
}

export const PinnedDrawer: Component<PinnedDrawerProps> = (props) => {
  const [open, setOpen] = createSignal(true)

  return (
    <Show when={props.pins.length > 0}>
      <aside class="pinned-drawer" role="complementary" aria-label="Pinned messages">
        <button
          class="pinned-drawer-header"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open()}
          aria-controls="pinned-drawer-list"
          aria-label={`Pinned messages (${props.pins.length}). ${open() ? "Collapse" : "Expand"}`}
        >
          <Icon name="pin" size="small" aria-hidden="true" />
          <span class="pinned-drawer-title">
            Pinned{" "}
            <span class="pinned-drawer-count" aria-hidden="true">{props.pins.length}</span>
          </span>
          <Icon name={open() ? "chevron-up" : "chevron-down"} size="small" aria-hidden="true" />
        </button>
        <Show when={open()}>
          <div id="pinned-drawer-list" class="pinned-drawer-list">
            <For each={props.pins}>
              {(pin) => (
                <div class="pinned-message-row">
                  <span class="pinned-message-text">{pin.text}</span>
                  <button
                    class="pinned-unpin-btn"
                    title="Unpin message"
                    aria-label={`Unpin: ${pin.text.slice(0, 40)}`}
                    onClick={() => props.onUnpin(pin.messageId)}
                  >
                    <Icon name="x" size="small" aria-hidden="true" />
                  </button>
                </div>
              )}
            </For>
          </div>
        </Show>
      </aside>
    </Show>
  )
}

export const PinButton: Component<{
  messageId: string
  isPinned: boolean
  onPin: () => void
}> = (props) => (
  <button
    class="msg-action-btn pin-btn"
    classList={{ "pin-btn--active": props.isPinned }}
    title={props.isPinned ? "Unpin" : "Pin message"}
    aria-label={props.isPinned ? "Unpin" : "Pin message"}
    onClick={(e) => {
      e.stopPropagation()
      props.onPin()
    }}
  >
    <Icon name="pin" size="small" />
  </button>
)

// ─────────────────────────────────────────────────────────────────────────────
// Feature 2 — Message Reactions / Ratings
// ─────────────────────────────────────────────────────────────────────────────

const FEEDBACK_OPTIONS: FeedbackOption[] = ["Inaccurate", "Incomplete", "Off-topic", "Harmful"]

export const ReactionBar: Component<{
  messageId: string
  reaction?: Reaction
  onReact: (rating: "up" | "down", feedback?: string) => void
}> = (props) => {
  const [showFeedback, setShowFeedback] = createSignal(false)
  const [pendingRating, setPendingRating] = createSignal<"up" | "down" | null>(null)

  const handleRating = (rating: "up" | "down") => {
    if (rating === "down") {
      setPendingRating("down")
      setShowFeedback(true)
    } else {
      props.onReact("up")
    }
  }

  const submitFeedback = (option: FeedbackOption) => {
    props.onReact("down", option)
    setShowFeedback(false)
    setPendingRating(null)
  }

  const current = () => props.reaction?.rating

  return (
    <div class="reaction-bar" role="group" aria-label="Message reactions">
      <button
        class="reaction-btn"
        classList={{ "reaction-btn--active": current() === "up" }}
        title="Helpful"
        aria-label={current() === "up" ? "Helpful (selected)" : "Helpful"}
        onClick={() => handleRating("up")}
        aria-pressed={current() === "up"}
      >
        <Icon name="thumbs-up" size="small" aria-hidden="true" />
        <span class="sr-only">Thumbs up</span>
      </button>
      <button
        class="reaction-btn"
        classList={{ "reaction-btn--active": current() === "down" }}
        title="Not helpful"
        aria-label={current() === "down" ? "Not helpful (selected)" : "Not helpful"}
        onClick={() => handleRating("down")}
        aria-pressed={current() === "down"}
      >
        <Icon name="thumbs-down" size="small" aria-hidden="true" />
        <span class="sr-only">Thumbs down</span>
      </button>
      <Show when={showFeedback()}>
        <div
          class="reaction-feedback-dropdown"
          role="menu"
          aria-label="Select feedback reason"
        >
          <span class="reaction-feedback-label" id="reaction-feedback-desc">What was wrong?</span>
          <For each={FEEDBACK_OPTIONS}>
            {(opt) => (
              <button
                class="reaction-feedback-option"
                role="menuitem"
                onClick={() => submitFeedback(opt)}
              >
                {opt}
              </button>
            )}
          </For>
          <button
            class="reaction-feedback-cancel"
            role="menuitem"
            aria-label="Cancel feedback"
            onClick={() => {
              setShowFeedback(false)
              setPendingRating(null)
            }}
          >
            Cancel
          </button>
        </div>
      </Show>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Feature 3 — Chat Split View (Compare Mode)
// ─────────────────────────────────────────────────────────────────────────────

export const SplitViewToggle: Component<{
  active: boolean
  onToggle: () => void
}> = (props) => (
  <button
    class="split-view-toggle"
    classList={{ "split-view-toggle--active": props.active }}
    title={props.active ? "Exit compare mode" : "Compare models side-by-side"}
    aria-label={props.active ? "Exit compare mode" : "Compare models"}
    aria-pressed={props.active}
    onClick={props.onToggle}
  >
    <Icon name="split-horizontal" size="small" />
    <span class="split-view-label">Compare</span>
  </button>
)

export const SplitViewPane: Component<{
  side: "left" | "right"
  model: string
  onModelChange: (m: string) => void
  children: JSX.Element
}> = (props) => (
  <div class="split-view-pane" data-side={props.side}>
    <div class="split-view-pane-header">
      <span class="split-view-pane-side">{props.side === "left" ? "Primary" : "Secondary"}</span>
      <input
        class="split-view-model-input"
        type="text"
        value={props.model}
        placeholder="Model ID"
        aria-label={`${props.side} model`}
        onBlur={(e) => props.onModelChange(e.currentTarget.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") props.onModelChange(e.currentTarget.value)
        }}
      />
    </div>
    <div class="split-view-pane-content">{props.children}</div>
  </div>
)

// ─────────────────────────────────────────────────────────────────────────────
// Feature 4 — Message Branching
// ─────────────────────────────────────────────────────────────────────────────

export const BranchButton: Component<{
  messageId: string
  sessionId: string
  branchCount: number
  branches: BranchInfo[]
  activeBranch?: string
  onBranch: () => void
  onSwitchBranch: (branchId: string) => void
}> = (props) => {
  const [open, setOpen] = createSignal(false)

  return (
    <div class="branch-control">
      <button
        class="msg-action-btn branch-btn"
        title="Branch chat from here"
        aria-label="Branch here"
        onClick={() => props.onBranch()}
      >
        <Icon name="branch" size="small" />
        Branch
      </button>
      <Show when={props.branchCount > 0}>
        <button
          class="branch-count-badge"
          onClick={(e) => {
            e.stopPropagation()
            setOpen((v) => !v)
          }}
          aria-haspopup="listbox"
          aria-expanded={open()}
        >
          Branches: {props.branchCount}
        </button>
      </Show>
      <Show when={open()}>
        <div class="branch-dropdown" role="listbox">
          <For each={props.branches}>
            {(b) => (
              <button
                class="branch-dropdown-item"
                classList={{ "branch-dropdown-item--active": b.branchId === props.activeBranch }}
                role="option"
                aria-selected={b.branchId === props.activeBranch}
                onClick={() => {
                  props.onSwitchBranch(b.branchId)
                  setOpen(false)
                }}
              >
                <Icon name="branch" size="small" />
                <span>{b.label}</span>
              </button>
            )}
          </For>
        </div>
      </Show>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Feature 5 — Inline Code Execution
// ─────────────────────────────────────────────────────────────────────────────

export interface CodeRunResult {
  codeId: string
  exitCode: number | null
  output: string
  running: boolean
}

export const RunCodeButton: Component<{
  codeId: string
  language: string
  code: string
  result?: CodeRunResult
  onRun: () => void
}> = (props) => (
  <div class="run-code-wrapper">
    <button
      class="run-code-btn"
      classList={{ "run-code-btn--running": props.result?.running }}
      disabled={props.result?.running}
      title={`Run ${props.language || "code"} in terminal`}
      aria-label="Run code"
      onClick={() => props.onRun()}
    >
      <Icon name={props.result?.running ? "spinner" : "play"} size="small" />
      {props.result?.running ? "Running…" : "Run"}
    </button>
    <Show when={props.result && !props.result.running}>
      <div
        class="run-code-result"
        classList={{ "run-code-result--error": (props.result?.exitCode ?? 0) !== 0 }}
      >
        <span class="run-code-exit-code">
          Exit {props.result!.exitCode ?? "?"}
        </span>
        <Show when={props.result!.output}>
          <pre class="run-code-output">{props.result!.output}</pre>
        </Show>
      </div>
    </Show>
  </div>
)

// ─────────────────────────────────────────────────────────────────────────────
// Feature 6 — Smart Scroll Anchor
// ─────────────────────────────────────────────────────────────────────────────

export const NewMessagesBadge: Component<{
  count: number
  onJump: () => void
}> = (props) => (
  <div aria-live="polite" aria-atomic="true">
    <Show when={props.count > 0}>
      <button
        class="new-messages-badge"
        onClick={props.onJump}
        aria-label={`${props.count} new ${props.count === 1 ? "message" : "messages"} — click to scroll down`}
      >
        <Icon name="arrow-down" size="small" aria-hidden="true" />
        {props.count} new {props.count === 1 ? "message" : "messages"}
      </button>
    </Show>
  </div>
)

// ─────────────────────────────────────────────────────────────────────────────
// Feature 7 — Chat Bookmarks
// ─────────────────────────────────────────────────────────────────────────────

interface BookmarksPanelProps {
  bookmarks: Bookmark[]
  onRemove: (messageId: string) => void
  onClose: () => void
  onNavigate: (messageId: string) => void
}

export const BookmarksPanel: Component<BookmarksPanelProps> = (props) => (
  <div class="bookmarks-panel" role="dialog" aria-label="Bookmarks">
    <div class="bookmarks-panel-header">
      <span class="bookmarks-panel-title">
        <Icon name="bookmark" size="small" />
        Bookmarks
      </span>
      <button class="bookmarks-panel-close" onClick={props.onClose} aria-label="Close bookmarks">
        <Icon name="x" size="small" />
      </button>
    </div>
    <div class="bookmarks-panel-list">
      <Show
        when={props.bookmarks.length > 0}
        fallback={
          <p class="bookmarks-panel-empty">No bookmarks yet. Hover a message and click the bookmark icon.</p>
        }
      >
        <For each={props.bookmarks}>
          {(bm) => (
            <div class="bookmark-item">
              <button
                class="bookmark-item-text"
                onClick={() => props.onNavigate(bm.messageId)}
                title="Jump to message"
              >
                {bm.text}
              </button>
              <button
                class="bookmark-item-remove"
                onClick={() => props.onRemove(bm.messageId)}
                title="Remove bookmark"
                aria-label="Remove bookmark"
              >
                <Icon name="x" size="small" />
              </button>
            </div>
          )}
        </For>
      </Show>
    </div>
  </div>
)

export const BookmarkButton: Component<{
  messageId: string
  isBookmarked: boolean
  onBookmark: () => void
}> = (props) => (
  <button
    class="msg-action-btn bookmark-btn"
    classList={{ "bookmark-btn--active": props.isBookmarked }}
    title={props.isBookmarked ? "Remove bookmark" : "Bookmark message"}
    aria-label={props.isBookmarked ? "Remove bookmark" : "Bookmark message"}
    aria-pressed={props.isBookmarked}
    onClick={(e) => {
      e.stopPropagation()
      props.onBookmark()
    }}
  >
    <Icon name="bookmark" size="small" />
  </button>
)

export const BookmarksToolbarButton: Component<{
  count: number
  onClick: () => void
}> = (props) => (
  <button
    class="toolbar-btn bookmarks-toolbar-btn"
    title={`Bookmarks (${props.count})`}
    aria-label="Show bookmarks"
    onClick={props.onClick}
  >
    <Icon name="bookmark" size="small" />
    <Show when={props.count > 0}>
      <span class="bookmarks-count-badge">{props.count}</span>
    </Show>
  </button>
)
