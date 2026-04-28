/**
 * BackendContext — SolidJS context for the switchable backend selector.
 *
 * Manages:
 *  - Which backend is active (kilo-native | openhands | goose)
 *  - Per-backend configuration
 *  - Access profiles (environment presets for execution)
 *  - Routing mode (manual | auto-hermes)
 *
 * Persistence:
 *  - localStorage key: kilocode_backend_state
 *
 * Extension host sync:
 *  - Outgoing: postMessage({ type: "backendStateChanged", state })
 *  - Incoming: window message { type: "backendStateSync", state }
 */

import {
  createContext,
  useContext,
  createSignal,
  createMemo,
  onMount,
  onCleanup,
  ParentComponent,
} from "solid-js"
import { useVSCode } from "./vscode"
import type {
  BackendId,
  BackendConfig,
  BackendState,
  AccessProfile,
  Capability,
} from "../types/backend-types"
import { DEFAULT_BACKENDS, DEFAULT_PROFILES } from "../types/backend-types"

// ─── Storage key ─────────────────��──────────────────────────────────────────

const STORAGE_KEY = "kilocode_backend_state"

// ─── Default state ──────────────────���────────────────────────���───────────────

const DEFAULT_STATE: BackendState = {
  activeBackend: "kilo-native",
  backends: DEFAULT_BACKENDS,
  profiles: DEFAULT_PROFILES,
  isRunning: false,
  routingMode: "manual",
}

// ─── Helpers ──────────────────────────────────────────────────���──────────────

function loadState(): BackendState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_STATE
    const parsed = JSON.parse(raw) as Partial<BackendState>
    // Merge with defaults to pick up new fields on upgrades
    return {
      ...DEFAULT_STATE,
      ...parsed,
      // Always merge backend list: keep user's enabled/config overrides but
      // ensure all three backend stubs are present
      backends: DEFAULT_BACKENDS.map((def) => {
        const saved = (parsed.backends ?? []).find((b) => b.id === def.id)
        return saved ? { ...def, ...saved } : def
      }),
      profiles: parsed.profiles?.length ? parsed.profiles : DEFAULT_PROFILES,
    }
  } catch {
    return DEFAULT_STATE
  }
}

function saveState(state: BackendState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // Silently ignore storage quota errors
  }
}

// ─── Context type ─────────────────────��────────────────────────���─────────────

interface BackendContextValue {
  // Read
  state: () => BackendState
  activeBackend: () => BackendId
  activeBackendConfig: () => BackendConfig
  activeProfile: () => AccessProfile | undefined
  getCapabilities: () => Set<Capability>
  isRunning: () => boolean
  routingMode: () => "manual" | "auto-hermes"
  // Write
  setActiveBackend: (id: BackendId) => void
  updateBackend: (id: BackendId, patch: Partial<BackendConfig>) => void
  addProfile: (profile: AccessProfile) => void
  updateProfile: (id: string, patch: Partial<AccessProfile>) => void
  deleteProfile: (id: string) => void
  setRoutingMode: (mode: "manual" | "auto-hermes") => void
  setRunning: (running: boolean, taskId?: string) => void
}

// ─── Context ───────────────────��─────────────────────────────────────────────

const BackendContext = createContext<BackendContextValue>()

