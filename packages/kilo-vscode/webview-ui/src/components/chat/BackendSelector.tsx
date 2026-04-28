/**
 * BackendSelector — Chat toolbar dropdown for switching between backends.
 *
 * Backends:
 *   ⚡ Kilo Native   — built-in assistant
 *   🤖 OpenHands Dev — sandboxed developer runtime
 *   🪿 Goose Operator — computer-use / MCP operator
 *
 * Design:
 *  - Small pill button: icon + short name
 *  - Green pulsing dot when backend is running
 *  - Yellow dot when Hermes auto-routing is active
 *  - Click opens panel with backend list, profile selector, Hermes toggle
 *  - Full keyboard nav: Enter/Space open, ArrowUp/Down navigate, Escape close
 *  - All VS Code CSS variables for colours
 */

import {
  Component,
  createSignal,
  createEffect,
  createMemo,
  For,
  Show,
  onCleanup,
  onMount,
} from "solid-js"
import { useBackend } from "../../context/backend-context"
import type { BackendId, BackendConfig, Capability } from "../../types/backend-types"
import { useVSCode } from "../../context/vscode"

// ─── Ultra-short labels for the pill button (icon-only mode) ─────────────────
// Keeping these for the accessible aria-label only; the visible button
// shows just the icon + caret to match the compact model-name pill.
const SHORT_NAMES: Record<BackendId, string> = {
  "kilo-native": "Kilo",
  openhands: "OH",
  goose: "GS",
}

// ─── Capability label map ─────────────────────────────────────────────────────

const CAP_LABELS: Partial<Record<Capability, string>> = {
  code_edit: "Code",
  repo_refactor: "Refactor",
  shell: "Shell",
  tests: "Tests",
  browser_sandbox: "Browser",
  computer_use: "Desktop",
  ssh: "SSH",
  vps: "VPS",
  remote_gpu: "GPU",
  file_ops: "Files",
  web_search: "Search",
  mcp_tools: "MCP",
  approval_required: "Approval",
  sandbox_required: "Sandbox",
  checkpoint_required: "Checkpoint",
}

// ─── Component ───────────────────────────────────────────────────────────────

