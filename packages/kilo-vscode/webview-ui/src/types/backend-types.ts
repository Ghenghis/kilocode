// ─── Backend Types ──────────────────────────────────────────────────────────

export type BackendId = 'kilo-native' | 'openhands' | 'goose'

export type Capability =
  | 'code_edit'
  | 'repo_refactor'
  | 'shell'
  | 'tests'
  | 'browser_sandbox'
  | 'computer_use'
  | 'ssh'
  | 'vps'
  | 'remote_gpu'
  | 'file_ops'
  | 'web_search'
  | 'mcp_tools'
  | 'approval_required'
  | 'sandbox_required'
  | 'checkpoint_required'

export type AccessProfileType =
  | 'local-repo'
  | 'local-docker'
  | 'vps-ssh'
  | 'remote-gpu'
  | 'browser-automation'
  | 'computer-use'
  | 'custom'

export interface AccessProfile {
  id: string
  name: string
  type: AccessProfileType
  description: string
  // Connection
  providerName?: string
  host?: string
  port?: number
  user?: string
  sshKeyPath?: string
  baseUrl?: string
  // Credentials (env var names only — no raw secrets)
  credentialEnvVars: string[]
  // Security
  allowedCommands: string[]
  blockedCommands: string[]
  sandboxMode: 'none' | 'docker' | 'zeroclaw' | 'readonly'
  requireApproval: boolean
  yoloMode: boolean
  // Limits
  budgetUsd?: number
  timeoutMs?: number
  // Artifacts
  artifactOutputPath?: string
  transcriptLogPath?: string
  checkpointBeforeRun: boolean
  rollbackOnFailure: boolean
  // Metadata
  createdAt: number
  updatedAt: number
}

export interface BackendConfig {
  id: BackendId
  enabled: boolean
  displayName: string
  description: string
  icon: string  // emoji or icon name
  capabilities: Capability[]
  // Per-backend settings
  openhandsServerUrl?: string
  openhandsRuntime?: 'docker' | 'remote' | 'modal'
  openhandsSandbox?: boolean
  openhandsLlmProvider?: string
  openhandsLlmModel?: string
  gooseCliPath?: string
  gooseApiPort?: number
  gooseComputerUse?: boolean
  gooseProfile?: string
  gooseMcpExtensions?: string[]
  // Active profile
  activeProfileId?: string
  // NOTE: BackendConfig intentionally has NO voice/TTS fields.
  // All backend text output is piped through the voice bridge (voice-bridge.ts)
  // Voice profile is NOT part of BackendConfig — it lives in SpeechTab's store.
}

export interface BackendState {
  activeBackend: BackendId
  backends: BackendConfig[]
  profiles: AccessProfile[]
  isRunning: boolean
  currentTaskId?: string
  routingMode: 'manual' | 'auto-hermes'
  // NOTE: BackendState intentionally has NO voice/TTS fields.
  // Voice state is managed exclusively by SpeechTab + speech service.
  // Switching backends does NOT reset, modify, or re-initialize voice settings.
}

// Default backends
export const DEFAULT_BACKENDS: BackendConfig[] = [
  {
    id: 'kilo-native',
    enabled: true,
    displayName: 'Kilo Native',
    description: 'Built-in KiloCode assistant — normal coding inside VS Code',
    icon: '⚡',
    capabilities: ['code_edit', 'repo_refactor', 'file_ops', 'web_search'],
  },
  {
    id: 'openhands',
    enabled: true,
    displayName: 'OpenHands Dev',
    description: 'Full developer runtime — code, shell, tests, browser (sandboxed)',
    icon: '🤖',
    capabilities: ['code_edit', 'repo_refactor', 'shell', 'tests', 'browser_sandbox', 'file_ops', 'sandbox_required'],
    openhandsServerUrl: 'http://localhost:3000',
    openhandsRuntime: 'docker',
    openhandsSandbox: true,
  },
  {
    id: 'goose',
    enabled: true,
    displayName: 'Goose Operator',
    description: 'Computer operator — desktop control, GUI automation, MCP tools',
    icon: '🪿',
    capabilities: ['computer_use', 'shell', 'mcp_tools', 'file_ops', 'browser_sandbox', 'approval_required'],
    gooseCliPath: 'goose',
    gooseApiPort: 3001,
    gooseComputerUse: true,
  },
]

export const DEFAULT_PROFILES: AccessProfile[] = [
  {
    id: 'local-repo-default',
    name: 'Local Repository',
    type: 'local-repo',
    description: 'Access to local project files only',
    credentialEnvVars: [],
    allowedCommands: ['git', 'npm', 'node', 'bun', 'python', 'pip'],
    blockedCommands: ['rm -rf', 'curl', 'wget', 'nc'],
    sandboxMode: 'none',
    requireApproval: false,
    yoloMode: false,
    checkpointBeforeRun: false,
    rollbackOnFailure: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: 'docker-sandbox-default',
    name: 'Docker Sandbox',
    type: 'local-docker',
    description: 'Isolated Docker container — safe for risky operations',
    credentialEnvVars: [],
    allowedCommands: ['*'],
    blockedCommands: [],
    sandboxMode: 'docker',
    requireApproval: false,
    yoloMode: false,
    checkpointBeforeRun: true,
    rollbackOnFailure: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: 'vps-ssh-template',
    name: 'VPS / SSH (Template)',
    type: 'vps-ssh',
    description: 'Remote VPS via SSH — customize host, user, key',
    host: 'your-vps.example.com',
    port: 22,
    user: 'ubuntu',
    sshKeyPath: '~/.ssh/id_ed25519',
    credentialEnvVars: ['VPS_HOST', 'VPS_USER', 'SSH_KEY'],
    allowedCommands: ['ls', 'cat', 'git', 'docker', 'systemctl', 'journalctl'],
    blockedCommands: ['rm -rf /', 'mkfs', 'dd'],
    sandboxMode: 'zeroclaw',
    requireApproval: true,
    yoloMode: false,
    budgetUsd: 5,
    timeoutMs: 300000,
    checkpointBeforeRun: true,
    rollbackOnFailure: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
]
