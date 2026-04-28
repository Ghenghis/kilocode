/**
 * proof-risk-register — the doc must have a "Risks", "Risk Register" or
 * "Threats" section with at least 3 entries. Each entry should mention a
 * mitigation ("mitigation", "mitigate", "rollback", "fallback",
 * "contingency"). Without this the project is shipping unmitigated risk.
 */

import type { Gate, GateIssue } from "../RubricCritic"

const HEADING_RE = /^#{1,6}\s+([^\n]+)/gm
const TITLE_RE = /\b(risk\s*register|risks?|threats?)\b/i
const ITEM_RE = /^\s*(?:[-*+]\s+|\d+\.\s+|\|\s*[^|\n]+?\s*\|)/m

function findLine(doc: string, idx: number): number {
	return doc.slice(0, idx).split("\n").length
}

function countItems(body: string): number {
	let count = 0
	for (const line of body.split("\n")) {
		if (ITEM_RE.test(line)) count++
	}
	return count
}

export const proofRiskRegister: Gate = {
	id: "proof-risk-register",
	name: "Risks section has ≥3 entries with mitigations",
	description: "Risks / Risk Register section must list ≥3 items and mention mitigation steps.",
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
			return [{ severity: "warn", message: "No Risks / Risk Register section found." }]
		}
		const next = headings.find((h) => h.idx > target.idx)
		const body = doc.slice(target.idx, next ? next.idx : doc.length)
		const items = countItems(body)
		const issues: GateIssue[] = []
		if (items < 3) {
			issues.push({
				line: target.line,
				severity: "warn",
				message: `Risks section has only ${items} entries; need ≥3.`,
			})
		}
		if (!/\b(mitigation|mitigate|rollback|fallback|contingency)\b/i.test(body)) {
			issues.push({
				line: target.line,
				severity: "warn",
				message: "Risks section never mentions mitigation/rollback/fallback.",
				suggestion: "For every risk, add a Mitigation column or sentence.",
			})
		}
		return issues.length ? issues : null
	},
}

export default proofRiskRegister
