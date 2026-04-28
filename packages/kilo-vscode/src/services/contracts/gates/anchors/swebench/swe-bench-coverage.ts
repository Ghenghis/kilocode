/**
 * proof.swe-bench-coverage — every user story declared in the PRD must
 * have at least one corresponding `verification/cases/*.case.yaml` whose
 * `mapsTo.storyId` matches the story id (e.g. "1.1", "2.3").
 *
 * User-story syntax recognised:
 *   • Markdown heading "#### Story 1.1 — P0 — title"
 *   • Heading "## Story 2.3"
 *   • Inline reference "Story 1.1" inside a list item
 *
 * The case files are read from `<projectRoot>/verification/cases/*.case.yaml`.
 * Project root is supplied via the `refs` argument: `{ projectRoot: string }`.
 * If `refs` is missing or no `verification/cases` directory exists the gate
 * still runs but every story is reported uncovered (which is correct: a
 * scaffold without verification cases has 0% coverage).
 */

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs"
import { join } from "node:path"

import type { Gate, GateIssue } from "../../../RubricCritic"

const STORY_HEADING_RE = /^#{1,6}\s+Story\s+(\d+(?:\.\d+)+)\b/gim
const STORY_INLINE_RE = /\bStory\s+(\d+(?:\.\d+)+)\b/g
const MAPS_TO_STORY_RE = /mapsTo\s*:\s*[\s\S]*?storyId\s*:\s*["']?([0-9.]+)["']?/i

interface Refs {
	projectRoot?: string
}

function findLine(doc: string, idx: number): number {
	return doc.slice(0, idx).split("\n").length
}

function listCaseFiles(dir: string): string[] {
	if (!existsSync(dir)) return []
	const out: string[] = []
	for (const entry of readdirSync(dir)) {
		const p = join(dir, entry)
		try {
			const st = statSync(p)
			if (st.isDirectory()) out.push(...listCaseFiles(p))
			else if (/\.case\.ya?ml$/i.test(entry)) out.push(p)
		} catch {
			/* skip unreadable entries */
		}
	}
	return out
}

function collectCoveredStoryIds(projectRoot: string): Set<string> {
	const dir = join(projectRoot, "verification", "cases")
	const covered = new Set<string>()
	for (const f of listCaseFiles(dir)) {
		try {
			const text = readFileSync(f, "utf-8")
			const m = MAPS_TO_STORY_RE.exec(text)
			if (m && m[1]) covered.add(m[1])
		} catch {
			/* ignore */
		}
	}
	return covered
}

function collectStoryIds(doc: string): { id: string; line: number }[] {
	const found = new Map<string, number>()
	let m: RegExpExecArray | null
	STORY_HEADING_RE.lastIndex = 0
	while ((m = STORY_HEADING_RE.exec(doc)) !== null) {
		const id = m[1]
		if (id && !found.has(id)) found.set(id, findLine(doc, m.index))
	}
	if (found.size === 0) {
		// Fall back to inline references — table cells, list items, etc.
		STORY_INLINE_RE.lastIndex = 0
		while ((m = STORY_INLINE_RE.exec(doc)) !== null) {
			const id = m[1]
			if (id && !found.has(id)) found.set(id, findLine(doc, m.index))
		}
	}
	return Array.from(found.entries()).map(([id, line]) => ({ id, line }))
}

export const sweBenchCoverage: Gate = {
	id: "proof-swe-bench-coverage",
	name: "Every user story has an executable verification case",
	description:
		"Anchor 2: each PRD story (Story 1.1, 1.2, …) must map to at least one verification/cases/*.case.yaml entry via mapsTo.storyId.",
	category: "proof",
	severity: "error",
	docTypes: "*",
	async validate(doc: string, refs?: unknown): Promise<GateIssue[] | null> {
		const stories = collectStoryIds(doc)
		if (stories.length === 0) return null
		const projectRoot = (refs as Refs | undefined)?.projectRoot
		const covered = projectRoot ? collectCoveredStoryIds(projectRoot) : new Set<string>()
		const issues: GateIssue[] = []
		for (const s of stories) {
			if (!covered.has(s.id)) {
				issues.push({
					line: s.line,
					severity: "error",
					message: `Story ${s.id} has no verification case (no .case.yaml with mapsTo.storyId="${s.id}").`,
					suggestion: `Add verification/cases/story-${s.id.replace(/\./g, "-")}.case.yaml mapping to storyId "${s.id}".`,
				})
			}
		}
		return issues.length ? issues : null
	},
}

export default sweBenchCoverage
