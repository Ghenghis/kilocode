/**
 * Unit tests for ZeroClawService — runner: `bun test`.
 *
 * The three gaps under test:
 *   Gap 1: spawn-based stdio capture into task.logs (with 10MB cap & timeout kill)
 *   Gap 2: medium-risk diff capture + apply/discard buffered changes
 *   Gap 3: networkPolicy enforcement (deny / allowlist / open)
 *
 * Hermetic: no real terminals, no real spawning, no real git/fs ops.
 */
import { describe, it, expect, beforeEach, mock } from "bun:test"
import { EventEmitter } from "events"

// ─── vscode stub ────────────────────────────────────────────

class FakeMemento {
	private s = new Map<string, unknown>()
	get<T>(k: string, d?: T): T | undefined {
		return this.s.has(k) ? (this.s.get(k) as T) : d
	}
	async update(k: string, v: unknown) {
		v === undefined ? this.s.delete(k) : this.s.set(k, v)
	}
}

class FakeTerminal {
	disposed = false
	dispose() {
		this.disposed = true
	}
	sendText() {}
	show() {}
}

const fakeTerminals: FakeTerminal[] = []
const terminalCloseListeners: Array<(t: FakeTerminal) => void> = []

mock.module("vscode", () => ({
	window: {
		createTerminal: mock(() => {
			const t = new FakeTerminal()
			fakeTerminals.push(t)
			return t
		}),
		createOutputChannel: () => ({ appendLine: () => {}, dispose: () => {} }),
		showInformationMessage: mock(async () => undefined),
		showWarningMessage: mock(async () => undefined),
		onDidCloseTerminal: (cb: (t: FakeTerminal) => void) => {
			terminalCloseListeners.push(cb)
			return { dispose: () => {} }
		},
	},
	workspace: {
		getConfiguration: () => ({ get: () => undefined }),
		workspaceFolders: undefined,
	},
	commands: { registerCommand: () => ({ dispose: () => {} }) },
}))

// ─── child_process stub ─────────────────────────────────────
//
// Each spawn call gets queued into `pendingSpawns` so tests can drive
// stdout / stderr / exit on demand. The real `execFileSync` (used for
// git status / git diff / git checkout) is replaced via `gitFake` so
// tests stay hermetic.

interface FakeChild extends EventEmitter {
	stdout: EventEmitter
	stderr: EventEmitter
	killed: boolean
	kill: (signal?: string) => boolean
	close: (code: number | null, signal?: NodeJS.Signals | null) => void
	emitStdout: (chunk: string | Buffer) => void
	emitStderr: (chunk: string | Buffer) => void
	emitError: (err: Error) => void
}

let pendingSpawns: FakeChild[] = []

function makeFakeChild(): FakeChild {
	const child = new EventEmitter() as FakeChild
	child.stdout = new EventEmitter()
	child.stderr = new EventEmitter()
	child.killed = false
	child.kill = (signal?: string) => {
		child.killed = true
		// Defer to a microtask so the caller can observe `kill()` first
		// before the close event lands.
		queueMicrotask(() => child.emit("close", null, (signal ?? "SIGTERM") as NodeJS.Signals))
		return true
	}
	child.close = (code, signal) => child.emit("close", code, signal ?? null)
	child.emitStdout = (c) => child.stdout.emit("data", c)
	child.emitStderr = (c) => child.stderr.emit("data", c)
	child.emitError = (err) => child.emit("error", err)
	return child
}

// gitFake: keyed by stringified args (e.g. "status --porcelain") with
// either a string output or a function that returns one.
type GitResponder = string | ((args: string[]) => string)
const gitFake: { default: GitResponder | null; byArgs: Map<string, GitResponder> } = {
	default: "",
	byArgs: new Map(),
}
const gitCalls: Array<{ cmd: string; args: string[] }> = []

