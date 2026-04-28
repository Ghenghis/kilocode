/**
 * GlobalCommandBar component
 * VS Code command palette-style bar for AI actions.
 * Triggered by Ctrl+Shift+K. Fuzzy-searchable. Most-used commands at top.
 */

import { Component, For, Show, createEffect, createMemo, createSignal, on, onCleanup, onMount } from "solid-js"
import { useSession } from "../../context/session"
import { useVSCode } from "../../context/vscode"

interface Command {
  id: string
  label: string
  description?: string
  usageCount: number
  action: () => void
}

interface GlobalCommandBarProps {
  open: boolean
  onClose: () => void
}

// Module-level usage counter persisted across mounts
const usageCounts: Record<string, number> = {}

function fuzzyMatch(query: string, target: string): boolean {
  if (!query) return true
  const q = query.toLowerCase()
  const t = target.toLowerCase()
  let qi = 0
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) qi++
  }
  return qi === q.length
}

function fuzzyScore(query: string, target: string): number {
  if (!query) return 0
  const q = query.toLowerCase()
  const t = target.toLowerCase()
  // Bonus for prefix match
  if (t.startsWith(q)) return 100
  // Bonus for word boundary match
  const words = t.split(/\s+/)
  if (words.some((w) => w.startsWith(q))) return 50
  return 10
}

