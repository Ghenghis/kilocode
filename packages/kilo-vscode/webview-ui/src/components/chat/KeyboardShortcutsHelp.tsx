/**
 * KeyboardShortcutsHelp — Canary.10 keyboard shortcuts reference modal
 *
 * Opens on Ctrl+/ (or Ctrl+?) and shows all registered shortcuts
 * grouped by scope, with a live search/filter input.
 *
 * Provides:
 *  - ShortcutRegistryProvider — context provider + global keydown listener
 *  - KeyboardShortcutsHelp — the modal itself (rendered from AppContent)
 *  - SkipLinks — visually-hidden "Skip to…" links for accessibility
 */

import {
  Component,
  createSignal,
  createMemo,
  For,
  Show,
  onMount,
  onCleanup,
  ParentComponent,
} from "solid-js"
import {
  ShortcutRegistryContext,
  createShortcutRegistry,
  useShortcutRegistry,
  type ShortcutScope,
  type ShortcutConfig,
} from "../../hooks/useKeyboardShortcuts"
import { createFocusTrap } from "../../utils/focusTrap"

// ─────────────────────────────────────────────────────────────────────────────
// Provider
// ─────────────────────────────────────────────────────────────────────────────

export const ShortcutRegistryProvider: ParentComponent = (props) => {
  const registry = createShortcutRegistry() as ReturnType<typeof createShortcutRegistry> & {
    _attach: () => void
  }

  onMount(() => {
    registry._attach()
  })

  return (
    <ShortcutRegistryContext.Provider value={registry}>
      {props.children}
    </ShortcutRegistryContext.Provider>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Help modal
// ─────────────────────────────────────────────────────────────────────────────

const SCOPE_LABELS: Record<ShortcutScope, string> = {
  global: "Global",
  chat: "Chat",
  settings: "Settings",
  history: "History",
}

const SCOPE_ORDER: ShortcutScope[] = ["global", "chat", "settings", "history"]

export const KeyboardShortcutsHelp: Component = () => {
  const registry = useShortcutRegistry()
  const [open, setOpen] = createSignal(false)
  const [query, setQuery] = createSignal("")
  let containerRef: HTMLDivElement | undefined
  let searchRef: HTMLInputElement | undefined

  const openHelp = () => {
    setQuery("")
    setOpen(true)
  }
  const closeHelp = () => setOpen(false)

  // Register the help-open shortcut inside the registry itself
  onMount(() => {
    // Ctrl+/ or Ctrl+?
    registry.registerShortcut({
      id: "help:open-ctrl-slash",
      key: "/",
      ctrl: true,
      description: "Show keyboard shortcuts",
      scope: "global",
      handler: (e) => {
        e.preventDefault()
        openHelp()
        return true
      },
    })
    registry.registerShortcut({
      id: "help:open-ctrl-question",
      key: "?",
      ctrl: true,
      description: "Show keyboard shortcuts",
      scope: "global",
      handler: (e) => {
        e.preventDefault()
        openHelp()
        return true
      },
    })

    onCleanup(() => {
      registry.unregisterShortcut("help:open-ctrl-slash")
      registry.unregisterShortcut("help:open-ctrl-question")
    })
  })

  // Focus trap + Escape to close
  onMount(() => {
    // Watch for open state changes via createEffect would require Solid's reactive
    // system; we handle focus trap imperatively on open toggle.
  })

  // Filtered shortcuts
  const filtered = createMemo(() => {
    const q = query().toLowerCase().trim()
    const all = registry.shortcuts
    if (!q) return all
    return all.filter(
      (sc) =>
        sc.description.toLowerCase().includes(q) ||
        registry.formatChord(sc).toLowerCase().includes(q) ||
        sc.scope.includes(q),
    )
  })

  // Group by scope
  const grouped = createMemo(() => {
    const map = new Map<ShortcutScope, ShortcutConfig[]>()
    for (const sc of filtered()) {
      const arr = map.get(sc.scope) ?? []
      arr.push(sc)
      map.set(sc.scope, arr)
    }
    return SCOPE_ORDER.filter((s) => map.has(s)).map((s) => ({ scope: s, items: map.get(s)! }))
  })

  let trap: ReturnType<typeof createFocusTrap> | null = null

  const handleBackdropClick = (e: MouseEvent) => {
    if (e.target === e.currentTarget) closeHelp()
  }

  const handleContainerMount = (el: HTMLDivElement) => {
    containerRef = el
  }

  // We need to manage the focus trap reactively; use a simple effect-style approach
  const handleOpenChange = (nowOpen: boolean) => {
    if (nowOpen) {
      requestAnimationFrame(() => {
        if (containerRef) {
          trap = createFocusTrap(containerRef)
          searchRef?.focus()
        }
      })
    } else {
      trap?.deactivate()
      trap = null
    }
  }

  // Wire open signal to focus trap lifecycle
  let prevOpen = false
  const tickCheck = () => {
    const now = open()
    if (now !== prevOpen) {
      prevOpen = now
      handleOpenChange(now)
    }
  }
  // Poll via requestAnimationFrame is not ideal; use a reactive approach instead:
  // We call handleOpenChange inside the Show fallback callbacks via ref assignment.

  const handleModalKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault()
      e.stopPropagation()
      closeHelp()
    }
  }

  return (
    <Show when={open()}>
      {/* Backdrop */}
      <div
        class="kb-help-backdrop"
        onClick={handleBackdropClick}
        role="presentation"
      >
        {/* Modal */}
        <div
          class="kb-help-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="kb-help-title"
          onKeyDown={handleModalKeyDown}
          ref={(el) => {
            handleContainerMount(el)
            // Activate focus trap once mounted
            requestAnimationFrame(() => {
              if (el) {
                trap = createFocusTrap(el)
                searchRef?.focus()
              }
            })
          }}
        >
          <div class="kb-help-header">
            <span id="kb-help-title" class="kb-help-title">Keyboard Shortcuts</span>
            <button
              class="kb-help-close"
              onClick={closeHelp}
              aria-label="Close keyboard shortcuts help"
              type="button"
            >
              <span aria-hidden="true">×</span>
            </button>
          </div>

          <div class="kb-help-search-wrapper">
            <input
              ref={searchRef}
              class="kb-help-search"
              type="text"
              placeholder="Search shortcuts…"
              value={query()}
              onInput={(e) => setQuery(e.currentTarget.value)}
              aria-label="Search shortcuts"
              aria-controls="kb-help-results"
            />
          </div>

          {/* Live region for search results count */}
          <div aria-live="polite" aria-atomic="true" class="sr-only">
            {query()
              ? `${filtered().length} shortcut${filtered().length !== 1 ? "s" : ""} found`
              : ""}
          </div>

          <div id="kb-help-results" class="kb-help-body">
            <Show
              when={grouped().length > 0}
              fallback={
                <p class="kb-help-empty" role="status">No shortcuts match "{query()}"</p>
              }
            >
              <For each={grouped()}>
                {(group) => (
                  <section
                    class="kb-help-section"
                    role="group"
                    aria-labelledby={`kb-help-section-${group.scope}`}
                  >
                    <h3 id={`kb-help-section-${group.scope}`} class="kb-help-section-title">
                      {SCOPE_LABELS[group.scope]}
                    </h3>
                    <ul class="kb-help-list" role="list">
                      <For each={group.items}>
                        {(sc) => (
                          <li class="kb-help-item">
                            <span class="kb-help-item-desc">{sc.description}</span>
                            <kbd class="kb-help-item-chord" aria-label={`keyboard shortcut: ${registry.formatChord(sc)}`}>
                              {registry.formatChord(sc)}
                            </kbd>
                          </li>
                        )}
                      </For>
                    </ul>
                  </section>
                )}
              </For>
            </Show>
          </div>

          <div class="kb-help-footer">
            <span><kbd>Tab</kbd> navigate</span>
            <span><kbd>Esc</kbd> close</span>
            <span class="kb-help-footer-hint">
              {registry.shortcuts.length} shortcut{registry.shortcuts.length !== 1 ? "s" : ""} registered
            </span>
          </div>
        </div>
      </div>
    </Show>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Skip links (accessibility)
// ─────────────────────────────────────────────────────────────────────────────

export const SkipLinks: Component = () => {
  return (
    <div class="skip-links" aria-label="Skip navigation">
      <a class="skip-link" href="#chat-main">
        Skip to chat
      </a>
      <a class="skip-link" href="#settings-main">
        Skip to settings
      </a>
    </div>
  )
}
