/**
 * compliance.scorecard-trend — Anchor 7.
 *
 * Tracks the OpenSSF Scorecard score over time and warns when the latest run
 * regresses against the rolling history. The history is stored at
 * `<projectRoot>/compliance/scorecard.history.json` as a chronological array
 * of entries (oldest first). The CI workflow appends to it; this gate only
 * **reads** it.
 *
 * History entry shape:
 *   { date: ISO-8601 string, score: 0..10, commit?: string }
 *
 * The gate keeps only the trailing 12 entries logically (callers may choose
 * to truncate the file when they write it, but the gate doesn't mutate it).
 *
 * Trigger conditions:
 *   • latest score < (max-of-prior - dropTolerance)  → warn, "score regressed"
 *   • history < 2 entries                            → null (not enough data)
 *   • files missing                                  → null (other gate handles)
 */

import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"

import type { Gate, GateIssue } from "../../../RubricCritic"

interface Refs {
	projectRoot?: string
	dropToleranceOverride?: number
}

interface HistoryEntry {
	date?: string
	score?: number
	commit?: string
}

interface ScorecardJsonShape {
	score?: number
	date?: string
}

const DEFAULT_DROP_TOLERANCE = 0.5
const HISTORY_WINDOW = 12

function readJson<T>(p: string): T | null {
	try {
		return JSON.parse(readFileSync(p, "utf-8")) as T
	} catch {
		return null
	}
}

function readDropTolerance(projectRoot: string): number {
	const cfgPath = join(projectRoot, ".kilo", "contracts", "config.json")
	if (!existsSync(cfgPath)) return DEFAULT_DROP_TOLERANCE
	const cfg = readJson<Record<string, unknown>>(cfgPath)
	if (!cfg) return DEFAULT_DROP_TOLERANCE
	const compliance = cfg["compliance"]
	if (compliance && typeof compliance === "object") {
		const sub = (compliance as Record<string, unknown>)["scorecard-trend"]
		if (sub && typeof sub === "object") {
			const t = (sub as Record<string, unknown>)["dropTolerance"]
			if (typeof t === "number" && t >= 0 && t <= 10) return t
		}
	}
	return DEFAULT_DROP_TOLERANCE
}

export const scorecardTrend: Gate = {
	id: "compliance-scorecard-trend",
	name: "OpenSSF Scorecard score is not regressing",
	description:
		"Anchor 7: warns when the latest scorecard score drops by more than the configured tolerance (default 0.5) vs. the rolling history.",
	category: "compliance",
	severity: "warn",
	docTypes: "*",
	async validate(_doc: string, refs?: unknown): Promise<GateIssue[] | null> {
		const projectRoot = (refs as Refs | undefined)?.projectRoot
		if (!projectRoot) return null

		const latestPath = join(projectRoot, "compliance", "scorecard.latest.json")
		const historyPath = join(projectRoot, "compliance", "scorecard.history.json")

		const latest = existsSync(latestPath) ? readJson<ScorecardJsonShape>(latestPath) : null
		const historyRaw = existsSync(historyPath) ? readJson<HistoryEntry[]>(historyPath) : null

		if (!latest || typeof latest.score !== "number" || latest.score < 0) {
			// Other gate (openssf-scorecard) handles the missing/invalid case.
			return null
		}
		if (!historyRaw || !Array.isArray(historyRaw) || historyRaw.length === 0) {
			return null
		}

		// Use the most-recent HISTORY_WINDOW entries.
		const window = historyRaw
			.filter((e) => e && typeof e.score === "number" && (e.score as number) >= 0)
			.slice(-HISTORY_WINDOW)
		if (window.length < 1) return null

		const priorMax = window.reduce((m, e) => Math.max(m, e.score as number), -Infinity)
		if (!isFinite(priorMax)) return null

		const tolerance =
			(refs as Refs | undefined)?.dropToleranceOverride !== undefined
				? (refs as Refs).dropToleranceOverride!
				: readDropTolerance(projectRoot)

		const drop = priorMax - latest.score
		if (drop <= tolerance) return null

		return [
			{
				severity: "warn",
				message: `OpenSSF Scorecard dropped ${drop.toFixed(1)} points (peak ${priorMax.toFixed(
					1,
				)}/10 → latest ${latest.score.toFixed(1)}/10), exceeding the ${tolerance.toFixed(1)}-point tolerance.`,
				suggestion:
					"Inspect the SARIF report in the GitHub Security tab; identify the regressed check(s); revert or remediate.",
			},
		]
	},
}

export default scorecardTrend