export const GlobalCommandBar: Component<GlobalCommandBarProps> = (props) => {
  const session = useSession()
  const vscode = useVSCode()

  const [query, setQuery] = createSignal("")
  const [activeIndex, setActiveIndex] = createSignal(0)
  let inputRef: HTMLInputElement | undefined
  let listRef: HTMLDivElement | undefined

  // Focus input when opened
  createEffect(
    on(
      () => props.open,
      (open) => {
        if (open) {
          setQuery("")
          setActiveIndex(0)
          requestAnimationFrame(() => inputRef?.focus())
        }
      },
    ),
  )

  const buildCommands = (): Command[] => {
    const agents = session.agents().filter((a) => a.mode !== "subagent" && !a.hidden)
    const cmds: Command[] = [
      {
        id: "new-chat",
        label: "New chat",
        description: "Start a new conversation",
        usageCount: usageCounts["new-chat"] ?? 0,
        action: () => {
          window.dispatchEvent(new CustomEvent("newTaskRequest"))
          props.onClose()
        },
      },
      {
        id: "export-conversation",
        label: "Export conversation",
        description: "Export the current conversation to a file",
        usageCount: usageCounts["export-conversation"] ?? 0,
        action: () => {
          vscode.postMessage({ type: "exportConversation" })
          props.onClose()
        },
      },
      {
        id: "clear-context",
        label: "Clear context",
        description: "Compact/summarize the current session",
        usageCount: usageCounts["clear-context"] ?? 0,
        action: () => {
          window.dispatchEvent(new CustomEvent("compactSession"))
          props.onClose()
        },
      },
      {
        id: "open-in-tab",
        label: "Open in tab",
        description: "Open the current session in an editor tab",
        usageCount: usageCounts["open-in-tab"] ?? 0,
        action: () => {
          vscode.postMessage({ type: "openInTab" })
          props.onClose()
        },
      },
      {
        id: "open-settings",
        label: "Open settings",
        description: "Open KiloCode settings panel",
        usageCount: usageCounts["open-settings"] ?? 0,
        action: () => {
          vscode.postMessage({ type: "action", action: "settingsButtonClicked" })
          props.onClose()
        },
      },
      {
        id: "show-history",
        label: "Show history",
        description: "Browse past conversations",
        usageCount: usageCounts["show-history"] ?? 0,
        action: () => {
          vscode.postMessage({ type: "action", action: "historyButtonClicked" })
          props.onClose()
        },
      },
      ...agents.map((agent) => ({
        id: `run-agent-${agent.name}`,
        label: `Run agent: ${agent.name}`,
        description: agent.description ?? `Switch to ${agent.name} agent`,
        usageCount: usageCounts[`run-agent-${agent.name}`] ?? 0,
        action: () => {
          session.selectAgent(agent.name)
          props.onClose()
        },
      })),
    ]
    return cmds
  }

  const allCommands = createMemo(buildCommands)

  const filteredCommands = createMemo(() => {
    const q = query()
    const cmds = allCommands()
    const matched = q ? cmds.filter((c) => fuzzyMatch(q, c.label) || fuzzyMatch(q, c.description ?? "")) : cmds
    return matched.sort((a, b) => {
      if (q) {
        const scoreDiff = fuzzyScore(q, b.label) - fuzzyScore(q, a.label)
        if (scoreDiff !== 0) return scoreDiff
      }
      return b.usageCount - a.usageCount
    })
  })

  createEffect(
    on(filteredCommands, () => {
      setActiveIndex(0)
    }),
  )

  const scrollActiveIntoView = () => {
    if (!listRef) return
    const items = listRef.querySelectorAll(".gcb-item")
    const active = items[activeIndex()] as HTMLElement | undefined
    active?.scrollIntoView({ block: "nearest" })
  }

  const handleKeyDown = (e: KeyboardEvent) => {
    const cmds = filteredCommands()
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setActiveIndex((i) => Math.min(i + 1, cmds.length - 1))
      requestAnimationFrame(scrollActiveIntoView)
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setActiveIndex((i) => Math.max(i - 1, 0))
      requestAnimationFrame(scrollActiveIntoView)
    } else if (e.key === "Enter") {
      e.preventDefault()
      const cmd = cmds[activeIndex()]
      if (cmd) executeCommand(cmd)
    } else if (e.key === "Escape") {
      e.preventDefault()
      props.onClose()
    }
  }

  const executeCommand = (cmd: Command) => {
    usageCounts[cmd.id] = (usageCounts[cmd.id] ?? 0) + 1
    cmd.action()
  }

  return (
    <Show when={props.open}>
      {/* Backdrop */}
      <div class="gcb-backdrop" onClick={props.onClose} aria-hidden="true" />

      <div class="gcb-container" role="dialog" aria-label="Command bar" aria-modal="true">
        <div class="gcb-header">
          <span class="gcb-icon" aria-hidden="true">&#62;_</span>
          <input
            ref={inputRef}
            class="gcb-input"
            type="text"
            role="combobox"
            placeholder="Type a command..."
            value={query()}
            onInput={(e) => setQuery(e.currentTarget.value)}
            onKeyDown={handleKeyDown}
            aria-label="Search commands"
            aria-autocomplete="list"
            aria-controls="gcb-list"
            aria-expanded={filteredCommands().length > 0}
            aria-activedescendant={filteredCommands().length > 0 ? `gcb-item-${activeIndex()}` : undefined}
            aria-haspopup="listbox"
          />
          <kbd class="gcb-shortcut-hint">Esc</kbd>
        </div>

        {/* Live region — announces result count to screen readers */}
        <div
          aria-live="polite"
          aria-atomic="true"
          class="sr-only"
        >
          {query()
            ? `${filteredCommands().length} result${filteredCommands().length !== 1 ? "s" : ""} found`
            : ""}
        </div>

        <div
          ref={listRef}
          id="gcb-list"
          class="gcb-list"
          role="listbox"
          aria-label="Commands"
        >
          <Show
            when={filteredCommands().length > 0}
            fallback={<div class="gcb-empty" role="status">No commands match "{query()}"</div>}
          >
            <For each={filteredCommands()}>
              {(cmd, index) => (
                <div
                  id={`gcb-item-${index()}`}
                  class="gcb-item"
                  classList={{ "gcb-item--active": index() === activeIndex() }}
                  role="option"
                  aria-selected={index() === activeIndex()}
                  onMouseEnter={() => setActiveIndex(index())}
                  onMouseDown={(e) => {
                    e.preventDefault()
                    executeCommand(cmd)
                  }}
                >
                  <span class="gcb-item-label">{cmd.label}</span>
                  <Show when={cmd.description}>
                    <span class="gcb-item-desc">{cmd.description}</span>
                  </Show>
                  <Show when={cmd.usageCount > 0}>
                    <span class="gcb-item-usage" title={`Used ${cmd.usageCount} times`}>
                      {cmd.usageCount}
                    </span>
                  </Show>
                </div>
              )}
            </For>
          </Show>
        </div>

        <div class="gcb-footer">
          <span><kbd>&#8593;</kbd><kbd>&#8595;</kbd> navigate</span>
          <span><kbd>Enter</kbd> run</span>
          <span><kbd>Esc</kbd> close</span>
          <span class="gcb-footer-shortcut">Ctrl+Shift+K to open</span>
        </div>
      </div>
    </Show>
  )
}
