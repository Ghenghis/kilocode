import { Component, createSignal, createEffect, onCleanup, For, Show, batch } from "solid-js"
import { Card } from "@kilocode/kilo-ui/card"
import { Button } from "@kilocode/kilo-ui/button"
import { useVSCode } from "../../context/vscode"
import type { ExtensionMessage } from "../../types/messages"
import SettingsRow from "./SettingsRow"
import { useTrackedTimers } from "../../lib/tracked-timers"

// ─── Types ──────────────────────────────────────────────

type AuthMode = "key" | "password"
type ConnectionStatus = "disconnected" | "connecting" | "connected" | "error"

interface SSHProfile {
  name: string
  host: string
  port: number
  user: string
  authMode: AuthMode
  keyPath: string
  jumpHost: string
  group: string
  labels: string[]
  // kilocode_change: previously absent — backend supports it; required for round-trip
  connectionTimeoutMs?: number
}

interface SSHSession {
  profileName: string
  status: ConnectionStatus
  lastError?: string
}

interface RemoteFileEntry {
  name: string
  path: string
  isDirectory: boolean
  children?: RemoteFileEntry[]
  expanded?: boolean
}

interface LogLine {
  timestamp: string
  text: string
}

interface SSHErrorEntry {
  message: string
  code: string
  profileName: string
  timestamp: number
}

// kilocode_change (canary.11): types for the new SSH plumbing.
interface KnownHostEntry {
  host: string
  keyType: string
  fingerprint: string
}

interface ConnectionHistoryEntry {
  profileName?: string
  status?: string
  timestamp?: number
  error?: string
}

interface GeneratedKeyResult {
  ok: boolean
  name?: string
  publicKey?: string
  publicPath?: string
  privatePath?: string
  error?: string
}

interface TestConnectionResult {
  profileName: string
  ok: boolean
  error?: string
}

// ─── Defaults ───────────────────────────────────────────

const EMPTY_PROFILE: SSHProfile = {
  name: "",
  host: "",
  port: 22,
  user: "",
  authMode: "key",
  keyPath: "",
  jumpHost: "",
  group: "",
  labels: [],
}

// ─── Styles ─────────────────────────────────────────────

const inputStyle = {
  width: "100%",
  padding: "4px 8px",
  border: "1px solid var(--vscode-input-border)",
  background: "var(--vscode-input-background)",
  color: "var(--vscode-input-foreground)",
  "border-radius": "2px",
  "font-size": "13px",
}

const sectionHeaderStyle = (clickable: boolean) => ({
  display: "flex",
  "align-items": "center",
  "justify-content": "space-between",
  padding: "8px 12px",
  cursor: clickable ? "pointer" : "default",
  "user-select": "none" as const,
  "font-weight": "600",
  "font-size": "13px",
})

const statusDotStyle = (status: ConnectionStatus) => ({
  width: "8px",
  height: "8px",
  "border-radius": "50%",
  display: "inline-block",
  "flex-shrink": "0",
  background:
    status === "connected"
      ? "var(--vscode-testing-iconPassed)"
      : status === "connecting"
        ? "var(--vscode-charts-yellow)"
        : status === "error"
          ? "var(--vscode-testing-iconFailed)"
          : "var(--vscode-panel-border)",
})

const statusLabel = (status: ConnectionStatus, error?: string): string => {
  if (status === "connected") return "Connected"
  if (status === "connecting") return "Connecting..."
  if (status === "error") return error ?? "Connection error"
  return "Disconnected"
}

const listItemStyle = (selected: boolean) => ({
  display: "flex",
  "align-items": "center",
  padding: "6px 10px",
  gap: "8px",
  cursor: "pointer",
  background: selected ? "var(--vscode-list-activeSelectionBackground)" : "transparent",
  color: selected ? "var(--vscode-list-activeSelectionForeground)" : "var(--vscode-foreground)",
  "border-bottom": "1px solid var(--vscode-panel-border)",
})

const monoStyle = {
  "font-family": "var(--vscode-editor-font-family, 'Consolas, monospace')",
  "font-size": "12px",
}

const breadcrumbSegmentStyle = (clickable: boolean) => ({
  cursor: clickable ? "pointer" : "default",
  color: clickable ? "var(--vscode-textLink-foreground)" : "var(--vscode-foreground)",
  "font-size": "12px",
})

// ─── Helpers ────────────────────────────────────────────

function cloneProfile(p: SSHProfile): SSHProfile {
  return { ...p, labels: [...p.labels] }
}

function getSessionForProfile(sessions: SSHSession[], name: string): SSHSession | undefined {
  return sessions.find((s) => s.profileName === name)
}

function parseBreadcrumb(path: string): { label: string; path: string }[] {
  const parts = path.split("/").filter(Boolean)
  const crumbs: { label: string; path: string }[] = [{ label: "/", path: "/" }]
  let accumulated = ""
  for (const part of parts) {
    accumulated += "/" + part
    crumbs.push({ label: part, path: accumulated })
  }
  return crumbs
}

// ─── Component ──────────────────────────────────────────

