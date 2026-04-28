/**
 * proof.swe-bench-pass-rate — read the cached verification report
 * (`verification/last-report.json`) and fail if pass rate < threshold.
 *
 * Threshold sources (highest precedence first):
 *   1. `refs.thresholdOverride` (programmatic)
 *   2. `<projectRoot>/.kilo/contracts/config.json` →
 *        `proof.swe-bench-pass-rate.threshold` (also accepts the legacy
 *        flat key `proof-swe-bench-pass-rate-threshold`)
 *   3. Default: 0.95
 *
 * The gate **never** invokes vitest/playwright/pytest. The CI pipeline runs
 * the harness at `verification/harness/runner.ts`; this gate only validates
 * the artefact the harness emitted.
 *
 * Failure modes:
 *   • report file missing → error (CI hasn't been wired up yet)
 *   • report unparseable → error (corrupt artefact)
 *   • pass rate < threshold → error (work is incomplete)
 */

import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"

import type { Gate, GateIssue } from "../../../RubricCritic"

interface Refs {
	projectRoot?: string
	thresholdOverride?: number
}

interface CaseRecord {
	id?: string
	status?: "passed" | "failed" | "skipped"
}
interface ReportShape {
	totalCases?: number
	passed?: number
	failed?: number
	skipped?: number
	cases?: CaseRecord[]
}

const DEFAULT_THRESHOLD = 0.95

function readJson<T>(p: string): T | null {
	try {
		return JSON.parse(readFileSync(p, "utf-8")) as T
	} catch {
		return null
	}
}

function readThreshold(projectRoot: string): number {
	const cfgPath = join(projectRoot, ".kilo", "contracts", "config.json")
	if (!existsSync(cfgPath)) return DEFAULT_THRESHOLD
	const cfg = readJson<Record<string, unknown>>(cfgPath)
	if (!cfg) return DEFAULT_THRESHOLD
	// Nested: cfg.proof["swe-bench-pass-rate"].threshold
	const proof = cfg["proof"]
	if (proof && typeof proof === "object") {
		const sub = (proof as Record<string, unknown>)["swe-bench-pass-rate"]
		if (sub && typeof sub === "object") {
			const t = (sub as Record<string, unknown>)["threshold"]
			if (typeof t === "number" && t >= 0 && t <= 1) return t
		}
	}
	// Flat fallback.
	const flat = cfg["proof-swe-bench-pass-rate-threshold"]
	if (typeof flat === "number" && flat >= 0 && flat <= 1) return flat
	return DEFAULT_THRESHOLD
}

export const sweBenchPassRate: Gate = {
	id: "proof-swe-bench-pass-rate",
	name: "Verification harness pass rate ≥ threshold",
	description:
		"Anchor 2: reads verification/last-report.json and fails if pass rate is below the configured threshold (default 0.95).",
	category: "proof",
	severity: "error",
	docTypes: "*",
	async validate(_doc: string, refs?: unknown): Promise<GateIssue[] | null> {
		const projectRoot = (refs as Refs | undefined)?.projectRoot
		if (!projectRoot) return null // Caller didn't give us a root → nothing to check.

		const reportPath = join(projectRoot, "verification", "last-report.json")
		if (!existsSync(reportPath)) {
			return [
				{
					severity: "error",
					message:
						"verification/last-report.json missing — run the harness (node verification/harness/runner.ts) before gating.",
					suggestion: "Wire the harness into CI; commit the report (or use a workflow artefact).",
				},
			]
		}
		const report = readJson<ReportShape>(reportPath)
		if (!report || typeof report.totalCases !== "number") {
			return [
				{
					severity: "error",
					message: "verification/last-report.json is not a valid SWE-bench report.",
					suggestion: "Regenerate via the harness; verify against report.schema.json.",
				},
			]
		}
		const total = report.totalCases ?? 0
		const passed = report.passed ?? 0
		const passRate = total === 0 ? 1 : passed / total

		const threshold =
			(refs as Refs | undefined)?.thresholdOverride !== undefined
				? (refs as Refs).thresholdOverride!
				: readThreshold(projectRoot)

		if (passRate >= threshold) return null
		return [
			{
				severity: "error",
				message: `Verification pass rate ${(passRate * 100).toFixed(1)}% is below threshold ${(threshold * 100).toFixed(1)}% (${passed}/${total} cases).`,
				suggestion: "Fix failing cases or lower the threshold in .kilo/contracts/config.json.",
			},
		]
	},
}

export default sweBenchPassRate
