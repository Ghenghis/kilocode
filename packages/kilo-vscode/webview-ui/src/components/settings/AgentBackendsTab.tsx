/**
 * AgentBackendsTab — Settings tab for managing OpenHands + Goose backends,
 * access profiles, routing rules, security policies, and routing log.
 *
 * Sections:
 *  1. Backend Overview          — three cards, enable/disable toggle + status
 *  2. OpenHands Configuration   — server URL, runtime, LLM, sandbox, test connection
 *  3. Goose Configuration       — CLI path, port, computer-use, MCP extensions
 *  4. Access Profiles           — list + inline edit form
 *  5. Routing Rules             — manual vs auto-hermes, capability override table
 *  6. Security Policies         — global approval gate, YOLO mode, audit log
 *  7. Routing Log               — last 20 routing decisions
 *
 * Pattern mirrors ZeroClawTab.tsx — signals at component top level, VS Code CSS vars.
 */

import { Component, createSignal, createMemo, For, Show, onCleanup } from "solid-js"
import { useBackend } from "../../context/backend-context"
import { useVSCode } from "../../context/vscode"
import { useLanguage } from "../../context/language"
import type {
  BackendId,
  BackendConfig,
  AccessProfile,
  AccessProfileType,
  Capability,
} from "../../types/backend-types"
import { DEFAULT_BACKENDS, DEFAULT_PROFILES } from "../../types/backend-types"

// ─── Voice isolation helpers (read-only from SpeechTab's localStorage) ────────
// IMPORTANT: This tab has NO voice configuration. Voice is managed exclusively
// in SpeechTab. The constants below are used ONLY to display the current voice
// as a "preserved" status indicator in the Routing Log. This tab NEVER writes
// to the voice store.
const VOICE_STORAGE_KEY = "kilo.chat.azureVoice"

const VOICE_DISPLAY_NAMES: Record<string, string> = {
  "en-GB-MaisieNeural": "Maisie (UK)",
  "en-US-JennyNeural": "Jenny (US)",
  "en-US-GuyNeural": "Guy (US)",
  "en-AU-NatashaNeural": "Natasha (AU)",
  "en-CA-ClaraNeural": "Clara (CA)",
  "en-IN-NeerjaNeural": "Neerja (IN)",
  "de-DE-KatjaNeural": "Katja (DE)",
  "fr-FR-DeniseNeural": "Denise (FR)",
  "es-ES-ElviraNeural": "Elvira (ES)",
  "ja-JP-NanamiNeural": "Nanami (JP)",
  "zh-CN-XiaoxiaoNeural": "Xiaoxiao (CN)",
}

function readCurrentVoiceId(): string {
  try {
    return localStorage.getItem(VOICE_STORAGE_KEY) ?? "en-GB-MaisieNeural"
  } catch {
    return "en-GB-MaisieNeural"
  }
}

function getVoiceDisplayName(voiceId: string): string {
  return VOICE_DISPLAY_NAMES[voiceId] ?? voiceId
}

// ─── Style constants ─────────────────────────────────────────────────────────

const inputStyle: Record<string, string> = {
  width: "100%",
  padding: "4px 8px",
  border: "1px solid var(--vscode-input-border)",
  background: "var(--vscode-input-background)",
  color: "var(--vscode-input-foreground)",
  "border-radius": "2px",
  "font-size": "13px",
  "box-sizing": "border-box",
}

const selectStyle: Record<string, string> = { ...inputStyle, cursor: "pointer" }

const labelStyle: Record<string, string> = {
  display: "block",
  "font-size": "12px",
  "font-weight": "600",
  "margin-bottom": "4px",
  color: "var(--vscode-foreground)",
}

const fieldGroupStyle: Record<string, string> = { "margin-bottom": "10px" }

const sectionStyle: Record<string, string> = {
  "margin-bottom": "16px",
  border: "1px solid var(--vscode-panel-border)",
  "border-radius": "4px",
  overflow: "hidden",
}

const sectionHeaderStyle: Record<string, string> = {
  display: "flex",
  "align-items": "center",
  "justify-content": "space-between",
  padding: "8px 12px",
  "user-select": "none",
  "font-weight": "600",
  "font-size": "13px",
  background: "var(--vscode-sideBarSectionHeader-background)",
  color: "var(--vscode-sideBarSectionHeader-foreground)",
}

const sectionBodyStyle: Record<string, string> = { padding: "12px" }

const btnBase: Record<string, string> = {
  padding: "4px 12px",
  border: "1px solid var(--vscode-button-border, transparent)",
  "border-radius": "2px",
  "font-size": "12px",
  cursor: "pointer",
}

const btnPrimary: Record<string, string> = {
  ...btnBase,
  background: "var(--vscode-button-background)",
  color: "var(--vscode-button-foreground)",
}

const btnSecondary: Record<string, string> = {
  ...btnBase,
  background: "var(--vscode-button-secondaryBackground)",
  color: "var(--vscode-button-secondaryForeground)",
}

const btnDanger: Record<string, string> = {
  ...btnBase,
  background: "var(--vscode-inputValidation-errorBackground, #5a1d1d)",
  color: "var(--vscode-errorForeground, #f48771)",
}

const btnSmall: Record<string, string> = {
  ...btnBase,
  padding: "2px 8px",
  "font-size": "11px",
}

// ─── Capability list (display order) ─────────────────────────────────────────

const ALL_CAPABILITIES: Capability[] = [
  "code_edit",
  "repo_refactor",
  "shell",
  "tests",
  "browser_sandbox",
  "computer_use",
  "ssh",
  "vps",
  "remote_gpu",
  "file_ops",
  "web_search",
  "mcp_tools",
  "approval_required",
  "sandbox_required",
  "checkpoint_required",
]

const CAP_LABELS: Record<Capability, string> = {
  code_edit: "Code Editing",
  repo_refactor: "Repo Refactor",
  shell: "Shell Commands",
  tests: "Run Tests",
  browser_sandbox: "Browser (Sandbox)",
  computer_use: "Computer Use / Desktop",
  ssh: "SSH Access",
  vps: "VPS Management",
  remote_gpu: "Remote GPU",
  file_ops: "File Operations",
  web_search: "Web Search",
  mcp_tools: "MCP Extensions",
  approval_required: "Requires Approval",
  sandbox_required: "Requires Sandbox",
  checkpoint_required: "Requires Checkpoint",
}

// ─── Routing log entry type ───────────────────────────────────────────────────

type LogEntryType = "backend-switch" | "approval" | "denied" | "auto-route"

interface RoutingLogEntry {
  ts: number
  inputSummary: string
  chosenBackend: BackendId
  reason: string
  entryType: LogEntryType
}

const SAMPLE_LOG: RoutingLogEntry[] = [
  { ts: Date.now() - 120000,  inputSummary: "Refactor auth module",         chosenBackend: "openhands",   reason: "shell + tests capability required",    entryType: "auto-route" },
  { ts: Date.now() - 300000,  inputSummary: "Fix typo in README",           chosenBackend: "kilo-native", reason: "simple code edit",                     entryType: "auto-route" },
  { ts: Date.now() - 600000,  inputSummary: "Take screenshot of dashboard", chosenBackend: "goose",       reason: "computer_use capability matched",       entryType: "backend-switch" },
  { ts: Date.now() - 900000,  inputSummary: "Write unit tests for parser",  chosenBackend: "openhands",   reason: "tests capability required",             entryType: "approval" },
  { ts: Date.now() - 1200000, inputSummary: "Update CHANGELOG",             chosenBackend: "kilo-native", reason: "code_edit only",                       entryType: "denied" },
]