const SSHTab: Component = () => {
  const vscode = useVSCode()
  // Wave 10-D fix: 2s "copied" reset timer at line ~541 was untracked.
  const { trackTimeout } = useTrackedTimers()

  // --- Section collapse state ---
  const [profilesOpen, setProfilesOpen] = createSignal(true)
  const [terminalsOpen, setTerminalsOpen] = createSignal(true)
  const [sftpOpen, setSftpOpen] = createSignal(false)
  const [logsOpen, setLogsOpen] = createSignal(false)

  // --- Profile management ---
  const [profiles, setProfiles] = createSignal<SSHProfile[]>([])
  const [sessions, setSessions] = createSignal<SSHSession[]>([])
  const [selectedProfileName, setSelectedProfileName] = createSignal<string | null>(null)
  const [editingProfile, setEditingProfile] = createSignal<SSHProfile | null>(null)
  const [isNewProfile, setIsNewProfile] = createSignal(false)
  const [deleteConfirmName, setDeleteConfirmName] = createSignal<string | null>(null)
  const [labelsInput, setLabelsInput] = createSignal("")

  // --- SFTP browser ---
  const [sftpProfile, setSftpProfile] = createSignal<string | null>(null)
  const [sftpPath, setSftpPath] = createSignal("/")
  const [sftpEntries, setSftpEntries] = createSignal<RemoteFileEntry[]>([])
  const [sftpLoading, setSftpLoading] = createSignal(false)
  const [expandedDirs, setExpandedDirs] = createSignal<Set<string>>(new Set())

  // --- File preview (Phase 22) ---
  const [previewContent, setPreviewContent] = createSignal<string | null>(null)
  const [previewPath, setPreviewPath] = createSignal<string | null>(null)
  const [previewLoading, setPreviewLoading] = createSignal(false)

  // --- SSH errors (Phase 26) ---
  const [sshErrors, setSSHErrors] = createSignal<SSHErrorEntry[]>([])
  const [errorsOpen, setErrorsOpen] = createSignal(false)

  // --- canary.11: keygen / known hosts / fingerprint / test / history ---
  const [keyGenName, setKeyGenName] = createSignal("")
  const [keyGenResult, setKeyGenResult] = createSignal<GeneratedKeyResult | null>(null)
  const [keyGenBusy, setKeyGenBusy] = createSignal(false)
  const [keyGenCopied, setKeyGenCopied] = createSignal(false)
  const [keysOpen, setKeysOpen] = createSignal(false)
  const [knownHosts, setKnownHosts] = createSignal<KnownHostEntry[]>([])
  const [knownHostsError, setKnownHostsError] = createSignal<string | undefined>(undefined)
  const [knownHostsOpen, setKnownHostsOpen] = createSignal(false)
  const [knownHostsLoaded, setKnownHostsLoaded] = createSignal(false)
  const [keyFingerprints, setKeyFingerprints] = createSignal<Record<string, string>>({})
  const [testResults, setTestResults] = createSignal<Record<string, TestConnectionResult>>({})
  const [connectionHistory, setConnectionHistory] = createSignal<ConnectionHistoryEntry[]>([])
  const [historyProfile, setHistoryProfile] = createSignal<string | null>(null)

  // --- Remote logs ---
  const [logProfile, setLogProfile] = createSignal<string | null>(null)
  const [logService, setLogService] = createSignal("")
  const [logLines, setLogLines] = createSignal<LogLine[]>([])
  const [logTailing, setLogTailing] = createSignal(false)

  // --- Message handler ---
  const unsubscribe = vscode.onMessage((message: ExtensionMessage) => {
    const msg = message as ExtensionMessage & Record<string, unknown>
    switch (msg.type) {
      case "sshProfilesLoaded":
        setProfiles((msg as unknown as { profiles: SSHProfile[] }).profiles)
        break
      case "sshSessionsUpdated":
        setSessions((msg as unknown as { sessions: SSHSession[] }).sessions)
        break
      case "sshConnectionStatus": {
        const data = msg as unknown as { profileName: string; status: ConnectionStatus; error?: string }
        setSessions((prev) => {
          const existing = prev.find((s) => s.profileName === data.profileName)
          if (existing) {
            return prev.map((s) =>
              s.profileName === data.profileName ? { ...s, status: data.status, lastError: data.error } : s,
            )
          }
          return [...prev, { profileName: data.profileName, status: data.status, lastError: data.error }]
        })
        break
      }
      case "sshFilesListed": {
        const data = msg as unknown as { path: string; entries: RemoteFileEntry[] }
        setSftpPath(data.path)
        setSftpEntries(data.entries)
        setSftpLoading(false)
        break
      }
      case "sshLogOutput": {
        const data = msg as unknown as { lines: LogLine[] }
        setLogLines((prev) => {
          const combined = [...prev, ...data.lines]
          // Keep last 2000 lines to prevent memory bloat
          return combined.length > 2000 ? combined.slice(combined.length - 2000) : combined
        })
        break
      }
      case "sshLogTailingStopped":
        setLogTailing(false)
        break
      case "sshFilePreviewResult": {
        const data = msg as unknown as { remotePath: string; content: string }
        setPreviewPath(data.remotePath)
        setPreviewContent(data.content)
        setPreviewLoading(false)
        break
      }
      case "sshErrors": {
        const data = msg as unknown as { errors: SSHErrorEntry[] }
        setSSHErrors(data.errors)
        break
      }
      case "sshError": {
        const data = msg as unknown as { error: SSHErrorEntry }
        setSSHErrors((prev) => {
          const combined = [...prev, data.error]
          return combined.length > 50 ? combined.slice(combined.length - 50) : combined
        })
        break
      }
      // ── canary.11 messages ──
      case "sshKeyGenerated": {
        const data = msg as unknown as GeneratedKeyResult
        setKeyGenResult(data)
        setKeyGenBusy(false)
        setKeyGenCopied(false)
        break
      }
      case "sshKnownHostsLoaded": {
        const data = msg as unknown as { entries: KnownHostEntry[]; error?: string }
        setKnownHosts(data.entries ?? [])
        setKnownHostsError(data.error)
        setKnownHostsLoaded(true)
        break
      }
      case "sshKeyFingerprint": {
        const data = msg as unknown as { keyPath: string; fingerprint: string | null; error?: string }
        if (data.keyPath) {
          setKeyFingerprints((prev) => ({
            ...prev,
            [data.keyPath]: data.fingerprint ?? (data.error ? `error: ${data.error}` : ""),
          }))
        }
        break
      }
      case "sshTestConnectionResult": {
        const data = msg as unknown as TestConnectionResult
        setTestResults((prev) => ({ ...prev, [data.profileName]: data }))
        break
      }
      case "sshConnectionHistoryLoaded": {
        const data = msg as unknown as { profileName?: string; history: ConnectionHistoryEntry[] }
        setConnectionHistory(data.history ?? [])
        setHistoryProfile(data.profileName ?? null)
        break
      }
    }
  })

  onCleanup(() => {
    unsubscribe()
  })

  // Request initial data
  vscode.postMessage({ type: "requestSSHProfiles" } as never)
  vscode.postMessage({ type: "requestSSHSessions" } as never)

  // --- Profile CRUD ---
  const startNewProfile = () => {
    batch(() => {
      setEditingProfile(cloneProfile(EMPTY_PROFILE))
      setIsNewProfile(true)
      setLabelsInput("")
    })
  }

  const startEditProfile = (profile: SSHProfile) => {
    batch(() => {
      setEditingProfile(cloneProfile(profile))
      setIsNewProfile(false)
      setLabelsInput(profile.labels.join(", "))
    })
  }

  const cancelEdit = () => {
    batch(() => {
      setEditingProfile(null)
      setIsNewProfile(false)
    })
  }

  const updateEditField = <K extends keyof SSHProfile>(key: K, value: SSHProfile[K]) => {
    const current = editingProfile()
    if (!current) return
    setEditingProfile({ ...current, [key]: value })
  }

  const saveProfile = () => {
    const profile = editingProfile()
    if (!profile || !profile.name.trim() || !profile.host.trim()) return

    const finalProfile: SSHProfile = {
      ...profile,
      name: profile.name.trim(),
      host: profile.host.trim(),
      user: profile.user.trim(),
      keyPath: profile.keyPath.trim(),
      jumpHost: profile.jumpHost.trim(),
      group: profile.group.trim(),
      labels: labelsInput()
        .split(",")
        .map((l) => l.trim())
        .filter(Boolean),
    }

    vscode.postMessage({ type: "sshProfileSave", profile: finalProfile } as never)

    // Optimistic update
    setProfiles((prev) => {
      const idx = prev.findIndex((p) => p.name === finalProfile.name)
      if (idx >= 0) {
        const next = [...prev]
        next[idx] = finalProfile
        return next
      }
      return [...prev, finalProfile]
    })

    batch(() => {
      setEditingProfile(null)
      setIsNewProfile(false)
    })
  }

  const deleteProfile = (name: string) => {
    vscode.postMessage({ type: "sshProfileDelete", profileName: name } as never)
    setProfiles((prev) => prev.filter((p) => p.name !== name))
    setDeleteConfirmName(null)
    if (selectedProfileName() === name) setSelectedProfileName(null)
  }

  // --- Connection ---
  const connectProfile = (name: string) => {
    vscode.postMessage({ type: "sshConnect", profileName: name } as never)
    setSessions((prev) => {
      const existing = prev.find((s) => s.profileName === name)
      if (existing) {
        return prev.map((s) => (s.profileName === name ? { ...s, status: "connecting" as ConnectionStatus } : s))
      }
      return [...prev, { profileName: name, status: "connecting" as ConnectionStatus }]
    })
  }

  const disconnectProfile = (name: string) => {
    vscode.postMessage({ type: "sshDisconnect", profileName: name } as never)
  }

  const openTerminal = (name: string) => {
    vscode.postMessage({ type: "sshOpenTerminal", profileName: name } as never)
  }

  const reconnectSession = (name: string) => {
    vscode.postMessage({ type: "sshConnect", profileName: name } as never)
  }

  // --- SFTP ---
  const browseFiles = (profileName: string, path: string) => {
    setSftpLoading(true)
    setSftpProfile(profileName)
    vscode.postMessage({ type: "sshBrowseFiles", profileName, path } as never)
  }

  const navigateToPath = (path: string) => {
    const profile = sftpProfile()
    if (!profile) return
    browseFiles(profile, path)
  }

  const toggleDirectory = (entry: RemoteFileEntry) => {
    const profile = sftpProfile()
    if (!profile || !entry.isDirectory) return
    // kilocode_change: capture pre-mutation state so the post-set check is correct.
    // Previous code read expandedDirs() AFTER the setter mutated state, so the
    // children-fetch branch never ran on expand and SFTP browsing was broken.
    const wasExpanded = expandedDirs().has(entry.path)
    setExpandedDirs((prev) => {
      const next = new Set(prev)
      if (wasExpanded) {
        next.delete(entry.path)
      } else {
        next.add(entry.path)
      }
      return next
    })
    if (!wasExpanded) {
      // Was just expanded, fetch children
      vscode.postMessage({ type: "sshBrowseFiles", profileName: profile, path: entry.path } as never)
    }
  }

  const openRemoteFile = (entry: RemoteFileEntry) => {
    const profile = sftpProfile()
    if (!profile || entry.isDirectory) return
    vscode.postMessage({ type: "sshFileOpen", profileName: profile, remotePath: entry.path } as never)
  }

  const downloadFile = (entry: RemoteFileEntry) => {
    const profile = sftpProfile()
    if (!profile) return
    vscode.postMessage({ type: "sshFileDownload", profileName: profile, remotePath: entry.path } as never)
  }

  const previewFile = (entry: RemoteFileEntry) => {
    const profile = sftpProfile()
    if (!profile || entry.isDirectory) return
    setPreviewLoading(true)
    setPreviewPath(entry.path)
    setPreviewContent(null)
    vscode.postMessage({ type: "sshFilePreview", profileName: profile, remotePath: entry.path } as never)
  }

  const closePreview = () => {
    setPreviewContent(null)
    setPreviewPath(null)
  }

  const uploadFile = () => {
    const profile = sftpProfile()
    if (!profile) return
    vscode.postMessage({ type: "sshFileUpload", profileName: profile, remotePath: sftpPath() } as never)
  }

  const requestErrors = () => {
    vscode.postMessage({ type: "sshGetErrors" } as never)
    setErrorsOpen(true)
  }

  const clearErrors = () => {
    setSSHErrors([])
  }

  // --- canary.11 dispatchers ---
  const generateKey = () => {
    const n = keyGenName().trim()
    if (!n) return
    setKeyGenBusy(true)
    setKeyGenResult(null)
    setKeyGenCopied(false)
    vscode.postMessage({ type: "generateSshKey", name: n } as never)
  }

  const copyPublicKey = async () => {
    const k = keyGenResult()?.publicKey
    if (!k) return
    try {
      await navigator.clipboard.writeText(k)
      setKeyGenCopied(true)
      trackTimeout(() => setKeyGenCopied(false), 2000)
    } catch {
      // Clipboard may be unavailable in webview; the key is still visible to copy manually.
    }
  }

  const refreshKnownHosts = () => {
    vscode.postMessage({ type: "listKnownHosts" } as never)
  }

  const removeKnownHost = (host: string) => {
    vscode.postMessage({ type: "removeKnownHost", host } as never)
  }

  const requestKeyFingerprint = (keyPath: string) => {
    if (!keyPath) return
    vscode.postMessage({ type: "sshGetKeyFingerprint", keyPath } as never)
  }

  const testConnection = (profileName: string) => {
    setTestResults((prev) => ({ ...prev, [profileName]: { profileName, ok: false, error: "Testing..." } }))
    vscode.postMessage({ type: "sshTestConnection", profileName } as never)
  }

  const requestConnectionHistory = (profileName?: string) => {
    vscode.postMessage({ type: "requestSSHConnectionHistory", profileName } as never)
  }

  // --- Logs ---
  const startTailLogs = () => {
    const profile = logProfile()
    if (!profile) return
    setLogTailing(true)
    setLogLines([])
    vscode.postMessage({
      type: "sshTailLogs",
      profileName: profile,
      service: logService().trim() || undefined,
      action: "start",
    } as never)
  }

  const stopTailLogs = () => {
    const profile = logProfile()
    if (!profile) return
    vscode.postMessage({ type: "sshTailLogs", profileName: profile, action: "stop" } as never)
    setLogTailing(false)
  }

  // --- Auto-scroll log output ---
  let logContainerRef: HTMLDivElement | undefined

  createEffect(() => {
    // Access logLines to register dependency
    const lines = logLines()
    if (lines.length > 0 && logContainerRef) {
      logContainerRef.scrollTop = logContainerRef.scrollHeight
    }
  })

  // --- Derived ---
  const connectedProfiles = () => sessions().filter((s) => s.status === "connected")
  const connectedProfileNames = () => connectedProfiles().map((s) => s.profileName)

  // ─── Render ───────────────────────────────────────────

  return (
    <div style={{ display: "flex", "flex-direction": "column", height: "100%", overflow: "auto", gap: "12px" }}>
      {/* ═══ SECTION 1: SSH Profile Management ═══ */}
      <Card>
        <div style={sectionHeaderStyle(true)} onClick={() => setProfilesOpen(!profilesOpen())}>
          <span style={{ display: "flex", "align-items": "center", gap: "8px" }}>
            {profilesOpen() ? "\u25BE" : "\u25B8"} SSH Profiles
          </span>
          <span style={{ "font-size": "12px", color: "var(--vscode-descriptionForeground)", "font-weight": "400" }}>
            {profiles().length} profile{profiles().length !== 1 ? "s" : ""}
          </span>
        </div>
        <Show when={profilesOpen()}>
          <div style={{ padding: "0 12px 12px" }}>
            {/* Profile List */}
            <div
              style={{
                "max-height": "260px",
                overflow: "auto",
                border: "1px solid var(--vscode-panel-border)",
                "border-radius": "4px",
                "margin-bottom": "8px",
              }}
            >
              <Show
                when={profiles().length > 0}
                fallback={
                  <div
                    style={{
                      padding: "16px",
                      "text-align": "center",
                      color: "var(--vscode-descriptionForeground)",
                      "font-size": "13px",
                    }}
                  >
                    No SSH profiles configured. Click "Add Profile" to create one.
                  </div>
                }
              >
                <For each={profiles()}>
                  {(profile) => {
                    const session = () => getSessionForProfile(sessions(), profile.name)
                    const status = () => session()?.status ?? "disconnected"
                    return (
                      <div
                        style={listItemStyle(selectedProfileName() === profile.name)}
                        onClick={() => setSelectedProfileName(profile.name)}
                      >
                        <span style={statusDotStyle(status())} title={statusLabel(status(), session()?.lastError)} />
                        <div style={{ flex: "1", "min-width": "0" }}>
                          <div style={{ "font-size": "13px", "font-weight": "500" }}>
                            {profile.name}
                            <Show when={profile.group}>
                              <span
                                style={{
                                  "margin-left": "6px",
                                  "font-size": "11px",
                                  color: "var(--vscode-descriptionForeground)",
                                }}
                              >
                                [{profile.group}]
                              </span>
                            </Show>
                          </div>
                          <div
                            style={{
                              "font-size": "11px",
                              color: "var(--vscode-descriptionForeground)",
                              "white-space": "nowrap",
                              overflow: "hidden",
                              "text-overflow": "ellipsis",
                            }}
                          >
                            {profile.user}@{profile.host}:{profile.port}
                            <Show when={profile.labels.length > 0}>
                              {" "}
                              &middot; {profile.labels.join(", ")}
                            </Show>
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: "4px", "flex-shrink": "0" }}>
                          <Show
                            when={status() === "connected"}
                            fallback={
                              <Button
                                variant="secondary"
                                size="small"
                                onClick={(e: MouseEvent) => {
                                  e.stopPropagation()
                                  connectProfile(profile.name)
                                }}
                                disabled={status() === "connecting"}
                              >
                                {status() === "connecting" ? "..." : "Connect"}
                              </Button>
                            }
                          >
                            <Button
                              variant="secondary"
                              size="small"
                              onClick={(e: MouseEvent) => {
                                e.stopPropagation()
                                disconnectProfile(profile.name)
                              }}
                            >
                              Disconnect
                            </Button>
                          </Show>
                          <Button
                            variant="secondary"
                            size="small"
                            onClick={(e: MouseEvent) => {
                              e.stopPropagation()
                              startEditProfile(profile)
                            }}
                          >
                            Edit
                          </Button>
                          {/* canary.11: Test Connection */}
                          <Button
                            variant="secondary"
                            size="small"
                            onClick={(e: MouseEvent) => {
                              e.stopPropagation()
                              testConnection(profile.name)
                            }}
                            title={testResults()[profile.name]?.error}
                          >
                            {(() => {
                              const r = testResults()[profile.name]
                              if (!r) return "Test"
                              if (r.error === "Testing...") return "Testing..."
                              return r.ok ? "Test ✓" : "Test ✗"
                            })()}
                          </Button>
                          <Show when={deleteConfirmName() === profile.name}>
                            <Button
                              variant="primary"
                              size="small"
                              onClick={(e: MouseEvent) => {
                                e.stopPropagation()
                                deleteProfile(profile.name)
                              }}
                            >
                              Confirm
                            </Button>
                            <Button
                              variant="secondary"
                              size="small"
                              onClick={(e: MouseEvent) => {
                                e.stopPropagation()
                                setDeleteConfirmName(null)
                              }}
                            >
                              Cancel
                            </Button>
                          </Show>
                          <Show when={deleteConfirmName() !== profile.name}>
                            <Button
                              variant="secondary"
                              size="small"
                              onClick={(e: MouseEvent) => {
                                e.stopPropagation()
                                setDeleteConfirmName(profile.name)
                              }}
                            >
                              Delete
                            </Button>
                          </Show>
                        </div>
                      </div>
                    )
                  }}
                </For>
              </Show>
            </div>

            <div style={{ display: "flex", gap: "8px" }}>
              <Button variant="secondary" size="small" onClick={startNewProfile}>
                Add Profile
              </Button>
              {/* canary.11: Connection History */}
              <Button variant="secondary" size="small" onClick={() => requestConnectionHistory(undefined)}>
                Connection History
              </Button>
            </div>

            {/* canary.11: Connection history result */}
            <Show when={connectionHistory().length > 0}>
              <div
                style={{
                  "margin-top": "8px",
                  border: "1px solid var(--vscode-panel-border)",
                  "border-radius": "4px",
                  "max-height": "180px",
                  overflow: "auto",
                }}
              >
                <div
                  style={{
                    padding: "4px 8px",
                    "font-size": "11px",
                    color: "var(--vscode-descriptionForeground)",
                    "border-bottom": "1px solid var(--vscode-panel-border)",
                  }}
                >
                  History {historyProfile() ? `for ${historyProfile()}` : "(all profiles)"} —{" "}
                  {connectionHistory().length} entr{connectionHistory().length === 1 ? "y" : "ies"}
                </div>
                <For each={connectionHistory()}>
                  {(entry) => (
                    <div
                      style={{
                        padding: "4px 10px",
                        "border-bottom": "1px solid var(--vscode-panel-border)",
                        ...monoStyle,
                        "font-size": "11px",
                      }}
                    >
                      <span style={{ color: "var(--vscode-descriptionForeground)" }}>
                        {entry.timestamp ? new Date(entry.timestamp).toLocaleString() : "?"}
                      </span>
                      {" "}
                      {entry.profileName ?? ""} — {entry.status ?? "?"}
                      <Show when={entry.error}>
                        <span style={{ color: "var(--vscode-errorForeground)" }}> &middot; {entry.error}</span>
                      </Show>
                    </div>
                  )}
                </For>
              </div>
            </Show>

            {/* ── Add/Edit Profile Form ── */}
            <Show when={editingProfile()}>
              {(profile) => (
                <div
                  style={{
                    "margin-top": "12px",
                    "padding-top": "12px",
                    "border-top": "1px solid var(--vscode-panel-border)",
                  }}
                >
                  <div style={{ "font-size": "13px", "font-weight": "600", "margin-bottom": "8px" }}>
                    {isNewProfile() ? "New Profile" : `Edit: ${profile().name}`}
                  </div>

                  <SettingsRow title="Profile Name" description="A unique name for this SSH profile">
                    <input
                      type="text"
                      value={profile().name}
                      onInput={(e) => updateEditField("name", e.currentTarget.value)}
                      placeholder="production-server"
                      disabled={!isNewProfile()}
                      style={inputStyle}
                    />
                  </SettingsRow>

                  <SettingsRow title="Host" description="Remote hostname or IP address">
                    <input
                      type="text"
                      value={profile().host}
                      onInput={(e) => updateEditField("host", e.currentTarget.value)}
                      placeholder="192.168.1.100 or myserver.example.com"
                      style={inputStyle}
                    />
                  </SettingsRow>

                  <SettingsRow title="Port" description="SSH port (default: 22)">
                    <input
                      type="number"
                      value={profile().port}
                      onInput={(e) => updateEditField("port", parseInt(e.currentTarget.value) || 22)}
                      min="1"
                      max="65535"
                      style={{ ...inputStyle, width: "100px" }}
                    />
                  </SettingsRow>

                  <SettingsRow title="Username" description="SSH login username">
                    <input
                      type="text"
                      value={profile().user}
                      onInput={(e) => updateEditField("user", e.currentTarget.value)}
                      placeholder="root"
                      style={inputStyle}
                    />
                  </SettingsRow>

                  <SettingsRow title="Auth Mode" description="Authentication method for this connection">
                    <select
                      value={profile().authMode}
                      onChange={(e) => updateEditField("authMode", e.currentTarget.value as AuthMode)}
                      style={inputStyle}
                    >
                      <option value="key">SSH Key</option>
                      <option value="password">Password</option>
                    </select>
                  </SettingsRow>

                  <Show when={profile().authMode === "key"}>
                    <SettingsRow title="Key Path" description="Path to your SSH private key file">
                      <div style={{ display: "flex", gap: "6px", "align-items": "center", width: "100%" }}>
                        <input
                          type="text"
                          value={profile().keyPath}
                          onInput={(e) => updateEditField("keyPath", e.currentTarget.value)}
                          placeholder="~/.ssh/id_rsa"
                          style={inputStyle}
                        />
                        <Button
                          variant="secondary"
                          size="small"
                          onClick={() => requestKeyFingerprint(profile().keyPath)}
                          disabled={!profile().keyPath.trim()}
                        >
                          Fingerprint
                        </Button>
                      </div>
                    </SettingsRow>
                    <Show when={keyFingerprints()[profile().keyPath]}>
                      <div
                        style={{
                          padding: "4px 12px 8px",
                          ...monoStyle,
                          color: "var(--vscode-descriptionForeground)",
                          "word-break": "break-all",
                        }}
                      >
                        {keyFingerprints()[profile().keyPath]}
                      </div>
                    </Show>
                  </Show>

                  <SettingsRow title="Jump Host" description="Optional bastion/jump host (user@host:port)">
                    <input
                      type="text"
                      value={profile().jumpHost}
                      onInput={(e) => updateEditField("jumpHost", e.currentTarget.value)}
                      placeholder="bastion@jump.example.com:22"
                      style={inputStyle}
                    />
                  </SettingsRow>

                  <SettingsRow title="Group" description="Logical group for organizing profiles">
                    <input
                      type="text"
                      value={profile().group}
                      onInput={(e) => updateEditField("group", e.currentTarget.value)}
                      placeholder="production"
                      style={inputStyle}
                    />
                  </SettingsRow>

                  <SettingsRow title="Labels" description="Comma-separated labels for filtering" last>
                    <input
                      type="text"
                      value={labelsInput()}
                      onInput={(e) => setLabelsInput(e.currentTarget.value)}
                      placeholder="web, frontend, us-east"
                      style={inputStyle}
                    />
                  </SettingsRow>

                  <div style={{ display: "flex", gap: "8px", "margin-top": "8px" }}>
                    <Button
                      variant="primary"
                      size="small"
                      onClick={saveProfile}
                      disabled={!profile().name.trim() || !profile().host.trim()}
                    >
                      {isNewProfile() ? "Create Profile" : "Save Changes"}
                    </Button>
                    <Button variant="secondary" size="small" onClick={cancelEdit}>
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </Show>
          </div>
        </Show>
      </Card>

      {/* ═══ SECTION 2: Remote Terminal Sessions ═══ */}
      <Card>
        <div style={sectionHeaderStyle(true)} onClick={() => setTerminalsOpen(!terminalsOpen())}>
          <span style={{ display: "flex", "align-items": "center", gap: "8px" }}>
            {terminalsOpen() ? "\u25BE" : "\u25B8"} Remote Terminal Sessions
          </span>
          <Show when={connectedProfiles().length > 0}>
            <span
              style={{
                "font-size": "11px",
                padding: "1px 6px",
                "border-radius": "8px",
                background: "var(--vscode-badge-background)",
                color: "var(--vscode-badge-foreground)",
              }}
            >
              {connectedProfiles().length} active
            </span>
          </Show>
        </div>
        <Show when={terminalsOpen()}>
          <div style={{ padding: "0 12px 12px" }}>
            <Show
              when={sessions().length > 0}
              fallback={
                <div
                  style={{
                    padding: "16px",
                    "text-align": "center",
                    color: "var(--vscode-descriptionForeground)",
                    "font-size": "13px",
                    border: "1px solid var(--vscode-panel-border)",
                    "border-radius": "4px",
                  }}
                >
                  No active sessions. Connect to an SSH profile to get started.
                </div>
              }
            >
              <div
                style={{
                  border: "1px solid var(--vscode-panel-border)",
                  "border-radius": "4px",
                  overflow: "hidden",
                }}
              >
                <For each={sessions()}>
                  {(session) => {
                    const profile = () => profiles().find((p) => p.name === session.profileName)
                    return (
                      <div style={listItemStyle(false)}>
                        <span style={statusDotStyle(session.status)} title={statusLabel(session.status, session.lastError)} />
                        <div style={{ flex: "1", "min-width": "0" }}>
                          <div style={{ "font-size": "13px", "font-weight": "500" }}>{session.profileName}</div>
                          <div style={{ "font-size": "11px", color: "var(--vscode-descriptionForeground)" }}>
                            <Show when={profile()}>
                              {profile()!.user}@{profile()!.host}:{profile()!.port} &middot;{" "}
                            </Show>
                            {statusLabel(session.status, session.lastError)}
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: "4px", "flex-shrink": "0" }}>
                          <Show when={session.status === "connected"}>
                            <Button
                              variant="secondary"
                              size="small"
                              onClick={() => openTerminal(session.profileName)}
                            >
                              Open Terminal
                            </Button>
                            <Button
                              variant="secondary"
                              size="small"
                              onClick={() => disconnectProfile(session.profileName)}
                            >
                              Disconnect
                            </Button>
                          </Show>
                          <Show when={session.status === "disconnected" || session.status === "error"}>
                            <Button
                              variant="secondary"
                              size="small"
                              onClick={() => reconnectSession(session.profileName)}
                            >
                              Reconnect
                            </Button>
                          </Show>
                        </div>
                      </div>
                    )
                  }}
                </For>
              </div>
            </Show>
          </div>
        </Show>
      </Card>

      {/* ═══ SECTION 3: SFTP File Browser ═══ */}
      <Card>
        <div style={sectionHeaderStyle(true)} onClick={() => setSftpOpen(!sftpOpen())}>
          <span style={{ display: "flex", "align-items": "center", gap: "8px" }}>
            {sftpOpen() ? "\u25BE" : "\u25B8"} SFTP File Browser
          </span>
        </div>
        <Show when={sftpOpen()}>
          <div style={{ padding: "0 12px 12px" }}>
            {/* Profile Selector */}
            <SettingsRow title="Remote Host" description="Select a connected profile to browse files">
              <select
                value={sftpProfile() ?? ""}
                onChange={(e) => {
                  const name = e.currentTarget.value
                  if (name) {
                    setSftpProfile(name)
                    browseFiles(name, "/")
                    setExpandedDirs(new Set<string>())
                  } else {
                    setSftpProfile(null)
                    setSftpEntries([])
                  }
                }}
                style={inputStyle}
              >
                <option value="">-- Select profile --</option>
                <For each={connectedProfileNames()}>
                  {(name) => <option value={name}>{name}</option>}
                </For>
              </select>
            </SettingsRow>

            <Show when={sftpProfile()}>
              {/* Breadcrumb */}
              <div
                style={{
                  display: "flex",
                  "align-items": "center",
                  "flex-wrap": "wrap",
                  gap: "2px",
                  padding: "6px 8px",
                  background: "var(--vscode-textBlockQuote-background)",
                  "border-radius": "4px",
                  "margin-bottom": "8px",
                }}
              >
                <For each={parseBreadcrumb(sftpPath())}>
                  {(crumb, idx) => (
                    <>
                      <Show when={idx() > 0}>
                        <span style={{ color: "var(--vscode-descriptionForeground)", "font-size": "11px" }}>/</span>
                      </Show>
                      <span
                        style={breadcrumbSegmentStyle(crumb.path !== sftpPath())}
                        onClick={() => {
                          if (crumb.path !== sftpPath()) navigateToPath(crumb.path)
                        }}
                      >
                        {crumb.label}
                      </span>
                    </>
                  )}
                </For>
                <Show when={sftpLoading()}>
                  <span style={{ "margin-left": "8px", "font-size": "11px", color: "var(--vscode-descriptionForeground)" }}>
                    Loading...
                  </span>
                </Show>
              </div>

              {/* File Tree */}
              <div
                style={{
                  "max-height": "320px",
                  overflow: "auto",
                  border: "1px solid var(--vscode-panel-border)",
                  "border-radius": "4px",
                  "margin-bottom": "8px",
                }}
              >
                <Show
                  when={sftpEntries().length > 0}
                  fallback={
                    <div
                      style={{
                        padding: "16px",
                        "text-align": "center",
                        color: "var(--vscode-descriptionForeground)",
                        "font-size": "13px",
                      }}
                    >
                      {sftpLoading() ? "Loading directory contents..." : "Empty directory"}
                    </div>
                  }
                >
                  <For each={sftpEntries()}>
                    {(entry) => (
                      <FileEntryRow
                        entry={entry}
                        depth={0}
                        expandedDirs={expandedDirs()}
                        onToggle={toggleDirectory}
                        onOpen={openRemoteFile}
                        onDownload={downloadFile}
                        onPreview={previewFile}
                      />
                    )}
                  </For>
                </Show>
              </div>

              {/* File Preview Panel (Phase 22) */}
              <Show when={previewPath()}>
                <div
                  style={{
                    border: "1px solid var(--vscode-panel-border)",
                    "border-radius": "4px",
                    "margin-bottom": "8px",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      "align-items": "center",
                      "justify-content": "space-between",
                      padding: "6px 8px",
                      background: "var(--vscode-textBlockQuote-background)",
                      "border-bottom": "1px solid var(--vscode-panel-border)",
                      "font-size": "12px",
                    }}
                  >
                    <span style={{ "font-weight": "600" }}>Preview: {previewPath()!.split("/").pop()}</span>
                    <Button variant="secondary" size="small" onClick={closePreview}>
                      Close
                    </Button>
                  </div>
                  <div
                    style={{
                      "max-height": "200px",
                      overflow: "auto",
                      padding: "6px 8px",
                      background: "var(--vscode-editor-background)",
                      ...monoStyle,
                      "white-space": "pre-wrap",
                      "word-break": "break-all",
                    }}
                  >
                    <Show when={!previewLoading()} fallback={<span style={{ color: "var(--vscode-descriptionForeground)" }}>Loading preview...</span>}>
                      {previewContent() ?? ""}
                    </Show>
                  </div>
                </div>
              </Show>

              {/* Upload button */}
              <div style={{ display: "flex", gap: "8px" }}>
                <Button variant="secondary" size="small" onClick={() => navigateToPath(sftpPath())}>
                  Refresh
                </Button>
                <Button variant="secondary" size="small" onClick={uploadFile}>
                  Upload File
                </Button>
              </div>
            </Show>
          </div>
        </Show>
      </Card>

      {/* ═══ SECTION 4: Remote Logs ═══ */}
      <Card>
        <div style={sectionHeaderStyle(true)} onClick={() => setLogsOpen(!logsOpen())}>
          <span style={{ display: "flex", "align-items": "center", gap: "8px" }}>
            {logsOpen() ? "\u25BE" : "\u25B8"} Remote Logs
          </span>
          <Show when={logTailing()}>
            <span
              style={{
                width: "8px",
                height: "8px",
                "border-radius": "50%",
                background: "var(--vscode-testing-iconPassed)",
                animation: "pulse 1.5s infinite",
              }}
              title="Tailing logs"
            />
          </Show>
        </div>
        <Show when={logsOpen()}>
          <div style={{ padding: "0 12px 12px" }}>
            {/* Profile and service selector */}
            <SettingsRow title="Remote Host" description="Select a connected profile to tail logs from">
              <select
                value={logProfile() ?? ""}
                onChange={(e) => {
                  const name = e.currentTarget.value
                  setLogProfile(name || null)
                  if (!name) {
                    setLogLines([])
                    setLogTailing(false)
                  }
                }}
                style={inputStyle}
              >
                <option value="">-- Select profile --</option>
                <For each={connectedProfileNames()}>
                  {(name) => <option value={name}>{name}</option>}
                </For>
              </select>
            </SettingsRow>

            <Show when={logProfile()}>
              <SettingsRow title="Service / Log Path" description="systemd service name, log file path, or journalctl unit">
                <input
                  type="text"
                  value={logService()}
                  onInput={(e) => setLogService(e.currentTarget.value)}
                  placeholder="nginx, /var/log/syslog, docker compose logs"
                  style={inputStyle}
                />
              </SettingsRow>

              <div style={{ display: "flex", gap: "8px", "margin-bottom": "8px" }}>
                <Show
                  when={!logTailing()}
                  fallback={
                    <Button variant="primary" size="small" onClick={stopTailLogs}>
                      Stop Tailing
                    </Button>
                  }
                >
                  <Button variant="primary" size="small" onClick={startTailLogs}>
                    Start Tailing
                  </Button>
                </Show>
                <Button
                  variant="secondary"
                  size="small"
                  onClick={() => setLogLines([])}
                  disabled={logLines().length === 0}
                >
                  Clear
                </Button>
              </div>

              {/* Log output */}
              <div
                ref={logContainerRef}
                style={{
                  height: "280px",
                  overflow: "auto",
                  border: "1px solid var(--vscode-panel-border)",
                  "border-radius": "4px",
                  background: "var(--vscode-editor-background)",
                  padding: "6px 8px",
                  ...monoStyle,
                }}
              >
                <Show
                  when={logLines().length > 0}
                  fallback={
                    <div
                      style={{
                        color: "var(--vscode-descriptionForeground)",
                        padding: "12px",
                        "text-align": "center",
                        "font-size": "12px",
                      }}
                    >
                      {logTailing() ? "Waiting for log output..." : "Click 'Start Tailing' to begin streaming logs."}
                    </div>
                  }
                >
                  <For each={logLines()}>
                    {(line) => (
                      <div
                        style={{
                          "white-space": "pre-wrap",
                          "word-break": "break-all",
                          "line-height": "1.5",
                          "border-bottom": "1px solid var(--vscode-panel-border)",
                          padding: "1px 0",
                        }}
                      >
                        <span style={{ color: "var(--vscode-descriptionForeground)", "margin-right": "8px" }}>
                          {line.timestamp}
                        </span>
                        {line.text}
                      </div>
                    )}
                  </For>
                </Show>
              </div>

              <div
                style={{
                  "margin-top": "4px",
                  "font-size": "11px",
                  color: "var(--vscode-descriptionForeground)",
                  display: "flex",
                  "justify-content": "space-between",
                }}
              >
                <span>{logLines().length} lines</span>
                <Show when={logTailing()}>
                  <span>Live tailing...</span>
                </Show>
              </div>
            </Show>
          </div>
        </Show>
      </Card>

      {/* --- SECTION 5: SSH Error Log (Phase 26) --- */}
      <Card>
        <div style={sectionHeaderStyle(true)} onClick={() => { if (!errorsOpen()) requestErrors(); else setErrorsOpen(false); }}>
          <span style={{ display: "flex", "align-items": "center", gap: "8px" }}>
            {errorsOpen() ? "\u25BE" : "\u25B8"} SSH Error Log
          </span>
          <Show when={sshErrors().length > 0}>
            <span
              style={{
                "font-size": "11px",
                padding: "1px 6px",
                "border-radius": "8px",
                background: "var(--vscode-inputValidation-errorBackground, #5a1d1d)",
                color: "var(--vscode-inputValidation-errorForeground, #f48771)",
              }}
            >
              {sshErrors().length} error{sshErrors().length !== 1 ? "s" : ""}
            </span>
          </Show>
        </div>
        <Show when={errorsOpen()}>
          <div style={{ padding: "0 12px 12px" }}>
            <Show
              when={sshErrors().length > 0}
              fallback={
                <div
                  style={{
                    padding: "16px",
                    "text-align": "center",
                    color: "var(--vscode-descriptionForeground)",
                    "font-size": "13px",
                    border: "1px solid var(--vscode-panel-border)",
                    "border-radius": "4px",
                  }}
                >
                  No SSH errors recorded.
                </div>
              }
            >
              <div
                style={{
                  "max-height": "240px",
                  overflow: "auto",
                  border: "1px solid var(--vscode-panel-border)",
                  "border-radius": "4px",
                  "margin-bottom": "8px",
                }}
              >
                <For each={sshErrors().slice().reverse()}>
                  {(err) => (
                    <div
                      style={{
                        padding: "6px 10px",
                        "border-bottom": "1px solid var(--vscode-panel-border)",
                        "font-size": "12px",
                      }}
                    >
                      <div style={{ display: "flex", "align-items": "center", gap: "6px", "margin-bottom": "2px" }}>
                        <span
                          style={{
                            padding: "0 4px",
                            "border-radius": "3px",
                            background: "var(--vscode-inputValidation-errorBackground, #5a1d1d)",
                            color: "var(--vscode-inputValidation-errorForeground, #f48771)",
                            "font-size": "10px",
                            "font-weight": "600",
                          }}
                        >
                          {err.code}
                        </span>
                        <span style={{ color: "var(--vscode-descriptionForeground)", "font-size": "11px" }}>
                          {err.profileName}
                        </span>
                        <span style={{ color: "var(--vscode-descriptionForeground)", "font-size": "10px", "margin-left": "auto" }}>
                          {new Date(err.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      <div style={{ color: "var(--vscode-foreground)", ...monoStyle, "word-break": "break-all" }}>
                        {err.message}
                      </div>
                    </div>
                  )}
                </For>
              </div>
              <div style={{ display: "flex", gap: "8px" }}>
                <Button variant="secondary" size="small" onClick={requestErrors}>
                  Refresh
                </Button>
                <Button variant="secondary" size="small" onClick={clearErrors}>
                  Clear
                </Button>
              </div>
            </Show>
          </div>
        </Show>
      </Card>

      {/* --- SECTION 6: SSH Keys (canary.11) --- */}
      <Card>
        <div style={sectionHeaderStyle(true)} onClick={() => setKeysOpen(!keysOpen())}>
          <span style={{ display: "flex", "align-items": "center", gap: "8px" }}>
            {keysOpen() ? "▾" : "▸"} Generate SSH Key
          </span>
        </div>
        <Show when={keysOpen()}>
          <div style={{ padding: "0 12px 12px" }}>
            <SettingsRow
              title="Key Name"
              description="Creates ~/.ssh/id_ed25519_<name> (no passphrase). Use a short identifier."
            >
              <input
                type="text"
                value={keyGenName()}
                onInput={(e) => setKeyGenName(e.currentTarget.value)}
                placeholder="prod, github, deploy-key"
                style={inputStyle}
                disabled={keyGenBusy()}
              />
            </SettingsRow>
            <div style={{ display: "flex", gap: "8px" }}>
              <Button
                variant="primary"
                size="small"
                onClick={generateKey}
                disabled={keyGenBusy() || !keyGenName().trim()}
              >
                {keyGenBusy() ? "Generating..." : "Generate ed25519 Key"}
              </Button>
            </div>

            <Show when={keyGenResult()}>
              {(result) => (
                <div
                  style={{
                    "margin-top": "12px",
                    "padding-top": "12px",
                    "border-top": "1px solid var(--vscode-panel-border)",
                  }}
                >
                  <Show
                    when={result().ok}
                    fallback={
                      <div
                        style={{
                          padding: "8px 10px",
                          background: "var(--vscode-inputValidation-errorBackground, #5a1d1d)",
                          color: "var(--vscode-inputValidation-errorForeground, #f48771)",
                          "border-radius": "3px",
                          "font-size": "12px",
                        }}
                      >
                        {result().error ?? "Key generation failed"}
                      </div>
                    }
                  >
                    <div style={{ "font-size": "12px", color: "var(--vscode-descriptionForeground)", "margin-bottom": "4px" }}>
                      Created: <span style={monoStyle}>{result().privatePath}</span>
                    </div>
                    <div
                      style={{
                        padding: "6px 8px",
                        background: "var(--vscode-textBlockQuote-background)",
                        border: "1px solid var(--vscode-panel-border)",
                        "border-radius": "3px",
                        ...monoStyle,
                        "white-space": "pre-wrap",
                        "word-break": "break-all",
                      }}
                    >
                      {result().publicKey}
                    </div>
                    <div style={{ display: "flex", gap: "8px", "margin-top": "6px" }}>
                      <Button variant="secondary" size="small" onClick={copyPublicKey}>
                        {keyGenCopied() ? "Copied!" : "Copy Public Key"}
                      </Button>
                    </div>
                  </Show>
                </div>
              )}
            </Show>
          </div>
        </Show>
      </Card>

      {/* --- SECTION 7: Known Hosts (canary.11) --- */}
      <Card>
        <div
          style={sectionHeaderStyle(true)}
          onClick={() => {
            const next = !knownHostsOpen()
            setKnownHostsOpen(next)
            if (next && !knownHostsLoaded()) refreshKnownHosts()
          }}
        >
          <span style={{ display: "flex", "align-items": "center", gap: "8px" }}>
            {knownHostsOpen() ? "▾" : "▸"} Known Hosts
          </span>
          <Show when={knownHostsLoaded()}>
            <span style={{ "font-size": "12px", color: "var(--vscode-descriptionForeground)", "font-weight": "400" }}>
              {knownHosts().length} host{knownHosts().length !== 1 ? "s" : ""}
            </span>
          </Show>
        </div>
        <Show when={knownHostsOpen()}>
          <div style={{ padding: "0 12px 12px" }}>
            <Show when={knownHostsError()}>
              <div
                style={{
                  padding: "6px 10px",
                  "margin-bottom": "8px",
                  background: "var(--vscode-inputValidation-errorBackground, #5a1d1d)",
                  color: "var(--vscode-inputValidation-errorForeground, #f48771)",
                  "border-radius": "3px",
                  "font-size": "12px",
                }}
              >
                {knownHostsError()}
              </div>
            </Show>
            <div
              style={{
                border: "1px solid var(--vscode-panel-border)",
                "border-radius": "4px",
                "max-height": "300px",
                overflow: "auto",
                "margin-bottom": "8px",
              }}
            >
              <Show
                when={knownHosts().length > 0}
                fallback={
                  <div
                    style={{
                      padding: "16px",
                      "text-align": "center",
                      color: "var(--vscode-descriptionForeground)",
                      "font-size": "13px",
                    }}
                  >
                    {knownHostsLoaded() ? "No known hosts. Connect to a server to populate." : "Loading..."}
                  </div>
                }
              >
                <For each={knownHosts()}>
                  {(entry) => (
                    <div
                      style={{
                        display: "flex",
                        "align-items": "center",
                        gap: "8px",
                        padding: "6px 10px",
                        "border-bottom": "1px solid var(--vscode-panel-border)",
                        "font-size": "12px",
                      }}
                    >
                      <div style={{ flex: "1", "min-width": "0" }}>
                        <div style={{ "font-weight": "500", "white-space": "nowrap", overflow: "hidden", "text-overflow": "ellipsis" }}>
                          {entry.host}
                        </div>
                        <div style={{ color: "var(--vscode-descriptionForeground)", ...monoStyle }}>
                          {entry.keyType} &middot; {entry.fingerprint}
                        </div>
                      </div>
                      <Button variant="secondary" size="small" onClick={() => removeKnownHost(entry.host)}>
                        Remove
                      </Button>
                    </div>
                  )}
                </For>
              </Show>
            </div>
            <div style={{ display: "flex", gap: "8px" }}>
              <Button variant="secondary" size="small" onClick={refreshKnownHosts}>
                Refresh
              </Button>
            </div>
          </div>
        </Show>
      </Card>
    </div>
  )
}

