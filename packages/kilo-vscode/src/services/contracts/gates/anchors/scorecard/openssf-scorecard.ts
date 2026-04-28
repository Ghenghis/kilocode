/**
 * compliance.openssf-scorecard — Anchor 7.
 *
 * Reads `<projectRoot>/compliance/scorecard.latest.json` (uploaded by the
 * scorecard.yml CI workflow) and fails when the aggregate score is below the
 * configured threshold.
 *
 * Threshold sources (highest precedence first):
 *   1. `refs.thresholdOverride` (programmatic, used by tests)
 *   2. `<projectRoot>/.kilo/contracts/config.json` →
 *        `compliance.openssf-scorecard.threshold`
 *      (also accepts the legacy flat key
 *       `compliance-openssf-scorecard-threshold`)
 *   3. Default: 7.0
 *
 * If `compliance/scorecard.latest.json` is missing the gate emits a single
 * **info** issue ("project hasn't run scorecard yet") rather than failing —
 * this matches the spec's "warn, don't block, on missing artefact" rule.
 */

import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"

import type { Gate, GateIssue } from "../../../RubricCritic"

interface Refs {
	projectRoot?: string
	thresholdOverride?: number
}

interface ScorecardJsonShape {
	score?: number
	checks?: Array<{ name?: string; score?: number }>
}

const DEFAULT_THRESHOLD = 7.0

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
	const compliance = cfg["compliance"]
	if (compliance && typeof compliance === "object") {
		const sub = (compliance as Record<string, unknown>)["openssf-scorecard"]
		if (sub && typeof sub === "object") {
			const t = (sub as Record<string, unknown>)["threshold"]
			if (typeof t === "number" && t >= 0 && t <= 10) return t
		}
	}
	const flat = cfg["compliance-openssf-scorecard-threshold"]
	if (typeof flat === "number" && flat >= 0 && flat <= 10) return flat
	return DEFAULT_THRESHOLD
}

export const openSsfScorecard: Gate = {
	id: "compliance-openssf-scorecard",
	name: "OpenSSF Scorecard ≥ threshold",
	description:
		"Anchor 7: reads compliance/scorecard.latest.json (CI artefact) and fails if aggregate < threshold (default 7.0).",
	category: "compliance",
	severity: "warn",
	docTypes: "*",
	async validate(_doc: string, refs?: unknown): Promise<GateIssue[] | null> {
		const projectRoot = (refs as Refs | undefined)?.projectRoot
		if (!projectRoot) return null

		const reportPath = join(projectRoot, "compliance", "scorecard.latest.json")
		if (!existsSync(reportPath)) {
			return [
				{
					severity: "info",
					message:
						"compliance/scorecard.latest.json missing — project hasn't run OpenSSF Scorecard yet.",
					suggestion:
						"Add .github/workflows/scorecard.yml from the Contract Kit Creator scaffold and let CI run once.",
				},
			]
		}

		const report = readJson<ScorecardJsonShape>(reportPath)
		if (!report || typeof report.score !== "number") {
			return [
				{
					severity: "warn",
					message: "compliance/scorecard.latest.json is not a valid OpenSSF Scorecard JSON document.",
					suggestion:
						"Regenerate via the scorecard workflow (results_format: json) — see assets/contract-kit-anchors/scorecard/scorecard.workflow.yml.",
				},
			]
		}

		const score = report.score
		// Scorecard uses -1 to mean "not measured / inconclusive" — pass through as info.
		if (score < 0) {
			return [
				{
					severity: "info",
					message: "OpenSSF Scorecard returned an inconclusive aggregate (-1).",
					suggestion: "Re-run the scorecard workflow once the repo has at least one merged PR.",
				},
			]
		}

		const threshold =
			(refs as Refs | undefined)?.thresholdOverride !== undefined
				? (refs as Refs).thresholdOverride!
				: readThreshold(projectRoot)

		if (score >= threshold) return null

		const failingChecks = (report.checks ?? [])
			.filter((c) => typeof c.score === "number" && (c.score as number) >= 0 && (c.score as number) < 8)
			.map((c) => c.name ?? "?")
			.slice(0, 5)

		return [
			{
				severity: "warn",
				message: `OpenSSF Scorecard aggregate ${score.toFixed(1)}/10 is below threshold ${threshold.toFixed(
					1,
				)}/10.${failingChecks.length ? ` Top failing checks: ${failingChecks.join(", ")}.` : ""}`,
				suggestion:
					"Run the fix-playbook generator (compliance/scorecard-fix-playbook.md) and address each failing check.",
			},
		]
	},
}

export default openSsfScorecard
