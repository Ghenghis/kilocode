/**
 * safety.owasp-llm-coverage — Anchor 4 gate.
 *
 * For any contract whose YAML front-matter declares `aiSystem: true`, the
 * OWASP LLM Top 10 risk register MUST exist (a section per LLM01..LLM10)
 * AND every `<!-- ai-fill -->` placeholder must have been replaced with
 * non-empty content.
 *
 * The gate is intentionally tolerant of *where* the register lives — it
 * may be inlined in the contract markdown itself (typical for small
 * projects) or surfaced via a fenced reference block. We look for ten
 * headings of shape `## LLM01: ...` through `## LLM10: ...`. Each
 * section's body is then scanned for unresolved placeholders.
 *
 * Severity: error. Without this gate green, the contract is not safe to
 * ship to production for an AI-system project.
 *
 * Reference: https://genai.owasp.org/llm-top-10/
 */

import type { Gate, GateIssue } from "../../../RubricCritic"

const FRONT_MATTER_RE = /^---\s*\n([\s\S]*?)\n---\s*(?:\n|$)/
const AI_SYSTEM_RE = /^\s*aiSystem\s*:\s*(true|"true"|'true')\s*$/im
const SECTION_HEADING_RE = /^##\s+LLM(0[1-9]|10)\b[^\n]*$/gim
const PLACEHOLDER_RE = /<!--\s*ai-fill\b[^>]*-->/g

function findLine(doc: string, idx: number): number {
	return doc.slice(0, idx).split("\n").length
}

function hasAiSystemFlag(doc: string): boolean {
	const fm = FRONT_MATTER_RE.exec(doc)
	if (!fm) return false
	return AI_SYSTEM_RE.test(fm[1] ?? "")
}

interface FoundSection {
	id: string
	idx: number
	line: number
}

function findSections(doc: string): FoundSection[] {
	const out: FoundSection[] = []
	SECTION_HEADING_RE.lastIndex = 0
	let m: RegExpExecArray | null
	while ((m = SECTION_HEADING_RE.exec(doc)) !== null) {
		out.push({ id: `LLM${m[1]}`, idx: m.index, line: findLine(doc, m.index) })
	}
	return out
}

function bodyOf(doc: string, sections: FoundSection[], i: number): string {
	const start = sections[i]!.idx
	const end = sections[i + 1]?.idx ?? doc.length
	return doc.slice(start, end)
}

const REQUIRED_IDS = [
	"LLM01",
	"LLM02",
	"LLM03",
	"LLM04",
	"LLM05",
	"LLM06",
	"LLM07",
	"LLM08",
	"LLM09",
	"LLM10",
] as const

export const owaspLlmCoverage: Gate = {
	id: "safety-owasp-llm-coverage",
	name: "OWASP LLM Top 10 risk register is complete",
	description:
		"For aiSystem contracts the OWASP LLM Top 10 risk register must exist with non-empty entries for LLM01-LLM10.",
	category: "compliance",
	severity: "error",
	docTypes: "*",
	async validate(doc: string): Promise<GateIssue[] | null> {
		if (!hasAiSystemFlag(doc)) return null // gate is N/A for non-AI projects
		const issues: GateIssue[] = []
		const sections = findSections(doc)
		const seen = new Set(sections.map((s) => s.id))
		for (const id of REQUIRED_IDS) {
			if (!seen.has(id)) {
				issues.push({
					severity: "error",
					message: `OWASP LLM Top 10 register missing section ${id}.`,
					suggestion: `Add a "## ${id}: <category>" section using assets/contract-kit-anchors/safety/owasp-llm-top10.template.md as a starting point.`,
				})
			}
		}
		// For each present section, ensure no leftover ai-fill placeholders.
		for (let i = 0; i < sections.length; i++) {
			const s = sections[i]!
			const body = bodyOf(doc, sections, i)
			PLACEHOLDER_RE.lastIndex = 0
			const matches = body.match(PLACEHOLDER_RE)
			if (matches && matches.length > 0) {
				issues.push({
					line: s.line,
					severity: "error",
					message: `${s.id} has ${matches.length} unresolved <!-- ai-fill --> placeholder(s).`,
					suggestion:
						"Replace every <!-- ai-fill --> placeholder with concrete project-specific content (likelihood, impact, mitigations, owner, etc.).",
				})
			}
		}
		return issues.length ? issues : null
	},
}

export default owaspLlmCoverage
