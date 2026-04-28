/**
 * compliance.ssdf-coverage — at least N% of NIST SSDF (SP 800-218 v1.1)
 * practices listed in the attestation must have a non-`tbd` status.
 *
 * Default threshold = 0.80 (80%). Configurable per-project under
 * `compliance.ssdf-coverage.threshold` (a number in [0,1]).
 *
 * Reference: https://csrc.nist.gov/publications/detail/sp/800-218/final
 */

import type { Gate, GateIssue } from "../../../RubricCritic"

export const DEFAULT_SSDF_COVERAGE_THRESHOLD = 0.8

interface CoverageRefs {
	config?: {
		"compliance.ssdf-coverage"?: {
			threshold?: number
		}
	}
}

const PRACTICE_HEADING_RE = /^###\s+(P[OSWV]\.\d+)\b/gm
const STATUS_LINE_RE = /\*\*Status:\*\*\s*([A-Za-z/-]+|<!--[^>]*-->)/

interface PracticeBlock {
	id: string
	status: string
}

export function parseSsdfPractices(doc: string): PracticeBlock[] {
	const matches: { id: string; index: number }[] = []
	let m: RegExpExecArray | null
	PRACTICE_HEADING_RE.lastIndex = 0
	while ((m = PRACTICE_HEADING_RE.exec(doc)) !== null) {
		matches.push({ id: m[1]!, index: m.index })
	}
	const blocks: PracticeBlock[] = []
	for (let i = 0; i < matches.length; i++) {
		const start = matches[i]!.index
		const end = i + 1 < matches.length ? matches[i + 1]!.index : doc.length
		const segment = doc.slice(start, end)
		const sm = STATUS_LINE_RE.exec(segment)
		const raw = (sm?.[1] ?? "").trim().toLowerCase()
		// Treat ai-fill placeholders as "tbd"
		const status = raw.startsWith("<!--") || raw === "" ? "tbd" : raw
		blocks.push({ id: matches[i]!.id, status })
	}
	return blocks
}

export const ssdfCoverage: Gate = {
	id: "compliance.ssdf-coverage",
	name: "NIST SSDF self-attestation coverage",
	description:
		"At least the configured percentage of SSDF practices must have a non-tbd status (default 80%). Source: NIST SP 800-218 v1.1.",
	category: "compliance",
	severity: "warn",
	docTypes: ["ssdf-attestation"],
	async validate(doc: string, refs?: unknown): Promise<GateIssue[] | null> {
		const cfg = (refs as CoverageRefs | undefined)?.config?.["compliance.ssdf-coverage"]
		const rawThreshold = cfg?.threshold
		const threshold =
			typeof rawThreshold === "number" && rawThreshold >= 0 && rawThreshold <= 1
				? rawThreshold
				: DEFAULT_SSDF_COVERAGE_THRESHOLD

		const practices = parseSsdfPractices(doc)
		if (practices.length === 0) {
			return [
				{
					severity: "warn",
					message:
						"No SSDF practice headings found (expected ### headings like 'PO.1', 'PS.2', etc.).",
					suggestion:
						"Use the ssdf-attestation.template.md scaffold so canonical SSDF v1.1 practice IDs are present.",
				},
			]
		}
		const filled = practices.filter((p) => p.status !== "tbd").length
		const ratio = filled / practices.length
		if (ratio + 1e-9 >= threshold) return null
		const missing = practices
			.filter((p) => p.status === "tbd")
			.map((p) => p.id)
			.join(", ")
		const pct = Math.round(threshold * 100)
		const have = Math.round(ratio * 100)
		return [
			{
				severity: "warn",
				message: `SSDF coverage is ${have}% (${filled}/${practices.length}); minimum is ${pct}%. Unanswered: ${missing}.`,
				suggestion:
					"Set Status to one of: implemented | compensating | n/a | tbd. 'n/a' is acceptable with a Notes justification.",
			},
		]
	},
}

export default ssdfCoverage
