import { Component, For, Show, createEffect, createMemo, createSignal, onCleanup, onMount } from "solid-js"
import { Select } from "@kilocode/kilo-ui/select"
import { IconButton } from "@kilocode/kilo-ui/icon-button"
import { useConfig } from "../../context/config"
import { useLanguage } from "../../context/language"
import { useVSCode } from "../../context/vscode"
import type { ExtensionMessage, PermissionLevel, PermissionRule } from "../../types/messages"

// ─── Auto-approve advanced controls (canary.11) ──────────────────────
type AutoApproveConditionType = "glob" | "count" | "window"
type AutoApproveAction = "allow" | "deny"

interface AutoApproveCondition {
  id: string
  type: AutoApproveConditionType
  value: string
  action: AutoApproveAction
}

interface AutoApproveRateLimits {
  toolsPerMinute: number
  enabled: boolean
}

interface AutoApproveLogEntry {
  timestamp: number
  action: string
  source: string
  conditionId?: string
}

interface LevelOption {
  value: PermissionLevel
  labelKey: string
}

const LEVEL_OPTIONS: LevelOption[] = [
  { value: "allow", labelKey: "settings.autoApprove.level.allow" },
  { value: "ask", labelKey: "settings.autoApprove.level.ask" },
  { value: "deny", labelKey: "settings.autoApprove.level.deny" },
]

interface GranularConfig {
  wildcardKey: string
  addKey: string
  placeholderKey: string
}

interface ToolDef {
  id: string
  descriptionKey: string
  granular?: GranularConfig
}

interface GranularToolDef extends ToolDef {
  granular: GranularConfig
}

/** Grouped tool: maps a single UI row to multiple config keys */
interface GroupedToolDef {
  ids: string[]
  label: string
  descriptionKey: string
}

const GRANULAR_TOOLS: GranularToolDef[] = [
  {
    id: "external_directory",
    descriptionKey: "settings.autoApprove.tool.external_directory",
    granular: {
      wildcardKey: "settings.autoApprove.wildcardLabel.paths",
      addKey: "settings.autoApprove.addPath",
      placeholderKey: "settings.autoApprove.placeholder.path",
    },
  },
  {
    id: "bash",
    descriptionKey: "settings.autoApprove.tool.bash",
    granular: {
      wildcardKey: "settings.autoApprove.wildcardLabel.commands",
      addKey: "settings.autoApprove.addCommand",
      placeholderKey: "settings.autoApprove.placeholder.command",
    },
  },
  {
    id: "read",
    descriptionKey: "settings.autoApprove.tool.read",
    granular: {
      wildcardKey: "settings.autoApprove.wildcardLabel.paths",
      addKey: "settings.autoApprove.addPath",
      placeholderKey: "settings.autoApprove.placeholder.path",
    },
  },
  {
    id: "edit",
    descriptionKey: "settings.autoApprove.tool.edit",
    granular: {
      wildcardKey: "settings.autoApprove.wildcardLabel.paths",
      addKey: "settings.autoApprove.addPath",
      placeholderKey: "settings.autoApprove.placeholder.path",
    },
  },
]

const SIMPLE_TOOLS: ToolDef[] = [
  { id: "glob", descriptionKey: "settings.autoApprove.tool.glob" },
  { id: "grep", descriptionKey: "settings.autoApprove.tool.grep" },
  { id: "list", descriptionKey: "settings.autoApprove.tool.list" },
  { id: "task", descriptionKey: "settings.autoApprove.tool.task" },
  { id: "skill", descriptionKey: "settings.autoApprove.tool.skill" },
  { id: "lsp", descriptionKey: "settings.autoApprove.tool.lsp" },
]

const GROUPED_TOOLS: GroupedToolDef[] = [
  {
    ids: ["todoread", "todowrite"],
    label: "todoread / todowrite",
    descriptionKey: "settings.autoApprove.tool.todoreadwrite",
  },
  {
    ids: ["websearch", "codesearch"],
    label: "websearch / codesearch",
    descriptionKey: "settings.autoApprove.tool.websearchcodesearch",
  },
]

