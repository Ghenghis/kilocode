/**
 * HubPanel — Open WebUI / Hub integration panel for KiloCode canary.10.
 *
 * Integrates with Open WebUI (running locally or via VPS) to provide:
 *
 *  Feature 1: Hub Model Browser
 *    - Lists all models installed in Open WebUI with size, quantization, RAM req
 *    - Pull status: installed / available / downloading
 *    - One-click "Set as active model" button
 *    - Model tags/capabilities badges
 *
 *  Feature 2: Hub Chat Relay
 *    - Toggle to relay chat through Open WebUI instead of direct API
 *    - Allows Hub-specific pipelines, RAG, tools
 *    - Toggle state exposed via hubRelayMode signal + HubRelayContext
 *
 *  Feature 3: Hub Model Download Progress
 *    - Inline progress bar for in-flight model pulls
 *    - Download speed, ETA, size remaining
 *
 *  Feature 4: Hub Connection Status Widget
 *    - Persistent bottom-right indicator (green/red dot)
 *    - Click to expand: Hub version, models count, active sessions
 *    - Auto-polls every 15s
 *
 *  Feature 5: Quick Model Switch via Hub
 *    - Hub models injected into ModelSelector with "H" badge
 *    - Signal exported for external consumption
 */

import {
  Component,
  createSignal,
  createEffect,
  createMemo,
  onCleanup,
  Show,
  For,
} from "solid-js"
import { createContext, useContext } from "solid-js"
import { useVSCode } from "../../context/vscode"
import { useDocumentVisible } from "../../hooks/useDocumentVisible"

// ── Storage keys ─────────────────────────────────────────────────────────────

const SK_BASE_URL = "kilo.hub.baseUrl"
const SK_RELAY    = "kilo.hub.chatRelay"
const DEFAULT_OPENWEBUI_URL = "http://localhost:3000"

function ls(key: string, fallback: string): string {
  try { return localStorage.getItem(key) ?? fallback } catch { return fallback }
}
function lsSet(key: string, val: string): void {
  try { localStorage.setItem(key, val) } catch { /* unavailable */ }
}

// ── Open WebUI API types ──────────────────────────────────────────────────────

export interface HubModel {
  id: string
  name: string
  // Ollama-style detail block
  details?: {
    family?: string
    parameter_size?: string
    quantization_level?: string
  }
  // size in bytes (may be absent for pipeline models)
  size?: number
  // tags from model info
  tags?: string[]
  // capabilities (vision, tools, embedding …)
  capabilities?: string[]
  // whether model is actively installed/pulled vs just listed
  installed?: boolean
  // Whether a pull is currently in progress (set client-side)
  pulling?: boolean
  pullProgress?: HubPullProgress
}

export interface HubPullProgress {
  status: string        // "pulling manifest" | "pulling …" | "success" | "error"
  completed?: number    // bytes downloaded
  total?: number        // total bytes
  speed?: number        // bytes/s estimate
  eta?: number          // seconds remaining
}

interface HubConnectionInfo {
  reachable: boolean
  version?: string
  modelsCount?: number
  activeSessions?: number
}

// ── Hub context — shared across the app ─────────────────────────────────────

interface HubContextValue {
  /** The base URL of the connected Open WebUI instance */
  baseUrl: () => string
  /** Whether Hub is reachable */
  connected: () => boolean
  /** Whether chat relay via Hub is enabled */
  relayMode: () => boolean
  setRelayMode: (v: boolean) => void
  /** All installed Hub models (stable reference while fetching) */
  hubModels: () => HubModel[]
  /** Set a Hub model as the active model for KiloCode */
  activateHubModel: (model: HubModel) => void
  /** Trigger a pull of a model by name */
  pullModel: (modelName: string) => void
  /** Full connection details */
  connectionInfo: () => HubConnectionInfo
}

export const HubContext = createContext<HubContextValue | undefined>(undefined)

export function useHub(): HubContextValue {
  const ctx = useContext(HubContext)
  if (!ctx) throw new Error("useHub() must be used within HubProvider")
  return ctx
}

