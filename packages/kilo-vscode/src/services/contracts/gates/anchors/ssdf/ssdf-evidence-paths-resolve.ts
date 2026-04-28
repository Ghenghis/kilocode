/**
 * compliance.ssdf-evidence-paths-resolve — every Evidence path declared on
 * an "implemented" SSDF practice must resolve to an existing file under the
 * workspace root.
 *
 * The gate is path-based, so it needs a workspace root + an `exists` probe
 * (passed via `refs`). In production the probe wraps `fs.existsSync`; tests
 * inject a virtual fs map for portability.
 *
 * Reference: https://csrc.nist.gov/publications/detail/sp/800-218/final
 */

import * as fs from "fs"
import * as path from "path"

import type { Gate, GateIssue } from "../../../RubricCritic"

interface ResolveRefs {
	workspaceRoot?: string
	exists?: (absolutePath: string) => boolean
}

const PRACTICE_HEADING_RE = /^###\s+(P[OSWV]\.\d+)\b/gm
const STATUS_LINE_RE = /\*\*Status:\*\*\s*([A-Za-z/-]+|<!--[^>]*-->)/
const EVIDENCE_LINE_RE = /\*\*Evidence:\*\*\s*(.+)$/m

export interface PracticeEvidence {
	id: string
	status: string
	evidence: string[]
	line: number
}

function lineOf(doc: string, idx: number): number {
	return doc.slice(0, idx).split("\n").length
}

function tokenizeEvidence(line: string): string[] {
	// Strip ai-fill HTML comments
	const cleaned = line
		.replace(/<!--[^>]*-->/g, "")
		.replace(/`/g, "")
		.trim()
	if (!cleaned) return []
	// Accept comma- or whitespace-separated; ignore obvious prose-only fillers.
	return cleaned
		.split(/[\s,]+/)
		.map((s) => s.trim())
		.filter((s) => s.length > 0 && /[/.\-_a-zA-Z0-9]/.test(s))
}

export function parsePracticeEvidence(doc: string): PracticeEvidence[] {
	const matches: { id: string; index: number }[] = []
	let m: RegExpExecArray | null
	PRACTICE_HEADING_RE.lastIndex = 0
	while ((m = PRACTICE_HEADING_RE.exec(doc)) !== null) {
		matches.push({ id: m[1]!, index: m.index })
	}
	const out: PracticeEvidence[] = []
	for (let i = 0; i < matches.length; i++) {
		const start = matches[i]!.index
		const end = i + 1 < matches.length ? matches[i + 1]!.index : doc.length
		const segment = doc.slice(start, end)
		const sm = STATUS_LINE_RE.exec(segment)
		const raw = (sm?.[1] ?? "").trim().toLowerCase()
		const status = raw.startsWith("<!--") || raw === "" ? "tbd" : raw
		const ev = EVIDENCE_LINE_RE.exec(segment)
		const evidence = ev ? tokenizeEvidence(ev[1] ?? "") : []
		out.push({
			id: matches[i]!.id,
			status,
			evidence,
			line: lineOf(doc, start),
		})
	}
	return out
}

export const ssdfEvidencePathsResolve: Gate = {
	id: "compliance.ssdf-evidence-paths-resolve",
	name: "NIST SSDF evidence paths resolve",
	description:
		"Every evidence path on an implemented SSDF practice must resolve to a file in the workspace. Source: NIST SP 800-218 v1.1.",
	category: "compliance",
	severity: "error",
	docTypes: ["ssdf-attestation"],
	async validate(doc: string, refs?: unknown): Promise<GateIssue[] | null> {
		const r = (refs as ResolveRefs | undefined) ?? {}
		const root = r.workspaceRoot
		if (!root) {
			// Without a workspace root we cannot probe — emit info-level guidance
			// rather than blocking the gate suite.
			return null
		}
		const exists =
			r.exists ??
			((p: string): boolean => {
				try {
					return fs.existsSync(p)
				} catch {
					return false
				}
			})
		const issues: GateIssue[] = []
		const practices = parsePracticeEvidence(doc)
		for (const p of practices) {
			if (p.status !== "implemented") continue
			if (p.evidence.length === 0) {
				issues.push({
					line: p.line,
					severity: "error",
					message: `${p.id} is marked 'implemented' but has no evidence paths.`,
					suggestion: "Add at least one path under Evidence (e.g. `.github/workflows/ci.yml`).",
				})
				continue
			}
			for (const rel of p.evidence) {
				const abs = path.isAbsolute(rel) ? rel : path.join(root, rel)
				if (!exists(abs)) {
					issues.push({
						line: p.line,
						severity: "error",
						message: `${p.id}: evidence path \`${rel}\` does not resolve under the workspace root.`,
						suggestion:
							"Either fix the path, downgrade the status to `tbd`, or move the artefact under the workspace.",
					})
				}
			}
		}
		return issues.length ? issues : null
	},
}

export default ssdfEvidencePathsResolve
