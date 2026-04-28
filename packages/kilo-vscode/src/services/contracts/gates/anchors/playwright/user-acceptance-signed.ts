/**
 * proof.user-acceptance-signed — for every acceptance criterion declared
 * in the doc (typically as `AC-001`, `AC-002`, …), there must be a
 * `verification/sign-offs/{criterionId}.json` file with shape:
 *   { approvedBy: string, approvedAt: string, traceUrl: string }
 *
 * Anchor 3 (Playwright/Cypress trace evidence). Non-coder sign-off is
 * recorded after the user has watched the linked trace.
 */

import type { Gate, GateIssue } from "../../../RubricCritic"
import { asPlaywrightRefs, type SignOffRecord } from "./types"

const CRITERION_ID_RE = /\bAC-\d{2,4}\b/g

function isValidSignOff(value: unknown): value is SignOffRecord {
	if (!value || typeof value !== "object") return false
	const v = value as Record<string, unknown>
	return (
		typeof v.approvedBy === "string" &&
		v.approvedBy.length > 0 &&
		typeof v.approvedAt === "string" &&
		v.approvedAt.length > 0 &&
		typeof v.traceUrl === "string" &&
		v.traceUrl.length > 0
	)
}

function tryParseSignOff(body: string | undefined): SignOffRecord | undefined {
	if (!body) return undefined
	try {
		const parsed = JSON.parse(body)
		return isValidSignOff(parsed) ? parsed : undefined
	} catch {
		return undefined
	}
}

function lookupSignOff(
	criterionId: string,
	refs: ReturnType<typeof asPlaywrightRefs>,
): SignOffRecord | undefined {
	if (refs.signOffs && criterionId in refs.signOffs) {
		const record = refs.signOffs[criterionId]
		return record && isValidSignOff(record) ? record : undefined
	}
	const expectedPath = `verification/sign-offs/${criterionId}.json`
	if (refs.fileContents) {
		// match either the canonical path or any path ending with it
		for (const [p, body] of Object.entries(refs.fileContents)) {
			if (p === expectedPath || p.endsWith(`/${expectedPath}`) || p.endsWith(`\\${criterionId}.json`)) {
				return tryParseSignOff(body)
			}
		}
	}
	return undefined
}

export const userAcceptanceSigned: Gate = {
	id: "proof.user-acceptance-signed",
	name: "Acceptance criteria are signed off",
	description:
		"Every AC-### in the doc has a verification/sign-offs/AC-###.json with approvedBy/approvedAt/traceUrl.",
	category: "proof",
	severity: "error",
	docTypes: "*",
	async validate(doc: string, refs?: unknown): Promise<GateIssue[] | null> {
		const ids = Array.from(new Set(doc.match(CRITERION_ID_RE) ?? []))
		if (ids.length === 0) return null // no criteria to sign — out of scope
		const playRefs = asPlaywrightRefs(refs)
		const issues: GateIssue[] = []
		for (const id of ids) {
			const record = lookupSignOff(id, playRefs)
			if (!record) {
				issues.push({
					severity: "error",
					message: `Acceptance criterion ${id} is not signed off.`,
					suggestion: `Watch the trace, then write verification/sign-offs/${id}.json with { approvedBy, approvedAt, traceUrl }.`,
				})
			}
		}
		return issues.length ? issues : null
	},
}

export default userAcceptanceSigned
