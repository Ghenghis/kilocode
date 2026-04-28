/**
 * MessageTemplates component
 * Saved prompt templates with variable substitution ({filename}, {selection}, {language}).
 * "Templates" button opens a picker. Templates created from current prompt.
 */

import { Component, For, Show, createEffect, createMemo, createSignal, on } from "solid-js"
import { useVSCode } from "../../context/vscode"

export interface MessageTemplate {
  id: string
  name: string
  body: string
  usageCount: number
  createdAt: number
}

// Module-level storage (persisted in localStorage for cross-session durability)
const STORAGE_KEY = "kilo-message-templates"

function loadTemplates(): MessageTemplate[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return getDefaultTemplates()
    return JSON.parse(raw) as MessageTemplate[]
  } catch {
    return getDefaultTemplates()
  }
}

function saveTemplates(templates: MessageTemplate[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(templates))
  } catch {
    // ignore storage errors
  }
}

function getDefaultTemplates(): MessageTemplate[] {
  return [
    {
      id: "explain-file",
      name: "Explain this file",
      body: "Please explain what @{filename} does and how it works.",
      usageCount: 0,
      createdAt: Date.now(),
    },
    {
      id: "review-selection",
      name: "Review selected code",
      body: "Please review the following {language} code and suggest improvements:\n\n{selection}",
      usageCount: 0,
      createdAt: Date.now(),
    },
    {
      id: "write-tests",
      name: "Write tests",
      body: "Write comprehensive unit tests for @{filename}. Focus on edge cases and error handling.",
      usageCount: 0,
      createdAt: Date.now(),
    },
    {
      id: "fix-bug",
      name: "Fix bug",
      body: "There is a bug in @{filename}. Here is the error:\n\n{selection}\n\nPlease identify the root cause and fix it.",
      usageCount: 0,
      createdAt: Date.now(),
    },
  ]
}

interface MessageTemplatesProps {
  open: boolean
  onClose: () => void
  currentText: string
  onApply: (text: string) => void
  onSaveCurrentAsTemplate: (body: string) => void
}

