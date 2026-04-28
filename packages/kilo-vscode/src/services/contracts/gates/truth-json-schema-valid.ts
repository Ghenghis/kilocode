/**
 * truth-json-schema-valid — every ` ```json ` (and ```jsonc) fenced block
 * must `JSON.parse` cleanly. JSONC tolerates trailing commas + single-line
 * comments by stripping them before the parse.
 *
 * Failure → error with the parse-error message and the offending line.
 */

import type { Gate, GateIssue } from "../RubricCritic"

const JSON_RE = /```(json|jsonc)\n([\s\S]*?)```/g

function findLine(doc: string, idx: number): number {
	return doc.slice(0, idx).split("\n").length
}

function stripJsoncComments(src: string): string {
	// Remove // line comments and /* block comments */, then trailing commas
	return src
		.replace(/\/\*[\s\S]*?\*\//g, "")
		.replace(/(^|[^:])\/\/.*$/gm, "$1")
		.replace(/,(\s*[}\]])/g, "$1")
}

export const truthJsonSchemaValid: Gate = {
	id: "truth-json-schema-valid",
	name: "JSON blocks are parseable",
	description: "Every ```json``` (or ```jsonc) block must JSON.parse without error.",
	category: "truth",
	severity: "error",
	docTypes: "*",
	async validate(doc: string): Promise<GateIssue[] | null> {
		const issues: GateIssue[] = []
		let m: RegExpExecArray | null
		JSON_RE.lastIndex = 0
		while ((m = JSON_RE.exec(doc)) !== null) {
			const lang = m[1] ?? "json"
			const raw = m[2] ?? ""
			const startLine = findLine(doc, m.index) + 1
			const candidate = lang === "jsonc" ? stripJsoncComments(raw) : raw
			try {
				JSON.parse(candidate)
			} catch (err) {
				issues.push({
					line: startLine,
					severity: "error",
					message: `JSON block invalid: ${err instanceof Error ? err.message : String(err)}`,
					suggestion: "Fix the JSON syntax or change the fence to a plain code block.",
				})
			}
		}
		return issues.length ? issues : null
	},
}

export default truthJsonSchemaValid
