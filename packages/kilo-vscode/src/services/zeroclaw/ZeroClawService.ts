import * as vscode from "vscode"
import { randomUUID } from "crypto"
import { spawn, execFileSync, execSync, type ChildProcess } from "child_process"
import { KiloLogger } from "../KiloLogger"

// ─── Types ───────────────────────────────────────────────

export type RiskLevel = "low" | "medium" | "high"
export type NetworkPolicy = "deny" | "allowlist" | "open"
export type WritePolicy = "read_only" | "buffered" | "approved"
export type TaskStatus = "queued" | "running" | "completed" | "failed" | "blocked"

export interface TaskLimits {
	timeoutSec: number
	memoryMb: number
	cpu: number
}

export interface ZeroClawTask {
	taskId: string
	description: string
	projectPath: string
	riskLevel: RiskLevel
	workspaceScope: string[]
	networkPolicy: NetworkPolicy
	/**
	 * Optional allowlist of host substrings (e.g. "github.com",
	 * "https://registry.npmjs.org") consulted only when
	 * `networkPolicy === "allowlist"`. URLs in the command must match at
	 * least one allowlist entry; otherwise execution is refused.
	 */
	networkAllowlist?: string[]
	writePolicy: WritePolicy
	limits: TaskLimits
	status: TaskStatus
	exitCode?: number
	logs: string[]
	changedFiles: string[]
	artifacts: string[]
	/**
	 * Structured diff artifacts captured during medium-risk buffered
	 * execution. Each entry contains the patch produced by `git diff`
	 * for a single changed file, used by the webview for review/discard.
	 */
	diffArtifacts: Artifact[]
	requiresApproval: boolean
	approvedBy?: string
	createdAt: number
	completedAt?: number
	retryCount: number
}

export interface TaskSubmission {
	description: string
	projectPath: string
	riskLevel: RiskLevel
	workspaceScope: string
	networkPolicy: NetworkPolicy
	networkAllowlist?: string[]
	writePolicy: WritePolicy
	limits: TaskLimits
}

export interface TaskStatusEvent {
	taskId: string
	status: TaskStatus
	task: ZeroClawTask
}

export interface Artifact {
	name: string
	path: string
	type: "file" | "diff" | "log" | "screenshot"
	/**
	 * Alias for `type` — the spec for medium-risk diff artifacts uses
	 * `kind`. We keep both so existing consumers see the old field while
	 * new diff-aware UIs can rely on the new name.
	 */
	kind?: "file" | "diff" | "log" | "screenshot"
	/**
	 * Inline content (e.g. unified-diff patch text). Populated for
	 * `kind: "diff"` artifacts produced by medium-risk execution.
	 */
	content?: string
	sizeBytes: number
	createdAt: number
}

export interface TaskResult {
	taskId: string
	status: string
	artifacts: Artifact[]
	logs: string[]
	summary: string
	duration: number
	exitCode?: number
}

type StatusListener = (event: TaskStatusEvent) => void

const HISTORY_STATE_KEY = "zeroclaw.executionHistory"
const MAX_HISTORY = 200

/**
 * Per-task cap on captured stdout+stderr bytes. Anything beyond this is
 * dropped and replaced with a single truncation marker, preventing a
 * runaway child from exhausting extension memory.
 */
const MAX_LOG_CAPTURE_BYTES = 10 * 1024 * 1024 // 10 MB

/**
 * Substrings flagged by the network-pattern detector. Tokens are
 * matched against `/\b<token>\b/i` (or against any URL scheme for the
 * `http(s)://` entries) so e.g. "ncurses" does not trigger on "nc".
 */
const NETWORK_PATTERN_TOKENS: ReadonlyArray<{ token: string; pattern: RegExp }> = [
	{ token: "curl", pattern: /\bcurl\b/i },
	{ token: "wget", pattern: /\bwget\b/i },
	{ token: "npm install", pattern: /\bnpm\s+(install|i|add)\b/i },
	{ token: "pip install", pattern: /\bpip[\d.]*\s+install\b/i },
	{ token: "go get", pattern: /\bgo\s+get\b/i },
	{ token: "cargo install", pattern: /\bcargo\s+install\b/i },
	{ token: "git clone", pattern: /\bgit\s+clone\b/i },
	{ token: "ssh", pattern: /\bssh\b/i },
	{ token: "scp", pattern: /\bscp\b/i },
	{ token: "nc", pattern: /\bnc\b/i },
	{ token: "netcat", pattern: /\bnetcat\b/i },
	{ token: "http://", pattern: /\bhttps?:\/\/\S+/i },
]

// ─── Service ─────────────────────────────────────────────

/**
 * Manages ZeroClaw task queue and execution.
 *
 * Evaluates risk level to determine execution path:
 * - Low risk: auto-execute in VS Code terminal
 * - Medium risk: execute but buffer changes, require diff review
 * - High risk: block until approved
 *
 * Tracks execution history in workspace state and emits events
 * for status changes so the webview can stay in sync.
 */
export class ZeroClawService implements vscode.Disposable {
	private readonly log = KiloLogger.for("ZeroClawService")
	private readonly tasks = new Map<string, ZeroClawTask>()
	private readonly queue: string[] = []
	private readonly listeners = new Set<StatusListener>()
	private readonly disposables: vscode.Disposable[] = []
	private readonly terminals = new Map<string, vscode.Terminal>()
	/** Active child processes for spawn-based capture path (Gap 1). */
	private readonly children = new Map<string, ChildProcess>()
	/** Bytes appended to a task's logs via stdio capture; capped at MAX_LOG_CAPTURE_BYTES. */
	private readonly logCaptureBytes = new Map<string, number>()
	/** Whether a truncation marker has already been appended for a task. */
	private readonly logTruncated = new Set<string>()
	private readonly executionTimers = new Map<string, ReturnType<typeof setTimeout>>()
	private readonly maxRetries: number = 3
	private processing = false

