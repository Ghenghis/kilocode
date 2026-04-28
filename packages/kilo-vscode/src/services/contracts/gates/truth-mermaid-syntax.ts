/**
 * truth-mermaid-syntax — every ` ```mermaid ` fenced block must look like a
 * valid mermaid graph. We do NOT spawn mermaid-cli (too heavy for the gate
 * runner); instead we apply a light grammar check:
 *
 *   1. block must start with a recognised diagram-type keyword
 *      (flowchart, graph, sequenceDiagram, classDiagram, stateDiagram, erDiagram,
 *       gantt, pie, journey, gitGraph, mindmap, timeline)
 *   2. balanced brackets `[]`, `{}` and `()`
 *   3. no obviously malformed arrows (e.g. `-->>>` or `<-->>`)
 *
 * Catches the 3 hallucination modes we see most: wrong header, brace
 * mismatch, doubled arrows.
 */

import type { Gate, GateIssue } from "../RubricCritic"

const MERMAID_RE = /```mermaid\n([\s\S]*?)```/g
const KEYWORDS = [
	"flowchart",
	"graph",
	"sequenceDiagram",
	"classDiagram",
	"stateDiagram",
	"stateDiagram-v2",
	"erDiagram",
	"gantt",
	"pie",
	"journey",
	"gitGraph",
	"mindmap",
	"timeline",
	"requirementDiagram",
	"C4Context",
	"quadrantChart",
]

function findLine(doc: string, idx: number): number {
	return doc.slice(0, idx).split("\n").length
}

function balanced(s: string): boolean {
	const stack: string[] = []
	const pairs: Record<string, string> = { ")": "(", "]": "[", "}": "{" }
	for (const ch of s) {
		if ("([{".includes(ch)) stack.push(ch)
		else if (")]}".includes(ch) && stack.pop() !== pairs[ch]) return false
	}
	return stack.length === 0
}

export const truthMermaidSyntax: Gate = {
	id: "truth-mermaid-syntax",
	name: "Mermaid blocks parse",
	description: "Every ```mermaid``` block must declare a known diagram type and have balanced brackets.",
	category: "truth",
	severity: "error",
	docTypes: "*",
	async validate(doc: string): Promise<GateIssue[] | null> {
		const issues: GateIssue[] = []
		let m: RegExpExecArray | null
		MERMAID_RE.lastIndex = 0
		while ((m = MERMAID_RE.exec(doc)) !== null) {
			const block = m[1] ?? ""
			const startLine = findLine(doc, m.index) + 1
			const firstWord = block.trim().split(/\s|\n|;/)[0] ?? ""
			if (!KEYWORDS.some((k) => firstWord.startsWith(k))) {
				issues.push({
					line: startLine,
					severity: "error",
					message: `mermaid block does not start with a known diagram type (got "${firstWord}")`,
					suggestion: `Start with one of: ${KEYWORDS.slice(0, 6).join(", ")}, …`,
				})
			}
			if (!balanced(block)) {
				issues.push({ line: startLine, severity: "error", message: "mermaid block has unbalanced () [] {}" })
			}
			if (/-{3,}>>+|<-+>+/.test(block)) {
				issues.push({ line: startLine, severity: "error", message: "mermaid block has malformed arrow syntax" })
			}
		}
		return issues.length ? issues : null
	},
}

export default truthMermaidSyntax
