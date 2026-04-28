/**
 * proof-success-metrics — the doc must include a "Success Metrics", "KPI",
 * "Goals" or "North-Star Metric" section AND that section must contain at
 * least one quantitative metric — i.e. a number followed by a unit
 * (`%`, `ms`, `s`, `req`, `users`, `MB`, `GB`, `qps`, `rps`).
 *
 * Quantification turns a vibes-PRD into something measurable.
 */

import type { Gate, GateIssue } from "../RubricCritic"

const SECTION_HEADING_RE = /^#{1,6}\s+([^\n]+)/gm
const KEYWORD_RE = /\b(success\s*metrics?|kpis?|north[- ]?star|key\s*results|goals)\b/i
const QUANT_RE = /\b\d[\d,.]*\s*(%|ms|s|m|h|d|users?|req\/s|requests?|qps|rps|mb|gb|kb|gib|mib)\b/i

function findLine(doc: string, idx: number): number {
	return doc.slice(0, idx).split("\n").length
}

export const proofSuccessMetrics: Gate = {
	id: "proof-success-metrics",
	name: "Has quantitative success metrics",
	description: "A Success Metrics / KPI / North-Star section must include at least one quantitative metric.",
	category: "proof",
	severity: "error",
	docTypes: "*",
	async validate(doc: string): Promise<GateIssue[] | null> {
		// Build section ranges keyed by heading.
		const lines = doc.split("\n")
		const headings: { line: number; idx: number; title: string }[] = []
		let m: RegExpExecArray | null
		SECTION_HEADING_RE.lastIndex = 0
		while ((m = SECTION_HEADING_RE.exec(doc)) !== null) {
			headings.push({ line: findLine(doc, m.index), idx: m.index, title: m[1] ?? "" })
		}
		const target = headings.find((h) => KEYWORD_RE.test(h.title))
		if (!target) {
			return [{ severity: "error", message: "No Success Metrics / KPI / Goals section found." }]
		}
		const next = headings.find((h) => h.idx > target.idx)
		const body = doc.slice(target.idx, next ? next.idx : doc.length)
		if (!QUANT_RE.test(body)) {
			return [
				{
					line: target.line,
					severity: "error",
					message: `Section "${target.title}" has no quantitative metric (e.g. "p95 < 200ms", "≥ 1000 users").`,
					suggestion: "Add a number-with-unit threshold so the metric is testable.",
				},
			]
		}
		void lines // satisfies linter: we use doc directly
		return null
	},
}

export default proofSuccessMetrics
