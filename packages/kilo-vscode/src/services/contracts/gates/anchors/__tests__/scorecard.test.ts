/**
 * Tests for the OpenSSF Scorecard anchor gates (Anchor 7).
 *
 * Five scenarios:
 *   1. openssf-scorecard gate passes when aggregate ≥ threshold
 *   2. openssf-scorecard gate fails when aggregate < threshold
 *   3. openssf-scorecard gate emits info when scorecard.latest.json is missing
 *   4. scorecard-trend gate stays quiet when score is steady / improving
 *   5. scorecard-trend gate warns when score regresses beyond tolerance
 *
 * Fixtures live in `tmp-fixtures/` under the OS tempdir; the real workspace
 * is never touched.
 */

import { describe, expect, it, beforeEach, afterEach } from "bun:test"
import { mkdirSync, writeFileSync, rmSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"

import openSsfScorecard from "../scorecard/openssf-scorecard"
import scorecardTrend from "../scorecard/scorecard-trend"
import { generateFixPlaybook } from "../scorecard/fix-playbook"

let workdir: string

beforeEach(() => {
	workdir = join(tmpdir(), `kilo-scorecard-test-${Date.now()}-${Math.random().toString(36).slice(2)}`)
	mkdirSync(workdir, { recursive: true })
})

afterEach(() => {
	try {
		rmSync(workdir, { recursive: true, force: true })
	} catch {
		/* ignore */
	}
})

function writeLatest(latest: unknown): void {
	const dir = join(workdir, "compliance")
	mkdirSync(dir, { recursive: true })
	writeFileSync(join(dir, "scorecard.latest.json"), JSON.stringify(latest), "utf-8")
}

function writeHistory(history: unknown): void {
	const dir = join(workdir, "compliance")
	mkdirSync(dir, { recursive: true })
	writeFileSync(join(dir, "scorecard.history.json"), JSON.stringify(history), "utf-8")
}

describe("compliance-openssf-scorecard gate", () => {
	it("passes when aggregate score ≥ threshold (default 7.0)", async () => {
		writeLatest({
			date: "2026-04-28",
			score: 9.1,
			checks: [{ name: "Branch-Protection", score: 10 }],
		})
		const issues = await openSsfScorecard.validate("", { projectRoot: workdir })
		expect(issues).toBeNull()
	})

	it("fails (warn) when aggregate score < threshold", async () => {
		writeLatest({
			date: "2026-04-28",
			score: 4.2,
			checks: [
				{ name: "Branch-Protection", score: 0 },
				{ name: "Pinned-Dependencies", score: 2 },
				{ name: "License", score: 10 },
			],
		})
		const issues = await openSsfScorecard.validate("", { projectRoot: workdir })
		expect(issues).not.toBeNull()
		expect(issues!.length).toBe(1)
		expect(issues![0]!.severity).toBe("warn")
		expect(issues![0]!.message).toContain("4.2/10")
		expect(issues![0]!.message).toContain("Branch-Protection")
	})

	it("emits info when scorecard.latest.json is missing", async () => {
		const issues = await openSsfScorecard.validate("", { projectRoot: workdir })
		expect(issues).not.toBeNull()
		expect(issues!.length).toBe(1)
		expect(issues![0]!.severity).toBe("info")
		expect(issues![0]!.message).toContain("missing")
	})
})

describe("compliance-scorecard-trend gate", () => {
	it("passes when latest score is steady or improving", async () => {
		writeLatest({ date: "2026-04-28", score: 9.2, checks: [] })
		writeHistory([
			{ date: "2026-04-01", score: 9.0 },
			{ date: "2026-04-08", score: 9.1 },
			{ date: "2026-04-15", score: 9.2 },
		])
		const issues = await scorecardTrend.validate("", { projectRoot: workdir })
		expect(issues).toBeNull()
	})

	it("warns when latest score regresses beyond tolerance (>0.5)", async () => {
		writeLatest({ date: "2026-04-28", score: 7.0, checks: [] })
		writeHistory([
			{ date: "2026-04-01", score: 9.5 },
			{ date: "2026-04-08", score: 9.4 },
			{ date: "2026-04-15", score: 9.3 },
		])
		const issues = await scorecardTrend.validate("", { projectRoot: workdir })
		expect(issues).not.toBeNull()
		expect(issues!.length).toBe(1)
		expect(issues![0]!.severity).toBe("warn")
		expect(issues![0]!.message).toContain("9.5")
		expect(issues![0]!.message).toContain("7.0")
	})
})

describe("fix-playbook generator", () => {
	it("emits a markdown section for each failing check with one-line fixes", () => {
		const md = generateFixPlaybook({
			date: "2026-04-28",
			repo: { name: "example/foo" },
			score: 4.2,
			checks: [
				{ name: "Branch-Protection", score: 0, reason: "branch protection not enabled" },
				{ name: "Pinned-Dependencies", score: 2 },
				{ name: "License", score: 10 },
				{ name: "Security-Policy", score: 0 },
			],
		})
		expect(md).toContain("# OpenSSF Scorecard")
		expect(md).toContain("Branch-Protection")
		expect(md).toContain("Pinned-Dependencies")
		expect(md).toContain("Security-Policy")
		// License (10/10) should not appear in the failing list.
		expect(md.split("### License").length).toBe(1)
		// One-line fixes are present.
		expect(md).toContain("branch-protection.tf")
		expect(md).toContain("SECURITY.md")
	})
})