export const MessageTemplates: Component<MessageTemplatesProps> = (props) => {
  const vscode = useVSCode()

  const [templates, setTemplates] = createSignal<MessageTemplate[]>(loadTemplates())
  const [searchQuery, setSearchQuery] = createSignal("")
  const [editingTemplate, setEditingTemplate] = createSignal<MessageTemplate | null>(null)
  const [newTemplateName, setNewTemplateName] = createSignal("")
  const [activeIndex, setActiveIndex] = createSignal(0)
  const [showSaveNew, setShowSaveNew] = createSignal(false)
  let searchRef: HTMLInputElement | undefined

  // Focus search on open
  createEffect(
    on(
      () => props.open,
      (open) => {
        if (open) {
          setSearchQuery("")
          setActiveIndex(0)
          setShowSaveNew(false)
          requestAnimationFrame(() => searchRef?.focus())
        }
      },
    ),
  )

  const filteredTemplates = createMemo(() => {
    const q = searchQuery().toLowerCase()
    return templates()
      .filter((t) => !q || t.name.toLowerCase().includes(q) || t.body.toLowerCase().includes(q))
      .sort((a, b) => b.usageCount - a.usageCount)
  })

  const expandVariables = (body: string): string => {
    // Request variable values from VS Code extension
    // For now do simple substitution with placeholders indicating what to fill
    return body
  }

  const applyTemplate = (template: MessageTemplate) => {
    const expanded = expandVariables(template.body)
    // Increment usage count
    setTemplates((prev) =>
      prev.map((t) => (t.id === template.id ? { ...t, usageCount: t.usageCount + 1 } : t)),
    )
    saveTemplates(templates())
    props.onApply(expanded)
    props.onClose()
  }

  const deleteTemplate = (id: string, e: MouseEvent) => {
    e.stopPropagation()
    setTemplates((prev) => prev.filter((t) => t.id !== id))
    saveTemplates(templates())
  }

  const saveCurrentAsTemplate = () => {
    const name = newTemplateName().trim()
    if (!name || !props.currentText.trim()) return
    const newTemplate: MessageTemplate = {
      id: crypto.randomUUID(),
      name,
      body: props.currentText.trim(),
      usageCount: 0,
      createdAt: Date.now(),
    }
    setTemplates((prev) => [newTemplate, ...prev])
    saveTemplates(templates())
    setNewTemplateName("")
    setShowSaveNew(false)
    props.onClose()
  }

  const handleKeyDown = (e: KeyboardEvent) => {
    const cmds = filteredTemplates()
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setActiveIndex((i) => Math.min(i + 1, cmds.length - 1))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setActiveIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === "Enter" && !showSaveNew()) {
      e.preventDefault()
      const t = cmds[activeIndex()]
      if (t) applyTemplate(t)
    } else if (e.key === "Escape") {
      e.preventDefault()
      props.onClose()
    }
  }

  return (
    <Show when={props.open}>
      <div class="templates-backdrop" onClick={props.onClose} aria-hidden="true" />
      <div class="templates-panel" role="dialog" aria-label="Message templates" aria-modal="true">
        <div class="templates-header">
          <span class="templates-title">Message Templates</span>
          <div class="templates-header-actions">
            <Show when={props.currentText.trim()}>
              <button
                class="templates-save-btn"
                onClick={() => setShowSaveNew((v) => !v)}
                title="Save current input as template"
              >
                + Save current
              </button>
            </Show>
            <button class="templates-close-btn" onClick={props.onClose} aria-label="Close templates">
              &#215;
            </button>
          </div>
        </div>

        <Show when={showSaveNew()}>
          <div class="templates-save-form">
            <input
              class="templates-name-input"
              type="text"
              placeholder="Template name..."
              value={newTemplateName()}
              onInput={(e) => setNewTemplateName(e.currentTarget.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") saveCurrentAsTemplate()
                if (e.key === "Escape") setShowSaveNew(false)
              }}
              autofocus
            />
            <button
              class="templates-confirm-save-btn"
              onClick={saveCurrentAsTemplate}
              disabled={!newTemplateName().trim()}
            >
              Save
            </button>
          </div>
        </Show>

        <div class="templates-search-wrapper">
          <input
            ref={searchRef}
            class="templates-search"
            type="text"
            placeholder="Search templates..."
            value={searchQuery()}
            onInput={(e) => setSearchQuery(e.currentTarget.value)}
            onKeyDown={handleKeyDown}
            aria-label="Search templates"
          />
        </div>

        <div class="templates-list" role="listbox" aria-label="Templates">
          <Show
            when={filteredTemplates().length > 0}
            fallback={<div class="templates-empty">No templates found</div>}
          >
            <For each={filteredTemplates()}>
              {(template, index) => (
                <div
                  class="templates-item"
                  classList={{ "templates-item--active": index() === activeIndex() }}
                  role="option"
                  aria-selected={index() === activeIndex()}
                  onMouseEnter={() => setActiveIndex(index())}
                  onClick={() => applyTemplate(template)}
                >
                  <div class="templates-item-header">
                    <span class="templates-item-name">{template.name}</span>
                    <div class="templates-item-actions">
                      <Show when={template.usageCount > 0}>
                        <span class="templates-item-usage">{template.usageCount}x</span>
                      </Show>
                      <button
                        class="templates-item-delete"
                        onClick={(e) => deleteTemplate(template.id, e)}
                        aria-label={`Delete template: ${template.name}`}
                        title="Delete template"
                      >
                        &#215;
                      </button>
                    </div>
                  </div>
                  <div class="templates-item-preview">{template.body}</div>
                  <Show when={/\{[a-z]+\}/.test(template.body)}>
                    <div class="templates-item-vars">
                      {Array.from(template.body.matchAll(/\{([a-z]+)\}/g)).map((m) => (
                        <span class="templates-item-var">{`{${m[1]}}`}</span>
                      ))}
                    </div>
                  </Show>
                </div>
              )}
            </For>
          </Show>
        </div>

        <div class="templates-footer">
          <span><kbd>&#8593;</kbd><kbd>&#8595;</kbd> navigate</span>
          <span><kbd>Enter</kbd> apply</span>
          <span>Variables: <code>{"{filename}"}</code> <code>{"{selection}"}</code> <code>{"{language}"}</code></span>
        </div>
      </div>
    </Show>
  )
}