/** Safe variant — returns undefined when outside HubProvider. */
export function useHubOptional(): HubContextValue | undefined {
  return useContext(HubContext)
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`
}

function formatSpeed(bps: number): string {
  if (bps < 1024) return `${bps.toFixed(0)} B/s`
  if (bps < 1024 * 1024) return `${(bps / 1024).toFixed(1)} KB/s`
  return `${(bps / 1024 / 1024).toFixed(1)} MB/s`
}

function formatEta(seconds: number): string {
  if (seconds < 60) return `${Math.ceil(seconds)}s`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${Math.ceil(seconds % 60)}s`
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`
}

/** Estimate RAM requirement from model size + quantization */
function estimateRamReq(model: HubModel): string {
  const quant = model.details?.quantization_level ?? ""
  const size  = model.size ?? 0
  if (!size) return "?"
  // Rough heuristic: quantized models run at roughly 0.7× their file size
  const factor = quant.startsWith("Q4") || quant.startsWith("q4") ? 0.65
               : quant.startsWith("Q8") || quant.startsWith("q8") ? 0.90
               : 0.80
  return formatBytes(size * factor) + " RAM"
}

// ── HubProvider — wraps the app, holds shared state ─────────────────────────

export const HubProvider: Component<{ children: any }> = (props) => {
  const vscode = useVSCode()

  const [baseUrl]       = createSignal(ls(SK_BASE_URL, DEFAULT_OPENWEBUI_URL))
  const [connected,    setConnected]    = createSignal(false)
  const [relayMode,    setRelayModeRaw] = createSignal(ls(SK_RELAY, "0") === "1")
  const [hubModels,    setHubModels]    = createSignal<HubModel[]>([])
  const [connInfo,     setConnInfo]     = createSignal<HubConnectionInfo>({ reachable: false })

  // Persists relay mode to localStorage
  const setRelayMode = (v: boolean) => {
    lsSet(SK_RELAY, v ? "1" : "0")
    setRelayModeRaw(v)
  }

  // Fetch installed models from Open WebUI /api/models
  const fetchModels = async () => {
    const url = baseUrl().replace(/\/+$/, "")
    try {
      const res = await fetch(`${url}/api/models`, { signal: AbortSignal.timeout(8000) })
      if (!res.ok) { setConnected(false); return }
      const data: { data?: any[] } = await res.json()
      const raw: any[] = data.data ?? (Array.isArray(data) ? data as any[] : [])
      const mapped: HubModel[] = raw.map((m) => ({
        id:           m.id ?? m.model ?? "",
        name:         m.name ?? m.id ?? "",
        details:      m.ollama?.details ?? m.details,
        size:         m.ollama?.size ?? m.size,
        tags:         m.tags ?? [],
        capabilities: m.meta?.capabilities ?? [],
        installed:    true,
      }))
      setHubModels(mapped)
      setConnected(true)
    } catch {
      setConnected(false)
      setHubModels([])
    }
  }

  // Fetch connection health
  const fetchHealth = async () => {
    const url = baseUrl().replace(/\/+$/, "")
    try {
      const [health, activeSessions] = await Promise.allSettled([
        fetch(`${url}/api/version`, { signal: AbortSignal.timeout(5000) }).then((r) => r.json()),
        fetch(`${url}/api/chats`, { signal: AbortSignal.timeout(5000) }).then((r) => r.json()),
      ])
      const version        = health.status === "fulfilled" ? (health.value?.version ?? undefined) : undefined
      const activeSessionsCount = activeSessions.status === "fulfilled"
        ? (Array.isArray(activeSessions.value) ? activeSessions.value.length : (activeSessions.value?.total ?? undefined))
        : undefined
      setConnInfo({
        reachable:      true,
        version,
        modelsCount:    hubModels().length,
        activeSessions: activeSessionsCount,
      })
    } catch {
      setConnInfo({ reachable: false })
    }
  }

  // Poll every 30s — visibility-gated so we pause polling while VS Code or the
  // panel is hidden (Wave 10-F finding: was 15s unguarded, polling 2 endpoints
  // per tick contributed to background CPU on hidden panels).
  let pollTimer: ReturnType<typeof setInterval> | null = null
  const isVisible = useDocumentVisible()
  const startPoll = () => {
    // Defensive: clear any prior timer in case startPoll is ever re-entered.
    if (pollTimer) {
      clearInterval(pollTimer)
      pollTimer = null
    }
    void fetchModels()
    void fetchHealth()
    pollTimer = setInterval(() => {
      if (!isVisible()) return
      void fetchModels()
      void fetchHealth()
    }, 30_000)
  }

  // Plain mount-time setup (no reactive deps) — avoids re-init churn if anyone
  // later adds a signal read inside startPoll.
  startPoll()

  onCleanup(() => {
    if (pollTimer) {
      clearInterval(pollTimer)
      pollTimer = null
    }
  })

  // "Set as active model" — posts a message to the extension to switch the model
  // using "openwebui" as the provider ID so KiloCode routes through Hub
  const activateHubModel = (model: HubModel) => {
    vscode.postMessage({
      type: "selectModel",
      providerID: "openwebui",
      modelID: model.id,
    })
  }

  // Trigger an Ollama pull via Open WebUI /api/pull
  const pullModel = async (modelName: string) => {
    const url = baseUrl().replace(/\/+$/, "")
    // Mark the model as pulling
    setHubModels((prev) =>
      prev.map((m) =>
        m.id === modelName
          ? { ...m, pulling: true, pullProgress: { status: "pulling manifest" } }
          : m,
      ),
    )
    try {
      const res = await fetch(`${url}/api/pull`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: modelName, stream: true }),
      })
      if (!res.body) return
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let prevCompleted = 0
      let prevTime = Date.now()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const text = decoder.decode(value, { stream: true })
        for (const line of text.split("\n")) {
          if (!line.trim()) continue
          try {
            const evt = JSON.parse(line)
            const now = Date.now()
            const elapsed = (now - prevTime) / 1000
            const speed = elapsed > 0 && evt.completed != null
              ? (evt.completed - prevCompleted) / elapsed
              : 0
            const remaining = evt.total != null && evt.completed != null
              ? evt.total - evt.completed
              : undefined
            const eta = speed > 0 && remaining != null ? remaining / speed : undefined

            setHubModels((prev) =>
              prev.map((m) =>
                m.id === modelName
                  ? {
                      ...m,
                      pulling: evt.status !== "success",
                      installed: evt.status === "success" ? true : m.installed,
                      pullProgress: {
                        status:    evt.status ?? "pulling",
                        completed: evt.completed,
                        total:     evt.total,
                        speed,
                        eta,
                      },
                    }
                  : m,
              ),
            )
            prevCompleted = evt.completed ?? prevCompleted
            prevTime      = now
          } catch { /* partial JSON line — skip */ }
        }
      }
    } catch (e) {
      setHubModels((prev) =>
        prev.map((m) =>
          m.id === modelName
            ? { ...m, pulling: false, pullProgress: { status: "error" } }
            : m,
        ),
      )
    }
    // Refresh model list after pull
    void fetchModels()
  }

  const ctx: HubContextValue = {
    baseUrl,
    connected,
    relayMode,
    setRelayMode,
    hubModels,
    activateHubModel,
    pullModel,
    connectionInfo: connInfo,
  }

  return <HubContext.Provider value={ctx}>{props.children}</HubContext.Provider>
}

// ── Feature 4: HubStatusWidget ───────────────────────────────────────────────
// Persistent bottom-right dot. Click to expand for details.

export const HubStatusWidget: Component = () => {
  const hub = useHub()
  const [expanded, setExpanded] = createSignal(false)

  const dotColor = () =>
    hub.connected()
      ? "var(--vscode-charts-green, #4caf50)"
      : "var(--vscode-charts-red, #f44747)"

  const info = () => hub.connectionInfo()

  return (
    <div
      aria-live="polite"
      style={{
        position:    "fixed",
        bottom:      "12px",
        right:       "12px",
        "z-index":   "9999",
        display:     "flex",
        "flex-direction": "column",
        "align-items": "flex-end",
        gap:         "6px",
      }}
    >
      {/* Expanded detail card */}
      <Show when={expanded()}>
        <div
          style={{
            background:   "var(--vscode-editorWidget-background)",
            border:       "1px solid var(--vscode-widget-border)",
            "border-radius": "6px",
            padding:      "10px 14px",
            "min-width":  "180px",
            "font-size":  "11px",
            "box-shadow": "0 2px 8px rgba(0,0,0,0.3)",
          }}
          role="region"
          aria-label="Hub connection details"
        >
          <div style={{ "font-weight": "600", "margin-bottom": "6px", "font-size": "12px" }}>
            Open WebUI Hub
          </div>
          <Show
            when={hub.connected()}
            fallback={
              <div style={{ color: "var(--vscode-errorForeground)" }}>Not reachable</div>
            }
          >
            <div style={{ color: "var(--vscode-descriptionForeground)", "line-height": "1.7" }}>
              <Show when={info().version}>
                <div>Version: <b>{info().version}</b></div>
              </Show>
              <div>Models: <b>{info().modelsCount ?? hub.hubModels().length}</b></div>
              <Show when={info().activeSessions !== undefined}>
                <div>Sessions: <b>{info().activeSessions}</b></div>
              </Show>
              <div
                style={{ "margin-top": "6px", "padding-top": "6px", "border-top": "1px solid var(--vscode-widget-border)" }}
              >
                <label style={{ display: "flex", "align-items": "center", gap: "6px", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={hub.relayMode()}
                    onChange={(e) => hub.setRelayMode(e.currentTarget.checked)}
                    aria-label="Relay chat through Hub"
                  />
                  Via Hub (relay)
                </label>
              </div>
            </div>
          </Show>
        </div>
      </Show>

      {/* Status dot button */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded()}
        aria-label={`Hub status: ${hub.connected() ? "connected" : "disconnected"}. Click to ${expanded() ? "collapse" : "expand"}.`}
        title={hub.connected() ? "Hub connected — click for details" : "Hub unreachable — click for details"}
        style={{
          width:          "16px",
          height:         "16px",
          "border-radius": "50%",
          background:     dotColor(),
          border:         "2px solid var(--vscode-sideBar-background, #1e1e1e)",
          cursor:         "pointer",
          padding:        "0",
          "flex-shrink":  "0",
          "box-shadow":   hub.connected()
            ? `0 0 6px ${dotColor()}`
            : "none",
          transition:     "background 0.3s, box-shadow 0.3s",
        }}
      />
    </div>
  )
}

// ── Feature 2: HubRelayToggle ────────────────────────────────────────────────
// A compact toggle for the floating action bar inside PromptInput.

export const HubRelayToggle: Component = () => {
  const hub = useHubOptional()
  // Render nothing if Hub is not available or not connected
  if (!hub) return null

  return (
    <Show when={hub.connected()}>
      <button
        type="button"
        onClick={() => hub.setRelayMode(!hub.relayMode())}
        title={hub.relayMode() ? "Currently routing via Hub — click to switch to Direct API" : "Currently using Direct API — click to route via Hub"}
        aria-pressed={hub.relayMode()}
        aria-label={hub.relayMode() ? "Via Hub (relay mode on)" : "Direct API (relay mode off)"}
        style={{
          display:         "flex",
          "align-items":   "center",
          gap:             "5px",
          padding:         "4px 9px",
          "border-radius": "4px",
          border:          "1px solid var(--vscode-widget-border)",
          background:      hub.relayMode()
            ? "var(--vscode-button-background)"
            : "var(--vscode-button-secondaryBackground)",
          color:           hub.relayMode()
            ? "var(--vscode-button-foreground)"
            : "var(--vscode-button-secondaryForeground)",
          cursor:          "pointer",
          "font-size":     "11px",
          "font-weight":   "500",
          transition:      "background 0.2s, color 0.2s",
          "white-space":   "nowrap",
        }}
      >
        {/* Small H badge */}
        <span
          style={{
            display:         "inline-flex",
            "align-items":   "center",
            "justify-content": "center",
            width:           "14px",
            height:          "14px",
            "border-radius": "3px",
            background:      hub.relayMode() ? "rgba(255,255,255,0.25)" : "var(--vscode-badge-background)",
            color:           hub.relayMode() ? "inherit" : "var(--vscode-badge-foreground)",
            "font-size":     "9px",
            "font-weight":   "700",
            "line-height":   "1",
            "flex-shrink":   "0",
          }}
          aria-hidden="true"
        >
          H
        </span>
        {hub.relayMode() ? "Via Hub" : "Direct API"}
      </button>
    </Show>
  )
}

// ── Feature 3: HubPullProgressBar ───────────────────────────────────────────
// Inline progress bar for a model pull, embedded in the model list row.

const HubPullProgressBar: Component<{ progress: HubPullProgress }> = (props) => {
  const pct = createMemo(() => {
    const { completed, total } = props.progress
    if (completed != null && total != null && total > 0) {
      return Math.round((completed / total) * 100)
    }
    return null
  })

  return (
    <div style={{ "margin-top": "6px" }}>
      <div
        style={{
          display:       "flex",
          "align-items": "center",
          gap:           "8px",
          "font-size":   "10px",
          color:         "var(--vscode-descriptionForeground)",
          "margin-bottom": "3px",
        }}
      >
        <span>{props.progress.status}</span>
        <Show when={pct() !== null}>
          <span>{pct()}%</span>
        </Show>
        <Show when={props.progress.speed != null && props.progress.speed! > 0}>
          <span>{formatSpeed(props.progress.speed!)}</span>
        </Show>
        <Show when={props.progress.eta != null && props.progress.eta! > 0}>
          <span>ETA {formatEta(props.progress.eta!)}</span>
        </Show>
        <Show when={props.progress.completed != null && props.progress.total != null}>
          <span>
            {formatBytes(props.progress.completed!)} / {formatBytes(props.progress.total!)}
          </span>
        </Show>
      </div>
      {/* Track */}
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct() ?? 0}
        aria-label={`Model download: ${pct() !== null ? pct() + "%" : props.progress.status}`}
        style={{
          height:       "4px",
          background:   "var(--vscode-widget-border)",
          "border-radius": "2px",
          overflow:     "hidden",
        }}
      >
        <div
          style={{
            height:          "100%",
            width:           pct() !== null ? `${pct()}%` : "100%",
            background:      "var(--vscode-progressBar-background, var(--vscode-button-background))",
            "border-radius": "2px",
            transition:      pct() !== null ? "width 0.3s ease" : "none",
            animation:       pct() === null ? "hub-indeterminate 1.4s ease-in-out infinite" : "none",
          }}
        />
      </div>
    </div>
  )
}

// ── Feature 1: HubPanel (Model Browser) ──────────────────────────────────────

interface HubPanelProps {
  /** Controlled visibility */
  visible: boolean
  onClose: () => void
}

export const HubPanel: Component<HubPanelProps> = (props) => {
  const hub = useHub()
  const [search, setSearch] = createSignal("")

  const filtered = createMemo(() => {
    const q = search().trim().toLowerCase()
    if (!q) return hub.hubModels()
    return hub.hubModels().filter(
      (m) => m.name.toLowerCase().includes(q) || m.id.toLowerCase().includes(q),
    )
  })

  // ── Styles ──────────────────────────────────────────────────────────────
  const panel = {
    position:   "fixed" as const,
    top:        "0",
    right:      "0",
    bottom:     "0",
    width:      "340px",
    "z-index":  "9998",
    display:    "flex",
    "flex-direction": "column" as const,
    background: "var(--vscode-sideBar-background)",
    "border-left": "1px solid var(--vscode-widget-border)",
    "box-shadow":  "-4px 0 16px rgba(0,0,0,0.25)",
  }

  const header = {
    display:         "flex",
    "align-items":   "center",
    gap:             "8px",
    padding:         "12px 14px 10px",
    "border-bottom": "1px solid var(--vscode-widget-border)",
    "flex-shrink":   "0",
  }

  const subtle = {
    color:     "var(--vscode-descriptionForeground)",
    "font-size": "11px",
  }

  const card = {
    border:          "1px solid var(--vscode-widget-border)",
    "border-radius": "5px",
    padding:         "10px 12px",
    background:      "var(--vscode-editor-background)",
    "margin-bottom": "8px",
  }

  const tag = (color?: string) => ({
    padding:         "1px 6px",
    "border-radius": "8px",
    "font-size":     "10px",
    background:      color ?? "var(--vscode-badge-background)",
    color:           "var(--vscode-badge-foreground)",
    "font-weight":   "500",
  })

  const btnPrimary = {
    padding:         "5px 10px",
    "border-radius": "4px",
    border:          "none",
    background:      "var(--vscode-button-background)",
    color:           "var(--vscode-button-foreground)",
    cursor:          "pointer",
    "font-size":     "11px",
    "font-weight":   "600",
  }

  const btnSecondary = {
    ...btnPrimary,
    background: "var(--vscode-button-secondaryBackground)",
    color:      "var(--vscode-button-secondaryForeground)",
  }

  const hBadge = {
    display:           "inline-flex",
    "align-items":     "center",
    "justify-content": "center",
    width:             "16px",
    height:            "16px",
    "border-radius":   "3px",
    background:        "var(--vscode-button-background)",
    color:             "var(--vscode-button-foreground)",
    "font-size":       "9px",
    "font-weight":     "700",
    "flex-shrink":     "0",
    "margin-right":    "4px",
  }

  return (
    <Show when={props.visible}>
      <div style={panel} role="region" aria-label="Hub Model Browser">
        {/* ── Header ──────────────────────────────────────────────────── */}
        <div style={header}>
          <span style={hBadge} aria-hidden="true">H</span>
          <span style={{ "font-weight": "600", "font-size": "13px", flex: "1" }}>
            Hub Models
          </span>
          {/* Connection dot */}
          <span
            aria-label={hub.connected() ? "Hub connected" : "Hub disconnected"}
            title={hub.connected() ? "Hub connected" : "Hub disconnected"}
            style={{
              width:           "8px",
              height:          "8px",
              "border-radius": "50%",
              background:      hub.connected()
                ? "var(--vscode-charts-green, #4caf50)"
                : "var(--vscode-charts-red, #f44747)",
              "flex-shrink":   "0",
            }}
          />
          <button
            type="button"
            onClick={props.onClose}
            aria-label="Close Hub Models panel"
            style={{
              background: "none",
              border:     "none",
              cursor:     "pointer",
              color:      "var(--vscode-icon-foreground)",
              "font-size": "16px",
              "line-height": "1",
              padding:    "0 2px",
            }}
          >
            ×
          </button>
        </div>

        {/* ── Relay toggle strip ─────────────────────────────────────── */}
        <div
          style={{
            padding:         "8px 14px",
            "border-bottom": "1px solid var(--vscode-widget-border)",
            display:         "flex",
            "align-items":   "center",
            gap:             "8px",
            "flex-shrink":   "0",
          }}
        >
          <span style={subtle}>Route chat:</span>
          <button
            type="button"
            style={{
              ...btnSecondary,
              background: !hub.relayMode() ? "var(--vscode-button-background)" : btnSecondary.background,
              color:      !hub.relayMode() ? "var(--vscode-button-foreground)" : btnSecondary.color,
            }}
            onClick={() => hub.setRelayMode(false)}
            aria-pressed={!hub.relayMode()}
          >
            Direct API
          </button>
          <button
            type="button"
            style={{
              ...btnSecondary,
              background: hub.relayMode() ? "var(--vscode-button-background)" : btnSecondary.background,
              color:      hub.relayMode() ? "var(--vscode-button-foreground)" : btnSecondary.color,
            }}
            onClick={() => hub.setRelayMode(true)}
            aria-pressed={hub.relayMode()}
            disabled={!hub.connected()}
          >
            Via Hub
          </button>
        </div>

        {/* ── Search ─────────────────────────────────────────────────── */}
        <div style={{ padding: "10px 14px", "flex-shrink": "0" }}>
          <input
            type="text"
            placeholder="Search models…"
            value={search()}
            onInput={(e) => setSearch(e.currentTarget.value)}
            aria-label="Search Hub models"
            style={{
              width:           "100%",
              padding:         "6px 10px",
              background:      "var(--vscode-input-background)",
              color:           "var(--vscode-input-foreground)",
              border:          "1px solid var(--vscode-input-border)",
              "border-radius": "4px",
              "font-size":     "12px",
              "box-sizing":    "border-box",
            }}
          />
        </div>

        {/* ── Model list ─────────────────────────────────────────────── */}
        <div
          style={{
            flex:       "1",
            overflow:   "auto",
            padding:    "0 14px 14px",
          }}
          role="list"
          aria-label="Hub model list"
        >
          <Show
            when={hub.connected()}
            fallback={
              <div
                style={{
                  ...subtle,
                  "text-align": "center",
                  padding:      "32px 0",
                  "line-height": "1.6",
                }}
              >
                Hub not reachable.<br />
                Check the Hub URL in Settings → Hub.
              </div>
            }
          >
            <Show
              when={hub.hubModels().length > 0}
              fallback={
                <div style={{ ...subtle, "text-align": "center", padding: "32px 0" }}>
                  No models found.
                </div>
              }
            >
              <For each={filtered()}>
                {(model) => {
                  const pct = () => {
                    const p = model.pullProgress
                    if (p?.completed != null && p.total != null && p.total > 0) {
                      return Math.round((p.completed / p.total) * 100)
                    }
                    return null
                  }

                  const modelAriaLabel = () => {
                    const parts: string[] = [model.name]
                    if (model.details?.parameter_size) parts.push(`${model.details.parameter_size} parameters`)
                    if (model.size) parts.push(`size ${formatBytes(model.size)}`)
                    if (model.size) parts.push(`requires approximately ${estimateRamReq(model)}`)
                    if (model.installed) parts.push("installed")
                    return parts.join(", ")
                  }

                  return (
                    <div
                      style={card}
                      role="article"
                      aria-label={modelAriaLabel()}
                    >
                      {/* ── Model name + H badge ────────────────────── */}
                      <div style={{ display: "flex", "align-items": "flex-start", gap: "6px", "margin-bottom": "4px" }}>
                        <span style={hBadge} aria-hidden="true" title="Available via Open WebUI Hub">H</span>
                        <span style={{ "font-weight": "600", "font-size": "12px", flex: "1", "word-break": "break-word" }}>
                          {model.name}
                        </span>
                        <Show when={model.installed}>
                          <span style={{ ...tag("var(--vscode-charts-green, #4caf50)"), color: "#fff" }}>installed</span>
                        </Show>
                      </div>

                      {/* ── Metadata row ───────────────────────────── */}
                      <div
                        style={{
                          display:     "flex",
                          "flex-wrap": "wrap",
                          gap:         "4px",
                          "margin-bottom": "6px",
                        }}
                      >
                        <Show when={model.details?.parameter_size}>
                          <span style={tag()} title="Parameter count">{model.details!.parameter_size}</span>
                        </Show>
                        <Show when={model.details?.quantization_level}>
                          <span style={tag()} title="Quantization">{model.details!.quantization_level}</span>
                        </Show>
                        <Show when={model.size}>
                          <span style={{ ...subtle }}>{formatBytes(model.size!)}</span>
                        </Show>
                        <Show when={model.size}>
                          <span style={{ ...subtle }}>{estimateRamReq(model)}</span>
                        </Show>
                        <Show when={model.details?.family}>
                          <span style={tag()} title="Model family">{model.details!.family}</span>
                        </Show>
                      </div>

                      {/* ── Capabilities ───────────────────────────── */}
                      <Show when={(model.capabilities?.length ?? 0) > 0}>
                        <div style={{ display: "flex", "flex-wrap": "wrap", gap: "3px", "margin-bottom": "6px" }}>
                          <For each={model.capabilities!}>
                            {(cap) => (
                              <span
                                style={{
                                  ...tag("var(--vscode-badge-background)"),
                                  opacity: "0.85",
                                }}
                                title={`Capability: ${cap}`}
                              >
                                {cap}
                              </span>
                            )}
                          </For>
                        </div>
                      </Show>

                      {/* ── Feature 3: Download progress ───────────── */}
                      <Show when={model.pulling && model.pullProgress}>
                        <HubPullProgressBar progress={model.pullProgress!} />
                      </Show>

                      {/* ── Action row ─────────────────────────────── */}
                      <div style={{ display: "flex", gap: "6px", "margin-top": "6px" }}>
                        <button
                          type="button"
                          style={btnPrimary}
                          onClick={() => hub.activateHubModel(model)}
                          aria-label={`Set ${model.name} as active model`}
                          title="Set as active model in KiloCode"
                          disabled={model.pulling}
                        >
                          Set Active
                        </button>
                        <Show when={!model.installed}>
                          <button
                            type="button"
                            style={btnSecondary}
                            onClick={() => hub.pullModel(model.id)}
                            aria-label={
                              model.pulling
                                ? `Downloading ${model.name}${pct() !== null ? ` ${pct()}%` : ""}`
                                : `Pull / download ${model.name}`
                            }
                            aria-busy={model.pulling ?? false}
                            title={model.pulling ? "Downloading…" : "Pull this model from the registry"}
                            disabled={model.pulling}
                          >
                            {model.pulling ? `Downloading…${pct() !== null ? ` ${pct()}%` : ""}` : "Pull"}
                          </button>
                        </Show>
                      </div>
                    </div>
                  )
                }}
              </For>
            </Show>
          </Show>
        </div>
      </div>

      {/* CSS for indeterminate progress bar animation */}
      <style>{`
        @keyframes hub-indeterminate {
          0%   { transform: translateX(-100%); width: 50%; }
          100% { transform: translateX(300%);  width: 50%; }
        }
      `}</style>
    </Show>
  )
}

// ── Feature 5: HubModelBadge ─────────────────────────────────────────────────
// Tiny "H" badge to attach to model rows in the ModelSelector when those
// models are available via the Hub. Import and use in ModelSelector.

export const HubModelBadge: Component = () => (
  <span
    aria-label="Available via Hub"
    title="This model is available via Open WebUI Hub"
    style={{
      display:           "inline-flex",
      "align-items":     "center",
      "justify-content": "center",
      width:             "14px",
      height:            "14px",
      "border-radius":   "3px",
      background:        "var(--vscode-button-background)",
      color:             "var(--vscode-button-foreground)",
      "font-size":       "8px",
      "font-weight":     "700",
      "flex-shrink":     "0",
      "margin-left":     "3px",
      "vertical-align":  "middle",
    }}
  >
    H
  </span>
)

// ── HubModelsOpenButton ───────────────────────────────────────────────────────
// Small icon button to open the Hub Models panel from the chat toolbar.

export const HubModelsOpenButton: Component<{ onClick: () => void }> = (props) => {
  const hub = useHubOptional()
  if (!hub) return null
  return (
    <Show when={hub.connected()}>
      <button
        type="button"
        onClick={props.onClick}
        aria-label="Open Hub Models panel"
        title={`Open Hub Models (${hub.hubModels().length} installed)`}
        style={{
          display:         "flex",
          "align-items":   "center",
          gap:             "4px",
          padding:         "4px 8px",
          "border-radius": "4px",
          border:          "1px solid var(--vscode-widget-border)",
          background:      "var(--vscode-button-secondaryBackground)",
          color:           "var(--vscode-button-secondaryForeground)",
          cursor:          "pointer",
          "font-size":     "11px",
          "font-weight":   "500",
        }}
      >
        <span
          style={{
            display:           "inline-flex",
            "align-items":     "center",
            "justify-content": "center",
            width:             "14px",
            height:            "14px",
            "border-radius":   "3px",
            background:        "var(--vscode-button-background)",
            color:             "var(--vscode-button-foreground)",
            "font-size":       "9px",
            "font-weight":     "700",
            "flex-shrink":     "0",
          }}
          aria-hidden="true"
        >
          H
        </span>
        <span>Hub</span>
        <span style={{ opacity: "0.7" }}>{hub.hubModels().length}</span>
      </button>
    </Show>
  )
}