export const BackendSelector: Component = () => {
  const backend = useBackend()
  const vscode = useVSCode()

  // ── All signals at component top level ───────────────────────────────────
  const [open, setOpen] = createSignal(false)
  const [focusedIndex, setFocusedIndex] = createSignal(-1)

  // Derived
  const activeCfg = createMemo(() => backend.activeBackendConfig())
  const isRunning = createMemo(() => backend.isRunning())
  const isAuto = createMemo(() => backend.routingMode() === "auto-hermes")
  const backends = createMemo(() => backend.state().backends)
  const profiles = createMemo(() => backend.state().profiles)
  const activeProfileId = createMemo(() => activeCfg().activeProfileId)

  // Refs
  let triggerRef: HTMLButtonElement | undefined
  let panelRef: HTMLDivElement | undefined

  // ── Close on outside click ────────────────────────────────────────────────
  onMount(() => {
    const handler = (e: MouseEvent) => {
      if (!open()) return
      const target = e.target as Node
      if (panelRef?.contains(target) || triggerRef?.contains(target)) return
      setOpen(false)
    }
    document.addEventListener("mousedown", handler)
    onCleanup(() => document.removeEventListener("mousedown", handler))
  })

  // ── Keyboard nav ──────────────────────────────────────────────────────────
  const onTriggerKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault()
      setOpen((v) => !v)
      setFocusedIndex(0)
    }
  }

  const onPanelKeyDown = (e: KeyboardEvent) => {
    const count = backends().length
    if (e.key === "Escape") {
      e.preventDefault()
      setOpen(false)
      triggerRef?.focus()
      return
    }
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setFocusedIndex((i) => Math.min(i + 1, count - 1))
      return
    }
    if (e.key === "ArrowUp") {
      e.preventDefault()
      setFocusedIndex((i) => Math.max(i - 1, 0))
      return
    }
    if (e.key === "Enter" || e.key === " ") {
      const idx = focusedIndex()
      if (idx >= 0 && idx < count) {
        const b = backends()[idx]
        if (b.enabled) {
          e.preventDefault()
          // IMPORTANT: Voice/TTS profile is backend-agnostic and MUST NOT be touched here.
          // Voice state is managed exclusively by SpeechTab + speech service.
          // Switching backends does NOT reset, modify, or re-initialize voice settings.
          backend.setActiveBackend(b.id)
          setOpen(false)
          triggerRef?.focus()
        }
      }
    }
  }

  // Re-focus list item when focusedIndex changes
  createEffect(() => {
    const idx = focusedIndex()
    if (!open() || idx < 0) return
    const items = panelRef?.querySelectorAll<HTMLElement>("[data-backend-item]")
    items?.[idx]?.focus()
  })

  // ── Manage backends link → settings ──────────────────────────────────────
  const openBackendsSettings = () => {
    setOpen(false)
    vscode.postMessage({ type: "openSettings", tab: "agentBackends" } as any)
  }

  // ── Status dot colour ─────────────────────────────────────────────────────
  const dotColor = createMemo(() => {
    if (isAuto()) return "var(--vscode-charts-yellow, #f5c543)"
    if (isRunning()) return "var(--vscode-charts-green, #4caf50)"
    return "var(--vscode-descriptionForeground)"
  })

  const dotTitle = createMemo(() => {
    if (isAuto()) return "Hermes auto-routing active"
    if (isRunning()) return "Backend running"
    return "Backend idle"
  })

  return (
    <div style={{ position: "relative", display: "inline-flex", "align-items": "center" }}>
      {/* ── Trigger button ─────────────────────────────────────────────── */}
      {/* Compact pill — icon + caret only, matching the model-name pill style */}
      <button
        ref={(el) => (triggerRef = el)}
        aria-haspopup="listbox"
        aria-expanded={open()}
        aria-label={`Backend: ${SHORT_NAMES[activeCfg().id]} (${activeCfg().displayName})`}
        title={`Backend: ${activeCfg().displayName} — ${activeCfg().description}`}
        onClick={() => { setOpen((v) => !v); setFocusedIndex(0) }}
        onKeyDown={onTriggerKeyDown}
        style={{
          display: "inline-flex",
          "align-items": "center",
          gap: "3px",
          /* Tight horizontal padding keeps width similar to "-M2.7-highspeed" pill */
          padding: "2px 5px",
          "border-radius": "4px",
          border: "1px solid var(--vscode-button-secondaryBorder, var(--vscode-widget-border))",
          background: open()
            ? "var(--vscode-button-secondaryHoverBackground)"
            : "var(--vscode-button-secondaryBackground, transparent)",
          color: "var(--vscode-button-secondaryForeground, var(--vscode-foreground))",
          "font-size": "11px",
          "font-weight": "500",
          cursor: "pointer",
          "white-space": "nowrap",
          transition: "background 0.1s",
        }}
      >
        {/* Status dot — pulsing green when running, yellow when auto-hermes */}
        <span
          title={dotTitle()}
          style={{
            display: "inline-block",
            width: "6px",
            height: "6px",
            "border-radius": "50%",
            background: dotColor(),
            "flex-shrink": "0",
            animation: isRunning() && !isAuto() ? "backend-pulse 1.6s ease-in-out infinite" : "none",
          }}
        />
        {/* Backend icon — the only "label"; tooltip shows full name */}
        <span style={{ "font-size": "13px", "line-height": "1" }}>{activeCfg().icon}</span>
        {/* Caret matches the ▲ used by the model selector */}
        <span style={{ opacity: "0.55", "font-size": "9px", "margin-left": "1px" }}>▾</span>
      </button>

      {/* ── Dropdown panel ─────────────────────────────────────────────── */}
      <Show when={open()}>
        <div
          ref={(el) => (panelRef = el)}
          role="listbox"
          aria-label="Select backend"
          onKeyDown={onPanelKeyDown}
          style={{
            position: "absolute",
            bottom: "calc(100% + 4px)",
            left: "0",
            "z-index": "9999",
            "min-width": "300px",
            "max-width": "380px",
            background: "var(--vscode-dropdown-background)",
            border: "1px solid var(--vscode-dropdown-border, var(--vscode-widget-border))",
            "border-radius": "6px",
            "box-shadow": "0 4px 16px rgba(0,0,0,0.28)",
            padding: "6px 0 4px",
            "font-size": "12px",
          }}
        >
          {/* Backend options */}
          <div style={{ padding: "0 6px 4px" }}>
            <div
              style={{
                "font-size": "10px",
                "font-weight": "700",
                "letter-spacing": "0.06em",
                "text-transform": "uppercase",
                color: "var(--vscode-descriptionForeground)",
                padding: "0 6px 4px",
              }}
            >
              Runtime Backend
            </div>
            <For each={backends()}>
              {(b, idx) => (
                <BackendOption
                  config={b}
                  isActive={b.id === activeCfg().id}
                  isFocused={focusedIndex() === idx()}
                  onSelect={() => {
                    if (!b.enabled) return
                    // IMPORTANT: Voice/TTS profile is backend-agnostic and MUST NOT be touched here.
                    // Voice state is managed exclusively by SpeechTab + speech service.
                    // Switching backends does NOT reset, modify, or re-initialize voice settings.
                    backend.setActiveBackend(b.id)
                    setOpen(false)
                    triggerRef?.focus()
                  }}
                  onFocus={() => setFocusedIndex(idx())}
                />
              )}
            </For>
          </div>

          {/* Divider */}
          <div style={{ margin: "4px 0", "border-top": "1px solid var(--vscode-widget-border)" }} />

          {/* Active profile selector */}
          <Show when={profiles().length > 0}>
            <div style={{ padding: "4px 12px" }}>
              <div
                style={{
                  "font-size": "10px",
                  "font-weight": "700",
                  "letter-spacing": "0.06em",
                  "text-transform": "uppercase",
                  color: "var(--vscode-descriptionForeground)",
                  "margin-bottom": "4px",
                }}
              >
                Access Profile
              </div>
              <select
                value={activeProfileId() ?? ""}
                onChange={(e) => {
                  const val = e.currentTarget.value
                  backend.updateBackend(activeCfg().id, {
                    activeProfileId: val || undefined,
                  })
                }}
                style={{
                  width: "100%",
                  padding: "3px 6px",
                  "font-size": "11px",
                  background: "var(--vscode-dropdown-background)",
                  color: "var(--vscode-dropdown-foreground)",
                  border: "1px solid var(--vscode-dropdown-border, var(--vscode-widget-border))",
                  "border-radius": "3px",
                  cursor: "pointer",
                }}
              >
                <option value="">— No profile —</option>
                <For each={profiles()}>
                  {(p) => <option value={p.id}>{p.name}</option>}
                </For>
              </select>
            </div>

            {/* Divider */}
            <div style={{ margin: "4px 0", "border-top": "1px solid var(--vscode-widget-border)" }} />
          </Show>

          {/* Hermes auto-routing toggle */}
          <div
            style={{
              display: "flex",
              "align-items": "center",
              "justify-content": "space-between",
              padding: "4px 12px",
              gap: "8px",
            }}
          >
            <div>
              <div style={{ "font-size": "11px", "font-weight": "500" }}>Auto (Hermes)</div>
              <div style={{ "font-size": "10px", color: "var(--vscode-descriptionForeground)" }}>
                Let Hermes pick the best backend per task
              </div>
            </div>
            <button
              role="switch"
              aria-checked={isAuto()}
              onClick={() =>
                backend.setRoutingMode(isAuto() ? "manual" : "auto-hermes")
              }
              style={{
                width: "32px",
                height: "17px",
                "border-radius": "9px",
                border: "none",
                background: isAuto()
                  ? "var(--vscode-button-background)"
                  : "var(--vscode-input-border, #555)",
                position: "relative",
                cursor: "pointer",
                "flex-shrink": "0",
                transition: "background 0.15s",
              }}
            >
              <span
                style={{
                  position: "absolute",
                  top: "2px",
                  left: isAuto() ? "16px" : "2px",
                  width: "13px",
                  height: "13px",
                  "border-radius": "50%",
                  background: "var(--vscode-button-foreground, #fff)",
                  transition: "left 0.15s",
                }}
              />
            </button>
          </div>

          {/* Divider */}
          <div style={{ margin: "4px 0", "border-top": "1px solid var(--vscode-widget-border)" }} />

          {/* Manage backends link */}
          <div style={{ padding: "2px 12px 4px" }}>
            <button
              onClick={openBackendsSettings}
              style={{
                background: "none",
                border: "none",
                color: "var(--vscode-textLink-foreground)",
                "font-size": "11px",
                cursor: "pointer",
                padding: "2px 0",
                "text-decoration": "underline",
              }}
            >
              Manage Backends &amp; Profiles →
            </button>
          </div>
        </div>
      </Show>

      {/* Pulse animation style injection */}
      <style>{`
        @keyframes backend-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.35; }
        }
      `}</style>
    </div>
  )
}

