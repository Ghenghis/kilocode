/**
 * proof.e2e-coverage — every user-facing flow described in the PRD's
 * "User Stories" section must have at least one Playwright `*.spec.ts` or
 * Cypress `*.cy.ts` file referencing the same noun (case-insensitive).
 *
 * Anchor 3 (Playwright/Cypress trace evidence). Cross-references the PRD's
 * User Stories section: each story title becomes a flow keyword the gate
 * looks for in spec filenames.
 */

import type { Gate, GateIssue } from "../../../RubricCritic"
import { asPlaywrightRefs } from "./types"

const USER_STORIES_HEADING_RE =
	/^#{1,6}\s+(?:User\s+Stories|User\s+Flows|Flows|Stories)\b[^\n]*$/im
const STORY_BULLET_RE = /^\s*[-*]\s+(?:\*\*([^*]+)\*\*|([^:\n]+?):)/gm
const SPEC_FILE_RE = /\.(spec|cy)\.[tj]sx?$/i

function extractStoryKeywords(doc: string): string[] {
	const headingMatch = USER_STORIES_HEADING_RE.exec(doc)
	if (!headingMatch) return []
	const start = headingMatch.index + headingMatch[0].length
	// Section ends at the next heading of equal-or-higher level, or EOF.
	const rest = doc.slice(start)
	const nextHeading = /^#{1,6}\s+/m.exec(rest)
	const section = nextHeading ? rest.slice(0, nextHeading.index) : rest
	const keywords = new Set<string>()
	let m: RegExpExecArray | null
	STORY_BULLET_RE.lastIndex = 0
	while ((m = STORY_BULLET_RE.exec(section)) !== null) {
		const raw = (m[1] ?? m[2] ?? "").trim()
		if (!raw) continue
		// First 1-3 words form a noun handle ("login flow", "checkout").
		const slug = raw
			.toLowerCase()
			.replace(/[^\w\s-]/g, "")
			.split(/\s+/)
			.slice(0, 3)
			.filter(Boolean)
			.join("-")
		if (slug.length >= 3) keywords.add(slug)
	}
	return Array.from(keywords)
}

function specsForKeyword(files: string[], keyword: string): string[] {
	return files.filter(
		(f) => SPEC_FILE_RE.test(f) && f.toLowerCase().includes(keyword.split("-")[0]!),
	)
}

export const e2eCoverage: Gate = {
	id: "proof.e2e-coverage",
	name: "Every user flow has an E2E spec",
	description:
		"Every story in the PRD's User Stories section needs at least one *.spec.ts or *.cy.ts.",
	category: "proof",
	severity: "warn",
	docTypes: "*",
	async validate(doc: string, refs?: unknown): Promise<GateIssue[] | null> {
		const keywords = extractStoryKeywords(doc)
		if (keywords.length === 0) return null // no stories declared — out of scope
		const { files } = asPlaywrightRefs(refs)
		if (!files || files.length === 0) {
			return [
				{
					severity: "warn",
					message:
						"Cannot verify E2E coverage: no file list supplied to the gate. Pass `refs.files`.",
					suggestion: "Run the gate from the StudioController which injects the workspace listing.",
				},
			]
		}
		const issues: GateIssue[] = []
		for (const keyword of keywords) {
			const matches = specsForKeyword(files, keyword)
			if (matches.length === 0) {
				issues.push({
					severity: "warn",
					message: `User flow "${keyword}" has no matching E2E spec (*.spec.ts or *.cy.ts).`,
					suggestion: `Add e.g. verification/e2e/${keyword}.spec.ts (Playwright) or ${keyword}.cy.ts (Cypress).`,
				})
			}
		}
		return issues.length ? issues : null
	},
}

export default e2eCoverage
