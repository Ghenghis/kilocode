/**
 * HubTab — Embed the contract-kit Hub directly inside KiloCode settings.
 *
 * The Hub is the cross-cutting operations surface (services health, audit
 * gates, PR queue, MiniMax quota, secret-scan status, upstream-sync
 * classifier output). This tab brings a compact summary into VS Code so
 * the user does not have to open a browser to see deploy state.
 *
 * Features:
 *  - Configurable Hub base URL (default http://localhost:8082)
 *  - Live summary: services up/total, audit gates pass/fail, PRs open, quota %, secret-scan status
 *  - Auto-refresh toggle (5s / 15s / 30s / 60s, persisted in localStorage)
 *  - "Open full Hub UI" button — opens the Hub in the user's browser via VS Code
 *  - Connection status with retry
 *  - Last-updated relative time
 */

import { Component, createSignal, createEffect, on, onCleanup, onMount, Show, For } from "solid-js"
import { useVSCode } from "../../context/vscode"
import { useDocumentVisible } from "../../hooks/useDocumentVisible"

// ── Types ────────────────────────────────────────────────────────────────────

interface ServiceRow {
  id: string
  status: "up" | "down" | "starting" | "unknown"
  port?: number
  uptime_s?: number
}

interface PRRow {
  repo: string
  number: number
  title: string
  url: string
  mergeable?: boolean | null
}

interface AuditGateSummary {
  total: number
  passing: number
  failing: number
  unknown: number
}

interface QuotaInfo {
  provider: string
  used_pct: number
  remaining_usd?: number
}

interface SecretScanInfo {
  ran_at: string
  hits: number
  by_kind: Record<string, number>
}

interface HubSummary {
  hub_version?: string
  services: ServiceRow[]
  prs: PRRow[]
  audit: AuditGateSummary
  quotas: QuotaInfo[]
  secret_scan?: SecretScanInfo
}

const REFRESH_OPTIONS = [5_000, 15_000, 30_000, 60_000] as const
const STORAGE_KEY_URL = "kilo.hub.baseUrl"
const STORAGE_KEY_AUTOREFRESH = "kilo.hub.autoRefresh"
const STORAGE_KEY_INTERVAL = "kilo.hub.intervalMs"
const DEFAULT_BASE_URL = "http://localhost:8082"

// ── Helpers ──────────────────────────────────────────────────────────────────

function readLS(key: string, fallback: string): string {
  try {
    const v = localStorage.getItem(key)
    return v ?? fallback
  } catch {
    return fallback
  }
}
function writeLS(key: string, value: string): void {
  try {
    localStorage.setItem(key, value)
  } catch {
    /* localStorage unavailable */
  }
}

function relTime(ts: number): string {
  const diff = Math.max(0, Date.now() - ts)
  if (diff < 1000) return "just now"
  const s = Math.floor(diff / 1000)
  if (s < 60) return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  return `${h}h ago`
}