// ─── File Entry Sub-Component ────────────────────────────

interface FileEntryRowProps {
  entry: RemoteFileEntry
  depth: number
  expandedDirs: Set<string>
  onToggle: (entry: RemoteFileEntry) => void
  onOpen: (entry: RemoteFileEntry) => void
  onDownload: (entry: RemoteFileEntry) => void
  onPreview: (entry: RemoteFileEntry) => void
}

const FileEntryRow: Component<FileEntryRowProps> = (props) => {
  const isExpanded = () => props.expandedDirs.has(props.entry.path)

  return (
    <>
      <div
        style={{
          display: "flex",
          "align-items": "center",
          padding: "4px 8px",
          "padding-left": `${8 + props.depth * 16}px`,
          gap: "6px",
          cursor: "pointer",
          "border-bottom": "1px solid var(--vscode-panel-border)",
          "font-size": "13px",
        }}
        onClick={() => {
          if (props.entry.isDirectory) {
            props.onToggle(props.entry)
          } else {
            props.onOpen(props.entry)
          }
        }}
        onDblClick={() => {
          if (!props.entry.isDirectory) props.onOpen(props.entry)
        }}
      >
        {/* Icon */}
        <span style={{ "flex-shrink": "0", "font-size": "12px", width: "14px", "text-align": "center" }}>
          {props.entry.isDirectory ? (isExpanded() ? "\u25BE" : "\u25B8") : "\u2501"}
        </span>
        {/* Name */}
        <span
          style={{
            flex: "1",
            "white-space": "nowrap",
            overflow: "hidden",
            "text-overflow": "ellipsis",
            color: props.entry.isDirectory ? "var(--vscode-textLink-foreground)" : "var(--vscode-foreground)",
          }}
          title={props.entry.path}
        >
          {props.entry.name}
          <Show when={props.entry.isDirectory}>
            <span style={{ color: "var(--vscode-descriptionForeground)" }}>/</span>
          </Show>
        </span>
        {/* Actions */}
        <Show when={!props.entry.isDirectory}>
          <div style={{ display: "flex", gap: "4px", "flex-shrink": "0" }}>
            <Button
              variant="secondary"
              size="small"
              onClick={(e: MouseEvent) => {
                e.stopPropagation()
                props.onPreview(props.entry)
              }}
            >
              Preview
            </Button>
            <Button
              variant="secondary"
              size="small"
              onClick={(e: MouseEvent) => {
                e.stopPropagation()
                props.onOpen(props.entry)
              }}
            >
              Open
            </Button>
            <Button
              variant="secondary"
              size="small"
              onClick={(e: MouseEvent) => {
                e.stopPropagation()
                props.onDownload(props.entry)
              }}
            >
              Download
            </Button>
          </div>
        </Show>
      </div>
      {/* Recursive children */}
      <Show when={props.entry.isDirectory && isExpanded() && props.entry.children}>
        <For each={props.entry.children}>
          {(child) => (
            <FileEntryRow
              entry={child}
              depth={props.depth + 1}
              expandedDirs={props.expandedDirs}
              onToggle={props.onToggle}
              onOpen={props.onOpen}
              onDownload={props.onDownload}
              onPreview={props.onPreview}
            />
          )}
        </For>
      </Show>
    </>
  )
}

export default SSHTab
