/**
 * proof-data-model-constraints — if a Data Model / Schema / Database
 * section exists, it must mention at least one of: indexes, primary key,
 * foreign key, constraint, unique, retention, TTL, partition.
 *
 * Without that, the data model is decoration and on-call will pay later.
 */

import type { Gate, GateIssue } from "../RubricCritic"

const HEADING_RE = /^#{1,6}\s+([^\n]+)/gm
const TITLE_RE = /\b(data\s*model|schema|database|tables?|entities)\b/i
const CONSTRAINT_RE = /\b(index(?:es)?|primary\s*key|foreign\s*key|constraints?|unique|retention|ttl|partitions?|sharding|composite\s*key)\b/i

function findLine(doc: string, idx: number): number {
	return doc.slice(0, idx).split("\n").length
}

export const proofDataModelConstraints: Gate = {
	id: "proof-data-model-constraints",
	name: "Data Model section names indexes/constraints/retention",
	description: "If a Data Model section exists, it must mention indexes, constraints, or retention policy.",
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
		if (!target) return null // optional section
		const next = headings.find((h) => h.idx > target.idx)
		const body = doc.slice(target.idx, next ? next.idx : doc.length)
		if (CONSTRAINT_RE.test(body)) return null
		return [
			{
				line: target.line,
				severity: "warn",
				message: `Data Model section "${target.title}" omits indexes/constraints/retention.`,
				suggestion: "Specify primary keys, indexes, FK constraints, and a retention policy.",
			},
		]
	},
}

export default proofDataModelConstraints
