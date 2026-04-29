/**
 * WorkstationTab — Surfaces the user's hardware profile, local AI capabilities,
 * model library, and routing preferences (CPU/RAM/GPU/VRAM/local-vs-cloud).
 *
 * Backend: WorkstationProfileService (src/services/workstation/WorkstationProfile.ts)
 *
 * Outgoing messages: workstationGetProfile, workstationGetHardware,
 *   workstationGetLimits, workstationGetLocalAI, workstationGetRoutingPrefs,
 *   workstationGetModelLibrary, workstationHasLoRAs, workstationHasLocalTTS,
 *   workstationHasLocalSTT, workstationReload
 *
 * Incoming messages: workstationProfile, workstationHardware, workstationLimits,
 *   workstationLocalAI, workstationRoutingPrefs, workstationModelLibrary,
 *   workstationLoRAStatus, workstationLocalTTSStatus, workstationLocalSTTStatus
 */

import { Component, createSignal, onMount, onCleanup, Show, For, createMemo } from "solid-js"
import { Icon } from "@kilocode/kilo-ui/icon"
import { useVSCode } from "../../context/vscode"
import { subscribeToMessages } from "../../lib/message-bus"

interface HardwareSnapshot {
  cpuCores?: number
  cpuModel?: string
  ramGb?: number
  gpuName?: string
  gpuVramGb?: number
  gpuDriverVersion?: string
  os?: string
  arch?: string
}

interface LocalAICapabilities {
  ollama?: { available: boolean; baseUrl?: string; modelCount?: number }
  lmstudio?: { available: boolean; baseUrl?: string; modelCount?: number }
  openWebUI?: { available: boolean; baseUrl?: string }
  comfyUI?: { available: boolean; baseUrl?: string }
}

interface ModelLibraryEntry {
  id: string
  name: string
  category: string
  sizeGb: number
  quantization: string
}

interface RoutingPrefs {
  preferLocal: boolean
  fallbackToCloud: boolean
  costThresholdUsd: number
  latencyThresholdMs: number
}

const cardStyle = {
  background: "var(--vscode-editor-inactiveSelectionBackground)",
  border: "1px solid var(--vscode-panel-border)",
  "border-radius": "6px",
  padding: "12px 14px",
  "margin-bottom": "12px",
} as const

const statValue = {
  "font-size": "1.4rem",
  "font-weight": 600,
  color: "var(--vscode-foreground)",
} as const

const statLabel = {
  "font-size": "0.78rem",
  color: "var(--vscode-descriptionForeground)",
  "margin-top": "0.2rem",
} as const

const sectionTitle = {
  "font-size": "0.85rem",
  "font-weight": 600,
  "margin-bottom": "0.5rem",
  color: "var(--vscode-foreground)",
} as const