	constructor(private readonly ctx: vscode.ExtensionContext) {
		// Restore persisted history into the in-memory map
		const saved = ctx.workspaceState.get<ZeroClawTask[]>(HISTORY_STATE_KEY, [])
		for (const task of saved) {
			this.tasks.set(task.taskId, task)
		}

		// Clean up terminals that are closed externally
		const termClose = vscode.window.onDidCloseTerminal((t) => {
			for (const [taskId, term] of this.terminals) {
				if (term === t) {
					this.terminals.delete(taskId)
					this.clearExecutionTimer(taskId)
					const task = this.tasks.get(taskId)
					if (task && task.status === "running") {
						this.rollbackTask(taskId)
						this.transitionStatus(taskId, "failed")
						this.appendLog(taskId, "[ZeroClaw] Terminal closed externally")
					}
					break
				}
			}
		})
		this.disposables.push(termClose)

		this.log.info("ZeroClawService initialized")
	}

	// ─── Public API ────────────────────────────────────────

	/** Submit a new task. Returns the created task, or throws if validation fails. */
	submit(submission: TaskSubmission): ZeroClawTask {
		const endTimer = this.log.time("submitTask")

		if (!this.validateRiskLevel(submission)) {
			throw new Error("Invalid task submission: failed risk validation")
		}

		const taskId = randomUUID().slice(0, 12)
		const scopeParts = submission.workspaceScope
			.split(",")
			.map((s) => s.trim())
			.filter(Boolean)

		this.log.info("Task submitted", { taskId, description: submission.description })

		const task: ZeroClawTask = {
			taskId,
			description: submission.description,
			projectPath: submission.projectPath,
			riskLevel: submission.riskLevel,
			workspaceScope: scopeParts,
			networkPolicy: submission.networkPolicy,
			networkAllowlist: submission.networkAllowlist
				? [...submission.networkAllowlist]
				: undefined,
			writePolicy: submission.writePolicy,
			limits: { ...submission.limits },
			status: "queued",
			logs: [],
			changedFiles: [],
			artifacts: [],
			diffArtifacts: [],
			requiresApproval: submission.riskLevel === "high",
			createdAt: Date.now(),
			retryCount: 0,
		}

		this.tasks.set(taskId, task)
		this.appendLog(taskId, `[ZeroClaw] Task ${taskId} created (risk: ${task.riskLevel})`)

		if (task.riskLevel === "high") {
			this.transitionStatus(taskId, "blocked")
			this.appendLog(taskId, "[ZeroClaw] High-risk task blocked pending approval")
		} else {
			this.queue.push(taskId)
			this.processQueue()
		}

		this.persistHistory()
		endTimer()
		return task
	}

	/** Cancel a running or queued task. */
	cancel(taskId: string): boolean {
		const task = this.tasks.get(taskId)
		if (!task) return false

		if (task.status === "queued") {
			const idx = this.queue.indexOf(taskId)
			if (idx >= 0) this.queue.splice(idx, 1)
			this.transitionStatus(taskId, "failed")
			this.appendLog(taskId, "[ZeroClaw] Task cancelled while queued")
			this.persistHistory()
			return true
		}

		if (task.status === "running") {
			const terminal = this.terminals.get(taskId)
			if (terminal) {
				terminal.dispose()
				this.terminals.delete(taskId)
			}
			const child = this.children.get(taskId)
			if (child) {
				try {
					child.kill("SIGKILL")
				} catch (err) {
					this.log.warn("Failed to kill child during cancel", {
						taskId,
						error: err instanceof Error ? err.message : String(err),
					})
				}
				this.children.delete(taskId)
			}
			this.transitionStatus(taskId, "failed")
			this.appendLog(taskId, "[ZeroClaw] Task cancelled while running")
			this.persistHistory()
			return true
		}

		if (task.status === "blocked") {
			this.transitionStatus(taskId, "failed")
			this.appendLog(taskId, "[ZeroClaw] Blocked task cancelled")
			this.persistHistory()
			return true
		}

		return false
	}

	/** Retry a failed task by resubmitting it to the queue. Respects retry budget. */
	retry(taskId: string): ZeroClawTask | undefined {
		const original = this.tasks.get(taskId)
		if (!original || original.status !== "failed") return undefined

		if (original.retryCount >= this.maxRetries) {
			this.appendLog(taskId, `[ZeroClaw] Retry budget exhausted (${original.retryCount}/${this.maxRetries})`)
			this.persistHistory()
			return undefined
		}

		original.retryCount++
		this.appendLog(taskId, `[ZeroClaw] Retry ${original.retryCount}/${this.maxRetries}`)
		this.persistHistory()

		const newTask = this.submit({
			description: original.description,
			projectPath: original.projectPath,
			riskLevel: original.riskLevel,
			workspaceScope: original.workspaceScope.join(", "),
			networkPolicy: original.networkPolicy,
			writePolicy: original.writePolicy,
			limits: { ...original.limits },
		})

		// Carry over the retry count to the new task
		newTask.retryCount = original.retryCount
		this.persistHistory()
		return newTask
	}

	/** Approve a high-risk (blocked) task. Moves it into the queue. */
	approve(taskId: string, approver: string): boolean {
		const task = this.tasks.get(taskId)
		if (!task || task.status !== "blocked") return false

		task.approvedBy = approver
		task.requiresApproval = false
		this.appendLog(taskId, `[ZeroClaw] Approved by ${approver}`)
		this.queue.push(taskId)
		this.transitionStatus(taskId, "queued")
		this.persistHistory()
		this.processQueue()
		return true
	}

	/** Reject a blocked task. Moves it to failed. */
	reject(taskId: string, reason?: string): boolean {
		const task = this.tasks.get(taskId)
		if (!task || task.status !== "blocked") return false

		this.appendLog(taskId, `[ZeroClaw] Rejected${reason ? `: ${reason}` : ""}`)
		this.transitionStatus(taskId, "failed")
		this.persistHistory()
		return true
	}

	/** Get a single task by ID. */
	getTask(taskId: string): ZeroClawTask | undefined {
		this.log.debug("getTask requested", { taskId })
		return this.tasks.get(taskId)
	}

