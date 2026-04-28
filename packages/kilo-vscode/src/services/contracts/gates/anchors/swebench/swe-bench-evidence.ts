/**
 * proof.swe-bench-evidence — every failed case in the cached verification
 * report must have at least one entry in `evidencePaths`. Without evidence
 * a non-coder cannot tell *why* a test failed (Anchor 3 forensic-grade
 * proof requirement).
 *
 * Reads `<projectRoot>/verification/last-report.json` (same artefact as
 * `proof-swe-bench-pass-rate`). Skipped/passed cases are not checked — only
 * failures need evidence.
 */

import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"

import type { Gate, GateIssue } from "../../../RubricCritic"

interface Refs {
	projectRoot?: string
}

interface CaseRecord {
	id?: string
	status?: "passed" | "failed" | "skipped"
	evidencePaths?: string[]
}
interface ReportShape {
	cases?: CaseRecord[]
}

export const sweBenchEvidence: Gate = {
	id: "proof-swe-bench-evidence",
	name: "Failed verification cases have evidence",
	description:
		"Anchor 2 + 3: every failed case in verification/last-report.json must have at least one path in evidencePaths.",
	category: "proof",
	severity: "error",
	docTypes: "*",
	async validate(_doc: string, refs?: unknown): Promise<GateIssue[] | null> {
		const projectRoot = (refs as Refs | undefined)?.projectRoot
		if (!projectRoot) return null
		const reportPath = join(projectRoot, "verification", "last-report.json")
		if (!existsSync(reportPath)) return null // Pass-rate gate already flags this.
		let report: ReportShape | null
		try {
			report = JSON.parse(readFileSync(reportPath, "utf-8")) as ReportShape
		} catch {
			return null
		}
		if (!report || !Array.isArray(report.cases)) return null

		const issues: GateIssue[] = []
		for (const c of report.cases) {
			if (c.status !== "failed") continue
			const ev = Array.isArray(c.evidencePaths) ? c.evidencePaths : []
			if (ev.length === 0) {
				issues.push({
					severity: "error",
					message: `Failed case "${c.id ?? "<unknown>"}" has no evidencePaths.`,
					suggestion: "Attach a Playwright trace / screenshot / log path so the failure is auditable.",
				})
			}
		}
		return issues.length ? issues : null
	},
}

export default sweBenchEvidence
