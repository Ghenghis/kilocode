/**
 * OpenClawTab — Production-quality settings tab for the OpenClaw local AI gateway.
 *
 * OpenClaw — "Your own personal AI assistant. Any OS. Any Platform. The lobster way. 🦞"
 * Routes messages from 20+ platforms (WhatsApp, Telegram, Discord, Slack, Signal, iMessage,
 * Google Chat, Matrix, IRC, Teams, LINE, Twitch, WeChat, and more) to local AI models.
 *
 * Default gateway: http://localhost:18789
 * WebChat UI:      http://localhost:18789/webchat
 * Config:          ~/.openclaw/openclaw.json
 * Workspace:       ~/.openclaw/workspace
 * Setup:           openclaw onboard --install-daemon
 * Project:         https://github.com/Ghenghis/openclaw
 * Version:         2026.4.27
 */

import { Component, createSignal, For, Show, createMemo, createEffect, onMount, onCleanup } from "solid-js"
import { useVSCode } from "../../context/vscode"
import { fetchLivePricing, formatPrice, type ModelPricing, FALLBACK_PRICING } from "../../utils/pricing-service"
import { subscribeToMessages, postMessageDebounced } from "../../lib/message-bus"

// ── Types ─────────────────────────────────────────────────────────────────────

interface OpenClawStatus {
  connected: boolean
  gatewayUrl: string
  version?: string
  latency_ms?: number
  error?: string
  uptime_s?: number
  activeChannels: number
  totalMessagesToday: number
}

interface OpenClawChannel {
  id: string
  name: string
  type: "telegram" | "discord" | "slack" | "whatsapp" | "signal" | "imessage" | "webchat" | "webhook" | "googlechat" | "bluebubbles" | "irc" | "teams" | "matrix" | "feishu" | "line" | "mattermost" | "twitch" | "wechat" | "qq" | "nostr" | "zalo"
  enabled: boolean
  status: "active" | "idle" | "error" | "unconfigured"
  token?: string
  webhookUrl?: string
  messagesHandled: number
  assignedModel: string
  assignedAgent: string
  lastMessageAt?: number
}

interface OpenClawModel {
  id: string
  name: string
  provider: "ollama" | "lmstudio" | "openai" | "anthropic" | "custom"
  baseUrl: string
  available: boolean
  latency_ms?: number
  contextLength: number
  capabilities: string[]
}

interface OpenClawRoutingRule {
  id: string
  name: string
  pattern: string
  action: "route_to_agent" | "respond_direct" | "ignore" | "forward"
  targetAgent?: string
  targetChannel?: string
  priority: number
  enabled: boolean
}

interface OpenClawAgent {
  id: string
  name: string
  model: string
  systemPrompt: string
  channels: string[]
  status: "running" | "idle" | "error"
  messagesProcessed: number
  avgResponseMs: number
  errorCount: number
}

interface MessageLogEntry {
  id: string
  timestamp: number
  channel: string
  direction: "in" | "out"
  preview: string
  model: string
  latency_ms: number
  tokens?: number
  status: "ok" | "error"
}

// ── New Feature Types ─────────────────────────────────────────────────────────

interface WebhookEvent {
  id: string
  timestamp: number
  platform: string
  channel: string
  preview: string
  processingMs: number
  model: string
  status: "sent" | "retry" | "failed"
}

interface ChannelPerfRow {
  channelId: string
  channelName: string
  avgResponseMs: number
  satisfactionPct: number
  model: string
  costPerDay: number
}

// ── Seed / Mock Data ───────────────────────────────────────────────────────────

const DEFAULT_CHANNELS: OpenClawChannel[] = [
  // Tier 1 — most popular
  { id: "webchat", name: "WebChat UI", type: "webchat", enabled: true, status: "active", messagesHandled: 1203, assignedModel: "ollama/llama3:8b", assignedAgent: "agent-1", webhookUrl: "http://localhost:18789/webchat", lastMessageAt: Date.now() - 120000 },
  { id: "telegram", name: "Telegram", type: "telegram", enabled: false, status: "unconfigured", messagesHandled: 0, assignedModel: "ollama/llama3:8b", assignedAgent: "agent-1" },
  { id: "discord", name: "Discord", type: "discord", enabled: false, status: "unconfigured", messagesHandled: 247, assignedModel: "ollama/mistral:7b", assignedAgent: "agent-2" },
  { id: "slack", name: "Slack", type: "slack", enabled: false, status: "unconfigured", messagesHandled: 0, assignedModel: "ollama/phi3:mini", assignedAgent: "agent-3" },
  { id: "whatsapp", name: "WhatsApp", type: "whatsapp", enabled: false, status: "unconfigured", messagesHandled: 0, assignedModel: "ollama/llama3:8b", assignedAgent: "agent-1" },
  { id: "signal", name: "Signal", type: "signal", enabled: false, status: "unconfigured", messagesHandled: 0, assignedModel: "ollama/phi3:mini", assignedAgent: "agent-1" },
  // Tier 2 — widely used
  { id: "googlechat", name: "Google Chat", type: "googlechat", enabled: false, status: "unconfigured", messagesHandled: 0, assignedModel: "ollama/llama3:8b", assignedAgent: "agent-1" },
  { id: "imessage", name: "iMessage", type: "imessage", enabled: false, status: "unconfigured", messagesHandled: 0, assignedModel: "ollama/llama3:8b", assignedAgent: "agent-1" },
  { id: "bluebubbles", name: "BlueBubbles", type: "bluebubbles", enabled: false, status: "unconfigured", messagesHandled: 0, assignedModel: "ollama/llama3:8b", assignedAgent: "agent-1" },
  { id: "teams", name: "Microsoft Teams", type: "teams", enabled: false, status: "unconfigured", messagesHandled: 0, assignedModel: "ollama/mistral:7b", assignedAgent: "agent-2" },
  { id: "matrix", name: "Matrix", type: "matrix", enabled: false, status: "unconfigured", messagesHandled: 0, assignedModel: "ollama/phi3:mini", assignedAgent: "agent-1" },
  { id: "irc", name: "IRC", type: "irc", enabled: false, status: "unconfigured", messagesHandled: 0, assignedModel: "ollama/phi3:mini", assignedAgent: "agent-3" },
  // Tier 3 — regional / niche
  { id: "line", name: "LINE", type: "line", enabled: false, status: "unconfigured", messagesHandled: 0, assignedModel: "ollama/llama3:8b", assignedAgent: "agent-1" },
  { id: "wechat", name: "WeChat", type: "wechat", enabled: false, status: "unconfigured", messagesHandled: 0, assignedModel: "ollama/llama3:8b", assignedAgent: "agent-1" },
  { id: "qq", name: "QQ", type: "qq", enabled: false, status: "unconfigured", messagesHandled: 0, assignedModel: "ollama/llama3:8b", assignedAgent: "agent-1" },
  { id: "feishu", name: "Feishu / Lark", type: "feishu", enabled: false, status: "unconfigured", messagesHandled: 0, assignedModel: "ollama/llama3:8b", assignedAgent: "agent-1" },
  { id: "mattermost", name: "Mattermost", type: "mattermost", enabled: false, status: "unconfigured", messagesHandled: 0, assignedModel: "ollama/mistral:7b", assignedAgent: "agent-2" },
  { id: "twitch", name: "Twitch", type: "twitch", enabled: false, status: "unconfigured", messagesHandled: 0, assignedModel: "ollama/phi3:mini", assignedAgent: "agent-3" },
  { id: "nostr", name: "Nostr", type: "nostr", enabled: false, status: "unconfigured", messagesHandled: 0, assignedModel: "ollama/phi3:mini", assignedAgent: "agent-1" },
  { id: "zalo", name: "Zalo", type: "zalo", enabled: false, status: "unconfigured", messagesHandled: 0, assignedModel: "ollama/llama3:8b", assignedAgent: "agent-1" },
]

// OpenClaw model IDs use the format "<provider>/<model-id>" (e.g. "ollama/llama3:8b")
const DEFAULT_MODELS: OpenClawModel[] = [
  { id: "ollama/llama3:8b", name: "Llama 3 8B (Ollama)", provider: "ollama", baseUrl: "http://localhost:11434", available: false, contextLength: 8192, capabilities: ["chat", "code"] },
  { id: "ollama/mistral:7b", name: "Mistral 7B (Ollama)", provider: "ollama", baseUrl: "http://localhost:11434", available: false, contextLength: 8192, capabilities: ["chat"] },
  { id: "ollama/phi3:mini", name: "Phi-3 Mini (Ollama)", provider: "ollama", baseUrl: "http://localhost:11434", available: false, contextLength: 4096, capabilities: ["chat", "fast"] },
  { id: "lmstudio/local", name: "LM Studio (local)", provider: "lmstudio", baseUrl: "http://localhost:1234", available: false, contextLength: 4096, capabilities: ["chat", "code"] },
  { id: "openai/gpt-4o", name: "GPT-4o (OpenAI)", provider: "openai", baseUrl: "https://api.openai.com", available: false, contextLength: 128000, capabilities: ["chat", "code", "vision"] },
  { id: "anthropic/claude-sonnet-4-5", name: "Claude Sonnet 4.5 (Anthropic)", provider: "anthropic", baseUrl: "https://api.anthropic.com", available: false, contextLength: 200000, capabilities: ["chat", "code", "vision"] },
]

const DEFAULT_AGENTS: OpenClawAgent[] = [
  { id: "agent-1", name: "General Assistant", model: "ollama/llama3:8b", systemPrompt: "You are a helpful assistant.", channels: ["telegram", "whatsapp", "signal", "webchat"], status: "idle", messagesProcessed: 1203, avgResponseMs: 842, errorCount: 0 },
  { id: "agent-2", name: "Code Helper", model: "ollama/mistral:7b", systemPrompt: "You are a coding assistant specializing in debugging.", channels: ["discord"], status: "idle", messagesProcessed: 247, avgResponseMs: 1204, errorCount: 3 },
  { id: "agent-3", name: "Quick Responder", model: "ollama/phi3:mini", systemPrompt: "You give brief, actionable responses.", channels: ["slack"], status: "idle", messagesProcessed: 0, avgResponseMs: 0, errorCount: 0 },
]

const DEFAULT_ROUTING_RULES: OpenClawRoutingRule[] = [
  { id: "r1", name: "Code Questions", pattern: "^(fix|debug|code|error|bug)", action: "route_to_agent", targetAgent: "agent-2", priority: 1, enabled: true },
  { id: "r2", name: "Quick Q&A", pattern: "^(what|who|when|where|how much)", action: "route_to_agent", targetAgent: "agent-3", priority: 2, enabled: true },
  { id: "r3", name: "Default", pattern: ".*", action: "route_to_agent", targetAgent: "agent-1", priority: 99, enabled: true },
]

const DEFAULT_LOG: MessageLogEntry[] = [
  { id: "m1", timestamp: Date.now() - 120000, channel: "webchat", direction: "in", preview: "How do I center a div in CSS?", model: "llama3:8b", latency_ms: 734, tokens: 89, status: "ok" },
  { id: "m2", timestamp: Date.now() - 119000, channel: "webchat", direction: "out", preview: "Use flexbox: display:flex; justify-content:center...", model: "llama3:8b", latency_ms: 734, tokens: 312, status: "ok" },
  { id: "m3", timestamp: Date.now() - 3600000, channel: "discord", direction: "in", preview: "Debug this Python script for me", model: "mistral:7b", latency_ms: 1847, tokens: 156, status: "ok" },
]

// ── Heatmap seed (7 days × 24 hours realistic usage) ─────────────────────────
// Row 0 = 7 days ago, Row 6 = today. Col = hour 0–23.
// Pattern: weekdays busy, weekends quiet; peaks 9am, 14pm, 19pm.
const _peakHours = [9, 14, 19]
const _weekdayBoost = [0, 1, 1, 1, 1, 1, 0] // Sun…Sat
const _makeHeatmapForChannel = (baseLoad: number): number[][] => {
  const today = new Date()
  return Array.from({ length: 7 }, (_, dayIdx) => {
    const d = new Date(today)
    d.setDate(today.getDate() - (6 - dayIdx))
    const dow = d.getDay() // 0=Sun
    const wkBoost = _weekdayBoost[dow]
    return Array.from({ length: 24 }, (_, h) => {
      const isPeak = _peakHours.some((p) => Math.abs(h - p) <= 1)
      const raw = baseLoad * (wkBoost ? 1 : 0.2) * (isPeak ? 1 : 0.15) * (0.7 + Math.sin(dayIdx * 1.3 + h) * 0.3)
      return Math.max(0, Math.round(raw))
    })
  })
}

const HEATMAP_DATA: Record<string, number[][]> = {
  webchat: _makeHeatmapForChannel(120),
  telegram: _makeHeatmapForChannel(80),
  discord: _makeHeatmapForChannel(55),
  slack: _makeHeatmapForChannel(40),
  whatsapp: _makeHeatmapForChannel(30),
}

// ── Webhook event seed ────────────────────────────────────────────────────────
const _platforms = ["telegram", "discord", "slack", "whatsapp", "webchat", "signal", "teams", "matrix"]
const _sampleMessages = [
  "How do I fix this TypeScript error?",
  "What's the weather like today?",
  "Can you summarize this document?",
  "Debug my Python script please",
  "Tell me a joke",
  "Translate this to Spanish",
  "What's 42 * 13?",
  "Write a unit test for this function",
  "Explain async/await in simple terms",
  "What is the capital of France?",
]
const _sampleModels = ["llama3:8b", "mistral:7b", "phi3:mini", "gpt-4o", "claude-sonnet-4-5"]
const _sampleStatuses: WebhookEvent["status"][] = ["sent", "sent", "sent", "sent", "retry", "failed"]
const _genWebhookEvents = (): WebhookEvent[] =>
  Array.from({ length: 20 }, (_, i) => ({
    id: `we${i}`,
    timestamp: Date.now() - (20 - i) * 18000 - Math.floor(Math.random() * 5000),
    platform: _platforms[i % _platforms.length],
    channel: _platforms[i % _platforms.length],
    preview: _sampleMessages[i % _sampleMessages.length],
    processingMs: 200 + Math.floor(Math.sin(i * 1.7) * 400 + 400),
    model: _sampleModels[i % _sampleModels.length],
    status: _sampleStatuses[i % _sampleStatuses.length],
  }))