const TRAILING_TOOLS: ToolDef[] = [
  { id: "webfetch", descriptionKey: "settings.autoApprove.tool.webfetch" },
  { id: "doom_loop", descriptionKey: "settings.autoApprove.tool.doom_loop" },
]

/**
 * Backend default permission levels — mirrors the base defaults defined in
 * packages/opencode/src/agent/agent.ts (lines 61-78). The global default
 * is "*": "allow"; these are the per-tool overrides. If the backend defaults
 * change, this map must be updated to match.
 */
const TOOL_DEFAULTS: Partial<Record<string, PermissionLevel>> = {
  doom_loop: "ask",
  external_directory: "ask",
}

const RESTRICTION_ORDER: Record<PermissionLevel, number> = { allow: 0, ask: 1, deny: 2 }

/** For grouped tools, return the most restrictive level across all IDs. */
function mostRestrictive(levels: PermissionLevel[]): PermissionLevel {
  return levels.reduce<PermissionLevel>(
    (best, l) => (RESTRICTION_ORDER[l] > RESTRICTION_ORDER[best] ? l : best),
    levels[0] ?? "allow",
  )
}

function wildcardAction(rule: PermissionRule | undefined, fallback: PermissionLevel): PermissionLevel {
  if (!rule) return fallback
  if (typeof rule === "string") return rule
  return rule["*"] ?? fallback
}

function exceptions(rule: PermissionRule | undefined): Array<{ pattern: string; action: PermissionLevel }> {
  if (!rule || typeof rule === "string") return []
  return Object.entries(rule)
    .filter(([key, action]) => key !== "*" && action !== null)
    .map(([pattern, action]) => ({ pattern, action: action as PermissionLevel }))
}

function toolTitle(id: string): string {
  return id
    .split("_")
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(" ")
    .split(" / ")
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(" / ")
}

