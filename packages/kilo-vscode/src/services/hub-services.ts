import * as vscode from "vscode"

/**
 * Watchdog that probes /api/services/* on activation and polls each interval.
 * Auto-starts services with a registered start_cmd.
 * Status bar shows "DaveAI: N/M" with click-to-restart quick-pick.
 */
/**
 * Delay (ms) before the first probe runs after `start()`. The timer yields
 * the activation thread so an unreachable Hub doesn't push a 50–200 ms fetch
 * stall in front of the rest of `activate()`. The status bar still appears
 * immediately with a placeholder, then the first poll fills it in.
 */
const FIRST_POLL_DELAY_MS = 5_000

export class HubServicesService implements vscode.Disposable {
  private readonly _context: vscode.ExtensionContext
  private _timer: ReturnType<typeof setInterval> | undefined
  private _firstPollTimer: ReturnType<typeof setTimeout> | undefined
  private _bar: vscode.StatusBarItem

  constructor(context: vscode.ExtensionContext) {
    this._context = context
    this._bar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 90)
    this._bar.command = "kilo-code.hub.showServices"
  }

  start(): void {
    // Show a neutral placeholder immediately so the bar isn't blank during
    // the deferred-poll window. The first poll will overwrite it.
    this._bar.text = `$(server) DaveAI: …`
    this._bar.tooltip = "Hub status pending first probe"
    this._bar.show()

    // Defer the first probe so it doesn't add a synchronous fetch stall to
    // VS Code's activation phase. The 5s delay aligns with VS Code's
    // "show extension activation warning" threshold so the user never sees
    // a blocking probe attributed to this extension.
    this._firstPollTimer = setTimeout(() => {
      this._firstPollTimer = undefined
      void this._poll()
    }, FIRST_POLL_DELAY_MS)
    this._timer = setInterval(() => void this._poll(), 30_000)
  }

  private async _poll(): Promise<void> {
    // Probe the runtime-core hub endpoint if the CLI backend URL is known.
    // Non-fatal — any network error is silently swallowed so the extension keeps working.
    try {
      const cfg = vscode.workspace.getConfiguration("kiloCode")
      const baseUrl: string = cfg.get("hermesBaseUrl") ?? "http://localhost:8000"
      const res = await fetch(`${baseUrl}/api/services/status`, { signal: AbortSignal.timeout(4000) })
      if (res.ok) {
        const data = (await res.json()) as { running?: number; total?: number }
        const running = data.running ?? 0
        const total = data.total ?? 0
        this._bar.text = `$(server) DaveAI: ${running}/${total}`
        this._bar.tooltip = `Hub services: ${running} of ${total} running`
      } else {
        this._bar.text = `$(server) DaveAI: --`
        this._bar.tooltip = `Hub unreachable (${res.status})`
      }
    } catch {
      this._bar.text = `$(server) DaveAI: --`
      this._bar.tooltip = "Hub offline"
    }
  }

  dispose(): void {
    if (this._firstPollTimer !== undefined) {
      clearTimeout(this._firstPollTimer)
      this._firstPollTimer = undefined
    }
    if (this._timer !== undefined) {
      clearInterval(this._timer)
      this._timer = undefined
    }
    this._bar.dispose()
  }
}