// ── Channel performance seed ──────────────────────────────────────────────────
const CHANNEL_PERF_SEED: ChannelPerfRow[] = [
  { channelId: "webchat", channelName: "WebChat UI", avgResponseMs: 734, satisfactionPct: 94, model: "llama3:8b", costPerDay: 0.0 },
  { channelId: "discord", channelName: "Discord", avgResponseMs: 1204, satisfactionPct: 78, model: "mistral:7b", costPerDay: 0.0 },
  { channelId: "telegram", channelName: "Telegram", avgResponseMs: 892, satisfactionPct: 88, model: "llama3:8b", costPerDay: 0.0 },
  { channelId: "slack", channelName: "Slack", avgResponseMs: 2100, satisfactionPct: 61, model: "phi3:mini", costPerDay: 0.0 },
  { channelId: "whatsapp", channelName: "WhatsApp", avgResponseMs: 1050, satisfactionPct: 82, model: "llama3:8b", costPerDay: 0.0 },
]

// ── Flow Visualizer node layout ───────────────────────────────────────────────
const FLOW_LEFT_CHANNELS = ["webchat","telegram","discord","slack","whatsapp","signal","googlechat","teams","matrix","irc","line","wechat","qq","feishu","mattermost","twitch","nostr","zalo","bluebubbles","imessage"]
const FLOW_RIGHT_MODELS = ["llama3:8b","mistral:7b","phi3:mini","gpt-4o","claude-sonnet-4-5","lmstudio/local"]

// ── Helpers ────────────────────────────────────────────────────────────────────

const statusColor = (s: string) =>
  s === "active" || s === "connected" || s === "running" || s === "ok"
    ? "var(--vscode-testing-iconPassed)"
    : s === "idle" || s === "connecting" || s === "unconfigured"
    ? "var(--vscode-testing-iconQueued)"
    : "var(--vscode-testing-iconFailed)"

const statusBadgeBg = (s: string) =>
  s === "active" || s === "connected" || s === "running" || s === "ok"
    ? "rgba(35,134,54,0.18)"
    : s === "idle" || s === "connecting" || s === "unconfigured"
    ? "rgba(210,153,34,0.18)"
    : "rgba(248,81,73,0.18)"

const providerColor = (p: string) => {
  switch (p) {
    case "ollama": return "#4a9eff"
    case "lmstudio": return "#9b59b6"
    case "openai": return "#10a37f"
    case "anthropic": return "#cc785c"
    default: return "var(--vscode-descriptionForeground)"
  }
}

const formatUptime = (s: number) => {
  if (s < 60) return `${s}s`
  if (s < 3600) return `${Math.floor(s / 60)}m ${s % 60}s`
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  return `${h}h ${m}m`
}

const formatTime = (ts: number) => {
  const diff = Date.now() - ts
  if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
  return `${Math.floor(diff / 3600000)}h ago`
}

const inputStyle = {
  background: "var(--vscode-input-background)",
  color: "var(--vscode-input-foreground)",
  border: "1px solid var(--vscode-input-border, #555)",
  "border-radius": "3px",
  padding: "5px 8px",
  "font-size": "12px",
  outline: "none",
  width: "100%",
  "box-sizing": "border-box" as "border-box",
}

const btnPrimary = {
  background: "var(--vscode-button-background)",
  color: "var(--vscode-button-foreground)",
  border: "1px solid var(--vscode-button-border, transparent)",
  padding: "4px 10px",
  "border-radius": "3px",
  cursor: "pointer",
  "font-size": "12px",
  "font-weight": "600",
}

const btnSecondary = {
  background: "var(--vscode-button-secondaryBackground)",
  color: "var(--vscode-button-secondaryForeground)",
  border: "1px solid var(--vscode-button-border, transparent)",
  padding: "4px 10px",
  "border-radius": "3px",
  cursor: "pointer",
  "font-size": "12px",
}

const btnGhost = {
  background: "transparent",
  color: "var(--vscode-textLink-foreground)",
  border: "none",
  cursor: "pointer",
  "font-size": "11px",
  padding: "0",
}

const cardStyle = {
  background: "var(--vscode-editor-inactiveSelectionBackground)",
  "border-radius": "6px",
  padding: "0.8rem",
  border: "1px solid var(--vscode-panel-border)",
}

const sectionWrapStyle = {
  border: "1px solid var(--vscode-panel-border)",
  "border-radius": "6px",
  "margin-bottom": "1rem",
  overflow: "hidden",
}

// Used for table/list bodies that are direct children of sectionWrapStyle sections
// (no own border — the outer section provides it)
const sectionBodyTableStyle = {
  padding: "0",
  overflow: "hidden",
  background: "var(--vscode-editor-background)",
}

// ── Section Header Component ───────────────────────────────────────────────────

const SectionHeader = (props: {
  title: string
  open: boolean
  onToggle: () => void
  count?: number
  action?: { label: string; onClick: () => void }
}) => (
  <div
    style={{
      display: "flex",
      "align-items": "center",
      "justify-content": "space-between",
      cursor: "pointer",
      "user-select": "none",
      padding: "8px 12px",
      background: "var(--vscode-editor-inactiveSelectionBackground)",
      "border-bottom": props.open ? "1px solid var(--vscode-panel-border)" : "none",
    }}
    onClick={props.onToggle}
    aria-label={`${props.open ? "Collapse" : "Expand"} ${props.title}`}
    role="button"
  >
    <span style={{ "font-size": "12px", "font-weight": "700", color: "var(--vscode-foreground)" }}>
      {props.open ? "▼" : "▶"} {props.title}
      {props.count !== undefined && (
        <span style={{ "font-size": "11px", "font-weight": "400", color: "var(--vscode-descriptionForeground)", "margin-left": "6px" }}>
          ({props.count})
        </span>
      )}
    </span>
    {props.action && (
      <button
        onClick={(e) => { e.stopPropagation(); props.action!.onClick() }}
        style={{ ...btnGhost, "border-radius": "3px" }}
        aria-label={props.action.label}
      >
        {props.action.label}
      </button>
    )}
  </div>
)

// ── Status Dot ─────────────────────────────────────────────────────────────────

const Dot = (props: { status: string; size?: number }) => (
  <span
    aria-hidden="true"
    title={props.status}
    style={{
      display: "inline-block",
      width: `${props.size ?? 8}px`,
      height: `${props.size ?? 8}px`,
      "border-radius": "50%",
      background: statusColor(props.status),
      "flex-shrink": "0",
    }}
  />
)

// ── Badge ──────────────────────────────────────────────────────────────────────

const Badge = (props: { label: string; status?: string; color?: string; bg?: string }) => (
  <span style={{
    display: "inline-block",
    "font-size": "10px",
    "font-weight": "700",
    "text-transform": "uppercase",
    color: props.color ?? statusColor(props.status ?? "idle"),
    padding: "2px 7px",
    "border-radius": "8px",
    background: props.bg ?? statusBadgeBg(props.status ?? "idle"),
    "white-space": "nowrap",
    "flex-shrink": "0",
  }}>
    {props.label}
  </span>
)

// ── Main Component ─────────────────────────────────────────────────────────────