const AutoApproveTab: Component = () => {
  const { config, updateConfig } = useConfig()
  const language = useLanguage()
  const vscode = useVSCode()

  // ─── Auto-approve advanced state (canary.11) ──────────────────────
  const [conditions, setConditions] = createSignal<AutoApproveCondition[]>([])
  const [rateLimits, setRateLimits] = createSignal<AutoApproveRateLimits>({ toolsPerMinute: 60, enabled: false })
  const [countWindow, setCountWindow] = createSignal<{ count: number; windowMs: number }>({ count: 0, windowMs: 60_000 })
  const [logEntries, setLogEntries] = createSignal<AutoApproveLogEntry[]>([])

  const [newCondType, setNewCondType] = createSignal<AutoApproveConditionType>("glob")
  const [newCondValue, setNewCondValue] = createSignal("")
  const [newCondAction, setNewCondAction] = createSignal<AutoApproveAction>("allow")

  const unsubscribe = vscode.onMessage((message: ExtensionMessage) => {
    const msg = message as ExtensionMessage & Record<string, unknown>
    switch (msg.type) {
      case "autoApproveConditions":
        setConditions(((msg as unknown as { conditions?: AutoApproveCondition[] }).conditions ?? []) as AutoApproveCondition[])
        break
      case "autoApproveRateLimits": {
        const data = msg as unknown as { rateLimits?: AutoApproveRateLimits; countWindow?: { count: number; windowMs: number } }
        if (data.rateLimits) setRateLimits(data.rateLimits)
        if (data.countWindow) setCountWindow(data.countWindow)
        break
      }
      case "autoApproveLog":
        setLogEntries(((msg as unknown as { entries?: AutoApproveLogEntry[] }).entries ?? []) as AutoApproveLogEntry[])
        break
      default:
        break
    }
  })

  onMount(() => {
    vscode.postMessage({ type: "getAutoApproveConditions" } as never)
    vscode.postMessage({ type: "getAutoApproveRateLimits" } as never)
    vscode.postMessage({ type: "getAutoApproveLog", limit: 50 } as never)
  })

  onCleanup(() => unsubscribe())

  const submitNewCondition = () => {
    const value = newCondValue().trim()
    if (!value) return
    vscode.postMessage({
      type: "addAutoApproveCondition",
      conditionType: newCondType(),
      value,
      action: newCondAction(),
    } as never)
    setNewCondValue("")
  }

  const removeConditionById = (id: string) => {
    vscode.postMessage({ type: "removeAutoApproveCondition", id } as never)
  }

  const updateRateLimit = (patch: Partial<AutoApproveRateLimits>) => {
    vscode.postMessage({ type: "setAutoApproveRateLimit", ...patch } as never)
  }

  const formatTimestamp = (ts: number): string => {
    try {
      return new Date(ts).toLocaleString()
    } catch {
      return String(ts)
    }
  }

  const permissions = createMemo(() => config().permission ?? {})

  const globalFallback = createMemo((): PermissionLevel => {
    const star = permissions()["*"]
    if (typeof star === "string") return star
    return "allow" // backend default: "*": "allow" (agent.ts)
  })

  const defaultFor = (tool: string): PermissionLevel => TOOL_DEFAULTS[tool] ?? globalFallback()

  const levelFor = (tool: string): PermissionLevel => wildcardAction(permissions()[tool], defaultFor(tool))

  const ruleFor = (tool: string): PermissionRule | undefined => permissions()[tool]

  const setSimple = (tool: string, level: PermissionLevel) => {
    updateConfig({ permission: { [tool]: level } })
  }

  const setGrouped = (ids: string[], level: PermissionLevel) => {
    const patch: Record<string, PermissionLevel> = {}
    for (const id of ids) patch[id] = level
    updateConfig({ permission: patch })
  }

  const setWildcard = (tool: string, level: PermissionLevel) => {
    const current = ruleFor(tool)
    const excs = exceptions(current)
    if (excs.length === 0) {
      updateConfig({ permission: { [tool]: level } })
      return
    }
    const obj: Record<string, PermissionLevel | null> = { "*": level }
    for (const exc of excs) obj[exc.pattern] = exc.action
    updateConfig({ permission: { [tool]: obj } })
  }

  const setException = (tool: string, pattern: string, level: PermissionLevel) => {
    const current = ruleFor(tool)
    const base: Record<string, PermissionLevel | null> =
      typeof current === "string" ? { "*": current } : { ...(current ?? {}) }
    base[pattern] = level
    updateConfig({ permission: { [tool]: base } })
  }

  const addException = (tool: string, pattern: string) => {
    const current = ruleFor(tool)
    const base: Record<string, PermissionLevel | null> =
      typeof current === "string" ? { "*": current } : { ...(current ?? {}) }
    base[pattern] = "allow"
    updateConfig({ permission: { [tool]: base } })
  }

  const removeException = (tool: string, pattern: string) => {
    const current = ruleFor(tool)
    if (!current || typeof current === "string") return
    // Send a single patch with null for the deleted key.
    // null is a delete sentinel: patchJsonc removes the key from the JSONC file,
    // stripNulls removes it from the optimistic UI.
    updateConfig({ permission: { [tool]: { [pattern]: null } } })
  }

  return (
    <div data-component="auto-approve-settings">
      <div
        style={{
          "font-size": "12px",
          color: "var(--text-weak-base, var(--vscode-descriptionForeground))",
          "padding-bottom": "12px",
          "border-bottom": "1px solid var(--border-weak-base)",
        }}
      >
        {language.t("settings.autoApprove.description")}
      </div>

      <For each={GRANULAR_TOOLS}>
        {(tool) => (
          <GranularToolRow
            tool={tool}
            rule={ruleFor(tool.id)}
            fallback={defaultFor(tool.id)}
            onWildcardChange={(level) => setWildcard(tool.id, level)}
            onExceptionChange={(pattern, level) => setException(tool.id, pattern, level)}
            onExceptionAdd={(pattern) => addException(tool.id, pattern)}
            onExceptionRemove={(pattern) => removeException(tool.id, pattern)}
          />
        )}
      </For>

      <For each={SIMPLE_TOOLS}>
        {(tool) => (
          <SimpleToolRow
            id={tool.id}
            descriptionKey={tool.descriptionKey}
            level={levelFor(tool.id)}
            onChange={(level) => setSimple(tool.id, level)}
          />
        )}
      </For>

      <For each={GROUPED_TOOLS}>
        {(group) => (
          <SimpleToolRow
            id={group.label}
            descriptionKey={group.descriptionKey}
            level={mostRestrictive(group.ids.map(levelFor))}
            onChange={(level) => setGrouped(group.ids, level)}
          />
        )}
      </For>

      <For each={TRAILING_TOOLS}>
        {(tool) => (
          <SimpleToolRow
            id={tool.id}
            descriptionKey={tool.descriptionKey}
            level={levelFor(tool.id)}
            onChange={(level) => setSimple(tool.id, level)}
          />
        )}
      </For>

      {/* ─── Conditions table (canary.11) ────────────────────────── */}
      <div data-section="auto-approve-conditions" style={{ "margin-top": "24px", "padding-top": "16px", "border-top": "1px solid var(--border-weak-base)" }}>
        <div style={{ "font-size": "13px", color: "var(--text-strong-base, white)", "font-weight": 600 }}>Conditions</div>
        <div style={{ "font-size": "12px", color: "var(--text-weak-base, var(--vscode-descriptionForeground))", "margin-top": "4px" }}>
          Path globs, file-count limits, and time windows that allow or deny auto-approval.
        </div>
        <Show when={conditions().length > 0}>
          <div style={{ "margin-top": "8px" }}>
            <For each={conditions()}>
              {(cond) => (
                <div style={{ display: "flex", gap: "8px", "align-items": "center", padding: "6px 0", "border-bottom": "1px solid var(--border-weak-base)" }}>
                  <span style={{ "font-size": "11px", padding: "2px 6px", "border-radius": "3px", background: "var(--surface-strong-base, #252526)", color: "var(--text-base, #ccc)" }}>
                    {cond.type}
                  </span>
                  <span style={{ flex: "1 1 0%", "min-width": 0, "font-family": "var(--vscode-editor-font-family, monospace)", "font-size": "13px", color: "var(--text-base, #ccc)", overflow: "hidden", "text-overflow": "ellipsis", "white-space": "nowrap" }} title={cond.value}>
                    {cond.value}
                  </span>
                  <span style={{ "font-size": "11px", color: cond.action === "allow" ? "var(--text-success-base, #4ec9b0)" : "var(--text-danger-base, #f48771)" }}>
                    {cond.action}
                  </span>
                  <IconButton variant="ghost" size="small" icon="close" onClick={() => removeConditionById(cond.id)} />
                </div>
              )}
            </For>
          </div>
        </Show>
        <div style={{ display: "flex", gap: "8px", "align-items": "center", "margin-top": "8px" }}>
          <select
            value={newCondType()}
            onChange={(e) => setNewCondType(e.currentTarget.value as AutoApproveConditionType)}
            style={{ background: "var(--surface-strong-base, #252526)", border: "1px solid var(--border-base, #434443)", "border-radius": "2px", color: "var(--text-base, #ccc)", "font-size": "12px", padding: "4px 6px", outline: "none" }}
          >
            <option value="glob">glob</option>
            <option value="count">count</option>
            <option value="window">window</option>
          </select>
          <input
            type="text"
            value={newCondValue()}
            onInput={(e) => setNewCondValue(e.currentTarget.value)}
            onKeyDown={(e) => { if (e.key === "Enter") submitNewCondition() }}
            placeholder={newCondType() === "glob" ? "src/**/*.ts" : newCondType() === "count" ? "10" : "09:00-17:00"}
            style={{ flex: 1, "min-width": 0, background: "var(--surface-strong-base, #252526)", border: "1px solid var(--border-base, #434443)", "border-radius": "2px", color: "var(--text-base, #ccc)", "font-size": "13px", "font-family": "var(--vscode-editor-font-family, monospace)", padding: "4px 8px", outline: "none" }}
          />
          <select
            value={newCondAction()}
            onChange={(e) => setNewCondAction(e.currentTarget.value as AutoApproveAction)}
            style={{ background: "var(--surface-strong-base, #252526)", border: "1px solid var(--border-base, #434443)", "border-radius": "2px", color: "var(--text-base, #ccc)", "font-size": "12px", padding: "4px 6px", outline: "none" }}
          >
            <option value="allow">allow</option>
            <option value="deny">deny</option>
          </select>
          <button
            onClick={submitNewCondition}
            style={{ padding: "4px 10px", background: "var(--button-primary-base, #0e639c)", color: "white", border: "none", "border-radius": "2px", cursor: "pointer", "font-size": "12px" }}
          >
            Add
          </button>
        </div>
      </div>

      {/* ─── Rate limits panel (canary.11) ──────────────────────── */}
      <div data-section="auto-approve-rate-limits" style={{ "margin-top": "24px", "padding-top": "16px", "border-top": "1px solid var(--border-weak-base)" }}>
        <div style={{ "font-size": "13px", color: "var(--text-strong-base, white)", "font-weight": 600 }}>Rate limits</div>
        <div style={{ display: "flex", "align-items": "center", gap: "8px", "margin-top": "8px" }}>
          <input
            type="checkbox"
            checked={rateLimits().enabled}
            onChange={(e) => updateRateLimit({ enabled: e.currentTarget.checked })}
          />
          <span style={{ "font-size": "12px", color: "var(--text-base, #ccc)" }}>Enable rate limiting</span>
        </div>
        <div style={{ display: "flex", "align-items": "center", gap: "12px", "margin-top": "8px" }}>
          <span style={{ "font-size": "12px", color: "var(--text-base, #ccc)", "min-width": "140px" }}>Tools per minute</span>
          <input
            type="range"
            min="0"
            max="600"
            step="10"
            value={rateLimits().toolsPerMinute}
            onChange={(e) => updateRateLimit({ toolsPerMinute: Number(e.currentTarget.value) })}
            style={{ flex: 1 }}
          />
          <span style={{ "min-width": "48px", "text-align": "right", "font-family": "var(--vscode-editor-font-family, monospace)", "font-size": "12px", color: "var(--text-base, #ccc)" }}>
            {rateLimits().toolsPerMinute}
          </span>
        </div>
        <div style={{ "font-size": "11px", color: "var(--text-weak-base, var(--vscode-descriptionForeground))", "margin-top": "6px" }}>
          Current window: {countWindow().count} actions in last {Math.round(countWindow().windowMs / 1000)}s
        </div>
      </div>

      {/* ─── Audit log (canary.11) ──────────────────────────────── */}
      <div data-section="auto-approve-log" style={{ "margin-top": "24px", "padding-top": "16px", "border-top": "1px solid var(--border-weak-base)" }}>
        <div style={{ display: "flex", "align-items": "center", "justify-content": "space-between" }}>
          <div style={{ "font-size": "13px", color: "var(--text-strong-base, white)", "font-weight": 600 }}>Audit log</div>
          <button
            onClick={() => vscode.postMessage({ type: "getAutoApproveLog", limit: 50 } as never)}
            style={{ background: "none", border: "none", color: "var(--text-link-base, #3794ff)", cursor: "pointer", "font-size": "12px", padding: "0" }}
          >
            Refresh
          </button>
        </div>
        <Show
          when={logEntries().length > 0}
          fallback={
            <div style={{ "font-size": "12px", color: "var(--text-weak-base, var(--vscode-descriptionForeground))", "margin-top": "8px" }}>
              No auto-approved actions yet.
            </div>
          }
        >
          <div style={{ "margin-top": "8px", "max-height": "240px", overflow: "auto", border: "1px solid var(--border-weak-base)", "border-radius": "2px" }}>
            <For each={logEntries().slice().reverse()}>
              {(entry) => (
                <div style={{ display: "flex", gap: "12px", padding: "4px 8px", "border-bottom": "1px solid var(--border-weak-base)", "font-family": "var(--vscode-editor-font-family, monospace)", "font-size": "11px" }}>
                  <span style={{ color: "var(--text-weak-base, var(--vscode-descriptionForeground))", "min-width": "150px" }}>
                    {formatTimestamp(entry.timestamp)}
                  </span>
                  <span style={{ flex: 1, color: "var(--text-base, #ccc)", "min-width": 0, overflow: "hidden", "text-overflow": "ellipsis", "white-space": "nowrap" }}>
                    {entry.action}
                  </span>
                  <span style={{ color: "var(--text-weak-base, var(--vscode-descriptionForeground))", "min-width": "120px" }}>
                    {entry.source}
                  </span>
                </div>
              )}
            </For>
          </div>
        </Show>
      </div>
    </div>
  )
}

