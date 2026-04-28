/**
 * Anchor 3 (Playwright/Cypress trace evidence) — gate registry.
 *
 * These gates are NOT auto-registered with the global RubricCritic — they
 * require workspace context (`refs.files` + `refs.fileContents`) that
 * Truth/Proof gates do not. The StudioController wires them up explicitly
 * when the host has a workspace handle.
 */

import e2eCoverage from "./e2e-coverage"
import e2eEvidence from "./e2e-evidence"
import visualRegression from "./visual-regression"
import userAcceptanceSigned from "./user-acceptance-signed"

import type { Gate } from "../../../RubricCritic"

export { e2eCoverage, e2eEvidence, visualRegression, userAcceptanceSigned }

export const PLAYWRIGHT_ANCHOR_GATES: Gate[] = [
	e2eCoverage,
	e2eEvidence,
	visualRegression,
	userAcceptanceSigned,
]

export type { PlaywrightRefs, SignOffRecord } from "./types"