async function fetchHubSummary(baseUrl: string, signal?: AbortSignal): Promise<HubSummary> {
  // The Hub's own panel shell calls these same endpoints; we aggregate them
  // client-side so a single tab refresh is one parallel batch.
  const safe = baseUrl.replace(/\/+$/, "")

  // Each endpoint gets a 2 s hard timeout AND forwards the parent abort signal
  // (component unmount / new refresh). The forwarding uses addEventListener so
  // it works on every VS Code version without AbortSignal.any or
  // AbortSignal.timeout polyfills.
  //
  // WHY 2 s: localhost services either respond in <100 ms or are not running.
  // 2 s is generous; the old 5 s value meant 5 clicks × 6 fetches = 30
  // pending requests that couldn't be cancelled on older VS Code builds.
  //
  // WHY event-listener forward: AbortSignal.any (Chrome 116 / VS Code 1.83+)
  // is not universally available. The fallback of returning only the timeout
  // signal meant component-unmount aborts were silently ignored — every tab
  // click started 6 new fetches that accumulated until their timeout fired.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const get = async (path: string): Promise<any> => {
    const tc = new AbortController()
    const timer = setTimeout(() => tc.abort(), 2000)
    // Forward the parent abort (unmount / new refresh) → per-request controller.
    const onParentAbort = () => tc.abort()
    if (signal) signal.addEventListener("abort", onParentAbort, { once: true })
    try {
      const res = await fetch(`${safe}${path}`, { signal: tc.signal })
      if (!res.ok) throw new Error(`${path} → ${res.status}`)
      return res.json()
    } finally {
      clearTimeout(timer)
      if (signal) signal.removeEventListener("abort", onParentAbort)
    }
  }

  const [services, audit, prs, quotaMinimax, secretScan, health] = await Promise.allSettled([
    get("/api/services"),
    get("/api/audit/gates"),
    get("/api/prs/queue"),
    get("/api/quota/minimax"),
    get("/api/secrets/scan/last"),
    get("/api/hub/health"),
  ])

  const summary: HubSummary = {
    services: [],
    prs: [],
    audit: { total: 0, passing: 0, failing: 0, unknown: 0 },
    quotas: [],
  }

  if (services.status === "fulfilled" && Array.isArray(services.value?.services)) {
    summary.services = services.value.services.slice(0, 32)
  } else if (services.status === "fulfilled" && Array.isArray(services.value)) {
    summary.services = services.value.slice(0, 32)
  }

  if (audit.status === "fulfilled") {
    const gates = (audit.value?.gates ?? audit.value ?? []) as Array<{ status: string }>
    summary.audit.total = gates.length
    // kilocode_change: backend returns UPPERCASE statuses (PASS/FAIL/...);
    // case-insensitive match to keep frontend resilient.
    const norm = (s: string): string => (s ?? "").toLowerCase()
    summary.audit.passing = gates.filter((g) => norm(g.status) === "pass" || norm(g.status) === "passing").length
    summary.audit.failing = gates.filter((g) => norm(g.status) === "fail" || norm(g.status) === "failing").length
    summary.audit.unknown = summary.audit.total - summary.audit.passing - summary.audit.failing
  }

  // kilocode_change: backend GET /api/prs/queue returns array under field `queue`,
  // not `prs` (verified via cross-repo contract audit). Read `queue` first, then
  // fall back to legacy field names for resilience.
  if (prs.status === "fulfilled" && Array.isArray(prs.value?.queue)) {
    summary.prs = prs.value.queue.slice(0, 16)
  } else if (prs.status === "fulfilled" && Array.isArray(prs.value?.prs)) {
    summary.prs = prs.value.prs.slice(0, 16)
  } else if (prs.status === "fulfilled" && Array.isArray(prs.value)) {
    summary.prs = prs.value.slice(0, 16)
  }

  if (quotaMinimax.status === "fulfilled" && quotaMinimax.value) {
    const v = quotaMinimax.value
    const used =
      typeof v.used_pct === "number"
        ? v.used_pct
        : typeof v.used === "number" && typeof v.limit === "number" && v.limit > 0
          ? Math.round((v.used / v.limit) * 100)
          : 0
    summary.quotas.push({ provider: "minimax", used_pct: used, remaining_usd: v.remaining_usd })
  }

  if (secretScan.status === "fulfilled" && secretScan.value) {
    const v = secretScan.value
    summary.secret_scan = {
      ran_at: v.ran_at ?? v.timestamp ?? "",
      hits: v.hits ?? v.total ?? 0,
      by_kind: v.by_kind ?? {},
    }
  }

  if (health.status === "fulfilled" && health.value) {
    summary.hub_version = health.value.version ?? health.value.hub_version
  }

  return summary
}

// ── Component ─────────────────────────────────────────────────────────────────

