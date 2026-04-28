/**
 * AutoApproveService — persistence + audit trail for the AutoApproveTab UI.
 *
 * Stores three pieces of state in the extension's globalState:
 *   • kilo-code.autoApprove.conditions  — Array of allow/deny conditions
 *   • kilo-code.autoApprove.rateLimits  — { toolsPerMinute, enabled }
 *   • kilo-code.autoApprove.log         — Circular buffer of recent auto-approved actions
 *
 * The service is intentionally side-effect-free at construction time: we read
 * existing state lazily so a missing storage shape doesn't crash activation.
 */

import * as vscode from "vscode"

export type AutoApproveConditionType = "glob" | "count" | "window"
export type AutoApproveAction = "allow" | "deny"

export interface AutoApproveCondition {
  id: string
  type: AutoApproveConditionType
  /**
   * The condition value. Semantics depend on `type`:
   *   • glob  — a path glob string, e.g. "src/**\/*.ts"
   *   • count — a numeric file-count limit (stringified)
   *   • window — a time window expression, e.g. "09:00-17:00" or "30m"
   */
  value: string
  action: AutoApproveAction
}

export interface AutoApproveRateLimits {
  toolsPerMinute: number
  enabled: boolean
}

export interface AutoApproveLogEntry {
  timestamp: number
  action: string
  source: string
  conditionId?: string
}

const KEY_CONDITIONS = "kilo-code.autoApprove.conditions"
const KEY_RATE_LIMITS = "kilo-code.autoApprove.rateLimits"
const KEY_LOG = "kilo-code.autoApprove.log"

const LOG_BUFFER_SIZE = 100

const DEFAULT_RATE_LIMITS: AutoApproveRateLimits = {
  toolsPerMinute: 60,
  enabled: false,
}

export class AutoApproveService implements vscode.Disposable {
  constructor(private readonly context: vscode.ExtensionContext) {}

  // ─── Conditions ────────────────────────────────────────────────────

  getConditions(): AutoApproveCondition[] {
    const raw = this.context.globalState.get<AutoApproveCondition[]>(KEY_CONDITIONS, [])
    if (!Array.isArray(raw)) return []
    return raw.filter(isCondition)
  }

  async addCondition(input: Omit<AutoApproveCondition, "id"> & { id?: string }): Promise<AutoApproveCondition> {
    const condition: AutoApproveCondition = {
      id: input.id ?? makeId(),
      type: input.type,
      value: String(input.value ?? ""),
      action: input.action === "deny" ? "deny" : "allow",
    }
    const next = [...this.getConditions(), condition]
    await this.context.globalState.update(KEY_CONDITIONS, next)
    return condition
  }

  async removeCondition(id: string): Promise<boolean> {
    const before = this.getConditions()
    const next = before.filter((c) => c.id !== id)
    if (next.length === before.length) return false
    await this.context.globalState.update(KEY_CONDITIONS, next)
    return true
  }

  // ─── Rate limits ───────────────────────────────────────────────────

  getRateLimits(): AutoApproveRateLimits {
    const raw = this.context.globalState.get<Partial<AutoApproveRateLimits>>(KEY_RATE_LIMITS)
    if (!raw || typeof raw !== "object") return { ...DEFAULT_RATE_LIMITS }
    const tpm = typeof raw.toolsPerMinute === "number" && raw.toolsPerMinute >= 0
      ? Math.floor(raw.toolsPerMinute)
      : DEFAULT_RATE_LIMITS.toolsPerMinute
    return {
      toolsPerMinute: tpm,
      enabled: Boolean(raw.enabled),
    }
  }

  async setRateLimit(input: Partial<AutoApproveRateLimits>): Promise<AutoApproveRateLimits> {
    const current = this.getRateLimits()
    const next: AutoApproveRateLimits = {
      toolsPerMinute:
        typeof input.toolsPerMinute === "number" && input.toolsPerMinute >= 0
          ? Math.floor(input.toolsPerMinute)
          : current.toolsPerMinute,
      enabled: typeof input.enabled === "boolean" ? input.enabled : current.enabled,
    }
    await this.context.globalState.update(KEY_RATE_LIMITS, next)
    return next
  }

  /**
   * Returns the current count of log entries within the last 60s — useful
   * for the UI to show "X / Y tools used this minute".
   */
  getCountWindow(): { count: number; windowMs: number } {
    const since = Date.now() - 60_000
    const log = this.getLog()
    const count = log.filter((e) => e.timestamp >= since).length
    return { count, windowMs: 60_000 }
  }

  // ─── Audit log ─────────────────────────────────────────────────────

  getLog(limit = LOG_BUFFER_SIZE): AutoApproveLogEntry[] {
    const raw = this.context.globalState.get<AutoApproveLogEntry[]>(KEY_LOG, [])
    if (!Array.isArray(raw)) return []
    const entries = raw.filter(isLogEntry)
    if (limit > 0 && entries.length > limit) return entries.slice(-limit)
    return entries
  }

  async appendLog(entry: Omit<AutoApproveLogEntry, "timestamp"> & { timestamp?: number }): Promise<void> {
    const next: AutoApproveLogEntry = {
      timestamp: typeof entry.timestamp === "number" ? entry.timestamp : Date.now(),
      action: String(entry.action ?? ""),
      source: String(entry.source ?? ""),
      conditionId: typeof entry.conditionId === "string" ? entry.conditionId : undefined,
    }
    const log = this.getLog()
    log.push(next)
    // Circular buffer trim
    const trimmed = log.length > LOG_BUFFER_SIZE ? log.slice(-LOG_BUFFER_SIZE) : log
    await this.context.globalState.update(KEY_LOG, trimmed)
  }

  dispose(): void {
    /* state lives in globalState — nothing to release */
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────

function makeId(): string {
  return `cond_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

function isCondition(value: unknown): value is AutoApproveCondition {
  if (!value || typeof value !== "object") return false
  const v = value as Record<string, unknown>
  return (
    typeof v.id === "string" &&
    (v.type === "glob" || v.type === "count" || v.type === "window") &&
    typeof v.value === "string" &&
    (v.action === "allow" || v.action === "deny")
  )
}

function isLogEntry(value: unknown): value is AutoApproveLogEntry {
  if (!value || typeof value !== "object") return false
  const v = value as Record<string, unknown>
  return typeof v.timestamp === "number" && typeof v.action === "string" && typeof v.source === "string"
}
