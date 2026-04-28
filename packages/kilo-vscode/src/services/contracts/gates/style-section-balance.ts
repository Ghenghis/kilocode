/**
 * style-section-balance — no top-level (h1/h2) section may be more than 3×
 * the size of the smallest non-empty top-level section. Appendix-titled
 * sections are excluded from the comparison since they are routinely
 * larger than the body sections by design.
 *
 * Severity = info (style nudge, not a release blocker).
 */

import type { Gate, GateIssue } from "../RubricCritic"

const HEADING_RE = /^(#{1,2})\s+([^\n]+)/gm
const APPENDIX_RE = /\bappendix\b|\bappendices\b|\bglossary\b|\breferences\b/i

function findLine(doc: string, idx: number): number {
	return doc.slice(0, idx).split("\n").length
}

interface SectionRange {
	title: string
	line: number
	idx: number
	size: number
}

export const styleSectionBalance: Gate = {
	id: "style-section-balance",
	name: "Section sizes are balanced",
	description: "No top-level section may be more than 3× the smallest non-appendix section.",
	category: "style",
	severity: "info",
	docTypes: "*",
	async validate(doc: string): Promise<GateIssue[] | null> {
		const sections: SectionRange[] = []
		let m: RegExpExecArray | null
		HEADING_RE.lastIndex = 0
		while ((m = HEADING_RE.exec(doc)) !== null) {
			sections.push({ title: m[2] ?? "", line: findLine(doc, m.index), idx: m.index, size: 0 })
		}
		if (sections.length < 2) return null
		for (let i = 0; i < sections.length; i++) {
			const start = sections[i].idx
			const end = i + 1 < sections.length ? sections[i + 1].idx : doc.length
			sections[i].size = end - start
		}
		const body = sections.filter((s) => !APPENDIX_RE.test(s.title) && s.size > 60)
		if (body.length < 2) return null
		const min = Math.min(...body.map((s) => s.size))
		const issues: GateIssue[] = []
		for (const s of body) {
			if (s.size > min * 3) {
				issues.push({
					line: s.line,
					severity: "info",
					message: `Section "${s.title}" is ${(s.size / min).toFixed(1)}× the smallest section.`,
					suggestion: "Split into sub-sections or trim repetitive content.",
				})
			}
		}
		return issues.length ? issues : null
	},
}

export default styleSectionBalance
