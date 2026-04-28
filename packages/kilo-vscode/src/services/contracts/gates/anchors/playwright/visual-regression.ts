/**
 * proof.visual-regression — the project should ship at least one
 * Playwright `expect(page).toHaveScreenshot()` baseline. Detected by:
 *   1. A spec file that calls `toHaveScreenshot()`
 *   2. A baseline image under a `*-snapshots/` directory next to the spec
 *
 * If neither is found, the gate warns (not errors) — visual regression is
 * recommended but not mandatory for every project.
 *
 * Anchor 3 (Playwright/Cypress trace evidence).
 */

import type { Gate, GateIssue } from "../../../RubricCritic"
import { asPlaywrightRefs } from "./types"

const TO_HAVE_SCREENSHOT_RE = /toHaveScreenshot\s*\(/
const SNAPSHOT_DIR_RE = /-snapshots[\\/]/
const SPEC_FILE_RE = /\.spec\.[tj]sx?$/i

export const visualRegression: Gate = {
	id: "proof.visual-regression",
	name: "Visual regression baseline present",
	description: "At least one Playwright spec uses expect(page).toHaveScreenshot().",
	category: "proof",
	severity: "warn",
	docTypes: "*",
	async validate(_doc: string, refs?: unknown): Promise<GateIssue[] | null> {
		const { files, fileContents } = asPlaywrightRefs(refs)
		// Direct baseline detection (fastest path).
		if (files && files.some((f) => SNAPSHOT_DIR_RE.test(f))) return null
		// Fall back to scanning spec contents for the matcher call.
		if (fileContents) {
			for (const [path, body] of Object.entries(fileContents)) {
				if (SPEC_FILE_RE.test(path) && TO_HAVE_SCREENSHOT_RE.test(body)) {
					return null
				}
			}
		}
		return [
			{
				severity: "warn",
				message: "No visual-regression baseline detected (no toHaveScreenshot() call or *-snapshots/ dir).",
				suggestion:
					"Add `await expect(page).toHaveScreenshot('home.png')` to a Playwright spec, then run `npx playwright test --update-snapshots`.",
			},
		]
	},
}

export default visualRegression
