/**
 * safety.prompt-injection-test — Anchor 4 gate.
 *
 * For aiSystem contracts, `verification/cases/` must include at least one
 * test case mapped to LLM01 (Prompt Injection). The mapping signal is any
 * of:
 *   - a test id in the LLM01 section of shape `PI-NNN`
 *   - the literal token `LLM01` referenced from a `Test Cases Required`
 *     line in the OWASP register section, AND a corresponding entry in a
 *     `verification/cases/` index list elsewhere in the contract
 *   - a fenced code reference to `verification/cases/prompt-injection.test`
 *
 * The gate inspects ONLY the contract markdown — it does not crawl the
 * filesystem (the contract is the source of truth at gate time; on-disk
 * assets are validated separately by the scaffold pipeline).
 *
 * Severity: warn — the contract can ship without it, but the warning
 * should appear in the studio's gate panel.
 *
 * Reference: https://genai.owasp.org/llmrisk/llm01-prompt-injection/
 */

import type { Gate, GateIssue } from "../../../RubricCritic"

const FRONT_MATTER_RE = /^---\s*\n([\s\S]*?)\n---\s*(?:\n|$)/
const AI_SYSTEM_RE = /^\s*aiSystem\s*:\s*(true|"true"|'true')\s*$/im
const LLM01_SECTION_RE = /^##\s+LLM01\b[^\n]*$/im
const TEST_ID_RE = /\bPI-\d{3}\b/
const VERIFICATION_PATH_RE = /verification\/cases\/[\w./-]*prompt[-_]injection/i
const TEST_CASES_LINE_RE = /^\s*\*?\*?Test Cases Required\*?\*?:\s*(.+)$/im

function hasAiSystemFlag(doc: string): boolean {
	const fm = FRONT_MATTER_RE.exec(doc)
	if (!fm) return false
	return AI_SYSTEM_RE.test(fm[1] ?? "")
}

function llm01Body(doc: string): string | null {
	const m = LLM01_SECTION_RE.exec(doc)
	if (!m) return null
	const start = m.index
	// stop at next "## LLM" heading or EOF
	const tail = doc.slice(start + (m[0]?.length ?? 0))
	const next = /^##\s+LLM/im.exec(tail)
	const end = next ? start + (m[0]?.length ?? 0) + next.index : doc.length
	return doc.slice(start, end)
}

export const promptInjectionTest: Gate = {
	id: "safety-prompt-injection-test",
	name: "Prompt-injection regression test exists",
	description: "AI-system contracts must reference at least one LLM01 prompt-injection test case.",
	category: "compliance",
	severity: "warn",
	docTypes: "*",
	async validate(doc: string): Promise<GateIssue[] | null> {
		if (!hasAiSystemFlag(doc)) return null
		const issues: GateIssue[] = []
		const body = llm01Body(doc)
		if (!body) {
			issues.push({
				severity: "warn",
				message: "No LLM01 (Prompt Injection) section found in the OWASP register.",
				suggestion:
					"Add an LLM01 section using assets/contract-kit-anchors/safety/owasp-llm-top10.template.md.",
			})
			return issues
		}
		const tcLine = TEST_CASES_LINE_RE.exec(body)
		const tcText = tcLine?.[1] ?? ""
		const hasTestId = TEST_ID_RE.test(tcText)
		const hasVerificationRef = VERIFICATION_PATH_RE.test(doc)
		if (!hasTestId && !hasVerificationRef) {
			issues.push({
				severity: "warn",
				message: "LLM01 section does not list any prompt-injection test ids and no verification/cases/prompt-injection.* reference was found.",
				suggestion:
					"Populate 'Test Cases Required' under LLM01 with ids like PI-001 (or reference verification/cases/prompt-injection.test.ts).",
			})
		}
		return issues.length ? issues : null
	},
}

export default promptInjectionTest