export const BackendProvider: ParentComponent = (props) => {
  const vscode = useVSCode()

  const [state, setState] = createSignal<BackendState>(loadState())

  // Derived: active backend config
  const activeBackendConfig = createMemo<BackendConfig>(() => {
    const s = state()
    return s.backends.find((b) => b.id === s.activeBackend) ?? s.backends[0]
  })

  // Derived: active profile
  const activeProfile = createMemo<AccessProfile | undefined>(() => {
    const s = state()
    const cfg = activeBackendConfig()
    if (!cfg.activeProfileId) return undefined
    return s.profiles.find((p) => p.id === cfg.activeProfileId)
  })

  // Derived: union of capabilities from active backend + active profile
  const getCapabilities = createMemo<Set<Capability>>(() => {
    const caps = new Set<Capability>(activeBackendConfig().capabilities)
    const profile = activeProfile()
    if (!profile) return caps
    // Add approval_required if profile requiresApproval
    if (profile.requireApproval) caps.add("approval_required")
    if (profile.sandboxMode === "docker" || profile.sandboxMode === "zeroclaw") caps.add("sandbox_required")
    if (profile.checkpointBeforeRun) caps.add("checkpoint_required")
    return caps
  })

  // Persist + sync on every state change
  const syncState = (next: BackendState) => {
    saveState(next)
    vscode.postMessage({ type: "backendStateChanged", state: next } as any)
  }

  // Merge helper to avoid boilerplate
  const update = (patch: Partial<BackendState> | ((prev: BackendState) => BackendState)) => {
    setState((prev) => {
      const next = typeof patch === "function" ? patch(prev) : { ...prev, ...patch }
      syncState(next)
      return next
    })
  }

  // ── Actions ───────────────────────────────���──────────────────────────────

  const setActiveBackend = (id: BackendId) => {
    // IMPORTANT: Voice/TTS profile is backend-agnostic and MUST NOT be touched here.
    // Voice state is managed exclusively by SpeechTab + speech service.
    // Switching backends does NOT reset, modify, or re-initialize voice settings.
    update({ activeBackend: id })
  }

  const updateBackend = (id: BackendId, patch: Partial<BackendConfig>) =>
    update((prev) => ({
      ...prev,
      backends: prev.backends.map((b) => (b.id === id ? { ...b, ...patch } : b)),
    }))

  const addProfile = (profile: AccessProfile) =>
    update((prev) => ({ ...prev, profiles: [...prev.profiles, profile] }))

  const updateProfile = (id: string, patch: Partial<AccessProfile>) =>
    update((prev) => ({
      ...prev,
      profiles: prev.profiles.map((p) =>
        p.id === id ? { ...p, ...patch, updatedAt: Date.now() } : p,
      ),
    }))

  const deleteProfile = (id: string) =>
    update((prev) => ({
      ...prev,
      profiles: prev.profiles.filter((p) => p.id !== id),
      // Clear activeProfileId on backends that referenced it
      backends: prev.backends.map((b) =>
        b.activeProfileId === id ? { ...b, activeProfileId: undefined } : b,
      ),
    }))

  const setRoutingMode = (mode: "manual" | "auto-hermes") => update({ routingMode: mode })

  const setRunning = (running: boolean, taskId?: string) =>
    update({ isRunning: running, currentTaskId: taskId })

  // ── Inbound sync from extension host ─────────────────────────────────────

  onMount(() => {
    const handler = (event: MessageEvent) => {
      const msg = event.data as { type?: string; state?: BackendState }
      if (msg?.type === "backendStateSync" && msg.state) {
        // Replace state without re-broadcasting (would create an echo loop)
        setState(msg.state)
        saveState(msg.state)
      }
    }
    window.addEventListener("message", handler)
    onCleanup(() => window.removeEventListener("message", handler))
  })

  const value: BackendContextValue = {
    state,
    activeBackend: () => state().activeBackend,
    activeBackendConfig,
    activeProfile,
    getCapabilities,
    isRunning: () => state().isRunning,
    routingMode: () => state().routingMode,
    setActiveBackend,
    updateBackend,
    addProfile,
    updateProfile,
    deleteProfile,
    setRoutingMode,
    setRunning,
  }

  return <BackendContext.Provider value={value}>{props.children}</BackendContext.Provider>
}

// ─── Hook ──────────────────��──────────────────────────���───────────────��──────

export function useBackend(): BackendContextValue {
  const ctx = useContext(BackendContext)
  if (!ctx) {
    throw new Error("useBackend must be used inside <BackendProvider>")
  }
  return ctx
}
