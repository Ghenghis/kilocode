/**
 * SWE-bench-style verification runner.
 *
 * Loads every `verification/cases/*.case.yaml` under the project, executes
 * the test referenced by `run.kind` + `run.spec`, and emits two artefacts:
 *
 *   verification/last-report.json — machine-readable, validated against
 *                                   `report.schema.json`. Consumed by the
 *                                   `proof.swe-bench-pass-rate` gate.
 *   verification/last-report.junit.xml — JUnit XML for CI dashboards.
 *
 * This script is intentionally dependency-free so it runs anywhere Node 18+
 * is available (Linux, macOS, Windows, GitHub Actions, GitLab, BuildKite).
 *
 * Invocation:
 *
 *   node verification/harness/runner.ts            # auto-detect project root
 *   node verification/harness/runner.ts /path/to   # explicit project root
 *
 * Or via tsx / bun for native TS:
 *
 *   bun verification/harness/runner.ts
 *   tsx  verification/harness/runner.ts
 *
 * The runner is resilient: a thrown spec is treated as a failed case, never
 * as a crashed run. The exit code is 0 if pass-rate ≥ threshold (default
 * 0.95), else 1 — so CI can gate releases on `node runner.ts && ...`.
 */

import { spawnSync } from "node:child_process"
import { existsSync, readFileSync, readdirSync, writeFileSync, mkdirSync, statSync } from "node:fs"
import { dirname, join, relative, resolve } from "node:path"
import { performance } from "node:perf_hooks"

import { detectFramework } from "./detect-framework"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type RunnerKind = "vitest" | "playwright" | "pytest" | "cargo" | "shell"

export interface VerificationCase {
	id: string
	title: string
	given: string
	when: string
	then: string
	run: {
		kind: RunnerKind
		spec: string
		evidencePaths?: string[]
	}
	mapsTo?: {
		reqId?: string
		storyId?: string
	}
}

export interface CaseResult {
	id: string
	status: "passed" | "failed" | "skipped"
	durationMs: number
	errorMessage?: string
	evidencePaths: string[]
	mapsTo?: VerificationCase["mapsTo"]
}

export interface VerificationReport {
	totalCases: number
	passed: number
	failed: number
	skipped: number
	durationMs: number
	generatedAt: string
	cases: CaseResult[]
}

// ---------------------------------------------------------------------------
// Minimal YAML reader (case-shape only).
//
// A full YAML parser is overkill — case files are flat-ish maps with a
// nested `run:` and `mapsTo:` block. We parse exactly that shape with a
// regex/scanner so the runner has zero npm deps. If `js-yaml` or `yaml` is
// available we use it; otherwise we fall back.
// ---------------------------------------------------------------------------

interface YamlLoader {
	(text: string): unknown
}

function loadYamlLoader(): YamlLoader {
	// Try `yaml` first, then `js-yaml`. If neither is available, fall back to
	// the regex shape-reader.
	try {
		// eslint-disable-next-line @typescript-eslint/no-require-imports
		const mod = require("yaml") as { parse?: YamlLoader }
		if (mod && typeof mod.parse === "function") return mod.parse
	} catch {
		/* not available */
	}
	try {
		// eslint-disable-next-line @typescript-eslint/no-require-imports
		const mod = require("js-yaml") as { load?: YamlLoader }
		if (mod && typeof mod.load === "function") return mod.load
	} catch {
		/* not available */
	}
	return shapeReader
}

/**
 * Tiny regex YAML reader that handles ONLY the verification-case shape:
 * top-level scalar keys, a `run:` block with up to 3 keys (one of which may
 * be a string-list `evidencePaths:`), and a `mapsTo:` block.
 *
 * Anything outside this shape is dropped. The shape-reader exists as a
 * last-resort so the harness can still execute on a stripped-down system
 * without a YAML lib.
 */
