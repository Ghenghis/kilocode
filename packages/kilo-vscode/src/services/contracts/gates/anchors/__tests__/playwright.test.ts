/**
 * Anchor 3 (Playwright/Cypress trace evidence) — gate unit tests.
 *
 * Covers each of the four anchor gates:
 *   1. proof.e2e-coverage          — flow-keyword to spec-file matching
 *   2. proof.e2e-evidence          — workflow YAML inspection
 *   3. proof.visual-regression     — toHaveScreenshot() detection
 *   4. proof.user-acceptance-signed — sign-off JSON presence + shape
 *   5. composite                    — all four wired through a fake refs payload
 */

import { describe, expect, it } from "bun:test"

import {
	e2eCoverage,
	e2eEvidence,
	visualRegression,
	userAcceptanceSigned,
	PLAYWRIGHT_ANCHOR_GATES,
	type PlaywrightRefs,
} from "../playwright"

const PRD_WITH_STORIES = `# Acme Widget

## User Stories

- **Login**: as a user I want to sign in
- **Checkout**: as a buyer I want to pay
- **Settings**: as an admin I want to configure things

## Acceptance Criteria

AC-001 — Login form renders.
AC-002 — Checkout completes.
`

const VALID_WORKFLOW_YAML = `
name: Playwright E2E
on: [push]
jobs:
  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@b4ffde65f46336ab88eb53be808477a3936bae11 # v4.1.1
      - run: npx playwright test
      - uses: actions/upload-artifact@65462800fd760344b1a7b4382951275a0abb4808 # v4.3.3
        with:
          name: test-results
          path: test-results/
`

const WORKFLOW_MISSING_UPLOAD = `
name: Playwright E2E
on: [push]
jobs:
  e2e:
    runs-on: ubuntu-latest
    steps:
      - run: npx playwright test
`

describe("proof.e2e-coverage", () => {
	it("warns for a story without a matching spec file", async () => {
		const refs: PlaywrightRefs = {
			files: ["verification/e2e/login.spec.ts"], // checkout + settings missing
		}
		const issues = await e2eCoverage.validate(PRD_WITH_STORIES, refs)
		expect(issues).not.toBeNull()
		expect(issues!.length).toBeGreaterThanOrEqual(2)
		const messages = issues!.map((i) => i.message).join(" ")
		expect(messages).toContain("checkout")
		expect(messages).toContain("settings")
	})

	it("passes when every story has a spec", async () => {
		const refs: PlaywrightRefs = {
			files: [
				"verification/e2e/login.spec.ts",
				"verification/e2e/checkout.spec.ts",
				"verification/e2e/settings.cy.ts",
			],
		}
		const issues = await e2eCoverage.validate(PRD_WITH_STORIES, refs)
		expect(issues).toBeNull()
	})

	it("returns null when the doc has no User Stories section (out of scope)", async () => {
		const issues = await e2eCoverage.validate("# Just a title\n", { files: [] })
		expect(issues).toBeNull()
	})
})

describe("proof.e2e-evidence", () => {
	it("passes when a workflow uploads test-results via upload-artifact@v4", async () => {
		const refs: PlaywrightRefs = {
			fileContents: { ".github/workflows/e2e.yml": VALID_WORKFLOW_YAML },
		}
		const issues = await e2eEvidence.validate("", refs)
		expect(issues).toBeNull()
	})

	it("errors when the e2e workflow lacks an upload-artifact step", async () => {
		const refs: PlaywrightRefs = {
			fileContents: { ".github/workflows/e2e.yml": WORKFLOW_MISSING_UPLOAD },
		}
		const issues = await e2eEvidence.validate("", refs)
		expect(issues).not.toBeNull()
		expect(issues![0].severity).toBe("error")
		expect(issues![0].message).toMatch(/upload-artifact/)
	})

	it("errors when no workflow runs Playwright or Cypress", async () => {
		const refs: PlaywrightRefs = {
			fileContents: {
				".github/workflows/lint.yml": "name: Lint\non: [push]\njobs: {}\n",
			},
		}
		const issues = await e2eEvidence.validate("", refs)
		expect(issues).not.toBeNull()
		expect(issues![0].message).toMatch(/Playwright or Cypress/)
	})
})

