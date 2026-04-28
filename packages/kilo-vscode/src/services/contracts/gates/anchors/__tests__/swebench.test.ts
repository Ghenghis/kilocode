/**
 * Tests for the SWE-bench-style anchor gates.
 *
 * Layout:
 *   • coverage gate: positive (story has matching case) + negative (no case)
 *   • pass-rate gate: passing report + failing report (one test covers both)
 *   • evidence gate: failed case without evidence
 *   • framework detection: vitest, playwright, pytest fixtures
 *
 * Fixtures live in `tmp-fixtures/` under the OS tempdir; we never touch the
 * real workspace.
 */

import { describe, expect, it, beforeEach, afterEach } from "bun:test"
import { mkdirSync, writeFileSync, rmSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"

import sweBenchCoverage from "../swebench/swe-bench-coverage"
import sweBenchPassRate from "../swebench/swe-bench-pass-rate"
import sweBenchEvidence from "../swebench/swe-bench-evidence"

// The detector ships under assets/ so it gets bundled in the VSIX. We
// resolve it via a relative path so bun's runtime resolver picks it up.
import { detectFramework } from "../../../../../../assets/contract-kit-anchors/verification/harness/detect-framework"

let workdir: string

beforeEach(() => {
	workdir = join(tmpdir(), `kilo-swebench-test-${Date.now()}-${Math.random().toString(36).slice(2)}`)
	mkdirSync(workdir, { recursive: true })
})

afterEach(() => {
	try {
		rmSync(workdir, { recursive: true, force: true })
	} catch {
		/* ignore */
	}
})

function writeCase(filename: string, body: string): void {
	const dir = join(workdir, "verification", "cases")
	mkdirSync(dir, { recursive: true })
	writeFileSync(join(dir, filename), body, "utf-8")
}

function writeReport(report: unknown): void {
	const dir = join(workdir, "verification")
	mkdirSync(dir, { recursive: true })
	writeFileSync(join(dir, "last-report.json"), JSON.stringify(report), "utf-8")
}

const PRD_TWO_STORIES = `
# My App PRD

## 4. User stories

### Epic 1: Login

#### Story 1.1 — P0 — Sign in
As a user, I want to sign in.

#### Story 2.1 — P1 — Reset password
As a user, I want to reset.
`

describe("swe-bench-coverage gate", () => {
	it("passes when every story has a matching case", async () => {
		writeCase(
			"story-1-1.case.yaml",
			`id: CASE-001\ntitle: t\ngiven: g\nwhen: w\nthen: th\nrun:\n  kind: vitest\n  spec: x.test.ts\nmapsTo:\n  storyId: "1.1"\n`,
		)
		writeCase(
			"story-2-1.case.yaml",
			`id: CASE-002\ntitle: t\ngiven: g\nwhen: w\nthen: th\nrun:\n  kind: vitest\n  spec: y.test.ts\nmapsTo:\n  storyId: "2.1"\n`,
		)
		const issues = await sweBenchCoverage.validate(PRD_TWO_STORIES, { projectRoot: workdir })
		expect(issues).toBeNull()
	})

	it("fails for stories with no matching case", async () => {
		// Only story 1.1 covered; 2.1 should fail.
		writeCase(
			"story-1-1.case.yaml",
			`id: CASE-001\ntitle: t\ngiven: g\nwhen: w\nthen: th\nrun:\n  kind: vitest\n  spec: x.test.ts\nmapsTo:\n  storyId: "1.1"\n`,
		)
		const issues = await sweBenchCoverage.validate(PRD_TWO_STORIES, { projectRoot: workdir })
		expect(issues).not.toBeNull()
		expect(issues!.length).toBe(1)
		expect(issues![0]!.message).toContain("Story 2.1")
		expect(issues![0]!.severity).toBe("error")
	})
})

describe("swe-bench-pass-rate gate", () => {
	it("passes when pass rate ≥ threshold and fails when below", async () => {
		// Passing fixture (10/10 = 1.0).
		writeReport({
			totalCases: 10,
			passed: 10,
			failed: 0,
			skipped: 0,
			durationMs: 100,
			cases: Array.from({ length: 10 }, (_, i) => ({
				id: `C-${i}`,
				status: "passed",
				durationMs: 1,
				evidencePaths: [],
			})),
		})
		let issues = await sweBenchPassRate.validate("", { projectRoot: workdir })
		expect(issues).toBeNull()

		// Failing fixture (5/10 = 0.5, default threshold 0.95).
		writeReport({
			totalCases: 10,
			passed: 5,
			failed: 5,
			skipped: 0,
			durationMs: 100,
			cases: [],
		})
		issues = await sweBenchPassRate.validate("", { projectRoot: workdir })
		expect(issues).not.toBeNull()
		expect(issues![0]!.severity).toBe("error")
		expect(issues![0]!.message).toContain("50.0%")
	})

	it("respects threshold from .kilo/contracts/config.json", async () => {
		// 8/10 = 0.8 — under default 0.95 (would fail), but config sets 0.7 → passes.
		writeReport({ totalCases: 10, passed: 8, failed: 2, skipped: 0, durationMs: 1, cases: [] })
		const cfgDir = join(workdir, ".kilo", "contracts")
		mkdirSync(cfgDir, { recursive: true })
		writeFileSync(
			join(cfgDir, "config.json"),
			JSON.stringify({ proof: { "swe-bench-pass-rate": { threshold: 0.7 } } }),
			"utf-8",
		)
		const issues = await sweBenchPassRate.validate("", { projectRoot: workdir })
		expect(issues).toBeNull()
	})
})

describe("swe-bench-evidence gate", () => {
	it("flags failed cases lacking evidencePaths", async () => {
		writeReport({
			totalCases: 2,
			passed: 1,
			failed: 1,
			skipped: 0,
			durationMs: 1,
			cases: [
				{ id: "C-1", status: "passed", durationMs: 1, evidencePaths: [] },
				{ id: "C-2", status: "failed", durationMs: 1, evidencePaths: [] },
			],
		})
		const issues = await sweBenchEvidence.validate("", { projectRoot: workdir })
		expect(issues).not.toBeNull()
		expect(issues!.length).toBe(1)
		expect(issues![0]!.message).toContain("C-2")
	})

	it("passes when every failed case has at least one evidence path", async () => {
		writeReport({
			totalCases: 2,
			passed: 1,
			failed: 1,
			skipped: 0,
			durationMs: 1,
			cases: [
				{ id: "C-1", status: "passed", durationMs: 1, evidencePaths: [] },
				{
					id: "C-2",
					status: "failed",
					durationMs: 1,
					evidencePaths: ["traces/c2.zip"],
				},
			],
		})
		const issues = await sweBenchEvidence.validate("", { projectRoot: workdir })
		expect(issues).toBeNull()
	})
})

describe("detect-framework", () => {
	it("detects vitest from devDependencies", () => {
		writeFileSync(
			join(workdir, "package.json"),
			JSON.stringify({ name: "x", devDependencies: { vitest: "^1.0.0" } }),
			"utf-8",
		)
		expect(detectFramework(workdir).kind).toBe("vitest")
	})

	it("detects playwright from playwright.config.ts", () => {
		writeFileSync(join(workdir, "playwright.config.ts"), "export default {};", "utf-8")
		expect(detectFramework(workdir).kind).toBe("playwright")
	})

	it("detects pytest from pyproject.toml [tool.pytest] section", () => {
		writeFileSync(
			join(workdir, "pyproject.toml"),
			'[tool.pytest.ini_options]\nminversion = "7.0"\n',
			"utf-8",
		)
		expect(detectFramework(workdir).kind).toBe("pytest")
	})

	it("falls through to shell when no markers are present", () => {
		expect(detectFramework(workdir).kind).toBe("shell")
	})
})
