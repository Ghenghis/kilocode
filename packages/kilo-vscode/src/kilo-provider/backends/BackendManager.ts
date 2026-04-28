/**
 * BackendManager — Extension host side of the backend switching system.
 * Manages lifecycle of OpenHands and Goose processes.
 *
 * WebView → Extension: { type: "backendStateChanged", state: BackendState }
 * Extension → WebView: { type: "backendStatusUpdate", backend, status, message }
 */

import * as vscode from "vscode"
import * as cp from "child_process"

export type BackendId = "kilo-native" | "openhands" | "goose"
export type BackendStatus = "idle" | "starting" | "running" | "stopping" | "error"

export interface BackendStatusEvent {
  backend: BackendId
  status: BackendStatus
  message?: string
  pid?: number
}

export class BackendManager implements vscode.Disposable {
  private _activeBackend: BackendId = "kilo-native"
  private _openhandsProcess: cp.ChildProcess | null = null
  private _gooseProcess: cp.ChildProcess | null = null
  private _postMessage: (msg: unknown) => void
  private _outputChannel: vscode.OutputChannel

  constructor(postMessage: (msg: unknown) => void) {
    this._postMessage = postMessage
    this._outputChannel = vscode.window.createOutputChannel("KiloCode Backends")
  }

  async setActiveBackend(backendId: BackendId, config?: Record<string, unknown>): Promise<void> {
    const prev = this._activeBackend
    this._activeBackend = backendId

    this._outputChannel.appendLine(`[BackendManager] Switching: ${prev} → ${backendId}`)

    // Stop previous non-native backend
    if (prev === "openhands" && backendId !== "openhands") {
      await this._stopOpenhands()
    }
    if (prev === "goose" && backendId !== "goose") {
      await this._stopGoose()
    }

    // Start new backend
    switch (backendId) {
      case "kilo-native":
        this._emitStatus({ backend: "kilo-native", status: "running", message: "KiloCode native active" })
        break
      case "openhands":
        await this._startOpenhands(config)
        break
      case "goose":
        await this._startGoose(config)
        break
    }
  }

  private async _startOpenhands(config?: Record<string, unknown>): Promise<void> {
    this._emitStatus({ backend: "openhands", status: "starting", message: "Starting OpenHands..." })

    // OpenHands runs as a Docker container or via Python.
    // Check if openhandsServerUrl is configured; if so, use existing server.
    const serverUrl =
      (config?.openhandsServerUrl as string) || process.env.OPENHANDS_URL || "http://localhost:3000"

    // Test if server is already running
    try {
      const res = await fetch(`${serverUrl}/api/options/models`, { signal: AbortSignal.timeout(3000) })
      if (res.ok) {
        this._emitStatus({
          backend: "openhands",
          status: "running",
          message: `Connected to OpenHands at ${serverUrl}`,
        })
        this._outputChannel.appendLine(`[OpenHands] Connected to existing server at ${serverUrl}`)
        return
      }
    } catch {
      // Server not running — emit instructions to start it
      this._emitStatus({
        backend: "openhands",
        status: "error",
        message: [
          `OpenHands not found at ${serverUrl}.`,
          `Start it with:`,
          `docker run -it --rm \\`,
          `  -e SANDBOX_RUNTIME_CONTAINER_IMAGE=docker.all-hands.ai/all-hands-ai/runtime:0.38-nikolaik \\`,
          `  -v /var/run/docker.sock:/var/run/docker.sock \\`,
          `  -v ~/.openhands-state:/.openhands-state \\`,
          `  -p 3000:3000 --name openhands-app \\`,
          `  docker.all-hands.ai/all-hands-ai/openhands:0.38`,
        ].join("\n"),
      })
    }
  }

  private async _stopOpenhands(): Promise<void> {
    if (this._openhandsProcess) {
      this._openhandsProcess.kill("SIGTERM")
      this._openhandsProcess = null
      this._emitStatus({ backend: "openhands", status: "idle", message: "OpenHands stopped" })
    }
  }

  private async _startGoose(config?: Record<string, unknown>): Promise<void> {
    this._emitStatus({ backend: "goose", status: "starting", message: "Starting Goose..." })

    const cliPath = (config?.gooseCliPath as string) || process.env.GOOSE_CLI_PATH || "goose"

    // Try to detect goose
    try {
      const which = cp.spawnSync(process.platform === "win32" ? "where" : "which", [cliPath], {
        encoding: "utf8",
      })
      if (which.status !== 0) {
        this._emitStatus({
          backend: "goose",
          status: "error",
          message: `Goose CLI not found. Install with: curl -fsSL https://github.com/block/goose/releases/latest/download/install.sh | bash`,
        })
        return
      }

      // Launch goose in ACP mode (JSON-RPC stdio)
      this._gooseProcess = cp.spawn(cliPath, ["acp"], {
        stdio: ["pipe", "pipe", "pipe"],
        env: { ...process.env },
      })

      this._gooseProcess.stdout?.on("data", (data: Buffer) => {
        this._outputChannel.appendLine(`[Goose stdout] ${data.toString().trim()}`)
      })
      this._gooseProcess.stderr?.on("data", (data: Buffer) => {
        this._outputChannel.appendLine(`[Goose stderr] ${data.toString().trim()}`)
      })
      this._gooseProcess.on("exit", (code) => {
        this._outputChannel.appendLine(`[Goose] Process exited with code ${code}`)
        this._emitStatus({
          backend: "goose",
          status: "idle",
          message: `Goose process exited (code ${code})`,
        })
        this._gooseProcess = null
      })

      this._emitStatus({
        backend: "goose",
        status: "running",
        message: "Goose ACP server running",
        pid: this._gooseProcess.pid,
      })
    } catch (e) {
      this._emitStatus({ backend: "goose", status: "error", message: String(e) })
    }
  }

  private async _stopGoose(): Promise<void> {
    if (this._gooseProcess) {
      this._gooseProcess.kill("SIGTERM")
      this._gooseProcess = null
      this._emitStatus({ backend: "goose", status: "idle", message: "Goose stopped" })
    }
  }

  private _emitStatus(event: BackendStatusEvent): void {
    this._postMessage({ type: "backendStatusUpdate", ...event })
  }

  dispose(): void {
    void this._stopOpenhands()
    void this._stopGoose()
    this._outputChannel.dispose()
  }
}
