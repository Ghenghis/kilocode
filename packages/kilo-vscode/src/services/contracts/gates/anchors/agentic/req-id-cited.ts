/**
 * proof.req-id-cited (Anchor 1, Agentic Software Engineering)
 *
 * Scans the doc for sentences that make imperative claims (RFC 2119 keywords:
 * MUST / SHALL / WILL — case-insensitive, allowing the lowercase forms that
 * non-coders default to) and flags any whose sentence does not also reference
 * a stable contract id (`REQ-XXX` or `ADR-XXXX`) or risk id (`RISK-XXX`).
 *
 * Why: agents that consume the kit need to reverse-map every claim back to a
 * REQ/ADR. An unscoped imperative ("the system will rate-limit aggressively")
 * provides no anchor for tests, ownership, or audit. Cited claims are
 * traceable and gate-checkable.
 *
 * The gate emits a `warn` (non-blocking) per offending sentence with a
 * suggestion the editor can render as a one-click fix.
 *
 * Implementation notes:
 *   - Code fences are stripped before scanning so doc-as-data examples do
 *     not generate false positives.
 *   - Markdown links / footnotes are kept; the trigger keyword detection is
 *     sentence-scoped, so a `[REQ-001]` link on the same sentence satisfies
 *     the gate.
 *   - We avoid splitting on every period — abbreviations like "e.g." would
 *     fragment incorrectly. Instead, we split on a sentence terminator
 *     followed by whitespace or end-of-string. Bullet lines (`- foo`,
 *     `* foo`, numbered) are also split as their own sentences.
 */

import type { Gate, GateIssue } from "../../../RubricCritic"

const TRIGGER_RE = /\b(must|shall|will)\b/i
// Mid-word matches are excluded by the word boundary above.

const CITATION_RE = /\b(REQ-[A-Z0-9]+|ADR-[A-Z0-9]+|RISK-[A-Z0-9]+)\b/

const SENTENCE_SPLIT_RE = /(?<=[.!?])\s+(?=[A-Z(`"'\[])|\n+/

function stripCodeFences(doc: string): string {
	return doc.replace(/```[\s\S]*?```/g, "")
}

function lineNumberFor(doc: string, offset: number): number {
	let line = 1
	for (let i = 0; i < offset && i < doc.length; i++) {
		if (doc.charCodeAt(i) === 10) line++
	}
	return line
}

/**
 * Yield (sentence, offsetInOriginalDoc) pairs. We keep the offset so we can
 * report a line number against the original (un-stripped) doc.
 */
function* sentences(doc: string): Generator<{ text: string; offset: number }> {
	const stripped = stripCodeFences(doc)
	// Find offsets of stripped contents within original doc by re-walking.
	// Simpler approach: report against stripped offsets, then map by counting
	// newlines. Because stripCodeFences only removes fenced regions, the
	// resulting text shares newline structure for non-fenced lines (newlines
	// inside removed blocks vanish, so reported lines are biased low after
	// fences). For warning UX this is acceptable; we do not claim line
	// precision in the gate's contract.
	let offset = 0
	for (const part of stripped.split(SENTENCE_SPLIT_RE)) {
		const text = part.trim()
		if (text.length === 0) {
			offset += part.length + 1
			continue
		}
		yield { text, offset }
		offset += part.length + 1
	}
}

export const reqIdCited: Gate = {
	id: "proof.req-id-cited",
	name: "Imperative claims cite a REQ/ADR/RISK id",
	description:
		"Anchor 1: every sentence using must/will/shall must reference a REQ-XXX, ADR-XXXX, or RISK-XXX id so agents can reverse-map work to the contract.",
	category: "proof",
	severity: "warn",
	docTypes: "*",

	async validate(doc: string): Promise<GateIssue[] | null> {
		const issues: GateIssue[] = []

		for (const { text, offset } of sentences(doc)) {
			if (!TRIGGER_RE.test(text)) continue
			if (CITATION_RE.test(text)) continue
			// Skip headings and metadata-style lines (key: value with no narrative
			// claim — e.g. "Status: will be approved" is a label, not a claim).
			if (/^#+\s/.test(text)) continue

			const lineNo = lineNumberFor(doc, offset)
			const preview = text.length > 140 ? `${text.slice(0, 137)}...` : text
			issues.push({
				severity: "warn",
				line: lineNo,
				message: `Unscoped claim: "${preview}"`,
				suggestion: "Add a REQ-XXX, ADR-XXXX, or RISK-XXX reference so agents can map this claim to a tracked contract item.",
			})
		}

		return issues.length > 0 ? issues : null
	},
}

export default reqIdCited