mock.module("child_process", () => ({
	spawn: mock((_cmd: string, _args: string[], _opts: unknown) => {
		const child = makeFakeChild()
		pendingSpawns.push(child)
		return child as unknown
	}),
	execFileSync: mock((cmd: string, args: string[], opts?: { encoding?: string }) => {
		gitCalls.push({ cmd, args })
		const key = args.join(" ")
		const responder = gitFake.byArgs.get(key) ?? gitFake.default
		if (responder == null) {
			throw new Error(`gitFake: no responder for "${cmd} ${key}"`)
		}
		const out = typeof responder === "function" ? responder(args) : responder
		// Mirror Node's contract: when an encoding is passed, return a
		// string; otherwise return a Buffer. The service always sets
		// `encoding: "utf-8"` on its read paths.
		return opts?.encoding ? out : Buffer.from(out, "utf8")
	}),
	execSync: mock((_cmd: string, _opts: unknown) => Buffer.from("", "utf8")),
}))

// Imports must happen AFTER mock.module so the service picks up stubs.
import { ZeroClawService, type TaskSubmission } from "../ZeroClawService"

function makeContext() {
	return {
		workspaceState: new FakeMemento(),
		globalState: new FakeMemento(),
		subscriptions: [],
	} as unknown as import("vscode").ExtensionContext
}

function baseSubmission(over: Partial<TaskSubmission> = {}): TaskSubmission {
	return {
		description: "echo hello",
		projectPath: "/tmp/proj",
		riskLevel: "low",
		workspaceScope: "/tmp/proj",
		networkPolicy: "open",
		writePolicy: "read_only",
		limits: { timeoutSec: 30, memoryMb: 512, cpu: 1 },
		...over,
	}
}

/**
 * Wait for spawn to be invoked and return the resulting fake child.
 * Polls a microtask boundary because submit() kicks off async work.
 */
async function nextChild(maxWaitMs = 500): Promise<FakeChild> {
	const start = Date.now()
	while (pendingSpawns.length === 0) {
		if (Date.now() - start > maxWaitMs) {
			throw new Error("nextChild: spawn was never called")
		}
		await new Promise((r) => setTimeout(r, 5))
	}
	return pendingSpawns.shift()!
}

beforeEach(() => {
	pendingSpawns = []
	fakeTerminals.length = 0
	terminalCloseListeners.length = 0
	gitCalls.length = 0
	gitFake.default = ""
	gitFake.byArgs.clear()
})

// ─── Gap 1: Spawn-based capture ─────────────────────────────

describe("Gap 1: spawn-based stdio capture", () => {
	it("captures stdout into task.logs", async () => {
		const svc = new ZeroClawService(makeContext())
		const task = svc.submit(baseSubmission({ description: "node script.js" }))

		const child = await nextChild()
		child.emitStdout("line one\nline two\n")
		child.close(0)

		// Allow the close handler's microtasks to finalise the task.
		await new Promise((r) => setTimeout(r, 20))

		const final = svc.getTask(task.taskId)!
		const joined = final.logs.join("\n")
		expect(joined).toContain("[stdout] line one")
		expect(joined).toContain("[stdout] line two")
		expect(final.status).toBe("completed")
		svc.dispose()
	})

	it("captures stderr into task.logs", async () => {
		const svc = new ZeroClawService(makeContext())
		const task = svc.submit(baseSubmission({ description: "node bad.js" }))

		const child = await nextChild()
		child.emitStderr("boom on stderr\n")
		child.close(0)
		await new Promise((r) => setTimeout(r, 20))

		const final = svc.getTask(task.taskId)!
		expect(final.logs.join("\n")).toContain("[stderr] boom on stderr")
		svc.dispose()
	})

	it("truncates log capture at 10MB with marker", async () => {
		const svc = new ZeroClawService(makeContext())
		const task = svc.submit(baseSubmission({ description: "spew" }))

		const child = await nextChild()
		// One 6 MB chunk and one 6 MB chunk = 12 MB total. Only ~10 MB
		// should be admitted before the truncation marker fires.
		const sixMb = "x".repeat(6 * 1024 * 1024)
		child.emitStdout(sixMb)
		child.emitStdout(sixMb)
		child.close(0)
		await new Promise((r) => setTimeout(r, 30))

		const final = svc.getTask(task.taskId)!
		const joined = final.logs.join("\n")
		expect(joined).toContain("[ZeroClaw] Output truncated at 10MB")

		// Ensure the marker fires exactly once even though we sent more
		// data after the cap was hit.
		const markerCount = final.logs.filter((l) =>
			l.includes("Output truncated at 10MB"),
		).length
		expect(markerCount).toBe(1)
		svc.dispose()
	})

	it("timeout kills the process and transitions to failed", async () => {
		const svc = new ZeroClawService(makeContext())
		const task = svc.submit(
			baseSubmission({
				description: "sleep forever",
				// 50 ms timeout — fast enough for tests.
				limits: { timeoutSec: 0.05, memoryMb: 256, cpu: 1 },
			}),
		)

		const child = await nextChild()
		// Don't close it; let the timer expire.
		await new Promise((r) => setTimeout(r, 200))

		expect(child.killed).toBe(true)
		const final = svc.getTask(task.taskId)!
		expect(final.status).toBe("failed")
		expect(final.exitCode).toBe(-1)
		svc.dispose()
	})
})

