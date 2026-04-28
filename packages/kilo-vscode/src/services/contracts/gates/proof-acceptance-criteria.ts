/**
 * proof-acceptance-criteria — at least one section must spell out testable
 * acceptance criteria, either:
 *   • a Gherkin-style `Given … When … Then` block, OR
 *   • RFC 2119 keywords (MUST / SHOULD / MAY / SHALL / MUST NOT / SHOULD NOT)
 *
 * Without these the doc is "vibes-driven" — implementers cannot tell when
 * a feature is done.
 */

import type { Gate, GateIssue } from "../RubricCritic"

const GHERKIN_RE = /\b(Given|When|Then|And|But)\b\s+[^\n]{4,}/i
const RFC2119_RE = /\b(MUST(?:\s+NOT)?|SHOULD(?:\s+NOT)?|SHALL(?:\s+NOT)?|MAY|REQUIRED|RECOMMENDED|OPTIONAL)\b/

export const proofAcceptanceCriteria: Gate = {
	id: "proof-acceptance-criteria",
	name: "Has acceptance criteria",
	description: "Doc must contain Given/When/Then or RFC 2119 keywords (MUST/SHOULD/MAY).",
	category: "proof",
	severity: "error",
	docTypes: "*",
	async validate(doc: string): Promise<GateIssue[] | null> {
		// Strip code fences so doc-as-data examples don't satisfy the gate.
		const stripped = doc.replace(/```[\s\S]*?```/g, "")
		const hasGherkin = GHERKIN_RE.test(stripped)
		const hasRfc = RFC2119_RE.test(stripped)
		if (hasGherkin || hasRfc) return null
		return [
			{
				severity: "error",
				message: "No acceptance criteria found (no Given/When/Then or RFC 2119 keywords).",
				suggestion: "Add a section with 'Given X, When Y, Then Z' bullets or use MUST/SHOULD/MAY explicitly.",
			},
		]
	},
}

export default proofAcceptanceCriteria