	/** Get all tasks, ordered newest first. */
	getAllTasks(): ZeroClawTask[] {
		this.log.debug("getAllTasks requested", { count: this.tasks.size })
		return [...this.tasks.values()].sort((a, b) => b.createdAt - a.createdAt)
	}

	/** Get the last N tasks for history display. */
	getHistory(limit = 50): ZeroClawTask[] {
		return this.getAllTasks().slice(0, limit)
	}

	/**
	 * Build a safe default task context for pre-populating the ZeroClaw tab's
	 * submission form. Values are derived from the active workspace folder.
	 */
	getDefaultTaskContext(): {
		projectPath: string
		workspaceScope: string
		riskLevel: "low"
		networkPolicy: "none"
		writePolicy: "workspace-only"
		limits: { maxSeconds: number; maxFilesChanged: number }
		templates: Array<{ name: string; description: string; command: string }>
	} {
		let workspaceFsPath = ""
		try {
			workspaceFsPath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? ""
		} catch (err: unknown) {
			this.log.warn("getDefaultTaskContext: failed to resolve workspace", err)
			workspaceFsPath = ""
		}

		return {
			projectPath: workspaceFsPath,
			workspaceScope: workspaceFsPath,
			riskLevel: "low" as const,
			networkPolicy: "none" as const,
			writePolicy: "workspace-only" as const,
			limits: { maxSeconds: 300, maxFilesChanged: 20 },
			templates: [
				{ name: "Format project", description: "Run formatter across all files", command: "" },
				{ name: "Run tests", description: "Run test suite", command: "npm test" },
				{ name: "Type check", description: "Run TypeScript typecheck", command: "tsc --noEmit" },
			],
		}
	}

	// ─── Result & Artifact API ─────────────────────────────

	/**
	 * Build a full TaskResult snapshot for a given task.
	 * Returns undefined if the task does not exist.
	 */
	getTaskResult(taskId: string): TaskResult | undefined {
		this.log.debug("getTaskResult requested", { taskId })
		const task = this.tasks.get(taskId)
		if (!task) return undefined

		const duration =
			task.completedAt && task.createdAt
				? task.completedAt - task.createdAt
				: 0

		return {
			taskId: task.taskId,
			status: task.status,
			artifacts: this.buildArtifactsFromTask(task),
			logs: [...task.logs],
			summary: this.formatTaskSummary(taskId),
			duration,
			exitCode: task.exitCode,
		}
	}

	/**
	 * Scan a task's workspace and artifact paths to collect structured Artifact records.
	 * Inspects the task's changedFiles and artifacts lists, then stats each path
	 * on disk to gather size and creation time.
	 */
	async collectArtifacts(taskId: string): Promise<Artifact[]> {
		const task = this.tasks.get(taskId)
		if (!task) return []

		const fs = await import("fs/promises")
		const path = await import("path")
		const collected: Artifact[] = []

		// Combine both changedFiles and artifacts into candidates
		const candidates = [...new Set([...task.changedFiles, ...task.artifacts])]

		for (const filePath of candidates) {
			try {
				const stat = await fs.stat(filePath)
				const ext = path.extname(filePath).toLowerCase()
				const artifactType = this.classifyArtifact(ext, filePath)

				collected.push({
					name: path.basename(filePath),
					path: filePath,
					type: artifactType,
					kind: artifactType,
					sizeBytes: stat.size,
					createdAt: stat.birthtimeMs || stat.mtimeMs,
				})
			} catch {
				// File may have been cleaned up or is unreachable; skip it
			}
		}

		// Update the task's artifact list with any newly discovered paths
		const existingSet = new Set(task.artifacts)
		for (const a of collected) {
			if (!existingSet.has(a.path)) {
				task.artifacts.push(a.path)
			}
		}

		if (collected.length > 0) {
			this.appendLog(taskId, `[ZeroClaw] Collected ${collected.length} artifact(s)`)
			this.persistHistory()
		}

		return collected
	}

	/**
	 * Build a human-readable summary of a task's execution.
	 * Suitable for display in the webview or notification messages.
	 */
	formatTaskSummary(taskId: string): string {
		const task = this.tasks.get(taskId)
		if (!task) return `Task ${taskId}: not found`

		const lines: string[] = []

		// Header
		const statusLabel = task.status.toUpperCase()
		lines.push(`Task ${task.taskId} [${statusLabel}]`)

		// Description (truncated)
		const descPreview =
			task.description.length > 80
				? task.description.slice(0, 77) + "..."
				: task.description
		lines.push(`  Description: ${descPreview}`)

		// Risk + policies
		lines.push(`  Risk: ${task.riskLevel} | Network: ${task.networkPolicy} | Write: ${task.writePolicy}`)

		// Duration
		if (task.completedAt && task.createdAt) {
			const durSec = ((task.completedAt - task.createdAt) / 1000).toFixed(1)
			lines.push(`  Duration: ${durSec}s`)
		} else if (task.status === "running") {
			const elapsed = ((Date.now() - task.createdAt) / 1000).toFixed(1)
			lines.push(`  Elapsed: ${elapsed}s (still running)`)
		}

		// Exit code
		if (task.exitCode !== undefined) {
			lines.push(`  Exit code: ${task.exitCode}`)
		}

		// Changed files
		if (task.changedFiles.length > 0) {
			lines.push(`  Changed files (${task.changedFiles.length}):`)
			for (const f of task.changedFiles.slice(0, 10)) {
				lines.push(`    - ${f}`)
			}
			if (task.changedFiles.length > 10) {
				lines.push(`    ... and ${task.changedFiles.length - 10} more`)
			}
		}

		// Artifacts
		if (task.artifacts.length > 0) {
			lines.push(`  Artifacts (${task.artifacts.length}):`)
			for (const a of task.artifacts.slice(0, 10)) {
				lines.push(`    - ${a}`)
			}
			if (task.artifacts.length > 10) {
				lines.push(`    ... and ${task.artifacts.length - 10} more`)
			}
		}

		// Approval info
		if (task.approvedBy) {
			lines.push(`  Approved by: ${task.approvedBy}`)
		}

		// Retry count
		if (task.retryCount > 0) {
			lines.push(`  Retries: ${task.retryCount}`)
		}

		return lines.join("\n")
	}