// ─── Gap 2: Medium-risk diff capture ────────────────────────

describe("Gap 2: medium-risk diff generation", () => {
	it("produces Artifact entries for newly modified files", async () => {
		// before: clean. after: src/a.ts modified.
		let calls = 0
		gitFake.byArgs.set("status --porcelain", () => {
			calls++
			return calls === 1 ? "" : " M src/a.ts\n"
		})
		gitFake.byArgs.set("diff -- src/a.ts", "diff --git a/src/a.ts b/src/a.ts\n@@ -1 +1 @@\n-old\n+new\n")

		const svc = new ZeroClawService(makeContext())
		const task = svc.submit(baseSubmission({ riskLevel: "medium", description: "refactor" }))

		const child = await nextChild()
		child.close(0)
		await new Promise((r) => setTimeout(r, 30))

		const final = svc.getTask(task.taskId)!
		expect(final.status).toBe("blocked")
		expect(final.diffArtifacts.length).toBe(1)
		expect(final.diffArtifacts[0]!.kind).toBe("diff")
		expect(final.diffArtifacts[0]!.path).toBe("src/a.ts")
		expect(final.diffArtifacts[0]!.content).toContain("+new")
		expect(final.changedFiles).toContain("src/a.ts")
		svc.dispose()
	})

	it("discardBufferedChanges reverts changes via git checkout", async () => {
		let calls = 0
		gitFake.byArgs.set("status --porcelain", () => {
			calls++
			return calls === 1 ? "" : " M src/b.ts\n"
		})
		gitFake.byArgs.set("diff -- src/b.ts", "patch-b")

		const svc = new ZeroClawService(makeContext())
		const task = svc.submit(baseSubmission({ riskLevel: "medium", description: "edit" }))
		const child = await nextChild()
		child.close(0)
		await new Promise((r) => setTimeout(r, 30))

		const checkoutCallsBefore = gitCalls.filter(
			(c) => c.args[0] === "checkout" && c.args[2] === "src/b.ts",
		).length

		const ok = svc.discardBufferedChanges(task.taskId)
		expect(ok).toBe(true)

		const checkoutCallsAfter = gitCalls.filter(
			(c) => c.args[0] === "checkout" && c.args[2] === "src/b.ts",
		).length
		expect(checkoutCallsAfter).toBeGreaterThan(checkoutCallsBefore)

		const final = svc.getTask(task.taskId)!
		expect(final.status).toBe("failed")
		svc.dispose()
	})

	it("handles tasks with no file changes (empty diff)", async () => {
		gitFake.byArgs.set("status --porcelain", "")

		const svc = new ZeroClawService(makeContext())
		const task = svc.submit(baseSubmission({ riskLevel: "medium", description: "noop" }))
		const child = await nextChild()
		child.close(0)
		await new Promise((r) => setTimeout(r, 30))

		const final = svc.getTask(task.taskId)!
		expect(final.diffArtifacts.length).toBe(0)
		expect(final.status).toBe("blocked")
		expect(final.logs.join("\n")).toContain("No file changes detected")
		svc.dispose()
	})
})