const OpenClawTab: Component = () => {
  const vscode = useVSCode()

  // ── Gateway state ──────────────────────────────────────────────────────────
  const [urlInput, setUrlInput] = createSignal("http://localhost:18789")
  const [connecting, setConnecting] = createSignal(false)
  const [status, setStatus] = createSignal<OpenClawStatus | null>(null)
  const urlPresets = ["http://localhost:18789", "http://localhost:8080", "http://localhost:3000"]

  // ── Channel state ──────────────────────────────────────────────────────────
  const [channels, setChannels] = createSignal<OpenClawChannel[]>(DEFAULT_CHANNELS)
  const [channelOpen, setChannelOpen] = createSignal(true)
  const [expandedChannel, setExpandedChannel] = createSignal<string | null>(null)
  const [channelTestResult, setChannelTestResult] = createSignal<Record<string, "ok" | "error" | "testing">>({})

  // ── Model state ────────────────────────────────────────────────────────────
  const [models, setModels] = createSignal<OpenClawModel[]>(DEFAULT_MODELS)
  const [modelsOpen, setModelsOpen] = createSignal(true)
  const [scanning, setScanning] = createSignal(false)
  const [showAddModel, setShowAddModel] = createSignal(false)
  const [newModelProvider, setNewModelProvider] = createSignal<OpenClawModel["provider"]>("ollama")
  const [newModelUrl, setNewModelUrl] = createSignal("http://localhost:11434")
  const [newModelId, setNewModelId] = createSignal("")

  // ── Live pricing state ─────────────────────────────────────────────────────
  const [modelPricing, setModelPricing] = createSignal<ModelPricing[]>([])
  const [pricingLoaded, setPricingLoaded] = createSignal(false)

  onMount(() => {
    if (pricingLoaded()) return
    fetchLivePricing().then(data => {
      setModelPricing(data)
      setPricingLoaded(true)
    })
  })

  // ── Routing rules state ────────────────────────────────────────────────────
  const [rules, setRules] = createSignal<OpenClawRoutingRule[]>(DEFAULT_ROUTING_RULES)
  const [rulesOpen, setRulesOpen] = createSignal(true)
  const [showAddRule, setShowAddRule] = createSignal(false)
  const [testMessage, setTestMessage] = createSignal("")
  const [newRuleName, setNewRuleName] = createSignal("")
  const [newRulePattern, setNewRulePattern] = createSignal("")
  const [newRuleAction, setNewRuleAction] = createSignal<OpenClawRoutingRule["action"]>("route_to_agent")
  const [newRuleTarget, setNewRuleTarget] = createSignal("agent-1")

  // ── Agent state ────────────────────────────────────────────────────────────
  const [agents, setAgents] = createSignal<OpenClawAgent[]>(DEFAULT_AGENTS)
  const [agentsOpen, setAgentsOpen] = createSignal(true)
  const [editingPrompt, setEditingPrompt] = createSignal<string | null>(null)
  const [promptDraft, setPromptDraft] = createSignal("")

  // ── Log state ─────────────────────────────────────────────────────────────
  const [log, setLog] = createSignal<MessageLogEntry[]>(DEFAULT_LOG)
  const [logOpen, setLogOpen] = createSignal(false)

  // ── Wizard state ──────────────────────────────────────────────────────────
  const [wizardOpen, setWizardOpen] = createSignal(true)
  const [wizardDone, setWizardDone] = createSignal(false)

  // ── Misc ───────────────────────────────────────────────────────────────────
  const [copiedPath, setCopiedPath] = createSignal(false)
  const CONFIG_PATH = "~/.openclaw/openclaw.json"  // JSON5 format; workspace at ~/.openclaw/workspace

  // ── Upstream Updates panel state ─────────────────────────────────────────
  const [upstreamOpen, setUpstreamOpen] = createSignal(false)

  // ── New feature signals ────────────────────────────────────────────────────
  // Flow Visualizer
  const [flowOpen, setFlowOpen] = createSignal(true)
  const [flowActive, setFlowActive] = createSignal(false)
  const [flowTick, setFlowTick] = createSignal(0)
  const [flowMsgCounts, setFlowMsgCounts] = createSignal<Record<string, number>>({
    webchat: 1203, telegram: 0, discord: 247, slack: 0,
    whatsapp: 0, signal: 0, googlechat: 0, teams: 0,
  })

  createEffect(() => {
    if (!flowActive()) return
    const iv = setInterval(() => {
      setFlowTick((t) => (t + 1) % 100)
    }, 60)
    onCleanup(() => clearInterval(iv))
  })

  // Channel Health Heatmap
  const [heatmapOpen, setHeatmapOpen] = createSignal(true)
  const [heatmapChannel, setHeatmapChannel] = createSignal("webchat")
  const [heatmapHover, setHeatmapHover] = createSignal<{ day: number; hour: number; count: number } | null>(null)

  // Model Performance
  const [perfOpen, setPerfOpen] = createSignal(true)
  const [perfSort, setPerfSort] = createSignal<keyof ChannelPerfRow>("avgResponseMs")
  const [perfAsc, setPerfAsc] = createSignal(true)

  const sortedPerf = createMemo(() => {
    const key = perfSort()
    const asc = perfAsc()
    return [...CHANNEL_PERF_SEED].sort((a, b) => {
      const av = a[key] as number
      const bv = b[key] as number
      return asc ? av - bv : bv - av
    })
  })

  // Webhook Inspector
  const [inspectorOpen, setInspectorOpen] = createSignal(true)
  const [webhookEvents, setWebhookEvents] = createSignal<WebhookEvent[]>(_genWebhookEvents())
  const [whFilter, setWhFilter] = createSignal<string>("all")
  const [whStatusFilter, setWhStatusFilter] = createSignal<string>("all")

  const filteredEvents = createMemo(() =>
    webhookEvents().filter((e) => {
      const pf = whFilter() === "all" || e.platform === whFilter()
      const sf = whStatusFilter() === "all" || e.status === whStatusFilter()
      return pf && sf
    })
  )

  // Quick Connect Wizard (new channel)
  const [qcOpen, setQcOpen] = createSignal(false)
  const [qcStep, setQcStep] = createSignal(1)
  const [qcPlatform, setQcPlatform] = createSignal("")
  const [qcWebhookUrl, setQcWebhookUrl] = createSignal("")
  const [qcToken, setQcToken] = createSignal("")
  const [qcModel, setQcModel] = createSignal("ollama/llama3:8b")
  const [qcTestResult, setQcTestResult] = createSignal<"idle" | "testing" | "ok" | "fail">("idle")

  const qcRunTest = () => {
    setQcTestResult("testing")
    setTimeout(() => {
      setQcTestResult(Math.random() > 0.2 ? "ok" : "fail")
    }, 1400)
  }

  const qcFinish = () => {
    if (!qcPlatform()) return
    const ch = DEFAULT_CHANNELS.find((c) => c.id === qcPlatform())
    setChannels((prev) =>
      prev.map((c) =>
        c.id === qcPlatform()
          ? { ...c, enabled: true, status: "idle", token: qcToken(), webhookUrl: qcWebhookUrl() || c.webhookUrl, assignedModel: qcModel() }
          : c
      )
    )
    setQcOpen(false)
    setQcStep(1)
    setQcPlatform("")
    setQcToken("")
    setQcWebhookUrl("")
    setQcTestResult("idle")
  }

  // ── Computed ───────────────────────────────────────────────────────────────

  const matchedRule = createMemo(() => {
    const msg = testMessage().trim()
    if (!msg) return null
    const sorted = [...rules()].sort((a, b) => a.priority - b.priority)
    for (const rule of sorted) {
      if (!rule.enabled) continue
      try {
        if (new RegExp(rule.pattern, "i").test(msg)) return rule
      } catch { /* invalid regex */ }
    }
    return null
  })

  const anyChannelConfigured = createMemo(() =>
    channels().some((ch) => ch.status === "active" || ch.enabled)
  )

  // ── Actions ────────────────────────────────────────────────────────────────

  const connect = () => {
    setConnecting(true)
    // Optimistic placeholder — real status arrives via openclawStatusUpdate.
    // Kept so the UI shows "connecting…" rather than a frozen frame.
    vscode.postMessage({ type: "openclawConnect", url: urlInput().trim() } as any)
    // Safety timeout — if the extension never replies (e.g. handler not wired),
    // surface a clear error after FETCH_TIMEOUT_MS + grace so the UI doesn't
    // hang indefinitely. The real listener clears `connecting` on response.
    const safetyId = setTimeout(() => {
      if (connecting()) {
        setConnecting(false)
        setStatus({
          connected: false,
          gatewayUrl: urlInput().trim(),
          activeChannels: 0,
          totalMessagesToday: 0,
          error: "Gateway did not respond in time",
        })
      }
    }, 12_000)
    onCleanup(() => clearTimeout(safetyId))
  }

  const disconnect = () => {
    vscode.postMessage({ type: "openclawDisconnect" } as any)
    // Optimistic clear — real disconnected state confirmed via openclawStatusUpdate.
    setStatus(null)
  }

  const openUrl = (path: string) => {
    const base = status()?.gatewayUrl ?? urlInput().trim()
    vscode.postMessage({ type: "openclawOpenUrl", url: `${base}${path}` } as any)
  }

  const copyConfigPath = () => {
    navigator.clipboard?.writeText(CONFIG_PATH).catch(() => {})
    setCopiedPath(true)
    setTimeout(() => setCopiedPath(false), 1500)
  }

  const toggleChannelEnabled = (id: string) => {
    setChannels((prev) =>
      prev.map((ch) => {
        if (ch.id !== id) return ch
        const enabled = !ch.enabled
        const newStatus = enabled ? "idle" : "unconfigured"
        vscode.postMessage({ type: "openclawToggleChannel", channelId: id, enabled } as any)
        return { ...ch, enabled, status: newStatus as OpenClawChannel["status"] }
      })
    )
  }

  const testChannelConnection = (id: string) => {
    setChannelTestResult((prev) => ({ ...prev, [id]: "testing" }))
    vscode.postMessage({ type: "openclawTestChannel", channelId: id } as any)
    // Result resolved by openclawChannelTested listener below.
    // Safety: clear "testing" state if no reply within 15s so UI doesn't stick.
    const safetyId = setTimeout(() => {
      setChannelTestResult((prev) => {
        if (prev[id] !== "testing") return prev
        return { ...prev, [id]: "error" }
      })
    }, 15_000)
    onCleanup(() => clearTimeout(safetyId))
  }

  const updateChannelField = (id: string, field: keyof OpenClawChannel, value: string) => {
    setChannels((prev) =>
      prev.map((ch) => ch.id === id ? { ...ch, [field]: value } : ch)
    )
  }

  const scanForModels = () => {
    setScanning(true)
    vscode.postMessage({ type: "openclawScanModels" } as any)
    // Result resolved by openclawModelsUpdate listener below.
    // Safety: stop spinner if no reply within 20s.
    const safetyId = setTimeout(() => {
      if (scanning()) setScanning(false)
    }, 20_000)
    onCleanup(() => clearTimeout(safetyId))
  }

  const addModel = () => {
    if (!newModelId().trim()) return
    const m: OpenClawModel = {
      id: newModelId().trim(),
      name: newModelId().trim(),
      provider: newModelProvider(),
      baseUrl: newModelUrl().trim(),
      available: false,
      contextLength: 4096,
      capabilities: ["chat"],
    }
    setModels((prev) => [...prev, m])
    setNewModelId("")
    setShowAddModel(false)
  }

  const toggleRule = (id: string) => {
    setRules((prev) => prev.map((r) => r.id === id ? { ...r, enabled: !r.enabled } : r))
  }

  const addRule = () => {
    if (!newRuleName().trim() || !newRulePattern().trim()) return
    const r: OpenClawRoutingRule = {
      id: `r${Date.now()}`,
      name: newRuleName().trim(),
      pattern: newRulePattern().trim(),
      action: newRuleAction(),
      targetAgent: newRuleTarget(),
      priority: rules().length + 1,
      enabled: true,
    }
    setRules((prev) => [...prev, r])
    setNewRuleName("")
    setNewRulePattern("")
    setShowAddRule(false)
  }

  const savePrompt = (agentId: string) => {
    setAgents((prev) =>
      prev.map((a) => a.id === agentId ? { ...a, systemPrompt: promptDraft() } : a)
    )
    setEditingPrompt(null)
    vscode.postMessage({ type: "openclawSaveAgentPrompt", agentId, prompt: promptDraft() } as any)
  }

  const clearLog = () => setLog([])

  // ── Extension → webview message listener ──────────────────────────────────
  // Reconciles optimistic UI state with real responses from
  // src/kilo-provider/handlers/openclaw-webview.ts.
  const onExtensionMessage = (raw: unknown) => {
    const msg = (raw ?? {}) as Record<string, unknown>
    const type = msg.type as string | undefined
    if (typeof type !== "string" || !type.startsWith("openclaw")) return

    switch (type) {
      // Connect / Disconnect status
      case "openclawStatusUpdate": {
        setConnecting(false)
        const connected = Boolean(msg.connected)
        if (connected) {
          setStatus({
            connected: true,
            gatewayUrl: (msg.gatewayUrl as string) ?? urlInput().trim(),
            latency_ms: msg.latency_ms as number | undefined,
            version: msg.version as string | undefined,
            uptime_s: msg.uptime_s as number | undefined,
            activeChannels:
              (msg.activeChannels as number | undefined) ??
              channels().filter((c) => c.status === "active").length,
            totalMessagesToday: status()?.totalMessagesToday ?? 0,
          })
        } else {
          // Disconnected, possibly with error from connect attempt.
          const err = msg.error as string | undefined
          if (err) {
            setStatus({
              connected: false,
              gatewayUrl: (msg.gatewayUrl as string) ?? urlInput().trim(),
              activeChannels: 0,
              totalMessagesToday: 0,
              error: err,
            })
          } else {
            setStatus(null)
          }
        }
        return
      }

      // Channels list
      case "openclawChannelsUpdate": {
        const incoming = (msg.channels as OpenClawChannel[] | undefined) ?? []
        if (incoming.length > 0) {
          // Replace with real data when the gateway returned channels.
          setChannels(incoming)
        }
        // If empty (e.g. gateway error), keep optimistic seed list — error
        // is implicit via msg.error and surfaced by status panel.
        return
      }

      // Models list
      case "openclawModelsUpdate": {
        setScanning(false)
        const incoming = (msg.models as OpenClawModel[] | undefined) ?? []
        if (incoming.length > 0) {
          // Merge: keep existing entries, mark matched ones available, append new.
          setModels((prev) => {
            const byId = new Map(prev.map((m) => [m.id, m] as const))
            for (const m of incoming) {
              const existing = byId.get(m.id)
              byId.set(m.id, existing ? { ...existing, ...m, available: true } : { ...m, available: m.available ?? true })
            }
            return Array.from(byId.values())
          })
        }
        return
      }

      // Channel toggle confirmation
      case "openclawChannelToggled": {
        const channelId = msg.channelId as string | undefined
        const ok = Boolean(msg.ok)
        if (!channelId) return
        if (!ok) {
          // Roll back optimistic toggle on failure.
          const enabled = Boolean(msg.enabled)
          setChannels((prev) =>
            prev.map((ch) =>
              ch.id === channelId
                ? { ...ch, enabled: !enabled, status: !enabled ? "idle" : "unconfigured" }
                : ch,
            ),
          )
        }
        return
      }

      // Channel test result
      case "openclawChannelTested": {
        const channelId = msg.channelId as string | undefined
        const ok = Boolean(msg.ok)
        if (!channelId) return
        setChannelTestResult((prev) => ({ ...prev, [channelId]: ok ? "ok" : "error" }))
        return
      }

      // Agent prompt save confirmation
      case "openclawAgentUpdated": {
        // Already optimistically updated in savePrompt; nothing else to do
        // unless the server rejected. (Handler always responds; ok flag tells us.)
        return
      }

      // Agents list (after createAgent or refresh)
      case "openclawAgentsUpdate": {
        const incoming = (msg.agents as OpenClawAgent[] | undefined) ?? []
        if (incoming.length > 0) setAgents(incoming)
        return
      }

      // Update-info for the OpenClaw daemon
      case "openclawUpdateInfo": {
        // Nothing to wire to the existing UI yet; reserved for future
        // "update available" badge. Errors are silently absorbed.
        return
      }

      // Log export confirmation
      case "openclawLogExported": {
        // Log file already opened in editor by the handler on success;
        // no further UI action required here.
        return
      }
    }
  }

  onMount(() => {
    // Subscribe via the shared message bus instead of attaching a fresh
    // window listener. With ~28 settings tabs all listening for extension
    // events, the per-message dispatch cost was previously O(N tabs).
    const unsubscribe = subscribeToMessages(onExtensionMessage)
    onCleanup(unsubscribe)
  })

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div style={{ display: "flex", "flex-direction": "column", gap: "16px", padding: "0 4px 32px" }}>

      {/* ════════════════════════════════════════════════════════════════════════
          SECTION 1 — GATEWAY CONNECTION DASHBOARD
          ════════════════════════════════════════════════════════════════════════ */}
      <section style={{ ...sectionWrapStyle }}>
        {/* GitHub source banner */}
        <div style={{ padding:"0.4rem 0.7rem", background:"rgba(56,139,253,0.08)", border:"1px solid rgba(56,139,253,0.2)", "border-radius":"4px", "margin-bottom":"0.6rem", "font-size":"0.78rem", display:"flex", "align-items":"center", gap:"0.5rem" }}>
          <span>🦞</span>
          <span>OpenClaw — Your personal AI assistant on any platform</span>
          <a href="https://github.com/Ghenghis/openclaw" style={{ "margin-left":"auto", color:"var(--vscode-focusBorder)", "text-decoration":"none" }}>GitHub →</a>
        </div>

        {/* Top row: big status + latency */}
        <div style={{ display: "flex", "align-items": "center", "justify-content": "space-between", "margin-bottom": "12px" }}>
          <div style={{ display: "flex", "align-items": "center", gap: "10px" }}>
            <Dot status={connecting() ? "connecting" : status()?.connected ? "active" : "error"} size={12} />
            <span style={{
              "font-size": "15px",
              "font-weight": "800",
              "letter-spacing": "0.05em",
              color: connecting()
                ? "var(--vscode-testing-iconQueued)"
                : status()?.connected
                ? "var(--vscode-testing-iconPassed)"
                : "var(--vscode-testing-iconFailed)",
            }}>
              {connecting() ? "CONNECTING…" : status()?.connected ? "CONNECTED" : "DISCONNECTED"}
            </span>
            <Show when={status()?.connected && status()?.latency_ms !== undefined}>
              <span style={{
                "font-size": "11px",
                background: "rgba(35,134,54,0.15)",
                color: "var(--vscode-testing-iconPassed)",
                padding: "2px 8px",
                "border-radius": "10px",
                "font-weight": "600",
              }}>
                {status()?.latency_ms}ms
              </span>
            </Show>
          </div>
          <Show when={status()?.version}>
            <span style={{ "font-size": "11px", color: "var(--vscode-descriptionForeground)" }}>
              v{status()?.version}
            </span>
          </Show>
        </div>

        {/* URL input row */}
        <div style={{ display: "flex", gap: "6px", "margin-bottom": "10px", "align-items": "center" }}>
          <select
            style={{ ...inputStyle, width: "auto", flex: "0 0 auto", "min-width": "140px" }}
            onChange={(e) => setUrlInput(e.currentTarget.value)}
          >
            <For each={urlPresets}>
              {(p) => <option value={p} selected={urlInput() === p}>{p}</option>}
            </For>
            <option value="custom">Custom…</option>
          </select>
          <input
            type="text"
            value={urlInput()}
            onInput={(e) => setUrlInput(e.currentTarget.value)}
            placeholder="http://localhost:18789"
            style={{ ...inputStyle, flex: "1" }}
          />
          <Show
            when={status()?.connected}
            fallback={
              <button
                onClick={connect}
                disabled={connecting()}
                style={{ ...btnPrimary, opacity: connecting() ? "0.6" : "1", "white-space": "nowrap" }}
                aria-label={connecting() ? "Connecting to OpenClaw gateway" : "Connect to OpenClaw gateway"}
              >
                {connecting() ? "Connecting…" : "Connect"}
              </button>
            }
          >
            <button onClick={disconnect} style={{ ...btnSecondary, "white-space": "nowrap" }}>
              Disconnect
            </button>
          </Show>
        </div>

        {/* Stats row */}
        <Show when={status()?.connected}>
          <div style={{
            display: "flex",
            gap: "16px",
            "font-size": "11px",
            color: "var(--vscode-descriptionForeground)",
            "margin-bottom": "10px",
            "flex-wrap": "wrap",
          }}>
            <span>
              <span style={{ color: "var(--vscode-foreground)", "font-weight": "600" }}>
                {status()?.activeChannels ?? 0}
              </span>{" "}active channels
            </span>
            <span>
              <span style={{ color: "var(--vscode-foreground)", "font-weight": "600" }}>
                {(status()?.totalMessagesToday ?? 0).toLocaleString()}
              </span>{" "}messages today
            </span>
            <Show when={status()?.uptime_s !== undefined}>
              <span>Uptime: <span style={{ color: "var(--vscode-foreground)", "font-weight": "600" }}>
                {formatUptime(status()!.uptime_s!)}
              </span></span>
            </Show>
          </div>
        </Show>

        {/* Button row */}
        <div style={{ display: "flex", gap: "8px", "flex-wrap": "wrap" }}>
          <button onClick={() => openUrl("/webchat")} style={btnPrimary}>
            Open WebChat →
          </button>
          <button onClick={() => openUrl("/ui")} style={btnSecondary}>
            Open Control UI →
          </button>
          <button
            onClick={copyConfigPath}
            style={{
              ...btnSecondary,
              color: copiedPath() ? "var(--vscode-testing-iconPassed)" : undefined,
            }}
          >
            {copiedPath() ? "✓ Config Path Copied" : "Open Config →"}
          </button>
        </div>

        <Show when={status()?.error}>
          <div style={{
            "margin-top": "8px",
            "font-size": "11px",
            color: "var(--vscode-testing-iconFailed)",
            padding: "6px 10px",
            background: "rgba(248,81,73,0.1)",
            "border-radius": "4px",
            "border-left": "3px solid var(--vscode-testing-iconFailed, #f14c4c)",
          }}
            role="alert"
            aria-live="polite"
          >
            ✗ {status()?.error}
          </div>
        </Show>
      </section>

      {/* ════════════════════════════════════════════════════════════════════════
          SECTION 1b — UPSTREAM UPDATES
          ════════════════════════════════════════════════════════════════════════ */}
      <section style={{ ...sectionWrapStyle }}>
        <div
          style={{
            display: "flex",
            "align-items": "center",
            "justify-content": "space-between",
            cursor: "pointer",
            "user-select": "none",
            padding: "8px 12px",
            background: "var(--vscode-editor-inactiveSelectionBackground)",
            "border-bottom": upstreamOpen() ? "1px solid var(--vscode-panel-border)" : "none",
          }}
          onClick={() => setUpstreamOpen((v) => !v)}
          aria-label={`${upstreamOpen() ? "Collapse" : "Expand"} Upstream Updates`}
          role="button"
        >
          <span style={{ "font-size": "12px", "font-weight": "700", color: "var(--vscode-foreground)" }}>
            {upstreamOpen() ? "▼" : "▶"} Upstream Updates
          </span>
          <span style={{
            "font-size": "0.75rem",
            background: "rgba(35,134,54,0.15)",
            color: "var(--vscode-testing-iconPassed)",
            "border-radius": "10px",
            padding: "1px 7px",
            "font-weight": "600",
          }}>
            Auto-update eligible
          </span>
        </div>
        <Show when={upstreamOpen()}>
          <div style={{ padding: "0.8rem" }}>
            <p style={{ margin: "0 0 0.6rem", "font-size": "0.82rem", color: "var(--vscode-descriptionForeground)" }}>
              OpenClaw can safely follow upstream releases since it has not been locally modified.
              Upstream: <code style={{ "font-size": "0.78rem", "font-family": "var(--vscode-editor-font-family, monospace)" }}>https://github.com/Ghenghis/openclaw</code>
              {" "}(fork of <code style={{ "font-size": "0.78rem", "font-family": "var(--vscode-editor-font-family, monospace)" }}>openclaw/openclaw</code>)
            </p>
            <div style={{ display: "grid", "grid-template-columns": "1fr 1fr", gap: "0.5rem", "margin-bottom": "0.6rem" }}>
              <div style={{
                padding: "0.5rem 0.7rem",
                background: "var(--vscode-editor-inactiveSelectionBackground)",
                "border-radius": "4px",
              }}>
                <div style={{ "font-size": "0.75rem", color: "var(--vscode-descriptionForeground)" }}>Installed Version</div>
                <div style={{ "font-weight": "600", "font-size": "12px" }}>
                  Run: <code style={{ "font-family": "var(--vscode-editor-font-family, monospace)" }}>npm list -g openclaw</code>
                </div>
              </div>
              <div style={{
                padding: "0.5rem 0.7rem",
                background: "var(--vscode-editor-inactiveSelectionBackground)",
                "border-radius": "4px",
              }}>
                <div style={{ "font-size": "0.75rem", color: "var(--vscode-descriptionForeground)" }}>Update Policy</div>
                <div style={{ "font-weight": "600", "font-size": "12px", color: "var(--vscode-testing-iconPassed)" }}>
                  Safe to auto-update
                </div>
              </div>
            </div>
            <div style={{ display: "flex", gap: "0.5rem", "flex-wrap": "wrap", "margin-bottom": "0.5rem" }}>
              <button
                onClick={() => vscode.postMessage({ type: "openclawCheckUpdates" } as any)}
                style={{ ...btnPrimary, "font-size": "0.82rem" }}
              >
                Check for Updates
              </button>
              <button
                onClick={() => vscode.postMessage({ type: "openclawViewChangelog" } as any)}
                style={{ ...btnSecondary, "font-size": "0.82rem" }}
              >
                View Changelog
              </button>
              <a
                href="https://github.com/Ghenghis/openclaw/releases"
                style={{
                  padding: "5px 14px",
                  background: "transparent",
                  color: "var(--vscode-focusBorder)",
                  border: "1px solid var(--vscode-focusBorder)",
                  "border-radius": "3px",
                  cursor: "pointer",
                  "font-size": "0.82rem",
                  "text-decoration": "none",
                }}
              >
                GitHub Releases
              </a>
            </div>
            <p style={{ margin: "0", "font-size": "0.75rem", color: "var(--vscode-descriptionForeground)" }}>
              Run{" "}
              <code style={{ "font-family": "var(--vscode-editor-font-family, monospace)", background: "var(--vscode-textBlockQuote-background)", padding: "1px 4px", "border-radius": "3px" }}>
                scripts/check-upstream-updates.ps1 -Apply
              </code>
              {" "}to pull the latest OpenClaw release, or:{" "}
              <code style={{ "font-family": "var(--vscode-editor-font-family, monospace)", background: "var(--vscode-textBlockQuote-background)", padding: "1px 4px", "border-radius": "3px" }}>
                npm install -g openclaw@latest
              </code>
            </p>
          </div>
        </Show>
      </section>

      {/* ════════════════════════════════════════════════════════════════════════
          SECTION 2 — CHANNEL SETUP
          ════════════════════════════════════════════════════════════════════════ */}
      <section style={{ ...sectionWrapStyle }}>
        <SectionHeader
          title="Channel Setup"
          open={channelOpen()}
          onToggle={() => setChannelOpen(!channelOpen())}
          count={channels().length}
          action={{ label: "↻ Refresh", onClick: () => vscode.postMessage({ type: "openclawRequestChannels" } as any) }}
        />

        <Show when={channelOpen()}>
          <div style={{ ...sectionBodyTableStyle }}>
            {/* Table header */}
            <div style={{
              display: "grid",
              "grid-template-columns": "1.4fr 90px 80px 1fr 1fr 80px 60px",
              gap: "0",
              padding: "6px 12px",
              "font-size": "10px",
              "font-weight": "700",
              "text-transform": "uppercase",
              color: "var(--vscode-descriptionForeground)",
              "border-bottom": "1px solid var(--vscode-panel-border)",
            }}>
              <span>Channel</span>
              <span>Status</span>
              <span style={{ "text-align": "right", "padding-right": "8px" }}>Messages</span>
              <span>Model</span>
              <span>Agent</span>
              <span style={{ "text-align": "center" }}>Configure</span>
              <span style={{ "text-align": "center" }}>On</span>
            </div>

            <For each={channels()}>
              {(ch, i) => (
                <>
                  {/* Channel row */}
                  <div style={{
                    display: "grid",
                    "grid-template-columns": "1.4fr 90px 80px 1fr 1fr 80px 60px",
                    "align-items": "center",
                    padding: "7px 12px",
                    "border-top": i() === 0 ? "none" : "1px solid var(--vscode-panel-border)",
                    background: i() % 2 === 0 ? "transparent" : "rgba(255,255,255,0.02)",
                  }}>
                    {/* Name + dot */}
                    <div style={{ display: "flex", "align-items": "center", gap: "7px" }}>
                      <Dot status={ch.status} />
                      <span style={{ "font-size": "12px", "font-weight": "500" }}>{ch.name}</span>
                    </div>

                    {/* Status badge */}
                    <Badge label={ch.status} status={ch.status} />

                    {/* Messages */}
                    <span style={{ "font-size": "11px", "text-align": "right", "padding-right": "8px" }}>
                      {ch.messagesHandled.toLocaleString()}
                    </span>

                    {/* Model */}
                    <span style={{
                      "font-size": "11px",
                      color: "var(--vscode-descriptionForeground)",
                      "font-family": "var(--vscode-editor-font-family, monospace)",
                      overflow: "hidden",
                      "text-overflow": "ellipsis",
                      "white-space": "nowrap",
                      "min-width": "0",
                    }}
                      title={ch.assignedModel}
                    >
                      {ch.assignedModel}
                    </span>

                    {/* Agent */}
                    <span style={{ "font-size": "11px", color: "var(--vscode-descriptionForeground)" }}>
                      {agents().find((a) => a.id === ch.assignedAgent)?.name ?? ch.assignedAgent}
                    </span>

                    {/* Configure toggle */}
                    <div style={{ display: "flex", "justify-content": "center" }}>
                      <button
                        onClick={() => setExpandedChannel(expandedChannel() === ch.id ? null : ch.id)}
                        style={{
                          ...btnGhost,
                          "font-size": "10px",
                          color: expandedChannel() === ch.id
                            ? "var(--vscode-button-foreground)"
                            : "var(--vscode-textLink-foreground)",
                          background: expandedChannel() === ch.id
                            ? "var(--vscode-button-background)"
                            : "transparent",
                          padding: "2px 8px",
                          "border-radius": "3px",
                        }}
                      >
                        {expandedChannel() === ch.id ? "▲ Close" : "▼ Edit"}
                      </button>
                    </div>

                    {/* Enable toggle */}
                    <div style={{ display: "flex", "justify-content": "center" }}>
                      <input
                        type="checkbox"
                        checked={ch.enabled}
                        onChange={() => toggleChannelEnabled(ch.id)}
                        style={{ cursor: "pointer", width: "14px", height: "14px" }}
                        aria-label={`${ch.enabled ? "Disable" : "Enable"} ${ch.name} channel`}
                        title={`${ch.enabled ? "Disable" : "Enable"} ${ch.name}`}
                      />
                    </div>
                  </div>

                  {/* Inline configure panel */}
                  <Show when={expandedChannel() === ch.id}>
                    <div style={{
                      padding: "12px 16px",
                      background: "var(--vscode-editor-background)",
                      "border-top": "1px solid var(--vscode-panel-border)",
                      display: "flex",
                      "flex-direction": "column",
                      gap: "10px",
                    }}>
                      <div style={{ display: "grid", "grid-template-columns": "1fr 1fr", gap: "10px" }}>
                        {/* Token/API key */}
                        <div>
                          <label style={{ "font-size": "10px", "font-weight": "600", color: "var(--vscode-descriptionForeground)", display: "block", "margin-bottom": "4px" }}>
                            Bot Token / API Key
                          </label>
                          <input
                            type="password"
                            value={ch.token ?? ""}
                            onInput={(e) => updateChannelField(ch.id, "token", e.currentTarget.value)}
                            placeholder="Paste token here…"
                            style={{ ...inputStyle }}
                          />
                        </div>

                        {/* Webhook URL */}
                        <div>
                          <label style={{ "font-size": "10px", "font-weight": "600", color: "var(--vscode-descriptionForeground)", display: "block", "margin-bottom": "4px" }}>
                            Webhook URL
                          </label>
                          <div style={{ display: "flex", gap: "6px" }}>
                            <input
                              type="text"
                              value={ch.webhookUrl ?? `http://localhost:18789/webhook/${ch.id}`}
                              readOnly
                              style={{ ...inputStyle, flex: "1", "background": "var(--vscode-editor-inactiveSelectionBackground)" }}
                            />
                            <button
                              onClick={() => navigator.clipboard?.writeText(ch.webhookUrl ?? `http://localhost:18789/webhook/${ch.id}`)}
                              style={{ ...btnSecondary, padding: "4px 10px" }}
                              aria-label="Copy webhook URL to clipboard"
                              title="Copy webhook URL"
                            >
                              Copy
                            </button>
                          </div>
                        </div>

                        {/* Model selector */}
                        <div>
                          <label style={{ "font-size": "10px", "font-weight": "600", color: "var(--vscode-descriptionForeground)", display: "block", "margin-bottom": "4px" }}>
                            Assigned Model
                          </label>
                          <select
                            style={{ ...inputStyle }}
                            onChange={(e) => updateChannelField(ch.id, "assignedModel", e.currentTarget.value)}
                          >
                            <For each={models()}>
                              {(m) => <option value={m.id} selected={m.id === ch.assignedModel}>{m.name}</option>}
                            </For>
                          </select>
                        </div>

                        {/* Agent selector */}
                        <div>
                          <label style={{ "font-size": "10px", "font-weight": "600", color: "var(--vscode-descriptionForeground)", display: "block", "margin-bottom": "4px" }}>
                            Assigned Agent
                          </label>
                          <select
                            style={{ ...inputStyle }}
                            onChange={(e) => updateChannelField(ch.id, "assignedAgent", e.currentTarget.value)}
                          >
                            <For each={agents()}>
                              {(a) => <option value={a.id} selected={a.id === ch.assignedAgent}>{a.name}</option>}
                            </For>
                          </select>
                        </div>
                      </div>

                      {/* Test connection */}
                      <div style={{ display: "flex", "align-items": "center", gap: "10px" }}>
                        <button
                          onClick={() => testChannelConnection(ch.id)}
                          disabled={channelTestResult()[ch.id] === "testing"}
                          style={{ ...btnPrimary, opacity: channelTestResult()[ch.id] === "testing" ? "0.6" : "1" }}
                        >
                          {channelTestResult()[ch.id] === "testing" ? "Testing…" : "Test Connection"}
                        </button>
                        <Show when={channelTestResult()[ch.id] === "ok"}>
                          <span style={{ "font-size": "12px", color: "var(--vscode-testing-iconPassed)", "font-weight": "600" }}>
                            ✓ Connected
                          </span>
                        </Show>
                        <Show when={channelTestResult()[ch.id] === "error"}>
                          <span style={{ "font-size": "12px", color: "var(--vscode-testing-iconFailed)", "font-weight": "600" }}>
                            ✗ Connection failed
                          </span>
                        </Show>
                      </div>
                    </div>
                  </Show>
                </>
              )}
            </For>
          </div>

          <div style={{ "margin-top": "8px" }}>
            <button
              onClick={() => vscode.postMessage({ type: "openclawAddChannel" } as any)}
              style={btnSecondary}
            >
              + Add Custom Channel
            </button>
          </div>
        </Show>
      </section>

      {/* ════════════════════════════════════════════════════════════════════════
          SECTION 3 — AVAILABLE MODELS
          ════════════════════════════════════════════════════════════════════════ */}
      <section style={{ ...sectionWrapStyle }}>
        <SectionHeader
          title="Available Models"
          open={modelsOpen()}
          onToggle={() => setModelsOpen(!modelsOpen())}
          count={models().length}
          action={{
            label: scanning() ? "Scanning…" : "↻ Scan for Local Models",
            onClick: scanForModels,
          }}
        />

        <Show when={modelsOpen()}>
          <div style={{ padding: "0.6rem" }}>
          {/* 2-column card grid */}
          <div style={{
            display: "grid",
            "grid-template-columns": "1fr 1fr",
            gap: "8px",
            "margin-bottom": "8px",
          }}>
            <For each={models()}>
              {(m) => (
                <div style={{ ...cardStyle, display: "flex", "flex-direction": "column", gap: "6px" }}>
                  <div style={{ display: "flex", "align-items": "center", gap: "8px" }}>
                    <Dot status={m.available ? "active" : "idle"} />
                    <span style={{ "font-size": "12px", "font-weight": "600", flex: "1" }}>{m.name}</span>
                    <span style={{
                      "font-size": "10px",
                      "font-weight": "700",
                      color: providerColor(m.provider),
                      background: `${providerColor(m.provider)}22`,
                      padding: "1px 6px",
                      "border-radius": "6px",
                      "text-transform": "uppercase",
                    }}>
                      {m.provider}
                    </span>
                  </div>

                  <div style={{ "font-size": "10px", color: "var(--vscode-descriptionForeground)", display: "flex", gap: "10px" }}>
                    <span>{(m.contextLength / 1024).toFixed(0)}k ctx</span>
                    <Show when={m.latency_ms}><span>{m.latency_ms}ms</span></Show>
                    <Show when={m.available}>
                      <span style={{ color: "var(--vscode-testing-iconPassed)" }}>available</span>
                    </Show>
                    <Show when={!m.available}>
                      <span style={{ color: "var(--vscode-testing-iconQueued)" }}>not found</span>
                    </Show>
                  </div>

                  <div style={{ display: "flex", gap: "4px", "flex-wrap": "wrap" }}>
                    <For each={m.capabilities}>
                      {(cap) => (
                        <span style={{
                          "font-size": "9px",
                          background: "var(--vscode-badge-background)",
                          color: "var(--vscode-badge-foreground)",
                          padding: "1px 6px",
                          "border-radius": "4px",
                          "text-transform": "uppercase",
                          "font-weight": "600",
                        }}>
                          {cap}
                        </span>
                      )}
                    </For>
                  </div>

                  <div style={{ "font-size": "10px", color: "var(--vscode-descriptionForeground)", "font-family": "var(--vscode-editor-font-family, monospace)", "word-break": "break-all" }}>
                    {m.baseUrl}
                  </div>
                </div>
              )}
            </For>
          </div>

          {/* Model Cost Reference */}
          <Show when={pricingLoaded() && modelPricing().length > 0}>
            <div style={{"margin-top":"0.8rem"}}>
              <div style={{"font-size":"0.8rem","font-weight":600,"margin-bottom":"0.4rem",color:"var(--vscode-descriptionForeground)"}}>
                Live API Pricing (via OpenRouter) — updates every 24h
              </div>
              <div style={{display:"flex","flex-direction":"column",gap:"0.25rem","max-height":"200px",overflow:"auto"}}>
                <For each={modelPricing().filter(m=>!m.isLocal).slice(0,8)}>
                  {(model)=>(
                    <div style={{display:"flex","align-items":"center",gap:"0.5rem","font-size":"0.78rem",padding:"0.2rem 0.4rem","border-radius":"3px",background:"var(--vscode-editor-inactiveSelectionBackground)"}}>
                      <span style={{flex:1}}>{model.name}</span>
                      <span style={{color:"var(--vscode-descriptionForeground)"}}>{model.provider}</span>
                      <span style={{"font-weight":600}}>{formatPrice(model.inputPer1M)}<span style={{color:"var(--vscode-descriptionForeground)","font-weight":400}}>/in</span></span>
                      <span style={{"font-weight":600}}>{formatPrice(model.outputPer1M)}<span style={{color:"var(--vscode-descriptionForeground)","font-weight":400}}>/out</span></span>
                    </div>
                  )}
                </For>
              </div>
            </div>
          </Show>

          {/* Add Model form */}
          <Show when={!showAddModel()}>
            <button onClick={() => setShowAddModel(true)} style={btnSecondary}>
              + Add Model
            </button>
          </Show>

          <Show when={showAddModel()}>
            <div style={{ ...cardStyle, "margin-top": "4px" }}>
              <div style={{ "font-size": "11px", "font-weight": "700", "margin-bottom": "8px" }}>
                Add Model
              </div>
              <div style={{ display: "grid", "grid-template-columns": "1fr 1fr 1fr", gap: "8px", "margin-bottom": "8px" }}>
                <select
                  style={{ ...inputStyle }}
                  onChange={(e) => setNewModelProvider(e.currentTarget.value as OpenClawModel["provider"])}
                >
                  <option value="ollama">Ollama</option>
                  <option value="lmstudio">LM Studio</option>
                  <option value="openai">OpenAI</option>
                  <option value="anthropic">Anthropic</option>
                  <option value="custom">Custom</option>
                </select>
                <input
                  type="text"
                  value={newModelUrl()}
                  onInput={(e) => setNewModelUrl(e.currentTarget.value)}
                  placeholder="Base URL"
                  style={{ ...inputStyle }}
                />
                <input
                  type="text"
                  value={newModelId()}
                  onInput={(e) => setNewModelId(e.currentTarget.value)}
                  placeholder="Model ID (e.g. ollama/llama3:8b)"
                  style={{ ...inputStyle }}
                />
              </div>
              <div style={{ display: "flex", gap: "8px" }}>
                <button onClick={addModel} style={btnPrimary}>Add</button>
                <button onClick={() => setShowAddModel(false)} style={btnSecondary}>Cancel</button>
              </div>
            </div>
          </Show>
          </div>
        </Show>
      </section>

      {/* ════════════════════════════════════════════════════════════════════════
          SECTION 4 — ROUTING RULES
          ════════════════════════════════════════════════════════════════════════ */}
      <section style={{ ...sectionWrapStyle }}>
        <SectionHeader
          title="Agent Routing Rules"
          open={rulesOpen()}
          onToggle={() => setRulesOpen(!rulesOpen())}
          count={rules().length}
        />

        <Show when={rulesOpen()}>
          <div style={{ ...sectionBodyTableStyle }}>
            {/* Header */}
            <div style={{
              display: "grid",
              "grid-template-columns": "1.4fr 1.6fr 100px 1fr 60px 50px",
              padding: "6px 12px",
              "font-size": "10px",
              "font-weight": "700",
              "text-transform": "uppercase",
              color: "var(--vscode-descriptionForeground)",
              "border-bottom": "1px solid var(--vscode-panel-border)",
            }}>
              <span>Rule Name</span>
              <span>Pattern (regex)</span>
              <span>Action</span>
              <span>Target</span>
              <span style={{ "text-align": "center" }}>Pri</span>
              <span style={{ "text-align": "center" }}>On</span>
            </div>

            <Show when={rules().length === 0}>
              <div style={{ padding: "20px", "text-align": "center", color: "var(--vscode-descriptionForeground)", "font-size": "12px" }}>
                No routing rules. Click "+ Add Rule" to create one.
              </div>
            </Show>
            <For each={[...rules()].sort((a, b) => a.priority - b.priority)}>
              {(rule, i) => (
                <div style={{
                  display: "grid",
                  "grid-template-columns": "1.4fr 1.6fr 100px 1fr 60px 50px",
                  "align-items": "center",
                  padding: "7px 12px",
                  "border-top": i() === 0 ? "none" : "1px solid var(--vscode-panel-border)",
                  background: i() % 2 === 0 ? "transparent" : "rgba(255,255,255,0.02)",
                  opacity: rule.enabled ? "1" : "0.5",
                }}>
                  <span style={{ "font-size": "12px", "font-weight": "500" }}>{rule.name}</span>
                  <span style={{
                    "font-size": "11px",
                    "font-family": "var(--vscode-editor-font-family, monospace)",
                    color: "var(--vscode-descriptionForeground)",
                    overflow: "hidden",
                    "text-overflow": "ellipsis",
                    "white-space": "nowrap",
                    "min-width": "0",
                  }}
                    title={rule.pattern}
                  >
                    {rule.pattern}
                  </span>
                  <span style={{ "font-size": "11px", "text-transform": "capitalize", color: "var(--vscode-descriptionForeground)" }}>
                    {rule.action.replace(/_/g, " ")}
                  </span>
                  <span style={{ "font-size": "11px" }}>
                    {agents().find((a) => a.id === rule.targetAgent)?.name ?? rule.targetAgent ?? "—"}
                  </span>
                  <span style={{ "font-size": "11px", "text-align": "center", color: "var(--vscode-descriptionForeground)" }}>
                    {rule.priority}
                  </span>
                  <div style={{ display: "flex", "justify-content": "center" }}>
                    <input
                      type="checkbox"
                      checked={rule.enabled}
                      onChange={() => toggleRule(rule.id)}
                      style={{ cursor: "pointer", width: "14px", height: "14px" }}
                      aria-label={`${rule.enabled ? "Disable" : "Enable"} rule ${rule.name}`}
                      title={`${rule.enabled ? "Disable" : "Enable"} rule`}
                    />
                  </div>
                </div>
              )}
            </For>
          </div>

          {/* Rule tester */}
          <div style={{ ...cardStyle, "margin-top": "8px" }}>
            <div style={{ "font-size": "11px", "font-weight": "600", "margin-bottom": "6px" }}>
              Test a Message
            </div>
            <div style={{ display: "flex", gap: "8px", "align-items": "center" }}>
              <input
                type="text"
                value={testMessage()}
                onInput={(e) => setTestMessage(e.currentTarget.value)}
                placeholder="Type a message to see which rule matches…"
                style={{ ...inputStyle, flex: "1" }}
              />
            </div>
            <Show when={testMessage().trim()}>
              <div style={{ "margin-top": "8px", "font-size": "11px" }}>
                <Show
                  when={matchedRule()}
                  fallback={<span style={{ color: "var(--vscode-testing-iconFailed)" }}>No rule matched</span>}
                >
                  <span style={{ color: "var(--vscode-testing-iconPassed)", "font-weight": "600" }}>
                    ✓ Matched: "{matchedRule()!.name}"
                  </span>
                  <span style={{ color: "var(--vscode-descriptionForeground)", "margin-left": "8px" }}>
                    → {agents().find((a) => a.id === matchedRule()?.targetAgent)?.name ?? matchedRule()?.targetAgent}
                  </span>
                </Show>
              </div>
            </Show>
          </div>

          {/* Add rule form */}
          <Show when={!showAddRule()}>
            <button onClick={() => setShowAddRule(true)} style={{ ...btnSecondary, "margin-top": "8px" }}>
              + Add Rule
            </button>
          </Show>

          <Show when={showAddRule()}>
            <div style={{ ...cardStyle, "margin-top": "8px" }}>
              <div style={{ "font-size": "11px", "font-weight": "700", "margin-bottom": "8px" }}>New Rule</div>
              <div style={{ display: "grid", "grid-template-columns": "1fr 1fr", gap: "8px", "margin-bottom": "8px" }}>
                <input
                  type="text"
                  value={newRuleName()}
                  onInput={(e) => setNewRuleName(e.currentTarget.value)}
                  placeholder="Rule name"
                  style={{ ...inputStyle }}
                />
                <input
                  type="text"
                  value={newRulePattern()}
                  onInput={(e) => setNewRulePattern(e.currentTarget.value)}
                  placeholder="Regex pattern (e.g. ^debug)"
                  style={{ ...inputStyle }}
                />
                <select style={{ ...inputStyle }} onChange={(e) => setNewRuleAction(e.currentTarget.value as OpenClawRoutingRule["action"])}>
                  <option value="route_to_agent">Route to Agent</option>
                  <option value="respond_direct">Respond Direct</option>
                  <option value="ignore">Ignore</option>
                  <option value="forward">Forward</option>
                </select>
                <select style={{ ...inputStyle }} onChange={(e) => setNewRuleTarget(e.currentTarget.value)}>
                  <For each={agents()}>
                    {(a) => <option value={a.id}>{a.name}</option>}
                  </For>
                </select>
              </div>
              <div style={{ display: "flex", gap: "8px" }}>
                <button onClick={addRule} style={btnPrimary}>Add Rule</button>
                <button onClick={() => setShowAddRule(false)} style={btnSecondary}>Cancel</button>
              </div>
            </div>
          </Show>

          <p style={{ "font-size": "10px", color: "var(--vscode-descriptionForeground)", margin: "6px 0 0" }}>
            Rules are tested in priority order. Drag to reorder is available in the OpenClaw Control UI.
          </p>
        </Show>
      </section>

      {/* ════════════════════════════════════════════════════════════════════════
          SECTION 5 — AGENT ROSTER
          ════════════════════════════════════════════════════════════════════════ */}
      <section style={{ ...sectionWrapStyle }}>
        <SectionHeader
          title="Agent Roster"
          open={agentsOpen()}
          onToggle={() => setAgentsOpen(!agentsOpen())}
          count={agents().length}
        />

        <Show when={agentsOpen()}>
          <div style={{ display: "flex", "flex-direction": "column", gap: "8px", padding: "0.5rem" }}>
            <Show when={agents().length === 0}>
              <div style={{ padding: "24px", "text-align": "center", color: "var(--vscode-descriptionForeground)", "font-size": "12px" }}>
                <div style={{ "font-size": "20px", "margin-bottom": "6px" }}>🤖</div>
                <div>No agents yet</div>
                <div style={{ "font-size": "11px", "margin-top": "4px" }}>Click "+ Create Agent" to create your first agent.</div>
              </div>
            </Show>
            <For each={agents()}>
              {(agent) => (
                <div style={{ ...cardStyle }}>
                  {/* Agent header row */}
                  <div style={{ display: "flex", "align-items": "center", gap: "10px", "margin-bottom": "8px" }}>
                    <Dot status={agent.status} />
                    <span style={{ "font-size": "13px", "font-weight": "700", flex: "1" }}>{agent.name}</span>
                    <Badge label={agent.status} status={agent.status} />
                  </div>

                  {/* Stats row */}
                  <div style={{ display: "flex", gap: "16px", "font-size": "11px", "flex-wrap": "wrap", "margin-bottom": "8px" }}>
                    <span style={{ color: "var(--vscode-descriptionForeground)" }}>
                      Model: <span style={{
                        "font-family": "var(--vscode-editor-font-family, monospace)",
                        color: "var(--vscode-foreground)",
                      }}>{agent.model}</span>
                    </span>
                    <span style={{ color: "var(--vscode-descriptionForeground)" }}>
                      Processed: <span style={{ color: "var(--vscode-foreground)", "font-weight": "600" }}>
                        {agent.messagesProcessed.toLocaleString()}
                      </span>
                    </span>
                    <Show when={agent.avgResponseMs > 0}>
                      <span style={{ color: "var(--vscode-descriptionForeground)" }}>
                        Avg: <span style={{ color: "var(--vscode-foreground)", "font-weight": "600" }}>
                          {agent.avgResponseMs}ms
                        </span>
                      </span>
                    </Show>
                    <Show when={agent.errorCount > 0}>
                      <span style={{ color: "var(--vscode-testing-iconFailed)", "font-weight": "600" }}>
                        {agent.errorCount} error{agent.errorCount !== 1 ? "s" : ""}
                      </span>
                    </Show>
                  </div>

                  {/* Channels */}
                  <div style={{ display: "flex", gap: "4px", "flex-wrap": "wrap", "margin-bottom": "8px" }}>
                    <span style={{ "font-size": "10px", color: "var(--vscode-descriptionForeground)", "margin-right": "2px" }}>Channels:</span>
                    <For each={agent.channels}>
                      {(ch) => (
                        <span style={{
                          "font-size": "10px",
                          background: "var(--vscode-badge-background)",
                          color: "var(--vscode-badge-foreground)",
                          padding: "1px 6px",
                          "border-radius": "4px",
                          "font-weight": "600",
                          "text-transform": "capitalize",
                        }}>
                          {channels().find((c) => c.id === ch)?.name ?? ch}
                        </span>
                      )}
                    </For>
                  </div>

                  {/* System prompt edit */}
                  <Show
                    when={editingPrompt() === agent.id}
                    fallback={
                      <div>
                        <div style={{ "font-size": "10px", color: "var(--vscode-descriptionForeground)", "margin-bottom": "4px" }}>
                          System Prompt:
                          <span style={{ "margin-left": "6px", "font-style": "italic" }}>
                            {agent.systemPrompt.length > 60 ? agent.systemPrompt.slice(0, 60) + "…" : agent.systemPrompt}
                          </span>
                        </div>
                        <button
                          onClick={() => { setEditingPrompt(agent.id); setPromptDraft(agent.systemPrompt) }}
                          style={{ ...btnGhost, "font-size": "11px" }}
                        >
                          Edit System Prompt →
                        </button>
                      </div>
                    }
                  >
                    <div>
                      <div style={{ "font-size": "10px", "font-weight": "600", color: "var(--vscode-descriptionForeground)", "margin-bottom": "4px" }}>
                        System Prompt
                      </div>
                      <textarea
                        value={promptDraft()}
                        onInput={(e) => setPromptDraft(e.currentTarget.value)}
                        rows={4}
                        style={{
                          ...inputStyle,
                          resize: "vertical",
                          "font-family": "var(--vscode-editor-font-family, monospace)",
                          "font-size": "11px",
                        }}
                      />
                      <div style={{ display: "flex", gap: "8px", "margin-top": "6px" }}>
                        <button onClick={() => savePrompt(agent.id)} style={btnPrimary}>Save</button>
                        <button onClick={() => setEditingPrompt(null)} style={btnSecondary}>Cancel</button>
                      </div>
                    </div>
                  </Show>
                </div>
              )}
            </For>
          </div>

          <button
            onClick={() => vscode.postMessage({ type: "openclawCreateAgent" } as any)}
            style={{ ...btnSecondary, "margin-top": "8px" }}
          >
            + Create Agent
          </button>
        </Show>
      </section>

      {/* ════════════════════════════════════════════════════════════════════════
          SECTION 6 — MESSAGE LOG
          ════════════════════════════════════════════════════════════════════════ */}
      <section style={{ ...sectionWrapStyle }}>
        <SectionHeader
          title="Message Log"
          open={logOpen()}
          onToggle={() => setLogOpen(!logOpen())}
          count={log().length}
          action={{ label: "Clear", onClick: clearLog }}
        />

        <Show when={logOpen()}>
          <div style={{ ...sectionBodyTableStyle }}>
            {/* Header */}
            <div style={{
              display: "grid",
              "grid-template-columns": "80px 80px 30px 1fr 90px 60px 50px",
              padding: "6px 12px",
              "font-size": "10px",
              "font-weight": "700",
              "text-transform": "uppercase",
              color: "var(--vscode-descriptionForeground)",
              "border-bottom": "1px solid var(--vscode-panel-border)",
            }}>
              <span>Time</span>
              <span>Channel</span>
              <span>Dir</span>
              <span>Preview</span>
              <span>Model</span>
              <span>Latency</span>
              <span>Status</span>
            </div>

            <Show
              when={log().length > 0}
              fallback={
                <div style={{ padding: "14px 12px", "font-size": "11px", color: "var(--vscode-descriptionForeground)" }}>
                  No messages logged yet.
                </div>
              }
            >
              <div style={{ "max-height": "300px", "overflow-y": "auto" }}>
                <For each={log()}>
                  {(entry, i) => (
                    <div style={{
                      display: "grid",
                      "grid-template-columns": "80px 80px 30px 1fr 90px 60px 50px",
                      "align-items": "center",
                      padding: "6px 12px",
                      "border-top": i() === 0 ? "none" : "1px solid var(--vscode-panel-border)",
                      background: i() % 2 === 0 ? "transparent" : "rgba(255,255,255,0.02)",
                      "font-size": "11px",
                    }}>
                      <span style={{ color: "var(--vscode-descriptionForeground)", "white-space": "nowrap" }}>
                        {formatTime(entry.timestamp)}
                      </span>
                      <span style={{ "text-transform": "capitalize" }}>{entry.channel}</span>
                      <span style={{
                        "font-size": "11px",
                        color: entry.direction === "in" ? "#4a9eff" : "#9b59b6",
                        "font-weight": "700",
                        "text-align": "center",
                        "white-space": "nowrap",
                      }}
                        title={entry.direction === "in" ? "Incoming" : "Outgoing"}
                      >
                        {entry.direction === "in" ? "↓ in" : "↑ out"}
                      </span>
                      <span style={{
                        overflow: "hidden",
                        "text-overflow": "ellipsis",
                        "white-space": "nowrap",
                        color: "var(--vscode-foreground)",
                      }}>
                        {entry.preview}
                      </span>
                      <span style={{
                        "font-family": "var(--vscode-editor-font-family, monospace)",
                        color: "var(--vscode-descriptionForeground)",
                        "font-size": "10px",
                        overflow: "hidden",
                        "text-overflow": "ellipsis",
                        "white-space": "nowrap",
                        "min-width": "0",
                      }}
                        title={entry.model}
                      >
                        {entry.model}
                      </span>
                      <span style={{ color: "var(--vscode-descriptionForeground)" }}>
                        {entry.latency_ms}ms
                      </span>
                      <span style={{ display: "flex", "align-items": "center", gap: "4px" }}>
                        <Dot status={entry.status} />
                        <span style={{ "font-size": "10px", color: statusColor(entry.status) }}>{entry.status}</span>
                      </span>
                    </div>
                  )}
                </For>
              </div>
            </Show>
          </div>

          <div style={{ display: "flex", gap: "8px", "margin-top": "8px" }}>
            <button
              onClick={() => vscode.postMessage({ type: "openclawExportLog" } as any)}
              style={btnSecondary}
            >
              Export Log
            </button>
          </div>
        </Show>
      </section>

      {/* ════════════════════════════════════════════════════════════════════════
          SECTION 7 — QUICK SETUP WIZARD
          ════════════════════════════════════════════════════════════════════════ */}
      <section style={{ ...sectionWrapStyle }}>
        <SectionHeader
          title={wizardDone() ? "Setup Complete" : "Quick Setup Wizard"}
          open={wizardOpen()}
          onToggle={() => setWizardOpen(!wizardOpen())}
        />

        <Show when={wizardOpen()}>
          <Show
            when={!wizardDone()}
            fallback={
              <div style={{
                ...cardStyle,
                "text-align": "center",
                padding: "24px",
              }}>
                <div style={{ "font-size": "28px", "margin-bottom": "8px" }}>✓</div>
                <div style={{ "font-size": "15px", "font-weight": "700", color: "var(--vscode-testing-iconPassed)", "margin-bottom": "4px" }}>
                  Setup complete!
                </div>
                <div style={{ "font-size": "11px", color: "var(--vscode-descriptionForeground)" }}>
                  OpenClaw is configured and ready to route messages.
                </div>
              </div>
            }
          >
            <div style={{ ...cardStyle, display: "flex", "flex-direction": "column", gap: "12px" }}>
              {/* Step 1 */}
              <div style={{ display: "flex", gap: "12px", "align-items": "flex-start" }}>
                <div style={{
                  "min-width": "24px", height: "24px", "border-radius": "50%",
                  background: status()?.connected ? "var(--vscode-testing-iconPassed)" : "var(--vscode-button-background)",
                  color: "white", display: "flex", "align-items": "center", "justify-content": "center",
                  "font-size": "12px", "font-weight": "700", "flex-shrink": "0",
                }}>
                  {status()?.connected ? "✓" : "1"}
                </div>
                <div style={{ flex: "1" }}>
                  <div style={{ "font-size": "12px", "font-weight": "700", "margin-bottom": "2px" }}>
                    Start the OpenClaw Gateway
                  </div>
                  <div style={{ "font-size": "11px", color: "var(--vscode-descriptionForeground)", "margin-bottom": "6px" }}>
                    First-time setup: run <code style={{ "font-family": "var(--vscode-editor-font-family, monospace)", background: "var(--vscode-textBlockQuote-background)", padding: "1px 4px", "border-radius": "3px" }}>openclaw onboard --install-daemon</code>.
                    Subsequent starts: <code style={{ "font-family": "var(--vscode-editor-font-family, monospace)", background: "var(--vscode-textBlockQuote-background)", padding: "1px 4px", "border-radius": "3px" }}>node scripts/run-node.mjs</code> or <code style={{ "font-family": "var(--vscode-editor-font-family, monospace)", background: "var(--vscode-textBlockQuote-background)", padding: "1px 4px", "border-radius": "3px" }}>openclaw</code>.
                    Requires Node 22.14+ (Node 24 recommended).
                  </div>
                  <Show when={!status()?.connected}>
                    <button onClick={connect} style={btnPrimary}>Connect to Gateway</button>
                  </Show>
                </div>
              </div>

              {/* Step 2 */}
              <div style={{ display: "flex", gap: "12px", "align-items": "flex-start" }}>
                <div style={{
                  "min-width": "24px", height: "24px", "border-radius": "50%",
                  background: anyChannelConfigured() ? "var(--vscode-testing-iconPassed)" : "var(--vscode-button-secondaryBackground)",
                  color: anyChannelConfigured() ? "white" : "var(--vscode-button-secondaryForeground)",
                  display: "flex", "align-items": "center", "justify-content": "center",
                  "font-size": "12px", "font-weight": "700", "flex-shrink": "0",
                }}>
                  {anyChannelConfigured() ? "✓" : "2"}
                </div>
                <div style={{ flex: "1" }}>
                  <div style={{ "font-size": "12px", "font-weight": "700", "margin-bottom": "2px" }}>
                    Pick Your Channels
                  </div>
                  <div style={{ "font-size": "11px", color: "var(--vscode-descriptionForeground)", "margin-bottom": "6px" }}>
                    Enable at least one channel above (Telegram, Discord, WhatsApp, WebChat, Teams, Matrix, etc.) and add its bot token or API key.
                  </div>
                  <button onClick={() => { setChannelOpen(true); }} style={btnSecondary}>
                    Go to Channel Setup ↑
                  </button>
                </div>
              </div>

              {/* Step 3 */}
              <div style={{ display: "flex", gap: "12px", "align-items": "flex-start" }}>
                <div style={{
                  "min-width": "24px", height: "24px", "border-radius": "50%",
                  background: models().some((m) => m.available) ? "var(--vscode-testing-iconPassed)" : "var(--vscode-button-secondaryBackground)",
                  color: models().some((m) => m.available) ? "white" : "var(--vscode-button-secondaryForeground)",
                  display: "flex", "align-items": "center", "justify-content": "center",
                  "font-size": "12px", "font-weight": "700", "flex-shrink": "0",
                }}>
                  {models().some((m) => m.available) ? "✓" : "3"}
                </div>
                <div style={{ flex: "1" }}>
                  <div style={{ "font-size": "12px", "font-weight": "700", "margin-bottom": "2px" }}>
                    Add Local Models
                  </div>
                  <div style={{ "font-size": "11px", color: "var(--vscode-descriptionForeground)", "margin-bottom": "6px" }}>
                    Make sure Ollama or LM Studio is running, then scan for available models.
                  </div>
                  <button onClick={scanForModels} disabled={scanning()} style={{ ...btnSecondary, opacity: scanning() ? "0.6" : "1" }}>
                    {scanning() ? "Scanning…" : "Scan for Models"}
                  </button>
                </div>
              </div>

              {/* Step 4 */}
              <div style={{ display: "flex", gap: "12px", "align-items": "flex-start" }}>
                <div style={{
                  "min-width": "24px", height: "24px", "border-radius": "50%",
                  background: "var(--vscode-button-secondaryBackground)",
                  color: "var(--vscode-button-secondaryForeground)",
                  display: "flex", "align-items": "center", "justify-content": "center",
                  "font-size": "12px", "font-weight": "700", "flex-shrink": "0",
                }}>
                  4
                </div>
                <div style={{ flex: "1" }}>
                  <div style={{ "font-size": "12px", "font-weight": "700", "margin-bottom": "2px" }}>
                    Test It Out
                  </div>
                  <div style={{ "font-size": "11px", color: "var(--vscode-descriptionForeground)", "margin-bottom": "6px" }}>
                    Open WebChat and send a message to verify the full pipeline is working end-to-end.
                  </div>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <button onClick={() => openUrl("/webchat")} style={btnPrimary}>
                      Open WebChat →
                    </button>
                    <button onClick={() => setWizardDone(true)} style={btnSecondary}>
                      Mark Setup Complete
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </Show>
        </Show>
      </section>

      {/* ════════════════════════════════════════════════════════════════════════
          SECTION A — LIVE MESSAGE FLOW VISUALIZER
          ════════════════════════════════════════════════════════════════════════ */}
      <section style={{ ...sectionWrapStyle }}>
        <SectionHeader
          title="Live Message Flow Visualizer"
          open={flowOpen()}
          onToggle={() => setFlowOpen(!flowOpen())}
          action={{ label: flowActive() ? "⏹ Stop" : "▶ Animate", onClick: () => setFlowActive(!flowActive()) }}
        />
        <Show when={flowOpen()}>
          <div style={{ ...cardStyle, padding: "0.6rem" }}>
            <div style={{ "font-size": "10px", color: "var(--vscode-descriptionForeground)", "margin-bottom": "6px" }}>
              Real-time message routing: channels → OpenClaw → models
            </div>
            {/* SVG flow graph */}
            <svg
              viewBox="0 0 520 440"
              style={{ width: "100%", height: "auto", display: "block", background: "var(--vscode-editor-background)", "border-radius": "4px" }}
            >
              {/* Left channel nodes */}
              <For each={FLOW_LEFT_CHANNELS}>
                {(ch, i) => {
                  const y = 22 + i() * 20
                  const msgCount = flowMsgCounts()[ch] ?? 0
                  const isActive = msgCount > 0
                  return (
                    <>
                      <rect x="4" y={y - 7} width="90" height="14" rx="3"
                        fill={isActive ? "rgba(74,158,255,0.18)" : "rgba(255,255,255,0.04)"}
                        stroke={isActive ? "#4a9eff" : "rgba(255,255,255,0.12)"}
                        stroke-width="0.8"
                      />
                      <text x="8" y={y + 4} font-size="7" fill={isActive ? "#4a9eff" : "rgba(255,255,255,0.4)"}>
                        {ch.length > 11 ? ch.slice(0, 11) + "…" : ch}
                      </text>
                      {/* Edge msg counter */}
                      <Show when={isActive}>
                        <text x="78" y={y - 9} font-size="6" fill="rgba(74,158,255,0.7)">{msgCount}</text>
                      </Show>
                      {/* Path to OpenClaw */}
                      <path
                        d={`M94,${y} C180,${y} 185,220 215,220`}
                        stroke={isActive ? "#4a9eff" : "rgba(255,255,255,0.06)"}
                        stroke-width={isActive ? "0.8" : "0.4"}
                        fill="none"
                        stroke-dasharray={isActive ? "none" : "2,3"}
                      />
                      {/* Animated dot */}
                      <Show when={flowActive() && isActive}>
                        <circle r="2.5" fill="#4a9eff" opacity="0.9">
                          <animateMotion
                            dur={`${1.2 + i() * 0.07}s`}
                            repeatCount="indefinite"
                            begin={`${(i() * 0.13) % 1.5}s`}
                          >
                            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                            <mpath {...({ "xlink:href": `#path-l-${i()}` } as any)} />
                          </animateMotion>
                        </circle>
                        <path id={`path-l-${i()}`} d={`M94,${y} C180,${y} 185,220 215,220`} fill="none" />
                      </Show>
                    </>
                  )
                }}
              </For>

              {/* OpenClaw central node */}
              <rect x="208" y="203" width="80" height="34" rx="5"
                fill="rgba(210,100,50,0.22)"
                stroke="rgba(210,100,50,0.8)"
                stroke-width="1.5"
              />
              <text x="248" y="217" font-size="8" font-weight="bold" fill="#cc785c" text-anchor="middle">OpenClaw</text>
              <text x="248" y="228" font-size="6.5" fill="rgba(204,120,92,0.7)" text-anchor="middle">:18789</text>

              {/* Right model nodes */}
              <For each={FLOW_RIGHT_MODELS}>
                {(m, i) => {
                  const y = 80 + i() * 50
                  return (
                    <>
                      <rect x="420" y={y - 9} width="92" height="18" rx="3"
                        fill="rgba(155,89,182,0.18)"
                        stroke="rgba(155,89,182,0.5)"
                        stroke-width="0.8"
                      />
                      <text x="424" y={y + 4} font-size="7" fill="rgba(155,89,182,0.9)">
                        {m.length > 13 ? m.slice(0, 13) + "…" : m}
                      </text>
                      {/* Path from OpenClaw */}
                      <path
                        d={`M288,220 C350,220 380,${y} 420,${y}`}
                        stroke="rgba(155,89,182,0.3)"
                        stroke-width="0.7"
                        fill="none"
                      />
                      <Show when={flowActive()}>
                        <circle r="2.5" fill="#9b59b6" opacity="0.85">
                          <animateMotion dur={`${1.5 + i() * 0.2}s`} repeatCount="indefinite" begin={`${i() * 0.25}s`}>
                            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                            <mpath {...({ "xlink:href": `#path-r-${i()}` } as any)} />
                          </animateMotion>
                        </circle>
                        <path id={`path-r-${i()}`} d={`M288,220 C350,220 380,${y} 420,${y}`} fill="none" />
                      </Show>
                    </>
                  )
                }}
              </For>

              {/* Legend */}
              <circle cx="12" cy="428" r="3" fill="#4a9eff" />
              <text x="19" y="432" font-size="7" fill="rgba(255,255,255,0.45)">Channel → OpenClaw</text>
              <circle cx="130" cy="428" r="3" fill="#9b59b6" />
              <text x="137" y="432" font-size="7" fill="rgba(255,255,255,0.45)">OpenClaw → Model</text>
              <text x="280" y="432" font-size="7" fill="rgba(255,255,255,0.3)">
                {flowActive() ? "● live" : "○ paused"}
              </text>
            </svg>
            <div style={{ "margin-top": "6px", display: "flex", gap: "8px", "flex-wrap": "wrap" }}>
              <button
                onClick={() => setFlowActive(!flowActive())}
                style={{ ...btnPrimary, "font-size": "11px" }}
              >
                {flowActive() ? "⏹ Stop Animation" : "▶ Animate Flow"}
              </button>
              <span style={{ "font-size": "10px", color: "var(--vscode-descriptionForeground)", "align-self": "center" }}>
                {Object.values(flowMsgCounts()).reduce((a, b) => a + b, 0).toLocaleString()} msgs tracked
              </span>
            </div>
          </div>
        </Show>
      </section>

      {/* ════════════════════════════════════════════════════════════════════════
          SECTION B — CHANNEL HEALTH HEATMAP
          ════════════════════════════════════════════════════════════════════════ */}
      <section style={{ ...sectionWrapStyle }}>
        <SectionHeader
          title="Channel Health Heatmap (7-day)"
          open={heatmapOpen()}
          onToggle={() => setHeatmapOpen(!heatmapOpen())}
        />
        <Show when={heatmapOpen()}>
          <div style={{ ...cardStyle }}>
            {/* Channel picker */}
            <div style={{ display: "flex", gap: "6px", "margin-bottom": "10px", "flex-wrap": "wrap" }}>
              <For each={Object.keys(HEATMAP_DATA)}>
                {(ch) => (
                  <button
                    onClick={() => setHeatmapChannel(ch)}
                    style={{
                      ...btnSecondary,
                      "font-size": "10px",
                      padding: "3px 10px",
                      background: heatmapChannel() === ch ? "var(--vscode-button-background)" : "var(--vscode-button-secondaryBackground)",
                      color: heatmapChannel() === ch ? "var(--vscode-button-foreground)" : "var(--vscode-button-secondaryForeground)",
                      transition: "background 0.15s",
                    }}
                  >
                    {ch}
                  </button>
                )}
              </For>
            </div>

            {/* Heatmap grid */}
            <div style={{ "font-size": "9px", color: "var(--vscode-descriptionForeground)", "margin-bottom": "4px" }}>
              Hour →  (0h to 23h)
            </div>
            <div style={{ display: "flex", gap: "1px" }}>
              {/* Day labels */}
              <div style={{ display: "flex", "flex-direction": "column", gap: "1px", "margin-right": "4px" }}>
                <For each={["7d","6d","5d","4d","3d","2d","1d"]}>
                  {(lbl) => (
                    <div style={{ height: "14px", "line-height": "14px", "font-size": "8px", color: "var(--vscode-descriptionForeground)", "white-space": "nowrap" }}>
                      {lbl}
                    </div>
                  )}
                </For>
              </div>
              {/* Grid */}
              <div style={{ flex: "1", display: "flex", "flex-direction": "column", gap: "1px" }}>
                <For each={HEATMAP_DATA[heatmapChannel()] ?? []}>
                  {(dayRow, dayIdx) => (
                    <div style={{ display: "flex", gap: "1px" }}>
                      <For each={dayRow}>
                        {(count, hIdx) => {
                          const maxVal = 120
                          const intensity = Math.min(count / maxVal, 1)
                          const r = Math.round(30 + intensity * 10)
                          const g = Math.round(40 + intensity * 140)
                          const b = Math.round(30 + intensity * 30)
                          const bg = count === 0 ? "rgba(255,255,255,0.05)" : `rgba(${r},${g},${b},${0.3 + intensity * 0.7})`
                          const isHovered = heatmapHover()?.day === dayIdx() && heatmapHover()?.hour === hIdx()
                          return (
                            <div
                              style={{
                                flex: "1",
                                height: "14px",
                                background: bg,
                                "border-radius": "1px",
                                cursor: "pointer",
                                outline: isHovered ? "1px solid #4a9eff" : "none",
                                transition: "outline 0.1s",
                              }}
                              onMouseEnter={() => setHeatmapHover({ day: dayIdx(), hour: hIdx(), count })}
                              onMouseLeave={() => setHeatmapHover(null)}
                            />
                          )
                        }}
                      </For>
                    </div>
                  )}
                </For>
              </div>
            </div>

            {/* Hover tooltip */}
            <div style={{ "min-height": "18px", "margin-top": "6px", "font-size": "10px", color: "var(--vscode-descriptionForeground)" }}>
              <Show
                when={heatmapHover()}
                fallback={<span>Hover a cell to see exact count</span>}
              >
                Day -{6 - heatmapHover()!.day} ago, {heatmapHover()!.hour}:00 — {" "}
                <strong style={{ color: "var(--vscode-foreground)" }}>{heatmapHover()!.count} messages</strong>
              </Show>
            </div>

            {/* Color scale legend */}
            <div style={{ display: "flex", "align-items": "center", gap: "6px", "margin-top": "8px", "font-size": "9px", color: "var(--vscode-descriptionForeground)" }}>
              <span>Low</span>
              <div style={{ display: "flex", gap: "1px" }}>
                <For each={[0.0, 0.2, 0.4, 0.6, 0.8, 1.0]}>
                  {(v) => {
                    const r = Math.round(30 + v * 10)
                    const g = Math.round(40 + v * 140)
                    const b = Math.round(30 + v * 30)
                    return (
                      <div style={{ width: "14px", height: "10px", background: v === 0 ? "rgba(255,255,255,0.05)" : `rgba(${r},${g},${b},${0.3 + v * 0.7})`, "border-radius": "1px" }} />
                    )
                  }}
                </For>
              </div>
              <span>High</span>
            </div>
          </div>
        </Show>
      </section>

      {/* ════════════════════════════════════════════════════════════════════════
          SECTION C — MODEL PERFORMANCE BY CHANNEL
          ════════════════════════════════════════════════════════════════════════ */}
      <section style={{ ...sectionWrapStyle }}>
        <SectionHeader
          title="Model Performance by Channel"
          open={perfOpen()}
          onToggle={() => setPerfOpen(!perfOpen())}
        />
        <Show when={perfOpen()}>
          <div style={{ ...sectionBodyTableStyle }}>
            {/* Table header */}
            <div style={{
              display: "grid",
              "grid-template-columns": "1.4fr 100px 90px 1fr 80px",
              padding: "6px 12px",
              "font-size": "10px",
              "font-weight": "700",
              "text-transform": "uppercase",
              color: "var(--vscode-descriptionForeground)",
              "border-bottom": "1px solid var(--vscode-panel-border)",
              gap: "0",
            }}>
              <For each={[
                { col: "channelName" as const, label: "Channel" },
                { col: "avgResponseMs" as const, label: "Avg Resp" },
                { col: "satisfactionPct" as const, label: "Satisfaction" },
                { col: "model" as const, label: "Model" },
                { col: "costPerDay" as const, label: "Cost/Day" },
              ]}>
                {({ col, label }) => (
                  <span
                    style={{ cursor: "pointer", "user-select": "none", display: "flex", "align-items": "center", gap: "3px" }}
                    onClick={() => {
                      if (perfSort() === col) setPerfAsc(!perfAsc())
                      else { setPerfSort(col); setPerfAsc(true) }
                    }}
                  >
                    {label}
                    <Show when={perfSort() === col}>
                      <span style={{ "font-size": "9px" }}>{perfAsc() ? "↑" : "↓"}</span>
                    </Show>
                  </span>
                )}
              </For>
            </div>
            <For each={sortedPerf()}>
              {(row, i) => {
                const underperform = row.avgResponseMs > 1500 || row.satisfactionPct < 70
                return (
                  <div style={{
                    display: "grid",
                    "grid-template-columns": "1.4fr 100px 90px 1fr 80px",
                    "align-items": "center",
                    padding: "7px 12px",
                    "border-top": i() === 0 ? "none" : "1px solid var(--vscode-panel-border)",
                    background: underperform
                      ? "rgba(210,153,34,0.08)"
                      : i() % 2 === 0 ? "transparent" : "rgba(255,255,255,0.02)",
                    transition: "background 0.15s",
                  }}>
                    <span style={{ "font-size": "12px", "font-weight": "500", display: "flex", gap: "6px", "align-items": "center" }}>
                      {underperform && <span style={{ color: "rgba(210,153,34,0.9)", "font-size": "10px" }}>⚠</span>}
                      {row.channelName}
                    </span>
                    <span style={{ "font-size": "11px", color: row.avgResponseMs > 1500 ? "rgba(210,153,34,0.9)" : "var(--vscode-foreground)" }}>
                      {row.avgResponseMs}ms
                    </span>
                    <div style={{ display: "flex", "align-items": "center", gap: "5px" }}>
                      <div style={{ flex: "1", height: "5px", background: "rgba(255,255,255,0.08)", "border-radius": "3px", overflow: "hidden" }}>
                        <div style={{
                          width: `${row.satisfactionPct}%`,
                          height: "100%",
                          background: row.satisfactionPct >= 80 ? "var(--vscode-testing-iconPassed)" : row.satisfactionPct >= 70 ? "rgba(210,153,34,0.8)" : "var(--vscode-testing-iconFailed)",
                          "border-radius": "3px",
                          transition: "width 0.3s",
                        }} />
                      </div>
                      <span style={{ "font-size": "10px", "white-space": "nowrap", color: "var(--vscode-descriptionForeground)" }}>
                        {row.satisfactionPct}%
                      </span>
                    </div>
                    <span style={{ "font-size": "10px", "font-family": "var(--vscode-editor-font-family, monospace)", color: "var(--vscode-descriptionForeground)", overflow: "hidden", "text-overflow": "ellipsis", "white-space": "nowrap", "min-width": "0" }}
                      title={row.model}
                    >
                      {row.model}
                    </span>
                    <span style={{ "font-size": "11px", color: "var(--vscode-descriptionForeground)" }}>
                      {row.costPerDay === 0 ? "Free (local)" : `$${row.costPerDay.toFixed(2)}`}
                    </span>
                  </div>
                )
              }}
            </For>
          </div>
          <p style={{ "font-size": "10px", color: "var(--vscode-descriptionForeground)", margin: "6px 0 0" }}>
            ⚠ Amber = avg response &gt; 1.5s or satisfaction &lt; 70%. Click column headers to sort.
          </p>
        </Show>
      </section>

      {/* ════════════════════════════════════════════════════════════════════════
          SECTION D — WEBHOOK EVENT INSPECTOR
          ════════════════════════════════════════════════════════════════════════ */}
      <section style={{ ...sectionWrapStyle }}>
        <SectionHeader
          title="Webhook Event Inspector"
          open={inspectorOpen()}
          onToggle={() => setInspectorOpen(!inspectorOpen())}
          count={filteredEvents().length}
          action={{ label: "↻ Refresh", onClick: () => setWebhookEvents(_genWebhookEvents()) }}
        />
        <Show when={inspectorOpen()}>
          {/* Filters */}
          <div style={{ display: "flex", gap: "8px", "margin-bottom": "8px", "flex-wrap": "wrap", "align-items": "center" }}>
            <select
              style={{ ...inputStyle, width: "auto", "min-width": "110px" }}
              onChange={(e) => setWhFilter(e.currentTarget.value)}
            >
              <option value="all">All Platforms</option>
              <For each={_platforms}>
                {(p) => <option value={p}>{p}</option>}
              </For>
            </select>
            <select
              style={{ ...inputStyle, width: "auto", "min-width": "100px" }}
              onChange={(e) => setWhStatusFilter(e.currentTarget.value)}
            >
              <option value="all">All Status</option>
              <option value="sent">✓ Sent</option>
              <option value="retry">⚠ Retry</option>
              <option value="failed">✗ Failed</option>
            </select>
            <span style={{ "font-size": "10px", color: "var(--vscode-descriptionForeground)" }}>
              {filteredEvents().length} events
            </span>
          </div>

          <div style={{ ...sectionBodyTableStyle }}>
            {/* Header */}
            <div style={{
              display: "grid",
              "grid-template-columns": "70px 80px 1fr 55px 80px 50px",
              padding: "6px 12px",
              "font-size": "10px",
              "font-weight": "700",
              "text-transform": "uppercase",
              color: "var(--vscode-descriptionForeground)",
              "border-bottom": "1px solid var(--vscode-panel-border)",
            }}>
              <span>Time</span>
              <span>Platform</span>
              <span>Preview</span>
              <span>Proc.</span>
              <span>Model</span>
              <span style={{ "text-align": "center" }}>Status</span>
            </div>
            <div style={{ "max-height": "320px", "overflow-y": "auto" }}>
              <Show
                when={filteredEvents().length > 0}
                fallback={
                  <div style={{ padding: "12px", "font-size": "11px", color: "var(--vscode-descriptionForeground)" }}>
                    No events match filters.
                  </div>
                }
              >
                <For each={filteredEvents()}>
                  {(ev, i) => {
                    const statusIcon = ev.status === "sent" ? "✓" : ev.status === "retry" ? "⚠" : "✗"
                    const statusColor2 = ev.status === "sent"
                      ? "var(--vscode-testing-iconPassed)"
                      : ev.status === "retry"
                      ? "rgba(210,153,34,0.9)"
                      : "var(--vscode-testing-iconFailed)"
                    return (
                      <div style={{
                        display: "grid",
                        "grid-template-columns": "70px 80px 1fr 55px 80px 50px",
                        "align-items": "center",
                        padding: "6px 12px",
                        "border-top": i() === 0 ? "none" : "1px solid var(--vscode-panel-border)",
                        background: i() % 2 === 0 ? "transparent" : "rgba(255,255,255,0.02)",
                        "font-size": "11px",
                        transition: "background 0.1s",
                      }}>
                        <span style={{ color: "var(--vscode-descriptionForeground)", "white-space": "nowrap" }}>
                          {formatTime(ev.timestamp)}
                        </span>
                        <span style={{ "font-size": "10px", display: "flex", "align-items": "center", gap: "4px" }}>
                          <span style={{
                            "font-size": "9px",
                            background: "var(--vscode-badge-background)",
                            color: "var(--vscode-badge-foreground)",
                            padding: "1px 5px",
                            "border-radius": "4px",
                            "text-transform": "capitalize",
                            "font-weight": "600",
                          }}>
                            {ev.platform}
                          </span>
                        </span>
                        <span style={{ overflow: "hidden", "text-overflow": "ellipsis", "white-space": "nowrap", color: "var(--vscode-foreground)" }}>
                          {ev.preview.length > 40 ? ev.preview.slice(0, 40) + "…" : ev.preview}
                        </span>
                        <span style={{ color: "var(--vscode-descriptionForeground)" }}>
                          {ev.processingMs}ms
                        </span>
                        <span style={{ "font-size": "10px", "font-family": "var(--vscode-editor-font-family, monospace)", color: "var(--vscode-descriptionForeground)", overflow: "hidden", "text-overflow": "ellipsis", "white-space": "nowrap", "min-width": "0" }}
                          title={ev.model}
                        >
                          {ev.model}
                        </span>
                        <span style={{ "text-align": "center", color: statusColor2, "font-weight": "700", "font-size": "12px" }}>
                          {statusIcon}
                        </span>
                      </div>
                    )
                  }}
                </For>
              </Show>
            </div>
          </div>
        </Show>
      </section>

      {/* ════════════════════════════════════════════════════════════════════════
          SECTION E — QUICK CONNECT WIZARD
          ════════════════════════════════════════════════════════════════════════ */}
      <section style={{ ...sectionWrapStyle }}>
        <SectionHeader
          title="Quick Connect Wizard"
          open={qcOpen()}
          onToggle={() => setQcOpen(!qcOpen())}
          action={{ label: "+ New Channel", onClick: () => { setQcOpen(true); setQcStep(1) } }}
        />
        <Show when={qcOpen()}>
          <div style={{ ...cardStyle }}>
            {/* Step indicator */}
            <div style={{ display: "flex", gap: "8px", "align-items": "center", "margin-bottom": "16px" }}>
              <For each={[1, 2, 3]}>
                {(s) => (
                  <>
                    <div style={{
                      width: "24px", height: "24px", "border-radius": "50%",
                      background: qcStep() >= s ? "var(--vscode-button-background)" : "var(--vscode-button-secondaryBackground)",
                      color: qcStep() >= s ? "var(--vscode-button-foreground)" : "var(--vscode-button-secondaryForeground)",
                      display: "flex", "align-items": "center", "justify-content": "center",
                      "font-size": "11px", "font-weight": "700", "flex-shrink": "0",
                      transition: "background 0.2s",
                    }}>
                      {qcStep() > s ? "✓" : s}
                    </div>
                    <Show when={s < 3}>
                      <div style={{
                        flex: "1", height: "2px",
                        background: qcStep() > s ? "var(--vscode-button-background)" : "var(--vscode-panel-border)",
                        transition: "background 0.2s",
                      }} />
                    </Show>
                  </>
                )}
              </For>
              <span style={{ "margin-left": "8px", "font-size": "11px", "font-weight": "600" }}>
                {qcStep() === 1 ? "Pick Platform" : qcStep() === 2 ? "Enter Credentials" : "Pick Model & Test"}
              </span>
            </div>

            {/* Step 1 — platform grid */}
            <Show when={qcStep() === 1}>
              <div style={{ display: "grid", "grid-template-columns": "repeat(5, 1fr)", gap: "6px", "margin-bottom": "12px" }}>
                <For each={FLOW_LEFT_CHANNELS}>
                  {(ch) => (
                    <button
                      onClick={() => setQcPlatform(ch)}
                      style={{
                        background: qcPlatform() === ch ? "var(--vscode-button-background)" : "var(--vscode-button-secondaryBackground)",
                        color: qcPlatform() === ch ? "var(--vscode-button-foreground)" : "var(--vscode-button-secondaryForeground)",
                        border: qcPlatform() === ch ? "1px solid var(--vscode-focusBorder)" : "1px solid var(--vscode-panel-border)",
                        "border-radius": "4px",
                        padding: "6px 4px",
                        cursor: "pointer",
                        "font-size": "9px",
                        "font-weight": "600",
                        "text-align": "center",
                        "text-transform": "capitalize",
                        transition: "background 0.15s, border 0.15s",
                        overflow: "hidden",
                        "text-overflow": "ellipsis",
                        "white-space": "nowrap",
                      }}
                    >
                      {ch}
                    </button>
                  )}
                </For>
              </div>
              <div style={{ display: "flex", gap: "8px" }}>
                <button
                  onClick={() => { if (qcPlatform()) setQcStep(2) }}
                  disabled={!qcPlatform()}
                  style={{ ...btnPrimary, opacity: qcPlatform() ? "1" : "0.5" }}
                >
                  Next →
                </button>
                <button onClick={() => setQcOpen(false)} style={btnSecondary}>Cancel</button>
              </div>
            </Show>

            {/* Step 2 — credentials */}
            <Show when={qcStep() === 2}>
              <div style={{ display: "flex", "flex-direction": "column", gap: "10px", "margin-bottom": "12px" }}>
                <div>
                  <label style={{ "font-size": "10px", "font-weight": "600", color: "var(--vscode-descriptionForeground)", display: "block", "margin-bottom": "4px" }}>
                    Platform: <strong style={{ color: "var(--vscode-foreground)", "text-transform": "capitalize" }}>{qcPlatform()}</strong>
                  </label>
                </div>
                <div>
                  <label style={{ "font-size": "10px", "font-weight": "600", color: "var(--vscode-descriptionForeground)", display: "block", "margin-bottom": "4px" }}>
                    Webhook URL (optional — auto-generated if blank)
                  </label>
                  <input
                    type="text"
                    value={qcWebhookUrl()}
                    onInput={(e) => setQcWebhookUrl(e.currentTarget.value)}
                    placeholder={`http://localhost:18789/webhook/${qcPlatform()}`}
                    style={{ ...inputStyle }}
                  />
                </div>
                <div>
                  <label style={{ "font-size": "10px", "font-weight": "600", color: "var(--vscode-descriptionForeground)", display: "block", "margin-bottom": "4px" }}>
                    Bot Token / API Key
                  </label>
                  <input
                    type="password"
                    value={qcToken()}
                    onInput={(e) => setQcToken(e.currentTarget.value)}
                    placeholder="Paste your token here…"
                    style={{ ...inputStyle }}
                  />
                </div>
              </div>
              <div style={{ display: "flex", gap: "8px" }}>
                <button onClick={() => setQcStep(1)} style={btnSecondary}>← Back</button>
                <button onClick={() => setQcStep(3)} style={btnPrimary}>Next →</button>
                <button onClick={() => setQcOpen(false)} style={btnSecondary}>Cancel</button>
              </div>
            </Show>

            {/* Step 3 — model + test */}
            <Show when={qcStep() === 3}>
              <div style={{ display: "flex", "flex-direction": "column", gap: "10px", "margin-bottom": "12px" }}>
                <div>
                  <label style={{ "font-size": "10px", "font-weight": "600", color: "var(--vscode-descriptionForeground)", display: "block", "margin-bottom": "4px" }}>
                    Assign Model
                  </label>
                  <select
                    style={{ ...inputStyle }}
                    onChange={(e) => setQcModel(e.currentTarget.value)}
                  >
                    <For each={models()}>
                      {(m) => <option value={m.id} selected={m.id === qcModel()}>{m.name}</option>}
                    </For>
                  </select>
                </div>
                <div>
                  <div style={{ "font-size": "10px", "font-weight": "600", color: "var(--vscode-descriptionForeground)", "margin-bottom": "6px" }}>
                    Test with "Hello from KiloCode"
                  </div>
                  <div style={{ display: "flex", gap: "8px", "align-items": "center" }}>
                    <button
                      onClick={qcRunTest}
                      disabled={qcTestResult() === "testing"}
                      style={{ ...btnSecondary, opacity: qcTestResult() === "testing" ? "0.6" : "1" }}
                    >
                      {qcTestResult() === "testing" ? "Testing…" : "Send Test Message"}
                    </button>
                    <Show when={qcTestResult() === "ok"}>
                      <span style={{ "font-size": "12px", color: "var(--vscode-testing-iconPassed)", "font-weight": "600" }}>
                        ✓ Message delivered successfully!
                      </span>
                    </Show>
                    <Show when={qcTestResult() === "fail"}>
                      <span style={{ "font-size": "12px", color: "var(--vscode-testing-iconFailed)", "font-weight": "600" }}>
                        ✗ Delivery failed — check token/URL
                      </span>
                    </Show>
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", gap: "8px" }}>
                <button onClick={() => setQcStep(2)} style={btnSecondary}>← Back</button>
                <button onClick={qcFinish} style={btnPrimary}>
                  ✓ Connect Channel
                </button>
                <button onClick={() => setQcOpen(false)} style={btnSecondary}>Cancel</button>
              </div>
            </Show>
          </div>
        </Show>
      </section>

      {/* ── Architecture info ────────────────────────────────────────────────────── */}
      <section style={{
        background: "var(--vscode-textBlockQuote-background)",
        "border-left": "3px solid var(--vscode-textLink-foreground)",
        padding: "10px 14px",
        "border-radius": "0 4px 4px 0",
      }}>
        <div style={{ "font-size": "11px", "font-weight": "700", "margin-bottom": "6px" }}>
          How OpenClaw Works
        </div>
        <pre style={{
          "font-size": "10px",
          margin: "0",
          color: "var(--vscode-descriptionForeground)",
          "font-family": "var(--vscode-editor-font-family, monospace)",
          "white-space": "pre-wrap",
          "line-height": "1.5",
          "overflow-x": "auto",
          "word-break": "break-all",
        }}>
{`20+ Platforms: WhatsApp · Telegram · Discord · Slack · Signal
iMessage · Google Chat · Matrix · IRC · Teams · LINE · WeChat …
                    │
                    ▼
        OpenClaw Gateway  (:18789)  ← this panel
                    │  routing rules → agent dispatch
                    ▼
        Local AI Model  (Ollama / LM Studio / OpenAI / Anthropic)
          model ID format:  <provider>/<model-id>
                    │  response
                    ▼
        OpenClaw Gateway  (format + send back)
                    │
                    ▼
        Originating Channel (reply)`}
        </pre>
        <p style={{ "font-size": "11px", color: "var(--vscode-descriptionForeground)", margin: "8px 0 0" }}>
          All messages stay local — no cloud API required.
          Config: <span style={{ "font-family": "var(--vscode-editor-font-family, monospace)" }}>~/.openclaw/openclaw.json</span> (JSON5).
          Workspace: <span style={{ "font-family": "var(--vscode-editor-font-family, monospace)" }}>~/.openclaw/workspace</span>.{" "}
          <a
            href="https://github.com/Ghenghis/openclaw"
            style={{ color: "var(--vscode-textLink-foreground)" }}
          >
            GitHub →
          </a>
        </p>
      </section>

    </div>
  )
}

export default OpenClawTab