	// ─── Artifact helpers (private) ────────────────────────

	/**
	 * Classify a file into an artifact type based on its extension and path.
	 */
	private classifyArtifact(ext: string, filePath: string): Artifact["type"] {
		if (ext === ".diff" || ext === ".patch") return "diff"
		if (ext === ".log" || ext === ".txt") return "log"
		if (ext === ".png" || ext === ".jpg" || ext === ".jpeg" || ext === ".webp") return "screenshot"
		if (filePath.includes("/logs/") || filePath.includes("\\logs\\")) return "log"
		if (filePath.includes("/screenshots/") || filePath.includes("\\screenshots\\")) return "screenshot"
		return "file"
	}

	/**
	 * Build Artifact records from a task's existing artifact paths
	 * without hitting the filesystem (uses placeholder sizes).
	 * For accurate sizes, use collectArtifacts() instead.
	 */
	private buildArtifactsFromTask(task: ZeroClawTask): Artifact[] {
		const path = require("path") as typeof import("path")

		return task.artifacts.map((filePath) => {
			const ext = path.extname(filePath).toLowerCase()
			const t = this.classifyArtifact(ext, filePath)
			return {
				name: path.basename(filePath),
				path: filePath,
				type: t,
				kind: t,
				sizeBytes: 0, // Unknown without fs stat; use collectArtifacts for accurate data
				createdAt: task.createdAt,
			}
		})
	}

	/** Register a listener for task status changes. Returns a disposable to unsubscribe. */
	onStatusChange(listener: StatusListener): vscode.Disposable {
		this.listeners.add(listener)
		return { dispose: () => this.listeners.delete(listener) }
	}

	dispose(): void {
		for (const terminal of this.terminals.values()) {
			terminal.dispose()
		}
		this.terminals.clear()
		for (const child of this.children.values()) {
			try {
				child.kill("SIGKILL")
			} catch {
				// Best-effort: child may already be gone.
			}
		}
		this.children.clear()
		this.logCaptureBytes.clear()
		this.logTruncated.clear()
		for (const timer of this.executionTimers.values()) {
			clearTimeout(timer)
		}
		this.executionTimers.clear()
		this.listeners.clear()
		for (const d of this.disposables) {
			d.dispose()
		}
		this.disposables.length = 0
	}

	// ─── Internal ──────────────────────────────────────────

	private transitionStatus(taskId: string, status: TaskStatus): void {
		const task = this.tasks.get(taskId)
		if (!task) return

		task.status = status
		if (status === "completed" || status === "failed") {
			task.completedAt = Date.now()
		}

		const event: TaskStatusEvent = { taskId, status, task: { ...task } }
		for (const listener of this.listeners) {
			try {
				listener(event)
			} catch {
				// Listener errors must not break the service
			}
		}
	}

	private appendLog(taskId: string, line: string): void {
		const task = this.tasks.get(taskId)
		if (!task) return
		const ts = new Date().toISOString().slice(11, 19)
		task.logs.push(`[${ts}] ${line}`)
	}

	private async processQueue(): Promise<void> {
		if (this.processing) return
		this.processing = true

		try {
			while (this.queue.length > 0) {
				const taskId = this.queue.shift()!
				const task = this.tasks.get(taskId)
				if (!task || task.status === "failed") continue

				await this.executeTask(task)
			}
		} finally {
			this.processing = false
		}
	}

	private async executeTask(task: ZeroClawTask): Promise<void> {
		switch (task.riskLevel) {
			case "low":
				await this.executeLowRisk(task)
				break
			case "medium":
				await this.executeMediumRisk(task)
				break
			case "high":
				// High risk tasks should have been approved before reaching here
				await this.executeApproved(task)
				break
		}
	}

	/**
	 * Low risk: auto-execute via a captured child process. stdout/stderr
	 * are streamed into `task.logs` (subject to MAX_LOG_CAPTURE_BYTES).
	 */
	private async executeLowRisk(task: ZeroClawTask): Promise<void> {
		this.transitionStatus(task.taskId, "running")
		this.appendLog(task.taskId, "[ZeroClaw] Low-risk auto-execution started")
		this.appendLog(task.taskId, `[ZeroClaw] Network policy: ${task.networkPolicy}`)
		this.appendLog(task.taskId, `[ZeroClaw] Write policy: ${task.writePolicy}`)
		this.appendLog(task.taskId, `[ZeroClaw] Scope: ${task.workspaceScope.join(", ") || "(workspace)"}`)

		if (!this.enforceNetworkPolicy(task)) return
		await this.runWithSpawn(task)
	}

	/**
	 * Medium risk: execute via spawn (so we can capture logs), then
	 * compute a git-status-based diff of the workspace and surface each
	 * change as an `Artifact` in `task.diffArtifacts`. The task is
	 * transitioned to `blocked` so the user can review the diff before
	 * keeping or discarding the changes.
	 */
	private async executeMediumRisk(task: ZeroClawTask): Promise<void> {
		this.transitionStatus(task.taskId, "running")
		this.appendLog(task.taskId, "[ZeroClaw] Medium-risk buffered execution started")
		this.appendLog(task.taskId, "[ZeroClaw] Changes will be buffered for diff review")

		// Force buffered write policy for medium risk regardless of user setting
		task.writePolicy = "buffered"

		if (!this.enforceNetworkPolicy(task)) return

		// Snapshot the dirty file set before running — so we can diff
		// only the files the task itself touched.
		const beforeStatus = this.gitStatusSnapshot(task)

		await this.runWithSpawn(task)

		// Only generate diffs for tasks that actually completed; failed
		// tasks were already rolled back / transitioned by runWithSpawn.
		if (task.status === "completed") {
			this.captureDiffArtifacts(task, beforeStatus)
			this.transitionStatus(task.taskId, "blocked")
			task.requiresApproval = true
			this.appendLog(task.taskId, "[ZeroClaw] Buffered changes ready for diff review")
			this.persistHistory()
		}
	}

