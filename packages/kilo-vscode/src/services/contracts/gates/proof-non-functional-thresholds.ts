/**
 * proof-non-functional-thresholds — if the doc has a Non-Functional
 * Requirements ("NFR" / "Non-Functional" / "Performance" / "Reliability")
 * section, it must specify quantitative thresholds for at least two of:
 *   • latency / p95 / p99 / response time
 *   • error rate / availability / SLO / SLA
 *   • throughput / qps / rps / concurrency
 *
 * Empty NFR sections are the #1 cause of "we shipped, then it fell over"
 * post-mortems.
 */

import type { Gate, GateIssue } from "../RubricCritic"

const HEADING_RE = /^#{1,6}\s+([^\n]+)/gm
const NFR_TITLE_RE = /\b(non[- ]?functional|nfrs?|performance|reliability|sla|slo)\b/i
const LATENCY_RE = /\b(latency|response\s*time|p9[59]|ttfb)\b[\s\S]{0,80}\d/i
const ERROR_RE = /\b(error\s*rate|availability|uptime|slo|sla)\b[\s\S]{0,80}\d/i
const THROUGHPUT_RE = /\b(throughput|qps|rps|concurrency|requests?\/s)\b[\s\S]{0,80}\d/i

function findLine(doc: string, idx: number): number {
	return doc.slice(0, idx).split("\n").length
}

export const proofNonFunctionalThresholds: Gate = {
	id: "proof-non-functional-thresholds",
	name: "NFR section has quantitative thresholds",
	description: "If an NFR/Performance section exists, ≥2 of {latency, error-rate, throughput} must have numeric thresholds.",
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
		const target = headings.find((h) => NFR_TITLE_RE.test(h.title))
		if (!target) return null // optional section
		const next = headings.find((h) => h.idx > target.idx)
		const body = doc.slice(target.idx, next ? next.idx : doc.length)
		const hits = [LATENCY_RE.test(body), ERROR_RE.test(body), THROUGHPUT_RE.test(body)].filter(Boolean).length
		if (hits >= 2) return null
		return [
			{
				line: target.line,
				severity: "warn",
				message: `NFR section "${target.title}" has only ${hits} quantitative threshold(s); need ≥2.`,
				suggestion: "Add latency-p95, error-rate, and throughput numbers.",
			},
		]
	},
}

export default proofNonFunctionalThresholds
