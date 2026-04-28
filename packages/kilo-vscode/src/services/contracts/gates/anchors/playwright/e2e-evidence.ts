/**
 * proof.e2e-evidence — every CI workflow that runs Playwright/Cypress must
 * upload trace evidence as an artifact. Validated by inspecting any
 * `.github/workflows/*.yml` file passed in `refs.fileContents`.
 *
 * The gate looks for an `actions/upload-artifact@v4` (or higher) step
 * uploading a path containing `trace`, `test-results`, `playwright-report`,
 * or `cypress/videos`. Pinned-SHA references are accepted via comment
 * `# v4.x.y`.
 *
 * Anchor 3 (Playwright/Cypress trace evidence).
 */

import type { Gate, GateIssue } from "../../../RubricCritic"
import { asPlaywrightRefs } from "./types"

const RUNS_PLAYWRIGHT_RE = /\bplaywright\s+test\b|\bnpx\s+playwright\b/i
const RUNS_CYPRESS_RE = /\bcypress\s+run\b|cypress-io\/github-action/i
const UPLOAD_ARTIFACT_RE = /actions\/upload-artifact@(?:[a-f0-9]{40}|v[4-9])/i
const TRACE_PATH_RE = /\b(trace|test-results|playwright-report|cypress\/videos|cypress\/screenshots)\b/i

function isWorkflowFile(path: string): boolean {
	return /\.github\/workflows\/.+\.ya?ml$/i.test(path)
}

export const e2eEvidence: Gate = {
	id: "proof.e2e-evidence",
	name: "CI uploads E2E trace evidence",
	description:
		"Every CI workflow running Playwright or Cypress must upload trace/video artifacts.",
	category: "proof",
	severity: "error",
	docTypes: "*",
	async validate(_doc: string, refs?: unknown): Promise<GateIssue[] | null> {
		const { fileContents } = asPlaywrightRefs(refs)
		if (!fileContents) {
			return [
				{
					severity: "warn",
					message: "Cannot verify trace evidence: no workflow contents supplied to the gate.",
					suggestion: "Pass `refs.fileContents` with .github/workflows/*.yml entries.",
				},
			]
		}
		const workflows = Object.entries(fileContents).filter(([p]) => isWorkflowFile(p))
		if (workflows.length === 0) {
			return [
				{
					severity: "error",
					message: "No GitHub Actions workflows found under .github/workflows/.",
					suggestion: "Scaffold an E2E CI workflow (Anchor 3 — playwright-ci.workflow.yml).",
				},
			]
		}
		const e2eWorkflows = workflows.filter(
			([, body]) => RUNS_PLAYWRIGHT_RE.test(body) || RUNS_CYPRESS_RE.test(body),
		)
		if (e2eWorkflows.length === 0) {
			return [
				{
					severity: "error",
					message: "No workflow runs Playwright or Cypress.",
					suggestion: "Add an E2E job to .github/workflows/ that runs `npx playwright test` or `cypress run`.",
				},
			]
		}
		const issues: GateIssue[] = []
		for (const [path, body] of e2eWorkflows) {
			const hasUpload = UPLOAD_ARTIFACT_RE.test(body)
			const hasTracePath = TRACE_PATH_RE.test(body)
			if (!hasUpload) {
				issues.push({
					severity: "error",
					message: `${path}: missing actions/upload-artifact@v4 step.`,
					suggestion: "Add an `actions/upload-artifact@<sha> # v4.x.y` step that uploads test-results/.",
				})
			} else if (!hasTracePath) {
				issues.push({
					severity: "error",
					message: `${path}: upload-artifact step does not reference trace/test-results paths.`,
					suggestion: "Set `path: test-results/` (Playwright) or `path: cypress/videos` (Cypress).",
				})
			}
		}
		return issues.length ? issues : null
	},
}

export default e2eEvidence