// ─── Log entry colors ─────────────────────────────────────────────────────────

const LOG_TYPE_COLOR: Record<LogEntryType, string> = {
  "backend-switch": "var(--vscode-charts-blue)",
  "approval":       "var(--vscode-charts-orange, #e8a838)",
  "denied":         "var(--vscode-testing-iconFailed)",
  "auto-route":     "var(--vscode-testing-iconPassed)",
}

const LOG_TYPE_LABEL: Record<LogEntryType, string> = {
  "backend-switch": "Switch",
  "approval":       "Approval",
  "denied":         "Denied",
  "auto-route":     "Auto",
}

// ─── Profile type icons ───────────────────────────────────────────────────────

const PROFILE_TYPE_ICON: Record<string, string> = {
  "local-repo":         "🖥",
  "local-docker":       "🐳",
  "vps-ssh":            "🌐",
  "remote-gpu":         "💻",
  "browser-automation": "🌍",
  "computer-use":       "🖱",
  "custom":             "⚙",
}

// ─── Capability icons + tooltips ─────────────────────────────────────────────

const CAP_ICONS: Record<string, string> = {
  code_edit:          "✏",
  repo_refactor:      "🔀",
  shell:              "🖥",
  tests:              "🧪",
  browser_sandbox:    "🌍",
  computer_use:       "🖱",
  ssh:                "🔑",
  vps:                "☁",
  remote_gpu:         "⚡",
  file_ops:           "📁",
  web_search:         "🔍",
  mcp_tools:          "🔌",
  approval_required:  "✅",
  sandbox_required:   "🏖",
  checkpoint_required:"💾",
}

const CAP_TOOLTIPS: Record<string, string> = {
  code_edit:          "Edit code files in the workspace",
  repo_refactor:      "Large-scale repository refactoring across many files",
  shell:              "Execute shell commands and scripts",
  tests:              "Run test suites and report results",
  browser_sandbox:    "Control a sandboxed browser instance",
  computer_use:       "Full desktop control (mouse + keyboard)",
  ssh:                "Connect to remote hosts over SSH",
  vps:                "Manage virtual private servers",
  remote_gpu:         "Run workloads on remote GPU hardware",
  file_ops:           "Create, delete, and move files",
  web_search:         "Search the web and fetch URLs",
  mcp_tools:          "Call MCP extension tools",
  approval_required:  "All actions require explicit user approval",
  sandbox_required:   "Must run inside an isolated sandbox",
  checkpoint_required:"Creates a checkpoint snapshot before running",
}

// ─── YOLO checklist items ─────────────────────────────────────────────────────

const YOLO_UNLOCKS = [
  "All approval gates bypassed — no confirmation dialogs",
  "Auto-executes shell commands without review",
  "File destructive operations run without warning",
  "Backend routing skips safety heuristics",
  "Sandbox requirements ignored",
  "MCP tool calls fire without confirmation",
]

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtTs(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
}