const HubTab: Component = () => {
  const vscode = useVSCode()

  const [baseUrl, setBaseUrl] = createSignal(readLS(STORAGE_KEY_URL, DEFAULT_BASE_URL))
  const [urlDraft, setUrlDraft] = createSignal(baseUrl())
  const [autoRefresh, setAutoRefresh] = createSignal(readLS(STORAGE_KEY_AUTOREFRESH, "1") === "1")
  const [intervalMs, setIntervalMs] = createSignal<number>(parseInt(readLS(STORAGE_KEY_INTERVAL, "30000"), 10))

  const [summary, setSummary] = createSignal<HubSummary | null>(null)
  const [error, setError] = createSignal<string | null>(null)
  const [loading, setLoading] = createSignal(false)
  const [lastUpdated, setLastUpdated] = createSignal<number | null>(null)
  const [_now, setNow] = createSignal(Date.now())

  let abortCtl: AbortController | null = null
  let timer: ReturnType<typeof setTimeout> | null = null
  let tickTimer: ReturnType<typeof setInterval> | null = null

  const refresh = async () => {
    // Abort any in-flight fetch batch before starting a new one.
    // No loading() guard here — the abort clears the previous request,
    // so a new call is always safe and the guard was causing onMount's
    // scheduleNext() to be silently dropped when the visibility createEffect
    // fired first.
    abortCtl?.abort()
    abortCtl = new AbortController()
    setLoading(true)
    setError(null)
    try {
      const data = await fetchHubSummary(baseUrl(), abortCtl.signal)
      setSummary(data)
      setLastUpdated(Date.now())
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      if (!msg.toLowerCase().includes("abort")) setError(msg)
    } finally {
      setLoading(false)
    }
  }

  // Visibility-gated polling: skip the auto-refresh chain + the 5s tick while
  // the user has switched away from the Settings panel — there is nothing in
  // the DOM that depends on `_now()` or `summary()` until they come back.
  const isVisible = useDocumentVisible()

  const scheduleNext = () => {
    if (timer) clearTimeout(timer)
    if (!autoRefresh()) return
    timer = setTimeout(async () => {
      // If the panel was hidden when the timer fired, skip the network call
      // and reschedule cheaply. The user will get a fresh refresh on re-show
      // (the visibility effect below kicks one immediately).
      if (isVisible()) await refresh()
      scheduleNext()
    }, intervalMs())
  }

  // ── Reactive effects ─────────────────────────────────────────────────────

  // Initial fetch on first mount.
  // A 150 ms debounce prevents any fetch from starting if the user is just
  // clicking through tabs quickly (Kobalte unmounts/remounts on every click).
  // If the component is unmounted within 150 ms the timer is cleared and no
  // network I/O ever begins — eliminating the "6 stacked fetches per rapid
  // click" accumulation that caused the click-storm freeze.
  onMount(() => {
    let mountDebounce: ReturnType<typeof setTimeout> | undefined = setTimeout(() => {
      mountDebounce = undefined
      if (isVisible()) void refresh()
      scheduleNext()

      // Tick "now" every 5 s so relative-time labels update, but only while
      // visible.  Inside the debounce so it only starts when we actually commit
      // to rendering the tab (not on fly-by tab clicks).
      tickTimer = setInterval(() => {
        if (isVisible()) setNow(Date.now())
      }, 5000)
    }, 150)

    // Clear the debounce if the component unmounts before 150 ms elapses —
    // this is the primary defence against click-storm fetch accumulation.
    onCleanup(() => clearTimeout(mountDebounce))
  })

  // Re-schedule (and re-fetch) when the user changes URL / interval / toggle.
  // { defer: true } skips the initial run — onMount handles that — so this
  // effect fires only on actual user-driven signal changes.
  createEffect(
    on([baseUrl, autoRefresh, intervalMs], () => {
      void refresh()
      scheduleNext()
    }, { defer: true }),
  )

  // Re-fetch when the document becomes visible again (e.g. user switches back
  // to VS Code from another application). { defer: true } is critical — without
  // it this effect fires immediately on every component mount, bypassing the
  // 150 ms debounce and causing 6 fetches per tab click regardless of how
  // quickly the user moves on. With defer it only reacts to visibility
  // *changes* (false→true); the initial fetch is handled by onMount.
  createEffect(
    on(isVisible, (visible) => {
      if (visible) void refresh()
    }, { defer: true }),
  )

  onCleanup(() => {
    abortCtl?.abort()
    if (timer) clearTimeout(timer)
    if (tickTimer) clearInterval(tickTimer)
  })

  // ── Handlers ─────────────────────────────────────────────────────────────
  const saveUrl = () => {
    const v = urlDraft().trim() || DEFAULT_BASE_URL
    writeLS(STORAGE_KEY_URL, v)
    setBaseUrl(v)
  }
  const resetUrl = () => {
    setUrlDraft(DEFAULT_BASE_URL)
    writeLS(STORAGE_KEY_URL, DEFAULT_BASE_URL)
    setBaseUrl(DEFAULT_BASE_URL)
  }
  const toggleAuto = (next: boolean) => {
    writeLS(STORAGE_KEY_AUTOREFRESH, next ? "1" : "0")
    setAutoRefresh(next)
  }
  const pickInterval = (ms: number) => {
    writeLS(STORAGE_KEY_INTERVAL, String(ms))
    setIntervalMs(ms)
  }
  const openFullHub = () => {
    vscode.postMessage({ type: "openExternal", url: baseUrl() })
  }

  // ── Styles ───────────────────────────────────────────────────────────────
  const cardStyle = {
    border: "1px solid var(--vscode-widget-border)",
    "border-radius": "6px",
    padding: "12px",
    "margin-bottom": "12px",
    background: "var(--vscode-editorWidget-background)",
  } as const
  const headingStyle = { margin: "0 0 8px 0", "font-size": "13px", "font-weight": "600" } as const
  const subtleStyle = { color: "var(--vscode-descriptionForeground)", "font-size": "11px" } as const
  const rowStyle = { display: "flex", "align-items": "center", gap: "10px", "margin-bottom": "8px" } as const
  const inputStyle = {
    flex: "1",
    padding: "6px 8px",
    background: "var(--vscode-input-background)",
    color: "var(--vscode-input-foreground)",
    border: "1px solid var(--vscode-input-border)",
    "border-radius": "4px",
  } as const
  const btnStyle = {
    padding: "6px 12px",
    background: "var(--vscode-button-background)",
    color: "var(--vscode-button-foreground)",
    border: "none",
    "border-radius": "4px",
    cursor: "pointer",
  } as const
  const btnSecondaryStyle = {
    ...btnStyle,
    background: "var(--vscode-button-secondaryBackground)",
    color: "var(--vscode-button-secondaryForeground)",
  } as const
  const statBox = {
    flex: "1",
    "min-width": "120px",
    border: "1px solid var(--vscode-widget-border)",
    "border-radius": "4px",
    padding: "10px",
    background: "var(--vscode-editor-background)",
  } as const

  const servicesUp = () => summary()?.services.filter((s) => s.status === "up").length ?? 0
  const servicesTotal = () => summary()?.services.length ?? 0
  const auditPass = () => summary()?.audit.passing ?? 0
  const auditTotal = () => summary()?.audit.total ?? 0
  const prCount = () => summary()?.prs.length ?? 0
  const quota = () => summary()?.quotas[0]
  const lastUpdatedLabel = () => {
    const t = lastUpdated()
    if (!t) return "never"
    void _now()
    return relTime(t)
  }

  return (
    <div>
      {/* ── Connection card ───────────────────────────────────────────── */}
      <div style={cardStyle}>
        <h4 style={headingStyle}>Hub Connection</h4>
        <p style={subtleStyle}>
          The Hub is the contract-kit operations surface (services, audit, PRs, quotas, secret-scan).
        </p>
        <div style={{ ...rowStyle, "margin-top": "10px" }}>
          <input
            type="text"
            value={urlDraft()}
            onInput={(e) => setUrlDraft(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") saveUrl()
            }}
            placeholder="http://localhost:8082"
            aria-label="Hub base URL"
            style={inputStyle}
          />
          <button type="button" style={btnStyle} onClick={saveUrl} disabled={urlDraft() === baseUrl()}>
            Save
          </button>
          <button type="button" style={btnSecondaryStyle} onClick={resetUrl} title="Reset to default">
            Reset
          </button>
          <button type="button" style={btnSecondaryStyle} onClick={openFullHub} title="Open full Hub UI in browser">
            ↗ Full UI
          </button>
        </div>
        <Show when={error()}>
          <p style={{ color: "var(--vscode-errorForeground)", "font-size": "12px", "margin-top": "8px" }}>
            ⚠️ {error()}
          </p>
        </Show>
      </div>

      {/* ── Refresh card ─────────────────────────────────────────────── */}
      <div style={cardStyle}>
        <h4 style={headingStyle}>Live Status</h4>
        <div style={rowStyle}>
          <span style={subtleStyle}>Last updated: {lastUpdatedLabel()}</span>
          <span style={{ flex: "1" }} />
          <label style={{ display: "flex", "align-items": "center", gap: "6px" }}>
            <input
              type="checkbox"
              checked={autoRefresh()}
              onChange={(e) => toggleAuto(e.currentTarget.checked)}
              aria-label="Auto-refresh"
            />
            <span>Auto-refresh</span>
          </label>
          <select
            value={String(intervalMs())}
            onChange={(e) => pickInterval(parseInt(e.currentTarget.value, 10))}
            disabled={!autoRefresh()}
            aria-label="Refresh interval"
            style={{ padding: "4px 6px" }}
          >
            <For each={REFRESH_OPTIONS}>{(ms) => <option value={ms}>{ms / 1000}s</option>}</For>
          </select>
          <button type="button" style={btnStyle} onClick={refresh} disabled={loading()} title="Refresh now">
            {loading() ? "…" : "Refresh"}
          </button>
        </div>

        {/* Stat strip */}
        <div style={{ ...rowStyle, "flex-wrap": "wrap", "margin-top": "12px" }}>
          <div style={statBox}>
            <div style={subtleStyle}>Services</div>
            <div style={{ "font-size": "20px", "font-weight": "600" }}>
              {servicesUp()} / {servicesTotal()}
            </div>
            <div style={subtleStyle}>up</div>
          </div>
          <div style={statBox}>
            <div style={subtleStyle}>Audit Gates</div>
            <div
              style={{
                "font-size": "20px",
                "font-weight": "600",
                color:
                  auditTotal() > 0 && auditPass() === auditTotal()
                    ? "var(--vscode-charts-green)"
                    : (summary()?.audit.failing ?? 0) > 0
                      ? "var(--vscode-charts-red)"
                      : "inherit",
              }}
            >
              {auditPass()} / {auditTotal()}
            </div>
            <div style={subtleStyle}>passing</div>
          </div>
          <div style={statBox}>
            <div style={subtleStyle}>PR Queue</div>
            <div style={{ "font-size": "20px", "font-weight": "600" }}>{prCount()}</div>
            <div style={subtleStyle}>open</div>
          </div>
          <Show when={quota()}>
            <div style={statBox}>
              <div style={subtleStyle}>{quota()!.provider}</div>
              <div
                style={{
                  "font-size": "20px",
                  "font-weight": "600",
                  color:
                    quota()!.used_pct >= 90
                      ? "var(--vscode-charts-red)"
                      : quota()!.used_pct >= 70
                        ? "var(--vscode-charts-yellow)"
                        : "inherit",
                }}
              >
                {quota()!.used_pct}%
              </div>
              <div style={subtleStyle}>used</div>
            </div>
          </Show>
          <Show when={summary()?.secret_scan}>
            <div style={statBox}>
              <div style={subtleStyle}>Secrets</div>
              <div
                style={{
                  "font-size": "20px",
                  "font-weight": "600",
                  color:
                    (summary()!.secret_scan!.hits ?? 0) > 0
                      ? "var(--vscode-charts-red)"
                      : "var(--vscode-charts-green)",
                }}
              >
                {summary()!.secret_scan!.hits ?? 0}
              </div>
              <div style={subtleStyle}>hits</div>
            </div>
          </Show>
        </div>
      </div>

      {/* ── Services panel (compact) ────────────────────────────────── */}
      <Show when={(summary()?.services.length ?? 0) > 0}>
        <div style={cardStyle}>
          <h4 style={headingStyle}>Services</h4>
          <div style={{ display: "grid", "grid-template-columns": "1fr auto auto", gap: "4px 12px" }}>
            <For each={summary()!.services}>
              {(svc) => (
                <>
                  <span style={{ "font-family": "monospace", "font-size": "12px" }}>{svc.id}</span>
                  <span
                    style={{
                      "font-size": "11px",
                      "font-weight": "600",
                      color:
                        svc.status === "up"
                          ? "var(--vscode-charts-green)"
                          : svc.status === "down"
                            ? "var(--vscode-charts-red)"
                            : "var(--vscode-charts-yellow)",
                    }}
                  >
                    {svc.status}
                  </span>
                  <span style={{ ...subtleStyle, "font-family": "monospace" }}>
                    {svc.port ? `:${svc.port}` : ""}
                  </span>
                </>
              )}
            </For>
          </div>
        </div>
      </Show>

      {/* ── PR queue panel (compact) ────────────────────────────────── */}
      <Show when={(summary()?.prs.length ?? 0) > 0}>
        <div style={cardStyle}>
          <h4 style={headingStyle}>Open PRs</h4>
          <For each={summary()!.prs}>
            {(pr) => (
              <div style={{ "margin-bottom": "6px", "font-size": "12px" }}>
                <span style={{ "font-family": "monospace", "margin-right": "8px" }}>
                  {pr.repo}#{pr.number}
                </span>
                <span style={{ color: "var(--vscode-textLink-foreground)", cursor: "pointer" }}>
                  <a
                    href={pr.url}
                    onClick={(e) => {
                      e.preventDefault()
                      vscode.postMessage({ type: "openExternal", url: pr.url })
                    }}
                    style={{ color: "inherit", "text-decoration": "none" }}
                  >
                    {pr.title}
                  </a>
                </span>
                <Show when={pr.mergeable === false}>
                  <span style={{ "margin-left": "8px", color: "var(--vscode-charts-red)", "font-size": "11px" }}>
                    [conflict]
                  </span>
                </Show>
              </div>
            )}
          </For>
        </div>
      </Show>

      {/* ── Help footer ─────────────────────────────────────────────── */}
      <div style={{ ...subtleStyle, "margin-top": "8px" }}>
        Hub version: {summary()?.hub_version ?? "unknown"}. The full Hub UI offers per-panel detail, log preview, and
        gate re-run actions.
      </div>
    </div>
  )
}

export default HubTab
