/**
 * truth-citation-integrity — every Pandoc-style footnote `[^src-N]` used
 * in the doc must have a corresponding entry in the refs sidecar.
 *
 * The refs sidecar is the second argument passed to `validate(doc, refs)`.
 * It is expected to follow the shape `{ refs: Array<{ id: string; … }> }`.
 * We accept a few alternate shapes for forward-compat (an array directly,
 * a Map, or a record keyed by id).
 */

import type { Gate, GateIssue } from "../RubricCritic"

const FOOTNOTE_REF_RE = /\[\^([a-zA-Z0-9_-]+)\]/g

function findLine(doc: string, idx: number): number {
	return doc.slice(0, idx).split("\n").length
}

function collectRefIds(refs: unknown): Set<string> {
	const ids = new Set<string>()
	if (!refs) return ids
	if (Array.isArray(refs)) {
		for (const r of refs) if (r && typeof (r as { id?: unknown }).id === "string") ids.add((r as { id: string }).id)
		return ids
	}
	if (typeof refs === "object") {
		const wrap = refs as { refs?: unknown }
		if (Array.isArray(wrap.refs)) return collectRefIds(wrap.refs)
		for (const k of Object.keys(refs)) ids.add(k)
	}
	return ids
}

export const truthCitationIntegrity: Gate = {
	id: "truth-citation-integrity",
	name: "Citations resolve to refs sidecar",
	description: "Every [^src-N] footnote must have a matching entry in the refs sidecar.",
	category: "truth",
	severity: "error",
	docTypes: "*",
	async validate(doc: string, refs?: unknown): Promise<GateIssue[] | null> {
		const known = collectRefIds(refs)
		const inlineDefs = new Set<string>()
		// In-doc footnote definitions: lines like `[^src-1]: Some source`
		for (const line of doc.split("\n")) {
			const m = /^\s*\[\^([a-zA-Z0-9_-]+)\]:/.exec(line)
			if (m && m[1]) inlineDefs.add(m[1])
		}
		const issues: GateIssue[] = []
		const seen = new Set<string>()
		let m: RegExpExecArray | null
		FOOTNOTE_REF_RE.lastIndex = 0
		while ((m = FOOTNOTE_REF_RE.exec(doc)) !== null) {
			const id = m[1] ?? ""
			// Skip the definition itself.
			const after = doc[m.index + m[0].length]
			if (after === ":") continue
			if (seen.has(id)) continue
			seen.add(id)
			if (!known.has(id) && !inlineDefs.has(id)) {
				issues.push({
					line: findLine(doc, m.index),
					severity: "error",
					message: `Footnote [^${id}] has no entry in the refs sidecar or in-doc definitions`,
					suggestion: "Add a refs sidecar entry or remove the citation.",
				})
			}
		}
		return issues.length ? issues : null
	},
}

export default truthCitationIntegrity