function newProfile(): AccessProfile {
  return {
    id: `profile-${Date.now()}`,
    name: "New Profile",
    type: "local-repo",
    description: "",
    credentialEnvVars: [],
    allowedCommands: [],
    blockedCommands: [],
    sandboxMode: "none",
    requireApproval: false,
    yoloMode: false,
    checkpointBeforeRun: false,
    rollbackOnFailure: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
}

// ─── AgentBackendsTab ─────────────────────────────────────────────────────────

const AgentBackendsTab: Component = () => {
  const backend = useBackend()
  const vscode = useVSCode()
  const language = useLanguage()

  // ── Voice: read-only from SpeechTab's localStorage ─────────────────────────
  // IMPORTANT: Voice/TTS profile is backend-agnostic and MUST NOT be configured here.
  // Voice state is managed exclusively by SpeechTab + speech service.
  // Switching backends does NOT reset, modify, or re-initialize voice settings.
  // We read this for display ONLY — this tab never writes voice state.
  const [currentVoiceId] = createSignal(readCurrentVoiceId())
  const voiceDisplayName = createMemo(() => getVoiceDisplayName(currentVoiceId()))

  // Navigate to SpeechTab for voice configuration — voice lives there, not here.
  const navigateToSpeech = () => {
    vscode.postMessage({ type: "openSettings", tab: "speech" } as any)
  }

  // ── All signals at component top level ────────────────────────────────────

  // Section collapse state
  const [overviewOpen, setOverviewOpen] = createSignal(true)
  const [openhandsOpen, setOpenhandsOpen] = createSignal(true)
  const [gooseOpen, setGooseOpen] = createSignal(true)
  const [profilesOpen, setProfilesOpen] = createSignal(true)
  const [routingOpen, setRoutingOpen] = createSignal(true)
  const [securityOpen, setSecurityOpen] = createSignal(true)
  const [logOpen, setLogOpen] = createSignal(false)

  // Profile editor state
  const [editingProfileId, setEditingProfileId] = createSignal<string | null>(null)
  const [profileDraft, setProfileDraft] = createSignal<AccessProfile>(newProfile())
  const [addingProfile, setAddingProfile] = createSignal(false)

  // Test connection status
  const [openhandsTestStatus, setOpenhandsTestStatus] = createSignal<"idle" | "testing" | "ok" | "fail">("idle")
  const [gooseTestStatus, setGooseTestStatus] = createSignal<"idle" | "testing" | "ok" | "fail">("idle")
  // Per-card test statuses for the overview section
  const [cardTestStatus, setCardTestStatus] = createSignal<Record<string, "idle" | "testing" | "ok" | "fail">>({})

  // Routing log (seeded with sample data, max 100)
  const [routingLog, setRoutingLog] = createSignal<RoutingLogEntry[]>(SAMPLE_LOG)
  const [logFilter, setLogFilter] = createSignal<LogEntryType | "all">("all")

  // Capability→backend override map
  const [capabilityOverrides, setCapabilityOverrides] = createSignal<Record<string, string>>({})

  // YOLO checklist animated state
  const [yoloChecked, setYoloChecked] = createSignal<boolean[]>(YOLO_UNLOCKS.map(() => false))

  // Security policy local state (piggybacks on backend context profiles for now)
  const [globalApprovalGate, setGlobalApprovalGate] = createSignal(false)
  const [yoloMode, setYoloMode] = createSignal(false)
  const [auditLog, setAuditLog] = createSignal(true)

  // Track ad-hoc setTimeout handles spawned by user actions (testBackendCard,
  // testOpenHands, testGoose, YOLO checklist animation) so they're cancelled on
  // unmount. Wave 7 deferred: previous code called `onCleanup()` inside event
  // handlers, but Solid's onCleanup is a no-op outside a reactive scope, so
  // those timers leaked across every tab remount. Each "click 5 tabs" cycle
  // accumulated 6+ live timers per tab visit, plus 6 more per YOLO toggle,
  // each holding a closure that calls setSignal on a destroyed component.
  const pendingTimers = new Set<ReturnType<typeof setTimeout>>()
  const trackTimeout = (fn: () => void, ms: number): ReturnType<typeof setTimeout> => {
    const handle = setTimeout(() => {
      pendingTimers.delete(handle)
      fn()
    }, ms)
    pendingTimers.add(handle)
    return handle
  }
  onCleanup(() => {
    for (const t of pendingTimers) clearTimeout(t)
    pendingTimers.clear()
  })

  // Derived
  const backends = createMemo(() => backend.state().backends)
  const profiles = createMemo(() => backend.state().profiles)
  const routingMode = createMemo(() => backend.routingMode())

  const ohConfig = createMemo(() => backends().find((b) => b.id === "openhands") ?? DEFAULT_BACKENDS[1])
  const gooseConfig = createMemo(() => backends().find((b) => b.id === "goose") ?? DEFAULT_BACKENDS[2])

  // ── Test connection handlers ───────────────────────────────────────────────

  const testOpenHands = () => {
    setOpenhandsTestStatus("testing")
    trackTimeout(() => {
      // TODO Phase 2: real fetch to openhandsServerUrl/health
      setOpenhandsTestStatus("ok")
      trackTimeout(() => setOpenhandsTestStatus("idle"), 3000)
    }, 1200)
  }

  const testGoose = () => {
    setGooseTestStatus("testing")
    trackTimeout(() => {
      // TODO Phase 2: real goose CLI version check
      setGooseTestStatus("ok")
      trackTimeout(() => setGooseTestStatus("idle"), 3000)
    }, 1200)
  }

  const testBackendCard = (backendId: string) => {
    setCardTestStatus((prev) => ({ ...prev, [backendId]: "testing" }))
    trackTimeout(() => {
      setCardTestStatus((prev) => ({ ...prev, [backendId]: "ok" }))
      trackTimeout(() => {
        setCardTestStatus((prev) => ({ ...prev, [backendId]: "idle" }))
      }, 3000)
    }, 1400)
  }

  // ── Profile editor helpers ─────────────────────────────────────────────────

  const startEditProfile = (p: AccessProfile) => {
    setProfileDraft({ ...p })
    setEditingProfileId(p.id)
    setAddingProfile(false)
  }

  const startAddProfile = () => {
    setProfileDraft(newProfile())
    setEditingProfileId(null)
    setAddingProfile(true)
  }

  const cancelProfileEdit = () => {
    setEditingProfileId(null)
    setAddingProfile(false)
  }

  const saveProfileEdit = () => {
    const draft = profileDraft()
    if (addingProfile()) {
      backend.addProfile(draft)
    } else if (editingProfileId()) {
      backend.updateProfile(editingProfileId()!, draft)
    }
    setEditingProfileId(null)
    setAddingProfile(false)
  }

  const patchDraft = (patch: Partial<AccessProfile>) =>
    setProfileDraft((prev) => ({ ...prev, ...patch }))

  // ── Status badge helper ────────────────────────────────────────────────────

  const testStatusBadge = (status: "idle" | "testing" | "ok" | "fail") => {
    if (status === "idle") return null
    const map = {
      testing: { text: "Testing…", color: "var(--vscode-charts-yellow, #cca700)" },
      ok: { text: "Connected", color: "var(--vscode-testing-iconPassed, #388a34)" },
      fail: { text: "Failed", color: "var(--vscode-testing-iconFailed, #f14c4c)" },
    } as const
    const s = map[status as keyof typeof map]
    return (
      <span
        style={{
          "font-size": "11px",
          "font-weight": "600",
          color: s.color,
          "margin-left": "8px",
        }}
      >
        {s.text}
      </span>
    )
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div style={{ "max-width": "800px" }}>

      {/* ── Voice isolation notice ─────────────────────────────────────────── */}
      {/*
        IMPORTANT: Voice/TTS profile is backend-agnostic and MUST NOT be configured here.
        Voice state is managed exclusively by SpeechTab + speech service.
        Switching backends does NOT reset, modify, or re-initialize voice settings.
      */}
      <div
        style={{
          display: "flex",
          "align-items": "center",
          gap: "10px",
          padding: "8px 12px",
          "margin-bottom": "14px",
          "border-radius": "4px",
          background: "var(--vscode-inputValidation-infoBackground, rgba(0,122,204,0.08))",
          border: "1px solid var(--vscode-inputValidation-infoBorder, rgba(0,122,204,0.25))",
          "font-size": "12px",
        }}
      >
        <span style={{ "font-size": "15px" }}>🔊</span>
        <div style={{ flex: "1" }}>
          <span style={{ "font-weight": "600" }}>Voice configuration lives in SpeechTab</span>
          <span style={{ color: "var(--vscode-descriptionForeground)", "margin-left": "6px" }}>
            — switching backends never changes your voice.
          </span>
        </div>
        <button
          onClick={navigateToSpeech}
          style={{
            background: "none",
            border: "none",
            color: "var(--vscode-textLink-foreground)",
            "font-size": "12px",
            cursor: "pointer",
            padding: "0",
            "text-decoration": "underline",
            "white-space": "nowrap",
          }}
        >
          Configure Voice →
        </button>
      </div>

      {/* ── 1. Backend Overview ─────────────────────────────────────────── */}
      <div style={sectionStyle}>
        <div
          style={{ ...sectionHeaderStyle, cursor: "pointer" }}
          onClick={() => setOverviewOpen((v) => !v)}
          role="button"
          aria-expanded={overviewOpen()}
        >
          <span>{language.t("settings.agentBackends.section.overview")}</span>
          <span style={{ "font-size": "10px", opacity: "0.7" }}>{overviewOpen() ? "▲" : "▼"}</span>
        </div>
        <Show when={overviewOpen()}>
          <div style={{ ...sectionBodyStyle, display: "flex", gap: "12px", "flex-wrap": "wrap" }}>
            <For each={backends()}>
              {(b) => {
                const cardStatus = () => cardTestStatus()[b.id] ?? "idle"
                return (
                  <div
                    style={{
                      flex: "1",
                      "min-width": "200px",
                      border: b.id === backend.activeBackend()
                        ? "2px solid var(--vscode-focusBorder)"
                        : "1px solid var(--vscode-panel-border)",
                      "border-radius": "6px",
                      padding: "12px",
                      background: b.id === backend.activeBackend()
                        ? "var(--vscode-list-activeSelectionBackground)"
                        : "var(--vscode-editor-background)",
                      display: "flex",
                      "flex-direction": "column",
                      gap: "8px",
                    }}
                  >
                    {/* Header: icon + name + toggle */}
                    <div style={{ display: "flex", "align-items": "center", "justify-content": "space-between" }}>
                      <div style={{ display: "flex", "align-items": "center", gap: "8px" }}>
                        <span style={{ "font-size": "22px", "line-height": "1" }}>{b.icon}</span>
                        <span style={{ "font-weight": "700", "font-size": "14px" }}>{b.displayName}</span>
                      </div>
                      <label style={{ display: "flex", "align-items": "center", gap: "5px", cursor: "pointer" }}>
                        <span
                          style={{
                            "font-size": "10px",
                            "font-weight": "600",
                            color: b.enabled ? "var(--vscode-testing-iconPassed)" : "var(--vscode-descriptionForeground)",
                          }}
                        >
                          {b.enabled ? "On" : "Off"}
                        </span>
                        <input
                          type="checkbox"
                          checked={b.enabled}
                          onChange={(e) => backend.updateBackend(b.id, { enabled: e.currentTarget.checked })}
                          style={{ "accent-color": "var(--vscode-focusBorder)" }}
                        />
                      </label>
                    </div>

                    {/* Description */}
                    <div style={{ "font-size": "11px", color: "var(--vscode-descriptionForeground)" }}>
                      {b.description}
                    </div>

                    {/* Capability chips */}
                    <div style={{ display: "flex", "flex-wrap": "wrap", gap: "4px" }}>
                      <For each={b.capabilities.slice(0, 6)}>
                        {(cap) => (
                          <span
                            title={CAP_TOOLTIPS[cap] ?? cap}
                            style={{
                              "font-size": "10px",
                              padding: "1px 6px",
                              "border-radius": "8px",
                              background: "var(--vscode-badge-background)",
                              color: "var(--vscode-badge-foreground)",
                              cursor: "help",
                              "white-space": "nowrap",
                            }}
                          >
                            {CAP_ICONS[cap] ?? "•"} {CAP_LABELS[cap as keyof typeof CAP_LABELS] ?? cap}
                          </span>
                        )}
                      </For>
                      <Show when={b.capabilities.length > 6}>
                        <span
                          style={{
                            "font-size": "10px",
                            padding: "1px 6px",
                            "border-radius": "8px",
                            color: "var(--vscode-descriptionForeground)",
                          }}
                        >
                          +{b.capabilities.length - 6} more
                        </span>
                      </Show>
                    </div>

                    {/* Test Connection + status */}
                    <div style={{ display: "flex", "align-items": "center", gap: "8px", "flex-wrap": "wrap" }}>
                      <button
                        style={{
                          ...btnSmall,
                          background: "var(--vscode-button-secondaryBackground)",
                          color: "var(--vscode-button-secondaryForeground)",
                        }}
                        onClick={() => testBackendCard(b.id)}
                        disabled={cardStatus() === "testing"}
                      >
                        {cardStatus() === "testing" ? "Testing…" : "Test Connection"}
                      </button>
                      <Show when={cardStatus() !== "idle"}>
                        <span
                          style={{
                            "font-size": "11px",
                            "font-weight": "600",
                            color: cardStatus() === "testing"
                              ? "var(--vscode-charts-yellow, #cca700)"
                              : cardStatus() === "ok"
                                ? "var(--vscode-testing-iconPassed)"
                                : "var(--vscode-testing-iconFailed)",
                          }}
                        >
                          {cardStatus() === "testing" ? "Testing…" : cardStatus() === "ok" ? "Connected" : "Failed"}
                        </span>
                      </Show>
                    </div>

                    {/* Active badge / Activate button */}
                    <div>
                      <Show when={b.id === backend.activeBackend()}>
                        <span
                          style={{
                            "font-size": "9px",
                            padding: "2px 7px",
                            "border-radius": "3px",
                            background: "var(--vscode-badge-background)",
                            color: "var(--vscode-badge-foreground)",
                            "font-weight": "700",
                          }}
                        >
                          ACTIVE
                        </span>
                      </Show>
                      <Show when={b.id !== backend.activeBackend() && b.enabled}>
                        <button
                          style={{ ...btnSmall, ...btnPrimary }}
                          onClick={() => {
                            // IMPORTANT: Voice/TTS profile is backend-agnostic and MUST NOT be touched here.
                            backend.setActiveBackend(b.id)
                          }}
                        >
                          Activate
                        </button>
                      </Show>
                    </div>
                  </div>
                )
              }}
            </For>
          </div>
        </Show>
      </div>

      {/* ── 2. OpenHands Configuration ──────────────────────────────────── */}
      <div style={sectionStyle}>
        <div
          style={{ ...sectionHeaderStyle, cursor: "pointer" }}
          onClick={() => setOpenhandsOpen((v) => !v)}
          role="button"
          aria-expanded={openhandsOpen()}
        >
          <span>🤖 OpenHands Configuration</span>
          <span style={{ "font-size": "10px", opacity: "0.7" }}>{openhandsOpen() ? "▲" : "▼"}</span>
        </div>
        <Show when={openhandsOpen()}>
          <div style={sectionBodyStyle}>
            <div style={{ display: "grid", "grid-template-columns": "1fr 1fr", gap: "12px" }}>
              <div style={fieldGroupStyle}>
                <label style={labelStyle}>Server URL</label>
                <input
                  type="text"
                  style={inputStyle}
                  value={ohConfig().openhandsServerUrl ?? "http://localhost:3000"}
                  onBlur={(e) => backend.updateBackend("openhands", { openhandsServerUrl: e.currentTarget.value })}
                  placeholder="http://localhost:3000"
                />
              </div>
              <div style={fieldGroupStyle}>
                <label style={labelStyle}>Runtime</label>
                <select
                  style={selectStyle}
                  value={ohConfig().openhandsRuntime ?? "docker"}
                  onChange={(e) =>
                    backend.updateBackend("openhands", {
                      openhandsRuntime: e.currentTarget.value as "docker" | "remote" | "modal",
                    })
                  }
                >
                  <option value="docker">Docker (local)</option>
                  <option value="remote">Remote server</option>
                  <option value="modal">Modal (cloud)</option>
                </select>
              </div>
              <div style={fieldGroupStyle}>
                <label style={labelStyle}>LLM Provider</label>
                <input
                  type="text"
                  style={inputStyle}
                  value={ohConfig().openhandsLlmProvider ?? ""}
                  onBlur={(e) => backend.updateBackend("openhands", { openhandsLlmProvider: e.currentTarget.value })}
                  placeholder="e.g. anthropic"
                />
              </div>
              <div style={fieldGroupStyle}>
                <label style={labelStyle}>LLM Model</label>
                <input
                  type="text"
                  style={inputStyle}
                  value={ohConfig().openhandsLlmModel ?? ""}
                  onBlur={(e) => backend.updateBackend("openhands", { openhandsLlmModel: e.currentTarget.value })}
                  placeholder="e.g. claude-sonnet-4-5"
                />
              </div>
            </div>

            <div style={{ display: "flex", "align-items": "center", gap: "12px", "margin-top": "4px", "margin-bottom": "12px" }}>
              <label style={{ display: "flex", "align-items": "center", gap: "6px", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={ohConfig().openhandsSandbox ?? true}
                  onChange={(e) => backend.updateBackend("openhands", { openhandsSandbox: e.currentTarget.checked })}
                />
                <span style={{ "font-size": "12px" }}>Enable sandbox isolation</span>
              </label>
            </div>

            <div style={{ display: "flex", "align-items": "center", gap: "8px" }}>
              <button style={btnSecondary} onClick={testOpenHands} disabled={openhandsTestStatus() === "testing"}>
                {openhandsTestStatus() === "testing" ? "Testing…" : "Test Connection"}
              </button>
              {testStatusBadge(openhandsTestStatus())}
            </div>
          </div>
        </Show>
      </div>

      {/* ── 3. Goose Configuration ──────────────────────────────────────── */}
      <div style={sectionStyle}>
        <div
          style={{ ...sectionHeaderStyle, cursor: "pointer" }}
          onClick={() => setGooseOpen((v) => !v)}
          role="button"
          aria-expanded={gooseOpen()}
        >
          <span>🪿 Goose Configuration</span>
          <span style={{ "font-size": "10px", opacity: "0.7" }}>{gooseOpen() ? "▲" : "▼"}</span>
        </div>
        <Show when={gooseOpen()}>
          <div style={sectionBodyStyle}>
            <div style={{ display: "grid", "grid-template-columns": "1fr 1fr", gap: "12px" }}>
              <div style={fieldGroupStyle}>
                <label style={labelStyle}>CLI Path</label>
                <input
                  type="text"
                  style={inputStyle}
                  value={gooseConfig().gooseCliPath ?? "goose"}
                  onBlur={(e) => backend.updateBackend("goose", { gooseCliPath: e.currentTarget.value })}
                  placeholder="goose"
                />
              </div>
              <div style={fieldGroupStyle}>
                <label style={labelStyle}>API Port</label>
                <input
                  type="number"
                  style={inputStyle}
                  value={gooseConfig().gooseApiPort ?? 3001}
                  onBlur={(e) => backend.updateBackend("goose", { gooseApiPort: Number(e.currentTarget.value) })}
                  min={1024}
                  max={65535}
                />
              </div>
              <div style={fieldGroupStyle}>
                <label style={labelStyle}>Profile</label>
                <input
                  type="text"
                  style={inputStyle}
                  value={gooseConfig().gooseProfile ?? ""}
                  onBlur={(e) => backend.updateBackend("goose", { gooseProfile: e.currentTarget.value })}
                  placeholder="default"
                />
              </div>
            </div>

            <div style={{ display: "flex", "align-items": "center", gap: "12px", "margin-top": "4px" }}>
              <label style={{ display: "flex", "align-items": "center", gap: "6px", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={gooseConfig().gooseComputerUse ?? false}
                  onChange={(e) => backend.updateBackend("goose", { gooseComputerUse: e.currentTarget.checked })}
                />
                <span style={{ "font-size": "12px" }}>Enable computer use (desktop control)</span>
              </label>
            </div>

            <div style={{ ...fieldGroupStyle, "margin-top": "10px" }}>
              <label style={labelStyle}>MCP Extensions (comma-separated)</label>
              <input
                type="text"
                style={inputStyle}
                value={(gooseConfig().gooseMcpExtensions ?? []).join(", ")}
                onBlur={(e) =>
                  backend.updateBackend("goose", {
                    gooseMcpExtensions: e.currentTarget.value
                      .split(",")
                      .map((s) => s.trim())
                      .filter(Boolean),
                  })
                }
                placeholder="e.g. filesystem, git, github"
              />
            </div>

            <div style={{ display: "flex", "align-items": "center", gap: "8px", "margin-top": "4px" }}>
              <button style={btnSecondary} onClick={testGoose} disabled={gooseTestStatus() === "testing"}>
                {gooseTestStatus() === "testing" ? "Testing…" : "Test Connection"}
              </button>
              {testStatusBadge(gooseTestStatus())}
            </div>
          </div>
        </Show>
      </div>

      {/* ── 4. Access Profiles ──────────────────────────────────────────── */}
      <div style={sectionStyle}>
        <div
          style={{ ...sectionHeaderStyle, cursor: "pointer" }}
          onClick={() => setProfilesOpen((v) => !v)}
          role="button"
          aria-expanded={profilesOpen()}
        >
          <span>Access Profiles</span>
          <span
            style={{
              "font-size": "10px",
              padding: "1px 5px",
              "border-radius": "3px",
              background: "var(--vscode-badge-background)",
              color: "var(--vscode-badge-foreground)",
              "margin-left": "8px",
            }}
          >
            {profiles().length}
          </span>
          <span style={{ "font-size": "10px", opacity: "0.7", "margin-left": "auto" }}>{profilesOpen() ? "▲" : "▼"}</span>
        </div>
        <Show when={profilesOpen()}>
          <div style={sectionBodyStyle}>
            {/* Profile list */}
            <For each={profiles()}>
              {(p) => (
                <div
                  style={{
                    display: "flex",
                    "align-items": "center",
                    "justify-content": "space-between",
                    padding: "8px 10px",
                    "border-radius": "4px",
                    "margin-bottom": "6px",
                    border: editingProfileId() === p.id
                      ? "1px solid var(--vscode-focusBorder)"
                      : "1px solid var(--vscode-panel-border)",
                    background: editingProfileId() === p.id
                      ? "var(--vscode-list-activeSelectionBackground)"
                      : "var(--vscode-editor-background)",
                  }}
                >
                  <div style={{ display: "flex", "align-items": "center", gap: "8px" }}>
                    {/* Type icon */}
                    <span
                      style={{ "font-size": "16px", "line-height": "1", "flex-shrink": "0" }}
                      title={p.type}
                    >
                      {PROFILE_TYPE_ICON[p.type] ?? "⚙"}
                    </span>
                    <div>
                      <div style={{ display: "flex", "align-items": "center", gap: "6px" }}>
                        <span style={{ "font-weight": "600", "font-size": "13px" }}>{p.name}</span>
                        <span
                          style={{
                            "font-size": "10px",
                            padding: "1px 6px",
                            "border-radius": "8px",
                            background: "var(--vscode-badge-background)",
                            color: "var(--vscode-badge-foreground)",
                          }}
                        >
                          {p.type}
                        </span>
                      </div>
                      <Show when={p.description}>
                        <div style={{ "font-size": "11px", color: "var(--vscode-descriptionForeground)", "margin-top": "1px" }}>
                          {p.description}
                        </div>
                      </Show>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: "6px", "flex-shrink": "0" }}>
                    <button style={btnSmall} onClick={() => startEditProfile(p)}>Edit</button>
                    <button
                      style={{ ...btnSmall, ...btnDanger }}
                      onClick={() => backend.deleteProfile(p.id)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              )}
            </For>

            {/* Add profile button */}
            <Show when={!addingProfile() && !editingProfileId()}>
              <button style={{ ...btnSecondary, "margin-top": "8px" }} onClick={startAddProfile}>
                + Add Profile
              </button>
            </Show>

            {/* Inline profile form */}
            <Show when={addingProfile() || editingProfileId()}>
              <ProfileForm
                draft={profileDraft()}
                onPatch={patchDraft}
                onSave={saveProfileEdit}
                onCancel={cancelProfileEdit}
                isNew={addingProfile()}
              />
            </Show>
          </div>
        </Show>
      </div>

      {/* ── 5. Routing Rules ────────────────────────────────────────────── */}
      <div style={sectionStyle}>
        <div
          style={{ ...sectionHeaderStyle, cursor: "pointer" }}
          onClick={() => setRoutingOpen((v) => !v)}
          role="button"
          aria-expanded={routingOpen()}
        >
          <span>Routing Rules</span>
          <span style={{ "font-size": "10px", opacity: "0.7" }}>{routingOpen() ? "▲" : "▼"}</span>
        </div>
        <Show when={routingOpen()}>
          <div style={sectionBodyStyle}>
            {/* Manual vs Auto toggle */}
            <div style={{ display: "flex", gap: "8px", "margin-bottom": "14px" }}>
              <button
                style={{
                  ...btnBase,
                  background: routingMode() === "manual"
                    ? "var(--vscode-button-background)"
                    : "var(--vscode-button-secondaryBackground)",
                  color: routingMode() === "manual"
                    ? "var(--vscode-button-foreground)"
                    : "var(--vscode-button-secondaryForeground)",
                }}
                onClick={() => backend.setRoutingMode("manual")}
              >
                Manual
              </button>
              <button
                style={{
                  ...btnBase,
                  background: routingMode() === "auto-hermes"
                    ? "var(--vscode-button-background)"
                    : "var(--vscode-button-secondaryBackground)",
                  color: routingMode() === "auto-hermes"
                    ? "var(--vscode-button-foreground)"
                    : "var(--vscode-button-secondaryForeground)",
                }}
                onClick={() => backend.setRoutingMode("auto-hermes")}
              >
                Auto (Hermes)
              </button>
            </div>

            <Show when={routingMode() === "auto-hermes"}>
              <div
                style={{
                  padding: "8px 10px",
                  "border-radius": "4px",
                  background: "var(--vscode-inputValidation-infoBackground, rgba(0,122,204,0.1))",
                  "border-left": "3px solid var(--vscode-inputValidation-infoBorder, #007acc)",
                  "margin-bottom": "12px",
                  "font-size": "12px",
                }}
              >
                Hermes will analyse each prompt and route to the best-fit backend based on capability matching and task complexity.
              </div>
            </Show>

            {/* Capability → Backend override table */}
            <div style={{ "font-size": "12px", "font-weight": "600", "margin-bottom": "6px" }}>
              Capability → Backend Override
            </div>
            <div
              style={{
                border: "1px solid var(--vscode-panel-border)",
                "border-radius": "4px",
                overflow: "hidden",
              }}
            >
              {/* Table header */}
              <div
                style={{
                  display: "grid",
                  "grid-template-columns": "32px 1fr 160px",
                  "font-size": "11px",
                  "font-weight": "700",
                  padding: "5px 8px",
                  background: "var(--vscode-sideBarSectionHeader-background)",
                  color: "var(--vscode-descriptionForeground)",
                  gap: "8px",
                }}
              >
                <span />
                <span>Capability</span>
                <span>Preferred Backend</span>
              </div>
              <For each={ALL_CAPABILITIES.filter((c) => !c.includes("required"))}>
                {(cap, idx) => {
                  const override = () => capabilityOverrides()[cap] ?? "auto"
                  return (
                    <div
                      style={{
                        display: "grid",
                        "grid-template-columns": "32px 1fr 160px",
                        padding: "5px 8px",
                        "font-size": "11px",
                        background: idx() % 2 === 0 ? "transparent" : "var(--vscode-list-hoverBackground)",
                        "align-items": "center",
                        gap: "8px",
                      }}
                    >
                      {/* Icon */}
                      <span
                        style={{ "font-size": "14px", "text-align": "center" }}
                        title={CAP_TOOLTIPS[cap] ?? ""}
                      >
                        {CAP_ICONS[cap] ?? "•"}
                      </span>
                      {/* Name + tooltip hint */}
                      <span
                        title={CAP_TOOLTIPS[cap] ?? ""}
                        style={{ cursor: "help" }}
                      >
                        {CAP_LABELS[cap as keyof typeof CAP_LABELS]}
                      </span>
                      {/* Backend selector */}
                      <select
                        value={override()}
                        onChange={(e) =>
                          setCapabilityOverrides((prev) => ({ ...prev, [cap]: e.currentTarget.value }))
                        }
                        style={{
                          ...selectStyle,
                          "font-size": "11px",
                          padding: "2px 4px",
                        }}
                      >
                        <option value="auto">Auto</option>
                        <For each={backends()}>
                          {(b) => <option value={b.id}>{b.displayName}</option>}
                        </For>
                      </select>
                    </div>
                  )
                }}
              </For>
            </div>
          </div>
        </Show>
      </div>

      {/* ── 6. Security Policies ────────────────────────────────────────── */}
      <div style={sectionStyle}>
        <div
          style={{ ...sectionHeaderStyle, cursor: "pointer" }}
          onClick={() => setSecurityOpen((v) => !v)}
          role="button"
          aria-expanded={securityOpen()}
        >
          <span>Security Policies</span>
          <span style={{ "font-size": "10px", opacity: "0.7" }}>{securityOpen() ? "▲" : "▼"}</span>
        </div>
        <Show when={securityOpen()}>
          <div style={sectionBodyStyle}>
            <div style={{ display: "flex", "flex-direction": "column", gap: "12px" }}>
              {/* Global approval gate */}
              <div style={{ display: "flex", "align-items": "flex-start", "justify-content": "space-between", gap: "16px" }}>
                <div>
                  <div style={{ "font-weight": "600", "font-size": "13px", "margin-bottom": "2px" }}>
                    Global Approval Gate
                  </div>
                  <div style={{ "font-size": "11px", color: "var(--vscode-descriptionForeground)" }}>
                    Require explicit approval before any backend executes an action
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={globalApprovalGate()}
                  onChange={(e) => setGlobalApprovalGate(e.currentTarget.checked)}
                />
              </div>

              {/* Audit log */}
              <div style={{ display: "flex", "align-items": "flex-start", "justify-content": "space-between", gap: "16px" }}>
                <div>
                  <div style={{ "font-weight": "600", "font-size": "13px", "margin-bottom": "2px" }}>
                    Audit Log
                  </div>
                  <div style={{ "font-size": "11px", color: "var(--vscode-descriptionForeground)" }}>
                    Record all backend routing decisions and tool calls
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={auditLog()}
                  onChange={(e) => setAuditLog(e.currentTarget.checked)}
                />
              </div>

              {/* YOLO mode — red warning box with skull */}
              <div
                style={{
                  border: `2px solid ${yoloMode() ? "var(--vscode-testing-iconFailed, #f14c4c)" : "var(--vscode-inputValidation-errorBorder, #be1100)"}`,
                  "border-radius": "6px",
                  padding: "12px",
                  background: yoloMode()
                    ? "var(--vscode-inputValidation-errorBackground, rgba(190,17,0,0.14))"
                    : "var(--vscode-inputValidation-errorBackground, rgba(190,17,0,0.06))",
                  transition: "background 0.3s, border-color 0.3s",
                }}
              >
                {/* Header */}
                <div style={{ display: "flex", "align-items": "flex-start", "justify-content": "space-between", gap: "12px", "margin-bottom": "8px" }}>
                  <div style={{ display: "flex", "align-items": "center", gap: "8px" }}>
                    <span style={{ "font-size": "22px", "line-height": "1" }}>💀</span>
                    <div>
                      <div
                        style={{
                          "font-weight": "700",
                          "font-size": "14px",
                          "margin-bottom": "2px",
                          color: "var(--vscode-errorForeground, #f48771)",
                        }}
                      >
                        YOLO Mode
                      </div>
                      <div style={{ "font-size": "11px", color: "var(--vscode-descriptionForeground)" }}>
                        Skips all approval gates. Use only in fully isolated sandboxes.
                      </div>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={yoloMode()}
                    onChange={(e) => {
                      const on = e.currentTarget.checked
                      setYoloMode(on)
                      if (on) {
                        // Animate checklist items in sequence
                        YOLO_UNLOCKS.forEach((_, i) => {
                          trackTimeout(() => {
                            setYoloChecked((prev) => {
                              const next = [...prev]
                              next[i] = true
                              return next
                            })
                          }, i * 120)
                        })
                      } else {
                        setYoloChecked(YOLO_UNLOCKS.map(() => false))
                      }
                    }}
                    style={{ "accent-color": "var(--vscode-testing-iconFailed)", "flex-shrink": "0" }}
                  />
                </div>

                {/* Active warning + animated checklist */}
                <Show when={yoloMode()}>
                  <div
                    style={{
                      padding: "8px 10px",
                      "border-radius": "4px",
                      background: "rgba(190,17,0,0.12)",
                      border: "1px solid var(--vscode-inputValidation-errorBorder, #be1100)",
                      "margin-bottom": "8px",
                    }}
                  >
                    <div
                      style={{
                        "font-size": "12px",
                        "font-weight": "700",
                        color: "var(--vscode-errorForeground, #f48771)",
                        "margin-bottom": "6px",
                      }}
                    >
                      YOLO active — the following are now unlocked:
                    </div>
                    <div style={{ display: "flex", "flex-direction": "column", gap: "4px" }}>
                      <For each={YOLO_UNLOCKS}>
                        {(item, i) => (
                          <div
                            style={{
                              display: "flex",
                              "align-items": "flex-start",
                              gap: "6px",
                              "font-size": "11px",
                              color: yoloChecked()[i()]
                                ? "var(--vscode-errorForeground, #f48771)"
                                : "var(--vscode-descriptionForeground)",
                              opacity: yoloChecked()[i()] ? "1" : "0.4",
                              transition: "opacity 0.2s, color 0.2s",
                            }}
                          >
                            <span
                              style={{
                                "font-size": "12px",
                                "flex-shrink": "0",
                                "line-height": "1.4",
                                transform: yoloChecked()[i()] ? "scale(1.2)" : "scale(1)",
                                transition: "transform 0.15s",
                                display: "inline-block",
                              }}
                            >
                              {yoloChecked()[i()] ? "☑" : "☐"}
                            </span>
                            <span>{item}</span>
                          </div>
                        )}
                      </For>
                    </div>
                  </div>
                </Show>
              </div>
            </div>
          </div>
        </Show>
      </div>

      {/* ── 7. Routing Log ──────────────────────────────────────────────── */}
      <div style={sectionStyle}>
        <div
          style={{ ...sectionHeaderStyle, cursor: "pointer" }}
          onClick={() => setLogOpen((v) => !v)}
          role="button"
          aria-expanded={logOpen()}
        >
          <span>Routing Log</span>
          <span
            style={{
              "font-size": "10px",
              padding: "1px 5px",
              "border-radius": "3px",
              background: "var(--vscode-badge-background)",
              color: "var(--vscode-badge-foreground)",
              "margin-left": "8px",
            }}
          >
            {routingLog().length}
          </span>
          {/* Voice preservation status — read-only display, never written by this tab. */}
          <span
            style={{
              display: "flex",
              "align-items": "center",
              gap: "4px",
              "margin-left": "12px",
              "font-size": "10px",
              "font-weight": "600",
              color: "var(--vscode-testing-iconPassed, #4caf50)",
              "white-space": "nowrap",
            }}
            title="Voice profile is preserved across all backend switches. Configure in SpeechTab."
          >
            🔊 Voice: {voiceDisplayName()} [preserved]
          </span>
          <span style={{ "font-size": "10px", opacity: "0.7", "margin-left": "auto" }}>
            {logOpen() ? "▲" : "▼"}
          </span>
        </div>
        <Show when={logOpen()}>
          {/* Filter toolbar */}
          <div
            style={{
              display: "flex",
              "align-items": "center",
              gap: "6px",
              padding: "8px 12px",
              "border-bottom": "1px solid var(--vscode-panel-border)",
              "flex-wrap": "wrap",
            }}
          >
            <span style={{ "font-size": "11px", color: "var(--vscode-descriptionForeground)", "margin-right": "4px" }}>Filter:</span>
            <For each={(["all", "backend-switch", "approval", "denied", "auto-route"] as Array<"all" | LogEntryType>)}>
              {(f) => (
                <button
                  onClick={() => setLogFilter(f)}
                  style={{
                    padding: "1px 8px",
                    "border-radius": "8px",
                    "font-size": "10px",
                    "font-weight": "600",
                    cursor: "pointer",
                    border: `1px solid ${logFilter() === f ? (f === "all" ? "var(--vscode-focusBorder)" : LOG_TYPE_COLOR[f as LogEntryType]) : "var(--vscode-panel-border)"}`,
                    background: logFilter() === f ? (f === "all" ? "var(--vscode-button-background)" : LOG_TYPE_COLOR[f as LogEntryType]) : "transparent",
                    color: logFilter() === f ? (f === "all" ? "var(--vscode-button-foreground)" : "#fff") : "var(--vscode-foreground)",
                  }}
                >
                  {f === "all" ? "All" : LOG_TYPE_LABEL[f as LogEntryType]}
                </button>
              )}
            </For>
            <button
              onClick={() => setRoutingLog([])}
              style={{
                ...btnSmall,
                "margin-left": "auto",
                background: "transparent",
                color: "var(--vscode-descriptionForeground)",
                border: "1px solid var(--vscode-panel-border)",
              }}
            >
              Clear
            </button>
          </div>

          <div style={{ ...sectionBodyStyle, padding: "0" }}>
            {(() => {
              const filtered = () =>
                routingLog()
                  .slice(0, 100)
                  .filter((e) => logFilter() === "all" || e.entryType === logFilter())
              return (
                <Show
                  when={filtered().length > 0}
                  fallback={
                    <div
                      style={{
                        padding: "16px",
                        "text-align": "center",
                        "font-size": "12px",
                        color: "var(--vscode-descriptionForeground)",
                      }}
                    >
                      No routing decisions match the current filter.
                    </div>
                  }
                >
                  <For each={filtered()}>
                    {(entry, idx) => (
                      <div
                        style={{
                          display: "grid",
                          "grid-template-columns": "70px 60px 1fr 110px 1fr",
                          gap: "8px",
                          padding: "6px 12px",
                          "font-size": "11px",
                          "align-items": "center",
                          background: idx() % 2 === 0 ? "transparent" : "var(--vscode-list-hoverBackground)",
                          "border-bottom": "1px solid var(--vscode-widget-border)",
                          "border-left": `3px solid ${LOG_TYPE_COLOR[entry.entryType]}`,
                        }}
                      >
                        <span style={{ color: "var(--vscode-descriptionForeground)", "white-space": "nowrap" }}>
                          {fmtTs(entry.ts)}
                        </span>
                        {/* Type badge */}
                        <span
                          style={{
                            padding: "1px 5px",
                            "border-radius": "6px",
                            "font-size": "9px",
                            "font-weight": "700",
                            background: LOG_TYPE_COLOR[entry.entryType],
                            color: "#fff",
                            "text-align": "center",
                            "white-space": "nowrap",
                          }}
                        >
                          {LOG_TYPE_LABEL[entry.entryType]}
                        </span>
                        <span
                          style={{
                            overflow: "hidden",
                            "text-overflow": "ellipsis",
                            "white-space": "nowrap",
                          }}
                        >
                          {entry.inputSummary}
                        </span>
                        <span
                          style={{
                            padding: "1px 6px",
                            "border-radius": "3px",
                            background: "var(--vscode-badge-background)",
                            color: "var(--vscode-badge-foreground)",
                            "font-size": "10px",
                            "font-weight": "700",
                            "white-space": "nowrap",
                            "text-align": "center",
                          }}
                        >
                          {entry.chosenBackend}
                        </span>
                        <span
                          style={{
                            color: "var(--vscode-descriptionForeground)",
                            overflow: "hidden",
                            "text-overflow": "ellipsis",
                            "white-space": "nowrap",
                          }}
                        >
                          {entry.reason}
                        </span>
                      </div>
                    )}
                  </For>
                </Show>
              )
            })()}
          </div>
        </Show>
      </div>
    </div>
  )
}

// ─── ProfileForm sub-component ────────────────────────────────────────────────

interface ProfileFormProps {
  draft: AccessProfile
  onPatch: (patch: Partial<AccessProfile>) => void
  onSave: () => void
  onCancel: () => void
  isNew: boolean
}

const ProfileForm: Component<ProfileFormProps> = (props) => {
  const PROFILE_TYPES: AccessProfileType[] = [
    "local-repo",
    "local-docker",
    "vps-ssh",
    "remote-gpu",
    "browser-automation",
    "computer-use",
    "custom",
  ]

  return (
    <div
      style={{
        "margin-top": "12px",
        padding: "12px",
        border: "1px solid var(--vscode-focusBorder)",
        "border-radius": "4px",
        background: "var(--vscode-editor-background)",
      }}
    >
      <div
        style={{
          "font-size": "13px",
          "font-weight": "700",
          "margin-bottom": "10px",
          color: "var(--vscode-foreground)",
        }}
      >
        {props.isNew ? "New Profile" : `Edit Profile: ${props.draft.name}`}
      </div>

      <div style={{ display: "grid", "grid-template-columns": "1fr 1fr", gap: "10px" }}>
        <div style={fieldGroupStyle}>
          <label style={labelStyle}>Name</label>
          <input
            type="text"
            style={inputStyle}
            value={props.draft.name}
            onInput={(e) => props.onPatch({ name: e.currentTarget.value })}
          />
        </div>

        <div style={fieldGroupStyle}>
          <label style={labelStyle}>Type</label>
          <select
            style={selectStyle}
            value={props.draft.type}
            onChange={(e) => props.onPatch({ type: e.currentTarget.value as AccessProfileType })}
          >
            <For each={PROFILE_TYPES}>
              {(t) => <option value={t}>{PROFILE_TYPE_ICON[t] ?? "⚙"} {t}</option>}
            </For>
          </select>
        </div>

        <div style={{ ...fieldGroupStyle, "grid-column": "1 / -1" }}>
          <label style={labelStyle}>Description</label>
          <input
            type="text"
            style={inputStyle}
            value={props.draft.description}
            onInput={(e) => props.onPatch({ description: e.currentTarget.value })}
          />
        </div>

        <Show when={props.draft.type === "vps-ssh"}>
          <div style={fieldGroupStyle}>
            <label style={labelStyle}>Host</label>
            <input
              type="text"
              style={inputStyle}
              value={props.draft.host ?? ""}
              onInput={(e) => props.onPatch({ host: e.currentTarget.value })}
            />
          </div>
          <div style={fieldGroupStyle}>
            <label style={labelStyle}>Port</label>
            <input
              type="number"
              style={inputStyle}
              value={props.draft.port ?? 22}
              onInput={(e) => props.onPatch({ port: Number(e.currentTarget.value) })}
            />
          </div>
          <div style={fieldGroupStyle}>
            <label style={labelStyle}>User</label>
            <input
              type="text"
              style={inputStyle}
              value={props.draft.user ?? ""}
              onInput={(e) => props.onPatch({ user: e.currentTarget.value })}
            />
          </div>
          <div style={fieldGroupStyle}>
            <label style={labelStyle}>SSH Key Path</label>
            <input
              type="text"
              style={inputStyle}
              value={props.draft.sshKeyPath ?? ""}
              onInput={(e) => props.onPatch({ sshKeyPath: e.currentTarget.value })}
            />
          </div>
        </Show>

        <div style={fieldGroupStyle}>
          <label style={labelStyle}>Sandbox Mode</label>
          <select
            style={selectStyle}
            value={props.draft.sandboxMode}
            onChange={(e) =>
              props.onPatch({
                sandboxMode: e.currentTarget.value as AccessProfile["sandboxMode"],
              })
            }
          >
            <option value="none">None</option>
            <option value="docker">Docker</option>
            <option value="zeroclaw">ZeroClaw</option>
            <option value="readonly">Read-only</option>
          </select>
        </div>

        <div style={fieldGroupStyle}>
          <label style={labelStyle}>Budget (USD)</label>
          <input
            type="number"
            style={inputStyle}
            value={props.draft.budgetUsd ?? ""}
            onInput={(e) =>
              props.onPatch({ budgetUsd: e.currentTarget.value ? Number(e.currentTarget.value) : undefined })
            }
            placeholder="unlimited"
          />
        </div>
      </div>

      <div style={{ display: "flex", gap: "8px", "margin-top": "4px" }}>
        <label style={{ display: "flex", "align-items": "center", gap: "6px", cursor: "pointer", "font-size": "12px" }}>
          <input
            type="checkbox"
            checked={props.draft.requireApproval}
            onChange={(e) => props.onPatch({ requireApproval: e.currentTarget.checked })}
          />
          Require Approval
        </label>
        <label style={{ display: "flex", "align-items": "center", gap: "6px", cursor: "pointer", "font-size": "12px" }}>
          <input
            type="checkbox"
            checked={props.draft.checkpointBeforeRun}
            onChange={(e) => props.onPatch({ checkpointBeforeRun: e.currentTarget.checked })}
          />
          Checkpoint Before Run
        </label>
        <label style={{ display: "flex", "align-items": "center", gap: "6px", cursor: "pointer", "font-size": "12px" }}>
          <input
            type="checkbox"
            checked={props.draft.rollbackOnFailure}
            onChange={(e) => props.onPatch({ rollbackOnFailure: e.currentTarget.checked })}
          />
          Rollback on Failure
        </label>
      </div>

      <div style={{ display: "flex", gap: "8px", "margin-top": "12px" }}>
        <button style={btnPrimary} onClick={props.onSave}>
          {props.isNew ? "Add Profile" : "Save Changes"}
        </button>
        <button style={btnSecondary} onClick={props.onCancel}>
          Cancel
        </button>
      </div>
    </div>
  )
}

export default AgentBackendsTab
