/**
 * proof-rollback-plan — the Deployment, Rollout or Release section (if any
 * exists) must mention a rollback strategy or feature-flag. We accept any
 * of: "rollback", "revert", "feature flag", "feature-flag", "kill switch",
 * "canary", "blue/green", "blue-green", "shadow".
 *
 * If no deployment-themed heading exists, the gate returns a warn (every
 * production-bound contract should have one).
 */

import type { Gate, GateIssue } from "../RubricCritic"

const HEADING_RE = /^#{1,6}\s+([^\n]+)/gm
const TITLE_RE = /\b(deploy(?:ment)?|rollout|release|launch|go[- ]?live|cut[- ]?over)\b/i
const STRATEGY_RE = /\b(rollback|revert|feature[- ]flag|kill[- ]switch|canary|blue\s*\/?\s*green|blue-green|shadow|dark\s*launch)\b/i

function findLine(doc: string, idx: number): number {
	return doc.slice(0, idx).split("\n").length
}

export const proofRollbackPlan: Gate = {
	id: "proof-rollback-plan",
	name: "Deployment section names a rollback strategy",
	description: "Deployment/Rollout section must mention rollback, feature-flag, canary or blue/green.",
	category: "proof",
	severity: "warn",
	docTypes: "*",
	async validate(doc: string): Promise<GateIssue[] | null> {
		const headings: { line: number; idx: number; title: string }[] = []
		let m: RegExpExecArray | null
		HEADING_RE.lastIndex = 0
		while ((m = HEADING_RE.exec(doc)) !== null) {
			headings.push({ line: findLine(doc, m.index), idx: m.index, title: m[1] ?? "" })
		}
		const target = headings.find((h) => TITLE_RE.test(h.title))
		if (!target) {
			return [
				{
					severity: "warn",
					message: "No Deployment / Rollout / Release section found; rollback strategy unclear.",
					suggestion: "Add a 'Deployment' section that names a rollback strategy.",
				},
			]
		}
		const next = headings.find((h) => h.idx > target.idx)
		const body = doc.slice(target.idx, next ? next.idx : doc.length)
		if (STRATEGY_RE.test(body)) return null
		return [
			{
				line: target.line,
				severity: "warn",
				message: `Section "${target.title}" never names a rollback strategy.`,
				suggestion: "Mention 'rollback', 'feature flag', 'canary', or 'blue/green'.",
			},
		]
	},
}

export default proofRollbackPlan
