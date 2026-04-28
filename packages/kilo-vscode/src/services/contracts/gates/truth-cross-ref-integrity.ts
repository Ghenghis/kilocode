/**
 * truth-cross-ref-integrity — every internal anchor link `[text](#anchor)`
 * must resolve to a heading in the same doc. We slugify headings using the
 * same algorithm GitHub-flavoured Markdown uses (lowercase, strip
 * punctuation, replace whitespace with `-`).
 *
 * External links (http://, https://, mailto:) are ignored; reflinks are
 * also out-of-scope (the linked-ref gate is separate).
 */

import type { Gate, GateIssue } from "../RubricCritic"

const HEADING_RE = /^(#{1,6})\s+(.+?)\s*$/gm
const LINK_RE = /\[([^\]]+)\]\(#([^)]+)\)/g

function slugify(s: string): string {
	return s
		.toLowerCase()
		.replace(/[`*_~]/g, "")
		.replace(/[^\w\s-]/g, "")
		.trim()
		.replace(/\s+/g, "-")
}

function findLine(doc: string, idx: number): number {
	return doc.slice(0, idx).split("\n").length
}

export const truthCrossRefIntegrity: Gate = {
	id: "truth-cross-ref-integrity",
	name: "Anchor links resolve",
	description: "Every [text](#anchor) link must point at an existing heading.",
	category: "truth",
	severity: "error",
	docTypes: "*",
	async validate(doc: string): Promise<GateIssue[] | null> {
		const slugs = new Set<string>()
		let m: RegExpExecArray | null
		HEADING_RE.lastIndex = 0
		while ((m = HEADING_RE.exec(doc)) !== null) {
			slugs.add(slugify(m[2] ?? ""))
		}

		const issues: GateIssue[] = []
		LINK_RE.lastIndex = 0
		while ((m = LINK_RE.exec(doc)) !== null) {
			const anchor = m[2] ?? ""
			if (!slugs.has(anchor)) {
				issues.push({
					line: findLine(doc, m.index),
					severity: "error",
					message: `Anchor "#${anchor}" does not match any heading`,
					suggestion: `Available headings: ${Array.from(slugs).slice(0, 5).join(", ")}…`,
				})
			}
		}
		return issues.length ? issues : null
	},
}

export default truthCrossRefIntegrity