function shapeReader(text: string): unknown {
	const obj: Record<string, unknown> = {}
	const lines = text.split(/\r?\n/)
	let i = 0
	while (i < lines.length) {
		const raw = lines[i] ?? ""
		const line = raw.replace(/#.*$/, "").trimEnd()
		if (!line.trim() || line.trimStart().startsWith("#")) {
			i++
			continue
		}
		const indent = raw.length - raw.trimStart().length
		const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*:\s*(.*)$/)
		if (!m || indent !== 0) {
			i++
			continue
		}
		const key = m[1]!
		const inline = m[2] ?? ""
		if (inline.length > 0) {
			obj[key] = unquote(inline)
			i++
			continue
		}
		// Nested block → walk children with indent > 0.
		const child: Record<string, unknown> = {}
		i++
		while (i < lines.length) {
			const raw2 = lines[i] ?? ""
			if (!raw2.trim()) {
				i++
				continue
			}
			const ind2 = raw2.length - raw2.trimStart().length
			if (ind2 === 0) break
			const cleaned = raw2.replace(/#.*$/, "").trimEnd()
			const cm = cleaned.match(/^\s+([A-Za-z_][A-Za-z0-9_]*)\s*:\s*(.*)$/)
			if (cm) {
				const ckey = cm[1]!
				const cval = cm[2] ?? ""
				if (cval.length > 0) {
					child[ckey] = unquote(cval)
					i++
					continue
				}
				// Possibly a list of strings (evidencePaths).
				const list: string[] = []
				i++
				while (i < lines.length) {
					const rawL = lines[i] ?? ""
					if (!rawL.trim()) {
						i++
						continue
					}
					const indL = rawL.length - rawL.trimStart().length
					if (indL <= ind2) break
					const lm = rawL.replace(/#.*$/, "").trimEnd().match(/^\s*-\s*(.*)$/)
					if (!lm) break
					list.push(unquote(lm[1] ?? ""))
					i++
				}
				child[ckey] = list
				continue
			}
			i++
		}
		obj[key] = child
	}
	return obj
}

function unquote(s: string): string {
	const t = s.trim()
	if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
		return t.slice(1, -1)
	}
	return t
}

// ---------------------------------------------------------------------------
// Case loading
// ---------------------------------------------------------------------------

function listYamlFiles(dir: string): string[] {
	if (!existsSync(dir)) return []
	const out: string[] = []
	for (const entry of readdirSync(dir)) {
		const p = join(dir, entry)
		const st = statSync(p)
		if (st.isDirectory()) {
			out.push(...listYamlFiles(p))
		} else if (/\.case\.ya?ml$/i.test(entry)) {
			out.push(p)
		}
	}
	return out.sort()
}

export function loadCases(projectRoot: string): VerificationCase[] {
	const loader = loadYamlLoader()
	const dir = join(projectRoot, "verification", "cases")
	const files = listYamlFiles(dir)
	const cases: VerificationCase[] = []
	for (const f of files) {
		const text = readFileSync(f, "utf-8")
		const parsed = loader(text) as Partial<VerificationCase> | undefined
		if (!parsed || typeof parsed !== "object") continue
		if (!parsed.id || !parsed.run || !parsed.run.kind || !parsed.run.spec) {
			console.warn(`[verification] skipping malformed case: ${relative(projectRoot, f)}`)
			continue
		}
		cases.push(parsed as VerificationCase)
	}
	return cases
}

// ---------------------------------------------------------------------------
// Runner per kind
// ---------------------------------------------------------------------------

interface SpawnResult {
	ok: boolean
	output: string
	durationMs: number
}

function runSpawn(cmd: string, args: string[], cwd: string): SpawnResult {
	const t0 = performance.now()
	const r = spawnSync(cmd, args, { cwd, encoding: "utf-8", shell: process.platform === "win32" })
	const durationMs = performance.now() - t0
	const output = `${r.stdout ?? ""}\n${r.stderr ?? ""}`.trim()
	const ok = r.status === 0 && !r.error
	return { ok, output, durationMs }
}

function runCase(c: VerificationCase, projectRoot: string): CaseResult {
	const evidencePaths = c.run.evidencePaths ?? []
	let result: SpawnResult
	switch (c.run.kind) {
		case "vitest":
			result = runSpawn("npx", ["--no-install", "vitest", "run", c.run.spec, "--reporter=verbose"], projectRoot)
			break
		case "playwright":
			result = runSpawn("npx", ["--no-install", "playwright", "test", c.run.spec], projectRoot)
			break
		case "pytest":
			result = runSpawn("python", ["-m", "pytest", c.run.spec, "-q"], projectRoot)
			break
		case "cargo":
			result = runSpawn("cargo", ["test", "--", c.run.spec], projectRoot)
			break
		case "shell":
		default:
			result = runSpawn("sh", ["-c", c.run.spec], projectRoot)
			break
	}
	return {
		id: c.id,
		status: result.ok ? "passed" : "failed",
		durationMs: Math.round(result.durationMs),
		errorMessage: result.ok ? undefined : truncate(result.output, 4000),
		evidencePaths,
		mapsTo: c.mapsTo,
	}
}

function truncate(s: string, max: number): string {
	if (s.length <= max) return s
	return s.slice(0, max) + `\n... [truncated ${s.length - max} chars]`
}

// ---------------------------------------------------------------------------
// Report writers
// ---------------------------------------------------------------------------

export function buildReport(cases: VerificationCase[], results: CaseResult[], totalMs: number): VerificationReport {
	const passed = results.filter((r) => r.status === "passed").length
	const failed = results.filter((r) => r.status === "failed").length
	const skipped = results.filter((r) => r.status === "skipped").length
	return {
		totalCases: cases.length,
		passed,
		failed,
		skipped,
		durationMs: Math.round(totalMs),
		generatedAt: new Date().toISOString(),
		cases: results,
	}
}

export function toJUnitXml(report: VerificationReport): string {
	const escape = (s: string) =>
		s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
	const lines: string[] = []
	lines.push('<?xml version="1.0" encoding="UTF-8"?>')
	lines.push(
		`<testsuite name="contract-kit-verification" tests="${report.totalCases}" failures="${report.failed}" skipped="${report.skipped}" time="${(report.durationMs / 1000).toFixed(3)}">`,
	)
	for (const c of report.cases) {
		lines.push(
			`  <testcase classname="verification" name="${escape(c.id)}" time="${(c.durationMs / 1000).toFixed(3)}">`,
		)
		if (c.status === "failed") {
			lines.push(`    <failure message="${escape(c.errorMessage?.split("\n")[0] ?? "failed")}">`)
			lines.push(`<![CDATA[${c.errorMessage ?? ""}]]>`)
			lines.push(`    </failure>`)
		} else if (c.status === "skipped") {
			lines.push(`    <skipped/>`)
		}
		lines.push(`  </testcase>`)
	}
	lines.push("</testsuite>")
	return lines.join("\n")
}

// ---------------------------------------------------------------------------
// Orchestration
// ---------------------------------------------------------------------------

export interface RunOptions {
	projectRoot: string
	threshold?: number
	writeReports?: boolean
}

export function runHarness(opts: RunOptions): { report: VerificationReport; passRate: number } {
	const t0 = performance.now()
	const cases = loadCases(opts.projectRoot)
	const detected = detectFramework(opts.projectRoot)
	if (detected.kind !== "shell" && cases.length > 0) {
		// non-fatal — purely informational
		console.error(`[verification] detected framework: ${detected.kind}`)
	}
	const results: CaseResult[] = cases.map((c) => runCase(c, opts.projectRoot))
	const totalMs = performance.now() - t0
	const report = buildReport(cases, results, totalMs)
	if (opts.writeReports !== false) {
		const outDir = join(opts.projectRoot, "verification")
		mkdirSync(outDir, { recursive: true })
		writeFileSync(join(outDir, "last-report.json"), JSON.stringify(report, null, 2), "utf-8")
		writeFileSync(join(outDir, "last-report.junit.xml"), toJUnitXml(report), "utf-8")
	}
	const passRate = report.totalCases === 0 ? 1 : report.passed / report.totalCases
	return { report, passRate }
}

// ---------------------------------------------------------------------------
// CLI entrypoint
// ---------------------------------------------------------------------------

function findProjectRoot(start: string): string {
	let cur = resolve(start)
	while (true) {
		if (existsSync(join(cur, "verification", "cases"))) return cur
		const parent = dirname(cur)
		if (parent === cur) return resolve(start)
		cur = parent
	}
}

function isMainModule(): boolean {
	// Node ESM and CJS compatible "is this script the entry?".
	const argv1 = process.argv[1]
	if (!argv1) return false
	try {
		// CJS path
		// eslint-disable-next-line @typescript-eslint/no-require-imports
		const req = require as unknown as { main?: { filename?: string } }
		if (req && req.main && req.main.filename === argv1) return true
	} catch {
		/* ignore */
	}
	return false
}

if (isMainModule()) {
	const root = findProjectRoot(process.argv[2] ?? process.cwd())
	const threshold = Number(process.env.SWE_BENCH_THRESHOLD ?? "0.95")
	const { report, passRate } = runHarness({ projectRoot: root, threshold })
	console.error(
		`[verification] cases=${report.totalCases} passed=${report.passed} failed=${report.failed} skipped=${report.skipped} passRate=${(passRate * 100).toFixed(1)}%`,
	)
	process.exit(passRate >= threshold ? 0 : 1)
}