// ─── BackendOption sub-component ─────────────────────────────────────────────

interface BackendOptionProps {
  config: BackendConfig
  isActive: boolean
  isFocused: boolean
  onSelect: () => void
  onFocus: () => void
}

const BackendOption: Component<BackendOptionProps> = (props) => {
  const visibleCaps = createMemo(() =>
    props.config.capabilities.filter(
      (c) => c !== "approval_required" && c !== "sandbox_required" && c !== "checkpoint_required",
    ),
  )

  return (
    <div
      role="option"
      aria-selected={props.isActive}
      data-backend-item
      tabindex={props.config.enabled ? "0" : "-1"}
      onClick={props.onSelect}
      onFocus={props.onFocus}
      style={{
        display: "flex",
        "align-items": "flex-start",
        gap: "8px",
        padding: "6px 8px",
        "border-radius": "4px",
        cursor: props.config.enabled ? "pointer" : "not-allowed",
        opacity: props.config.enabled ? "1" : "0.45",
        background: props.isActive
          ? "var(--vscode-list-activeSelectionBackground)"
          : props.isFocused
          ? "var(--vscode-list-hoverBackground)"
          : "transparent",
        color: props.isActive
          ? "var(--vscode-list-activeSelectionForeground)"
          : "var(--vscode-foreground)",
        outline: "none",
        transition: "background 0.1s",
      }}
    >
      {/* Icon + active checkmark */}
      <div
        style={{
          "font-size": "18px",
          "line-height": "1",
          "margin-top": "1px",
          "flex-shrink": "0",
          width: "20px",
          "text-align": "center",
        }}
      >
        {props.config.icon}
      </div>

      {/* Text content */}
      <div style={{ flex: "1", "min-width": "0" }}>
        <div
          style={{
            display: "flex",
            "align-items": "center",
            gap: "6px",
            "margin-bottom": "2px",
          }}
        >
          <span style={{ "font-weight": "600", "font-size": "12px" }}>
            {props.config.displayName}
          </span>
          <Show when={props.isActive}>
            <span
              style={{
                "font-size": "9px",
                padding: "1px 4px",
                "border-radius": "3px",
                background: "var(--vscode-badge-background)",
                color: "var(--vscode-badge-foreground)",
                "font-weight": "700",
              }}
            >
              ACTIVE
            </span>
          </Show>
          <Show when={!props.config.enabled}>
            <span
              style={{
                "font-size": "9px",
                padding: "1px 4px",
                "border-radius": "3px",
                background: "var(--vscode-inputValidation-errorBackground)",
                color: "var(--vscode-inputValidation-errorForeground)",
                "font-weight": "700",
              }}
            >
              DISABLED
            </span>
          </Show>
        </div>

        <div
          style={{
            "font-size": "10px",
            color: props.isActive
              ? "var(--vscode-list-activeSelectionForeground)"
              : "var(--vscode-descriptionForeground)",
            "margin-bottom": "4px",
            "white-space": "nowrap",
            overflow: "hidden",
            "text-overflow": "ellipsis",
          }}
        >
          {props.config.description}
        </div>

        {/* Capability pills */}
        <div style={{ display: "flex", "flex-wrap": "wrap", gap: "3px" }}>
          <For each={visibleCaps()}>
            {(cap) => (
              <span
                style={{
                  "font-size": "9px",
                  padding: "1px 5px",
                  "border-radius": "10px",
                  border: "1px solid var(--vscode-widget-border)",
                  color: props.isActive
                    ? "var(--vscode-list-activeSelectionForeground)"
                    : "var(--vscode-descriptionForeground)",
                  "white-space": "nowrap",
                }}
              >
                {CAP_LABELS[cap] ?? cap}
              </span>
            )}
          </For>
        </div>
      </div>
    </div>
  )
}