const SimpleToolRow: Component<{
  id: string
  descriptionKey: string
  level: PermissionLevel
  onChange: (level: PermissionLevel) => void
}> = (props) => {
  const language = useLanguage()
  return (
    <div
      style={{
        display: "flex",
        gap: "24px",
        "align-items": "flex-start",
        "justify-content": "space-between",
        padding: "12px 0",
        "border-bottom": "1px solid var(--border-weak-base)",
      }}
    >
      <div style={{ flex: 1, "min-width": 0 }}>
        <div style={{ "font-size": "13px", color: "var(--text-strong-base, white)" }}>{toolTitle(props.id)}</div>
        <div
          style={{
            "font-size": "12px",
            color: "var(--text-weak-base, var(--vscode-descriptionForeground))",
            "margin-top": "6px",
          }}
        >
          {language.t(props.descriptionKey)}
        </div>
      </div>
      <ActionSelect level={props.level} onChange={props.onChange} />
    </div>
  )
}

const GranularToolRow: Component<{
  tool: GranularToolDef
  rule: PermissionRule | undefined
  fallback: PermissionLevel
  onWildcardChange: (level: PermissionLevel) => void
  onExceptionChange: (pattern: string, level: PermissionLevel) => void
  onExceptionAdd: (pattern: string) => void
  onExceptionRemove: (pattern: string) => void
}> = (props) => {
  const language = useLanguage()
  const [adding, setAdding] = createSignal(false)
  const [input, setInput] = createSignal("")
  let inputRef: HTMLInputElement | undefined

  createEffect(() => {
    if (adding()) inputRef?.focus()
  })

  const excs = createMemo(() => exceptions(props.rule))
  const level = createMemo(() => wildcardAction(props.rule, props.fallback))

  const submit = () => {
    const val = input().trim()
    if (val) {
      props.onExceptionAdd(val)
      setInput("")
    }
    setAdding(false)
  }

  const cancel = () => {
    setInput("")
    setAdding(false)
  }

  return (
    <div style={{ padding: "12px 0", "border-bottom": "1px solid var(--border-weak-base)" }}>
      {/* Tool header with name and description */}
      <div style={{ display: "flex", gap: "24px", "align-items": "flex-start", "justify-content": "space-between" }}>
        <div style={{ flex: 1, "min-width": 0 }}>
          <div style={{ "font-size": "13px", color: "var(--text-strong-base, white)" }}>{toolTitle(props.tool.id)}</div>
          <div
            style={{
              "font-size": "12px",
              color: "var(--text-weak-base, var(--vscode-descriptionForeground))",
              "margin-top": "6px",
            }}
          >
            {language.t(props.tool.descriptionKey)}
          </div>
        </div>
      </div>

      {/* Wildcard row */}
      <div
        style={{
          display: "flex",
          gap: "24px",
          "align-items": "center",
          "justify-content": "space-between",
          padding: "8px 0",
        }}
      >
        <div style={{ flex: 1, "min-width": 0 }}>
          <div style={{ "font-size": "12px", color: "var(--text-base, #ccc)" }}>
            {language.t(props.tool.granular.wildcardKey)}
          </div>
        </div>
        <ActionSelect level={level()} onChange={props.onWildcardChange} />
      </div>

      {/* Exceptions */}
      <Show when={excs().length > 0}>
        <div style={{ "margin-top": "4px" }}>
          <div
            style={{
              "font-size": "12px",
              color: "var(--text-weak-base, var(--vscode-descriptionForeground))",
              "margin-bottom": "4px",
            }}
          >
            {language.t("settings.autoApprove.exceptions")}
          </div>
          <For each={excs()}>
            {(exc) => (
              <div
                style={{
                  display: "flex",
                  gap: "8px",
                  "align-items": "center",
                  padding: "4px 0",
                  "padding-left": "12px",
                  "border-top": "1px solid var(--border-weak-base)",
                }}
              >
                <div
                  style={{
                    flex: "1 1 0%",
                    "min-width": 0,
                    "font-size": "13px",
                    "font-family": "var(--vscode-editor-font-family, monospace)",
                    color: "var(--text-base, #ccc)",
                    overflow: "hidden",
                    "text-overflow": "ellipsis",
                    "white-space": "nowrap",
                  }}
                  title={exc.pattern}
                >
                  {exc.pattern}
                </div>
                <div style={{ display: "flex", gap: "4px", "align-items": "center", "flex-shrink": 0 }}>
                  <ActionSelect level={exc.action} onChange={(level) => props.onExceptionChange(exc.pattern, level)} />
                  <IconButton
                    variant="ghost"
                    size="small"
                    icon="close"
                    onClick={() => props.onExceptionRemove(exc.pattern)}
                  />
                </div>
              </div>
            )}
          </For>
        </div>
      </Show>

      {/* Add button / inline input */}
      <Show
        when={adding()}
        fallback={
          <button
            style={{
              display: "flex",
              gap: "4px",
              "align-items": "center",
              padding: "4px 0",
              background: "none",
              border: "none",
              cursor: "pointer",
              "font-size": "12px",
              color: "var(--text-link-base, #3794ff)",
              "font-family": "inherit",
              "margin-top": "4px",
            }}
            onClick={() => setAdding(true)}
          >
            <span style={{ "font-size": "14px" }}>+</span>
            {language.t(props.tool.granular.addKey)}
          </button>
        }
      >
        <div style={{ display: "flex", gap: "8px", "align-items": "center", "margin-top": "4px" }}>
          <input
            ref={(el) => (inputRef = el)}
            type="text"
            value={input()}
            onInput={(e) => setInput(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submit()
              if (e.key === "Escape") cancel()
            }}
            onBlur={() => {
              if (!input().trim()) cancel()
            }}
            placeholder={language.t(props.tool.granular.placeholderKey)}
            style={{
              flex: 1,
              "min-width": 0,
              background: "var(--surface-strong-base, #252526)",
              border: "1px solid var(--border-base, #434443)",
              "border-radius": "2px",
              color: "var(--text-base, #ccc)",
              "font-size": "13px",
              "font-family": "var(--vscode-editor-font-family, monospace)",
              padding: "4px 8px",
              outline: "none",
            }}
          />
          <IconButton variant="ghost" size="small" icon="close" onClick={cancel} />
        </div>
      </Show>
    </div>
  )
}

const ActionSelect: Component<{
  level: PermissionLevel
  onChange: (level: PermissionLevel) => void
}> = (props) => {
  const language = useLanguage()
  return (
    <Select
      options={LEVEL_OPTIONS}
      current={LEVEL_OPTIONS.find((o) => o.value === props.level)}
      value={(o) => o.value}
      label={(o) => language.t(o.labelKey)}
      onSelect={(option) => option && props.onChange(option.value)}
      variant="secondary"
      size="small"
      triggerVariant="settings"
    />
  )
}

export default AutoApproveTab