describe("proof.visual-regression", () => {
	it("passes when a spec calls toHaveScreenshot()", async () => {
		const refs: PlaywrightRefs = {
			fileContents: {
				"verification/e2e/login.spec.ts":
					"await expect(page).toHaveScreenshot('login-form.png')",
			},
		}
		const issues = await visualRegression.validate("", refs)
		expect(issues).toBeNull()
	})

	it("passes when a *-snapshots/ baseline image is present in the file list", async () => {
		const refs: PlaywrightRefs = {
			files: ["verification/e2e/login.spec.ts-snapshots/login-form-chromium-linux.png"],
		}
		const issues = await visualRegression.validate("", refs)
		expect(issues).toBeNull()
	})

	it("warns when no baseline + no toHaveScreenshot() are detected", async () => {
		const issues = await visualRegression.validate("", { files: [] })
		expect(issues).not.toBeNull()
		expect(issues![0].severity).toBe("warn")
	})
})

describe("proof.user-acceptance-signed", () => {
	const docWithCriteria = "AC-001 must be approved.\nAC-002 must also be approved.\n"

	it("errors for any AC-### without a matching sign-off file", async () => {
		const refs: PlaywrightRefs = {
			fileContents: {
				"verification/sign-offs/AC-001.json": JSON.stringify({
					approvedBy: "alice@example.com",
					approvedAt: "2026-04-28T10:00:00Z",
					traceUrl: "https://github.com/x/y/actions/runs/1#artifact",
				}),
				// AC-002 intentionally missing
			},
		}
		const issues = await userAcceptanceSigned.validate(docWithCriteria, refs)
		expect(issues).not.toBeNull()
		expect(issues!.length).toBe(1)
		expect(issues![0].message).toMatch(/AC-002/)
	})

	it("passes when every criterion has a complete sign-off record", async () => {
		const refs: PlaywrightRefs = {
			signOffs: {
				"AC-001": {
					approvedBy: "alice@example.com",
					approvedAt: "2026-04-28T10:00:00Z",
					traceUrl: "https://github.com/x/y/actions/runs/1",
				},
				"AC-002": {
					approvedBy: "bob@example.com",
					approvedAt: "2026-04-28T11:00:00Z",
					traceUrl: "https://github.com/x/y/actions/runs/2",
				},
			},
		}
		const issues = await userAcceptanceSigned.validate(docWithCriteria, refs)
		expect(issues).toBeNull()
	})

	it("rejects sign-off records missing required fields", async () => {
		const refs: PlaywrightRefs = {
			fileContents: {
				"verification/sign-offs/AC-001.json": JSON.stringify({
					approvedBy: "alice@example.com",
					// missing approvedAt + traceUrl
				}),
				"verification/sign-offs/AC-002.json": JSON.stringify({
					approvedBy: "bob@example.com",
					approvedAt: "2026-04-28T11:00:00Z",
					traceUrl: "https://x/y",
				}),
			},
		}
		const issues = await userAcceptanceSigned.validate(docWithCriteria, refs)
		expect(issues).not.toBeNull()
		expect(issues!.length).toBe(1)
		expect(issues![0].message).toMatch(/AC-001/)
	})

	it("returns null when the doc declares no acceptance criteria (out of scope)", async () => {
		const issues = await userAcceptanceSigned.validate("# No criteria here\n", {})
		expect(issues).toBeNull()
	})
})

describe("PLAYWRIGHT_ANCHOR_GATES registry", () => {
	it("exports all four gates with stable ids", () => {
		const ids = PLAYWRIGHT_ANCHOR_GATES.map((g) => g.id).sort()
		expect(ids).toEqual([
			"proof.e2e-coverage",
			"proof.e2e-evidence",
			"proof.user-acceptance-signed",
			"proof.visual-regression",
		])
	})
})