	/**
	 * High risk: executes only after approval was granted. Uses the
	 * VS Code terminal path so the operator can watch potentially
	 * dangerous output live.
	 */
	private async executeApproved(task: ZeroClawTask): Promise<void> {
		this.transitionStatus(task.taskId, "running")
		this.appendLog(task.taskId, `[ZeroClaw] Approved execution started (by ${task.approvedBy ?? "unknown"})`)

		if (!this.enforceNetworkPolicy(task)) return
		await this.runInTerminal(task)
	}

	// ─── Gap 3: Network policy enforcement ─────────────────

	/**
	 * Inspect a command for substrings that imply network access.
	 * The match list is intentionally heuristic; real network policy
	 * enforcement requires OS-level firewall hooks which are not
	 * available cross-platform from a VS Code extension. This static
	 * helper exists primarily so tests and the webview can preview
	 * the same decision the service will make at execution time.
	 */
	static detectNetworkPatterns(command: string): { hasNetwork: boolean; matches: string[] } {
		const matches: string[] = []
		for (const { token, pattern } of NETWORK_PATTERN_TOKENS) {
			const m = command.match(pattern)
			if (!m) continue
			// For URL hits, surface the actual URL; otherwise the token.
			matches.push(token === "http://" ? m[0] : token)
		}
		return { hasNetwork: matches.length > 0, matches }
	}

	/**
	 * Extract every URL (http/https) from a command string.
	 * Used by the allowlist check — a URL is "allowed" if any
	 * allowlist entry is a substring of the URL (so callers can pass
	 * either a host, a host+path prefix, or the full URL).
	 */
	private static extractUrls(command: string): string[] {
		const urls: string[] = []
		const re = /\bhttps?:\/\/\S+/gi
		let m: RegExpExecArray | null
		while ((m = re.exec(command)) !== null) {
			// Strip trailing punctuation that's commonly adjacent to URLs
			// in shell pipelines (quotes, semicolons, parens).
			urls.push(m[0].replace(/[)'";]+$/g, ""))
		}
		return urls
	}

	/**
	 * Apply the task's `networkPolicy` to its command. Returns `true`
	 * when execution may proceed and `false` when the task was refused
	 * (in which case it has already been transitioned to "failed").
	 *
	 * NOTE: This is best-effort, command-string-based filtering — not a
	 * sandbox. A determined task author can bypass it via shell
	 * indirection. For real isolation use OS-level firewalls / network
	 * namespaces. See gap-3 doc comment for details.
	 */
	private enforceNetworkPolicy(task: ZeroClawTask): boolean {
		if (task.networkPolicy === "open") {
			return true
		}

		const { hasNetwork, matches } = ZeroClawService.detectNetworkPatterns(task.description)

		if (task.networkPolicy === "deny") {
			if (hasNetwork) {
				const reason = `[ZeroClaw] Refused: command appears to access network but networkPolicy=deny (matched: ${matches.join(", ")})`
				this.log.warn("Network policy denied execution", { taskId: task.taskId, matches })
				this.appendLog(task.taskId, reason)
				task.exitCode = -1
				this.transitionStatus(task.taskId, "failed")
				this.persistHistory()
				return false
			}
			return true
		}

		if (task.networkPolicy === "allowlist") {
			const urls = ZeroClawService.extractUrls(task.description)
			const allowlist = task.networkAllowlist ?? []
			const offenders = urls.filter(
				(url) => !allowlist.some((entry) => entry.length > 0 && url.includes(entry)),
			)
			if (offenders.length > 0) {
				const reason = `[ZeroClaw] Refused: URL(s) not in allowlist (offending: ${offenders.join(", ")})`
				this.log.warn("Network allowlist rejected URLs", {
					taskId: task.taskId,
					offenders,
					allowlist,
				})
				this.appendLog(task.taskId, reason)
				task.exitCode = -1
				this.transitionStatus(task.taskId, "failed")
				this.persistHistory()
				return false
			}
			return true
		}

		return true
	}

	// ─── Gap 1: Spawn-based execution with stdio capture ────

	/**
	 * Run a task via `child_process.spawn` so that stdout and stderr
	 * can be streamed back into `task.logs`. This is the path used for
	 * low and medium-risk tasks where the operator does not need a
	 * live terminal but does want a complete capture of output.
	 *
	 * The shell is selected to mirror `runInTerminal`: `cmd.exe /c` on
	 * Windows, `/bin/bash -c` elsewhere. Per-task capture is capped at
	 * MAX_LOG_CAPTURE_BYTES; further chunks are dropped and a single
	 * truncation marker is appended so callers can see what happened.
	 *
	 * Timeouts are enforced by `startExecutionTimer`, which now
	 * `child.kill('SIGKILL')`s instead of disposing a terminal.
	 */
	private async runWithSpawn(task: ZeroClawTask): Promise<void> {
		const shellPath = process.platform === "win32" ? "cmd.exe" : "/bin/bash"
		const shellFlagArg = process.platform === "win32" ? "/c" : "-c"

		const envVars: NodeJS.ProcessEnv = {
			...process.env,
			ZEROCLAW_TASK_ID: task.taskId,
			ZEROCLAW_RISK_LEVEL: task.riskLevel,
			ZEROCLAW_NETWORK_POLICY: task.networkPolicy,
			ZEROCLAW_WRITE_POLICY: task.writePolicy,
			ZEROCLAW_TIMEOUT_SEC: String(task.limits.timeoutSec),
			ZEROCLAW_MEMORY_MB: String(task.limits.memoryMb),
			ZEROCLAW_CPU: String(task.limits.cpu),
		}

		const timeoutMs = task.limits.timeoutSec * 1000
		this.appendLog(task.taskId, `[ZeroClaw] Spawning ${shellPath} ${shellFlagArg} <command>`)

		let child: ChildProcess
		try {
			child = spawn(shellPath, [shellFlagArg, task.description], {
				cwd: task.projectPath || undefined,
				env: envVars,
				stdio: ["ignore", "pipe", "pipe"],
				windowsHide: true,
			})
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err)
			this.appendLog(task.taskId, `[ZeroClaw] Failed to spawn shell: ${msg}`)
			task.exitCode = -1
			this.transitionStatus(task.taskId, "failed")
			this.persistHistory()
			return
		}

		this.children.set(task.taskId, child)
		this.logCaptureBytes.set(task.taskId, 0)
		this.startExecutionTimer(task.taskId, timeoutMs)

		const captureChunk = (chunk: Buffer | string, channel: "stdout" | "stderr") => {
			const text = typeof chunk === "string" ? chunk : chunk.toString("utf8")
			const used = this.logCaptureBytes.get(task.taskId) ?? 0
			if (used >= MAX_LOG_CAPTURE_BYTES) return

			const remaining = MAX_LOG_CAPTURE_BYTES - used
			const allowed = text.length <= remaining ? text : text.slice(0, remaining)
			if (allowed.length > 0) {
				const lines = allowed.split(/\r?\n/)
				for (const line of lines) {
					if (line.length === 0) continue
					this.appendLog(task.taskId, `[${channel}] ${line}`)
				}
			}
			this.logCaptureBytes.set(task.taskId, used + allowed.length)

			if (allowed.length < text.length && !this.logTruncated.has(task.taskId)) {
				this.logTruncated.add(task.taskId)
				this.appendLog(task.taskId, "[ZeroClaw] Output truncated at 10MB")
			}
		}

		child.stdout?.on("data", (c) => captureChunk(c, "stdout"))
		child.stderr?.on("data", (c) => captureChunk(c, "stderr"))

		const exitInfo = await new Promise<{ code: number | null; signal: NodeJS.Signals | null; error?: Error }>(
			(resolve) => {
				let settled = false
				const settle = (v: { code: number | null; signal: NodeJS.Signals | null; error?: Error }) => {
					if (settled) return
					settled = true
					resolve(v)
				}
				child.on("error", (error) => settle({ code: null, signal: null, error }))
				child.on("close", (code, signal) => settle({ code, signal }))
			},
		)

		this.clearExecutionTimer(task.taskId)
		this.children.delete(task.taskId)
		this.logCaptureBytes.delete(task.taskId)
		this.logTruncated.delete(task.taskId)

		if (exitInfo.error) {
			this.appendLog(task.taskId, `[ZeroClaw] Child process error: ${exitInfo.error.message}`)
			task.exitCode = -1
			if (task.status === "running") {
				this.rollbackTask(task.taskId)
				this.transitionStatus(task.taskId, "failed")
			}
			this.persistHistory()
			return
		}

		if (exitInfo.signal === "SIGKILL" || exitInfo.signal === "SIGTERM") {
			// startExecutionTimer's auto-cancel path will already have
			// transitioned the task; just record the exit cause.
			this.appendLog(task.taskId, `[ZeroClaw] Child terminated by signal ${exitInfo.signal}`)
			task.exitCode = -1
			if (task.status === "running") {
				this.rollbackTask(task.taskId)
				this.transitionStatus(task.taskId, "failed")
			}
			this.persistHistory()
			return
		}

		if (task.status !== "running") {
			// Cancelled or already failed externally; honor that decision.
			this.persistHistory()
			return
		}

		task.exitCode = exitInfo.code ?? 0
		if (task.exitCode === 0) {
			this.appendLog(task.taskId, "[ZeroClaw] Task execution completed")
			this.transitionStatus(task.taskId, "completed")
		} else {
			this.appendLog(task.taskId, `[ZeroClaw] Task exited with code ${task.exitCode}`)
			this.rollbackTask(task.taskId)
			this.transitionStatus(task.taskId, "failed")
		}
		this.persistHistory()
	}

	// ─── Gap 2: Medium-risk diff capture & buffer review ────

	/**
	 * Snapshot the current dirty-file set in the task's project so the
	 * post-execution diff can ignore files that were already dirty
	 * before the task ran. Returns a Set of porcelain paths or `null`
	 * if the project is not a git repository.
	 */
	private gitStatusSnapshot(task: ZeroClawTask): Set<string> | null {
		const cwd = task.projectPath || undefined
		try {
			const out = execFileSync("git", ["status", "--porcelain"], {
				cwd,
				timeout: 10000,
				encoding: "utf-8",
			})
			const paths = new Set<string>()
			for (const line of out.split(/\r?\n/)) {
				if (line.length < 4) continue
				paths.add(line.slice(3).trim())
			}
			return paths
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err)
			this.log.info("git status snapshot failed (non-git project?)", {
				taskId: task.taskId,
				error: msg,
			})
			return null
		}
	}