const WorkstationTab: Component = () => {
  const vscode = useVSCode()

  const [hardware, setHardware] = createSignal<HardwareSnapshot | null>(null)
  const [localAI, setLocalAI] = createSignal<LocalAICapabilities | null>(null)
  const [modelLibrary, setModelLibrary] = createSignal<ModelLibraryEntry[]>([])
  const [routingPrefs, setRoutingPrefs] = createSignal<RoutingPrefs | null>(null)
  const [loras, setLoras] = createSignal<boolean | null>(null)
  const [localTTS, setLocalTTS] = createSignal<boolean | null>(null)
  const [localSTT, setLocalSTT] = createSignal<boolean | null>(null)
  const [loading, setLoading] = createSignal(true)
  const [reloadAt, setReloadAt] = createSignal<number | null>(null)
  const [error, setError] = createSignal<string | null>(null)

  const requestAll = () => {
    setLoading(true)
    setError(null)
    vscode.postMessage({ type: "workstationGetHardware" } as never)
    vscode.postMessage({ type: "workstationGetLocalAI" } as never)
    vscode.postMessage({ type: "workstationGetModelLibrary" } as never)
    vscode.postMessage({ type: "workstationGetRoutingPrefs" } as never)
    vscode.postMessage({ type: "workstationHasLoRAs" } as never)
    vscode.postMessage({ type: "workstationHasLocalTTS" } as never)
    vscode.postMessage({ type: "workstationHasLocalSTT" } as never)
    // Watchdog — exit loading state even if extension never replies.
    setTimeout(() => setLoading(false), 4_000)
  }

  const reload = () => {
    setReloadAt(Date.now())
    vscode.postMessage({ type: "workstationReload" } as never)
    requestAll()
  }

  const onMessage = (raw: unknown) => {
    const msg = raw as { type?: string; [k: string]: unknown }
    if (!msg?.type) return
    switch (msg.type) {
      case "workstationHardware":
        setHardware((msg.hardware as HardwareSnapshot) ?? null)
        setLoading(false)
        break
      case "workstationLocalAI":
        setLocalAI((msg.localAI as LocalAICapabilities) ?? null)
        break
      case "workstationModelLibrary": {
        const lib = msg.library as { entries?: ModelLibraryEntry[] } | ModelLibraryEntry[] | undefined
        const list = Array.isArray(lib) ? lib : (lib?.entries ?? [])
        setModelLibrary(list)
        break
      }
      case "workstationRoutingPrefs":
        setRoutingPrefs((msg.prefs as RoutingPrefs) ?? null)
        break
      case "workstationLoRAStatus":
        setLoras(Boolean(msg.available))
        break
      case "workstationLocalTTSStatus":
        setLocalTTS(Boolean(msg.available))
        break
      case "workstationLocalSTTStatus":
        setLocalSTT(Boolean(msg.available))
        break
      default:
        break
    }
  }

  let unsubscribe: (() => void) | undefined
  onMount(() => {
    unsubscribe = subscribeToMessages(onMessage)
    requestAll()
  })
  onCleanup(() => unsubscribe?.())

  const totalLibrarySize = createMemo(() =>
    modelLibrary().reduce((sum, m) => sum + (m.sizeGb ?? 0), 0).toFixed(1),
  )

  const localAIBadges = createMemo(() => {
    const a = localAI()
    if (!a) return [] as Array<{ label: string; ok: boolean; sub?: string }>
    return [
      { label: "Ollama", ok: !!a.ollama?.available, sub: a.ollama?.modelCount ? `${a.ollama.modelCount} models` : undefined },
      { label: "LM Studio", ok: !!a.lmstudio?.available, sub: a.lmstudio?.modelCount ? `${a.lmstudio.modelCount} models` : undefined },
      { label: "Open WebUI", ok: !!a.openWebUI?.available },
      { label: "ComfyUI", ok: !!a.comfyUI?.available },
    ]
  })

  return (
    <div style={{ "padding-bottom": "2rem" }}>
      {/* Header + reload */}
      <div style={{ display: "flex", "align-items": "center", "justify-content": "space-between", "margin-bottom": "1rem" }}>
        <div>
          <div style={{ "font-size": "1.1rem", "font-weight": 600 }}>Workstation Profile</div>
          <div style={{ "font-size": "0.8rem", color: "var(--vscode-descriptionForeground)" }}>
            Live hardware + local AI capabilities (auto-detected on startup).
          </div>
        </div>
        <button
          type="button"
          onClick={reload}
          style={{
            background: "var(--vscode-button-secondaryBackground)",
            color: "var(--vscode-button-secondaryForeground)",
            border: "1px solid var(--vscode-panel-border)",
            "border-radius": "4px",
            padding: "6px 12px",
            cursor: "pointer",
            display: "inline-flex",
            "align-items": "center",
            gap: "0.4rem",
          }}
          title="Re-run hardware and local-AI probes"
        >
          <Icon name="reset" size="small" />
          <span>Reload profile</span>
        </button>
      </div>

      <Show when={loading() && !hardware()}>
        <div style={cardStyle}>
          <div style={{ display: "flex", "align-items": "center", gap: "0.5rem" }}>
            <Icon name="spinner" size="small" />
            <span>Detecting hardware…</span>
          </div>
        </div>
      </Show>

      <Show when={error()}>
        <div style={{ ...cardStyle, "border-color": "var(--vscode-errorForeground)" }}>
          <span style={{ color: "var(--vscode-errorForeground)" }}>{error()}</span>
        </div>
      </Show>

      {/* Hardware grid */}
      <Show when={hardware()}>
        {(hw) => (
          <div style={cardStyle}>
            <div style={sectionTitle}>Hardware</div>
            <div style={{ display: "grid", "grid-template-columns": "repeat(auto-fill, minmax(160px, 1fr))", gap: "0.8rem" }}>
              <div>
                <div style={statValue}>{hw().cpuCores ?? "—"}</div>
                <div style={statLabel}>CPU cores</div>
                <Show when={hw().cpuModel}>
                  <div style={{ "font-size": "0.7rem", color: "var(--vscode-descriptionForeground)", "margin-top": "2px" }}>{hw().cpuModel}</div>
                </Show>
              </div>
              <div>
                <div style={statValue}>{hw().ramGb ? `${hw().ramGb} GB` : "—"}</div>
                <div style={statLabel}>System RAM</div>
              </div>
              <div>
                <div style={statValue}>{hw().gpuVramGb ? `${hw().gpuVramGb} GB` : "—"}</div>
                <div style={statLabel}>GPU VRAM</div>
                <Show when={hw().gpuName}>
                  <div style={{ "font-size": "0.7rem", color: "var(--vscode-descriptionForeground)", "margin-top": "2px" }}>{hw().gpuName}</div>
                </Show>
              </div>
              <div>
                <div style={statValue}>{hw().os ?? "—"}</div>
                <div style={statLabel}>OS / Arch</div>
                <Show when={hw().arch}>
                  <div style={{ "font-size": "0.7rem", color: "var(--vscode-descriptionForeground)", "margin-top": "2px" }}>{hw().arch}</div>
                </Show>
              </div>
            </div>
          </div>
        )}
      </Show>

      {/* Local AI badges */}
      <Show when={localAIBadges().length > 0}>
        <div style={cardStyle}>
          <div style={sectionTitle}>Local AI Capabilities</div>
          <div style={{ display: "flex", "flex-wrap": "wrap", gap: "0.6rem" }}>
            <For each={localAIBadges()}>
              {(b) => (
                <div
                  style={{
                    padding: "0.5rem 0.8rem",
                    "border-radius": "6px",
                    border: `1px solid ${b.ok ? "var(--vscode-charts-green)" : "var(--vscode-panel-border)"}`,
                    background: b.ok
                      ? "color-mix(in srgb, var(--vscode-charts-green) 12%, transparent)"
                      : "var(--vscode-editor-inactiveSelectionBackground)",
                    "min-width": "120px",
                  }}
                >
                  <div style={{ display: "flex", "align-items": "center", gap: "0.4rem" }}>
                    <Icon name={b.ok ? "circle-check" : "circle-x"} size="small" />
                    <span style={{ "font-weight": 600, "font-size": "0.85rem" }}>{b.label}</span>
                  </div>
                  <Show when={b.sub}>
                    <div style={{ "font-size": "0.7rem", color: "var(--vscode-descriptionForeground)", "margin-top": "0.2rem" }}>{b.sub}</div>
                  </Show>
                </div>
              )}
            </For>
          </div>
        </div>
      </Show>

      {/* Capability flags */}
      <div style={cardStyle}>
        <div style={sectionTitle}>Modality support</div>
        <div style={{ display: "grid", "grid-template-columns": "repeat(3, 1fr)", gap: "0.6rem" }}>
          <div>
            <span style={{ display: "inline-flex", "align-items": "center", gap: "0.3rem" }}>
              <Icon name={loras() ? "circle-check" : "circle-x"} size="small" />
              <span>LoRA / fine-tunes</span>
            </span>
          </div>
          <div>
            <span style={{ display: "inline-flex", "align-items": "center", gap: "0.3rem" }}>
              <Icon name={localTTS() ? "circle-check" : "circle-x"} size="small" />
              <span>Local TTS</span>
            </span>
          </div>
          <div>
            <span style={{ display: "inline-flex", "align-items": "center", gap: "0.3rem" }}>
              <Icon name={localSTT() ? "circle-check" : "circle-x"} size="small" />
              <span>Local STT</span>
            </span>
          </div>
        </div>
      </div>

      {/* Routing preferences */}
      <Show when={routingPrefs()}>
        {(prefs) => (
          <div style={cardStyle}>
            <div style={sectionTitle}>Routing preferences</div>
            <div style={{ display: "grid", "grid-template-columns": "repeat(2, 1fr)", gap: "0.6rem", "font-size": "0.85rem" }}>
              <div>
                <span style={{ color: "var(--vscode-descriptionForeground)" }}>Prefer local: </span>
                <strong>{prefs().preferLocal ? "Yes" : "No"}</strong>
              </div>
              <div>
                <span style={{ color: "var(--vscode-descriptionForeground)" }}>Cloud fallback: </span>
                <strong>{prefs().fallbackToCloud ? "Yes" : "No"}</strong>
              </div>
              <div>
                <span style={{ color: "var(--vscode-descriptionForeground)" }}>Cost threshold: </span>
                <strong>${prefs().costThresholdUsd?.toFixed(3)}</strong>
              </div>
              <div>
                <span style={{ color: "var(--vscode-descriptionForeground)" }}>Latency threshold: </span>
                <strong>{prefs().latencyThresholdMs} ms</strong>
              </div>
            </div>
          </div>
        )}
      </Show>

      {/* Model library */}
      <Show when={modelLibrary().length > 0}>
        <div style={cardStyle}>
          <div style={{ display: "flex", "align-items": "center", "justify-content": "space-between" }}>
            <div style={sectionTitle}>Local model library</div>
            <div style={{ "font-size": "0.78rem", color: "var(--vscode-descriptionForeground)" }}>
              {modelLibrary().length} models · {totalLibrarySize()} GB total
            </div>
          </div>
          <div style={{ display: "grid", "grid-template-columns": "repeat(auto-fill, minmax(220px, 1fr))", gap: "0.5rem", "margin-top": "0.5rem" }}>
            <For each={modelLibrary().slice(0, 24)}>
              {(m) => (
                <div
                  style={{
                    background: "var(--vscode-input-background)",
                    border: "1px solid var(--vscode-panel-border)",
                    "border-radius": "4px",
                    padding: "0.5rem",
                  }}
                >
                  <div style={{ "font-weight": 600, "font-size": "0.83rem", "white-space": "nowrap", overflow: "hidden", "text-overflow": "ellipsis" }} title={m.name}>
                    {m.name}
                  </div>
                  <div style={{ "font-size": "0.72rem", color: "var(--vscode-descriptionForeground)", "margin-top": "0.2rem" }}>
                    {m.category} · {m.sizeGb?.toFixed(1) ?? "—"} GB · {m.quantization}
                  </div>
                </div>
              )}
            </For>
          </div>
          <Show when={modelLibrary().length > 24}>
            <div style={{ "font-size": "0.75rem", color: "var(--vscode-descriptionForeground)", "margin-top": "0.5rem" }}>
              … and {modelLibrary().length - 24} more
            </div>
          </Show>
        </div>
      </Show>

      <Show when={reloadAt()}>
        <div style={{ "font-size": "0.72rem", color: "var(--vscode-descriptionForeground)", "margin-top": "0.5rem", "text-align": "right" }}>
          Last reload: {new Date(reloadAt() ?? 0).toLocaleTimeString()}
        </div>
      </Show>
    </div>
  )
}

export default WorkstationTab