// ─── Gap 3: Network policy enforcement ──────────────────────

describe("Gap 3: detectNetworkPatterns", () => {
	it("finds curl, wget, npm install, git clone, URLs", () => {
		const cases = [
			{ cmd: "curl https://example.com -o out.txt", expect: ["curl", "https://example.com"] },
			{ cmd: "wget https://example.com/file", expect: ["wget", "https://example.com/file"] },
			{ cmd: "npm install lodash", expect: ["npm install"] },
			{ cmd: "git clone git@github.com:user/repo.git", expect: ["git clone"] },
			{ cmd: "fetch http://api.local/v1", expect: ["http://api.local/v1"] },
		]

		for (const c of cases) {
			const r = ZeroClawService.detectNetworkPatterns(c.cmd)
			expect(r.hasNetwork).toBe(true)
			for (const tok of c.expect) {
				expect(r.matches.some((m) => m.includes(tok) || m === tok)).toBe(true)
			}
		}

		const benign = ZeroClawService.detectNetworkPatterns("echo hello && ls -la")
		expect(benign.hasNetwork).toBe(false)
		expect(benign.matches).toEqual([])
	})
})

describe("Gap 3: networkPolicy enforcement at submit/exec time", () => {
	it("policy=deny refuses commands with network patterns", async () => {
		const svc = new ZeroClawService(makeContext())
		const task = svc.submit(
			baseSubmission({
				description: "curl https://evil.example.com",
				networkPolicy: "deny",
			}),
		)

		// No spawn should have been issued.
		await new Promise((r) => setTimeout(r, 20))
		expect(pendingSpawns.length).toBe(0)

		const final = svc.getTask(task.taskId)!
		expect(final.status).toBe("failed")
		expect(final.logs.join("\n")).toContain("Refused: command appears to access network")
		svc.dispose()
	})

	it("policy=allowlist accepts URLs in the allowlist", async () => {
		const svc = new ZeroClawService(makeContext())
		const task = svc.submit(
			baseSubmission({
				description: "curl https://registry.npmjs.org/lodash",
				networkPolicy: "allowlist",
				networkAllowlist: ["registry.npmjs.org"],
			}),
		)

		const child = await nextChild()
		child.close(0)
		await new Promise((r) => setTimeout(r, 20))

		const final = svc.getTask(task.taskId)!
		expect(final.status).toBe("completed")
		svc.dispose()
	})

	it("policy=allowlist refuses URLs NOT in the allowlist", async () => {
		const svc = new ZeroClawService(makeContext())
		const task = svc.submit(
			baseSubmission({
				description: "curl https://untrusted.example.com",
				networkPolicy: "allowlist",
				networkAllowlist: ["registry.npmjs.org"],
			}),
		)

		await new Promise((r) => setTimeout(r, 20))
		expect(pendingSpawns.length).toBe(0)

		const final = svc.getTask(task.taskId)!
		expect(final.status).toBe("failed")
		expect(final.logs.join("\n")).toContain("not in allowlist")
		svc.dispose()
	})

	it("policy=open allows everything without warning", async () => {
		const svc = new ZeroClawService(makeContext())
		const task = svc.submit(
			baseSubmission({
				description: "curl https://anywhere.example.com",
				networkPolicy: "open",
			}),
		)

		const child = await nextChild()
		child.close(0)
		await new Promise((r) => setTimeout(r, 20))

		const final = svc.getTask(task.taskId)!
		expect(final.status).toBe("completed")
		expect(final.logs.join("\n")).not.toContain("Refused")
		svc.dispose()
	})
})