	/**
	 * Run `git status --porcelain` after the task, diff each newly
	 * dirty file, and append the resulting patches to
	 * `task.diffArtifacts` as `kind: "diff"` Artifact records. The
	 * file paths are also added to `task.changedFiles` for later
	 * rollback / discard. No-op (with an info log) if the project
	 * isn't a git repo or no changes were detected.
	 */
	private captureDiffArtifacts(task: ZeroClawTask, before: Set<string> | null): void {
		const cwd = task.projectPath || undefined

		let after: Set<string>
		try {
			const out = execFileSync("git", ["status", "--porcelain"], {
				cwd,
				timeout: 10000,
				encoding: "utf-8",
			})
			after = new Set<string>()
			for (const line of out.split(/\r?\n/)) {
				if (line.length < 4) continue
				after.add(line.slice(3).trim())
			}
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err)
			this.appendLog(task.taskId, `[ZeroClaw] Could not capture diff (git unavailable): ${msg}`)
			return
		}

		const newlyDirty = [...after].filter((p) => !before?.has(p))
		if (newlyDirty.length === 0) {
			this.appendLog(task.taskId, "[ZeroClaw] No file changes detected — empty diff")
			return
		}

		const now = Date.now()
		for (const filePath of newlyDirty) {
			let patch = ""
			try {
				patch = execFileSync("git", ["diff", "--", filePath], {
					cwd,
					timeout: 10000,
					encoding: "utf-8",
				})
			} catch (err) {
				const msg = err instanceof Error ? err.message : String(err)
				this.log.warn("git diff failed for changed path", {
					taskId: task.taskId,
					filePath,
					error: msg,
				})
				patch = `[ZeroClaw] git diff failed for ${filePath}: ${msg}`
			}

			// Untracked files don't show up in `git diff` — fall back to
			// a synthetic diff so the artifact is non-empty.
			if (patch.length === 0) {
				patch = `--- /dev/null\n+++ b/${filePath}\n[ZeroClaw] new file (untracked) — content not embedded`
			}

			const path = require("path") as typeof import("path")
			const artifact: Artifact = {
				name: path.basename(filePath),
				path: filePath,
				type: "diff",
				kind: "diff",
				content: patch,
				sizeBytes: Buffer.byteLength(patch, "utf8"),
				createdAt: now,
			}
			task.diffArtifacts.push(artifact)
			if (!task.changedFiles.includes(filePath)) {
				task.changedFiles.push(filePath)
			}
		}
		this.appendLog(
			task.taskId,
			`[ZeroClaw] Captured ${newlyDirty.length} diff artifact(s) for review`,
		)
	}

	/**
	 * Accept the buffered changes for a medium-risk task. Because the
	 * spawn already wrote files to disk, the buffer is virtual — this
	 * just transitions the task to "completed" and returns the diff
	 * artifacts so the caller can persist or display them.
	 */
	applyBufferedChanges(taskId: string): Artifact[] | undefined {
		const task = this.tasks.get(taskId)
		if (!task) return undefined
		if (task.status !== "blocked" || task.writePolicy !== "buffered") {
			this.log.warn("applyBufferedChanges called on non-buffered task", {
				taskId,
				status: task.status,
				writePolicy: task.writePolicy,
			})
			return undefined
		}

		this.appendLog(taskId, "[ZeroClaw] Buffered changes accepted")
		task.requiresApproval = false
		this.transitionStatus(taskId, "completed")
		this.persistHistory()
		return [...task.diffArtifacts]
	}

	/**
	 * Discard the buffered changes for a medium-risk task by running
	 * `git checkout -- <path>` for every diff artifact path. Best
	 * effort: failures are logged but do not throw. Transitions the
	 * task to "failed" once the revert is complete.
	 */
	discardBufferedChanges(taskId: string): boolean {
		const task = this.tasks.get(taskId)
		if (!task) return false
		if (task.status !== "blocked" || task.writePolicy !== "buffered") {
			this.log.warn("discardBufferedChanges called on non-buffered task", {
				taskId,
				status: task.status,
				writePolicy: task.writePolicy,
			})
			return false
		}

		const cwd = task.projectPath || undefined
		let reverted = 0
		let failed = 0

		for (const artifact of task.diffArtifacts) {
			try {
				execFileSync("git", ["checkout", "--", artifact.path], {
					cwd,
					timeout: 10000,
					stdio: "pipe",
				})
				reverted++
				this.appendLog(taskId, `[ZeroClaw] Reverted: ${artifact.path}`)
			} catch (err) {
				failed++
				const msg = err instanceof Error ? err.message : String(err)
				this.appendLog(taskId, `[ZeroClaw] Failed to revert ${artifact.path}: ${msg}`)
			}
		}

		this.appendLog(
			taskId,
			`[ZeroClaw] Discard complete: ${reverted} reverted, ${failed} failed`,
		)
		task.requiresApproval = false
		this.transitionStatus(taskId, "failed")
		this.persistHistory()
		return failed === 0
	}

	/**
	 * Run the task description as a command in a dedicated VS Code terminal.
	 * Enforces timeout limits via an execution timer. Captures the terminal
	 * name for tracking.
	 */
	private async runInTerminal(task: ZeroClawTask): Promise<void> {
		const terminalName = `ZeroClaw: ${task.taskId}`

		const shellPath = process.platform === "win32" ? "cmd.exe" : "/bin/bash"
		const shellFlagArg = process.platform === "win32" ? "/c" : "-c"

		// Build the command with resource constraints
		const envVars: Record<string, string> = {
			ZEROCLAW_TASK_ID: task.taskId,
			ZEROCLAW_RISK_LEVEL: task.riskLevel,
			ZEROCLAW_NETWORK_POLICY: task.networkPolicy,
			ZEROCLAW_WRITE_POLICY: task.writePolicy,
			ZEROCLAW_TIMEOUT_SEC: String(task.limits.timeoutSec),
			ZEROCLAW_MEMORY_MB: String(task.limits.memoryMb),
			ZEROCLAW_CPU: String(task.limits.cpu),
		}

		const terminal = vscode.window.createTerminal({
			name: terminalName,
			cwd: task.projectPath || undefined,
			env: envVars,
			shellPath,
			shellArgs: [shellFlagArg, task.description],
			isTransient: true,
		})

		this.terminals.set(task.taskId, terminal)
		this.appendLog(task.taskId, `[ZeroClaw] Terminal "${terminalName}" created`)

		// Start execution timeout timer
		const timeoutMs = task.limits.timeoutSec * 1000
		this.startExecutionTimer(task.taskId, timeoutMs)

		const completed = await this.waitForTerminalExit(task.taskId, terminal, timeoutMs)

		// Clear the execution timer now that the task has settled
		this.clearExecutionTimer(task.taskId)

		if (!completed) {
			// Timeout: kill the terminal and attempt rollback
			this.appendLog(task.taskId, `[ZeroClaw] Task timed out after ${task.limits.timeoutSec}s`)
			terminal.dispose()
			this.terminals.delete(task.taskId)
			this.rollbackTask(task.taskId)
			this.transitionStatus(task.taskId, "failed")
			task.exitCode = -1
		} else if (task.status === "running") {
			// Terminal exited normally
			this.appendLog(task.taskId, "[ZeroClaw] Task execution completed")
			this.transitionStatus(task.taskId, "completed")
			task.exitCode = 0
		}

		this.persistHistory()
	}

	/**
	 * Wait for a terminal to close, with a timeout.
	 * Returns true if the terminal closed before the timeout.
	 */
	private waitForTerminalExit(taskId: string, terminal: vscode.Terminal, timeoutMs: number): Promise<boolean> {
		return new Promise<boolean>((resolve) => {
			let resolved = false

			const cleanup = () => {
				if (resolved) return
				resolved = true
				disposable.dispose()
				clearTimeout(timer)
			}

			const disposable = vscode.window.onDidCloseTerminal((t) => {
				if (t === terminal) {
					cleanup()
					resolve(true)
				}
			})

			const timer = setTimeout(() => {
				if (!resolved) {
					cleanup()
					resolve(false)
				}
			}, timeoutMs)

			// If the terminal was already disposed (e.g. instant command)
			// the onDidCloseTerminal will fire; no extra check needed.
		})
	}

	/**
	 * Best-effort rollback when a task fails mid-execution.
	 * Uses git to restore modified files to their pre-execution state.
	 * Falls back to logging if git is unavailable or the project isn't a git repo.
	 */
	private rollbackTask(taskId: string): void {
		const task = this.tasks.get(taskId)
		if (!task) return

		this.log.info("Rollback started", { taskId })
		this.appendLog(taskId, "[ZeroClaw] Attempting rollback of failed task")

		if (task.changedFiles.length === 0) {
			this.appendLog(taskId, "[ZeroClaw] No changed files recorded — nothing to rollback")
			return
		}

		this.appendLog(taskId, `[ZeroClaw] Files to rollback: ${task.changedFiles.join(", ")}`)

		// Attempt git-based rollback in the task's project directory
		const cwd = task.projectPath || undefined

		try {
			// First check if this is a git repo
			execSync("git rev-parse --is-inside-work-tree", { cwd, timeout: 5000, stdio: "pipe" })
		} catch {
			this.appendLog(taskId, "[ZeroClaw] Project is not a git repository — cannot rollback via git")
			this.appendLog(taskId, `[ZeroClaw] Manual rollback required for: ${task.changedFiles.join(", ")}`)
			return
		}

		let restoredCount = 0
		let failedCount = 0

		for (const filePath of task.changedFiles) {
			try {
				// kilocode_change: shell-quoting filePath was insufficient — backticks /
				// $() / non-ASCII could still break out. Switched to execFileSync which
				// passes args directly to the OS exec call without shell interpolation.
				execFileSync("git", ["checkout", "--", filePath], { cwd, timeout: 10000, stdio: "pipe" })
				restoredCount++
				this.log.info("File restored during rollback", { taskId, filePath })
				this.appendLog(taskId, `[ZeroClaw] Restored: ${filePath}`)
			} catch (err) {
				failedCount++
				const msg = err instanceof Error ? err.message : String(err)
				this.log.warn("Failed to restore file during rollback", { taskId, filePath, error: msg })
				this.appendLog(taskId, `[ZeroClaw] Failed to restore ${filePath}: ${msg}`)
			}
		}

		// Also clean up any untracked files that were created during execution
		try {
			const statusOutput = execSync("git status --porcelain", { cwd, timeout: 10000, encoding: "utf-8" })
			const untrackedLines = statusOutput.split("\n").filter((line: string) => line.startsWith("?? "))
			for (const line of untrackedLines) {
				const untrackedPath = line.slice(3).trim()
				// Only clean untracked files within the task's workspace scope
				const inScope = task.workspaceScope.length === 0 || task.workspaceScope.some((scope) => untrackedPath.startsWith(scope))
				if (inScope) {
					try {
						const fs = require("fs") as typeof import("fs")
						const path = require("path") as typeof import("path")
						const fullPath = path.resolve(cwd ?? ".", untrackedPath)
						fs.unlinkSync(fullPath)
						restoredCount++
						this.appendLog(taskId, `[ZeroClaw] Removed untracked: ${untrackedPath}`)
					} catch {
						// Best-effort: ignore untracked file cleanup failures
					}
				}
			}
		} catch {
			// Best-effort: ignore git status failures
		}

		this.appendLog(taskId, `[ZeroClaw] Rollback complete: ${restoredCount} restored, ${failedCount} failed`)
	}

	/**
	 * Validate a task submission before accepting it.
	 * Checks description, projectPath, and riskLevel for validity.
	 */
	private validateRiskLevel(submission: TaskSubmission): boolean {
		const validRiskLevels: RiskLevel[] = ["low", "medium", "high"]

		if (!submission.description || submission.description.trim().length === 0) {
			this.log.warn("Validation failed: description is empty")
			return false
		}

		if (!submission.projectPath || submission.projectPath.trim().length === 0) {
			this.log.warn("Validation failed: projectPath is empty")
			return false
		}

		if (!validRiskLevels.includes(submission.riskLevel)) {
			this.log.warn("Validation failed: invalid risk level", { riskLevel: submission.riskLevel })
			return false
		}

		return true
	}

	/**
	 * Start an execution timeout timer for a task. If the timer fires,
	 * any active spawn child is SIGKILLed, any active terminal is
	 * disposed, and the task is transitioned to "failed".
	 */
	private startExecutionTimer(taskId: string, timeoutMs: number): void {
		this.clearExecutionTimer(taskId)

		const timer = setTimeout(() => {
			const task = this.tasks.get(taskId)
			if (task && task.status === "running") {
				this.appendLog(taskId, `[ZeroClaw] Execution timeout enforced after ${timeoutMs}ms`)
				const child = this.children.get(taskId)
				if (child) {
					try {
						child.kill("SIGKILL")
					} catch (err) {
						this.log.warn("Failed to SIGKILL child on timeout", {
							taskId,
							error: err instanceof Error ? err.message : String(err),
						})
					}
				}
				this.cancel(taskId)
			}
			this.executionTimers.delete(taskId)
		}, timeoutMs)

		this.executionTimers.set(taskId, timer)
	}

	/** Clear the execution timeout timer for a task. */
	private clearExecutionTimer(taskId: string): void {
		const timer = this.executionTimers.get(taskId)
		if (timer) {
			clearTimeout(timer)
			this.executionTimers.delete(taskId)
		}
	}

	/** Persist task history to workspace state so it survives reload. */
	private persistHistory(): void {
		const all = this.getAllTasks().slice(0, MAX_HISTORY)
		this.ctx.workspaceState.update(HISTORY_STATE_KEY, all)
	}
}
