/**
 * style-readability — Flesch-Kincaid Reading Ease.
 *   206.835 - 1.015*(words/sentences) - 84.6*(syllables/words)
 * Higher = easier. Tech docs aiming for "fairly easy to read" should
 * target ≥ 50; below 30 we emit a warn ("very difficult").
 *
 * Scoring is informational — never fail the doc for prose density.
 */

import type { Gate, GateIssue } from "../RubricCritic"

function stripMarkdown(doc: string): string {
	return doc
		.replace(/```[\s\S]*?```/g, "")
		.replace(/`[^`]*`/g, "")
		.replace(/!\[[^\]]*\]\([^)]+\)/g, "")
		.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
		.replace(/^#{1,6}\s+/gm, "")
		.replace(/[*_~>|#-]/g, " ")
}

function syllables(word: string): number {
	const w = word.toLowerCase().replace(/[^a-z]/g, "")
	if (w.length <= 3) return 1
	const cleaned = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, "").replace(/^y/, "")
	const groups = cleaned.match(/[aeiouy]+/g)
	return Math.max(1, groups ? groups.length : 1)
}

export const styleReadability: Gate = {
	id: "style-readability",
	name: "Flesch-Kincaid readability",
	description: "Warn when the doc's Flesch-Kincaid Reading Ease is below 30 (very difficult).",
	category: "style",
	severity: "info",
	docTypes: "*",
	async validate(doc: string): Promise<GateIssue[] | null> {
		const text = stripMarkdown(doc).trim()
		if (text.length < 200) return null // too short to score meaningfully
		const sentences = (text.match(/[.!?]+\s+/g) ?? []).length || 1
		const words = text.split(/\s+/).filter((w) => /[a-z]/i.test(w))
		const wordCount = words.length || 1
		const totalSyll = words.reduce((s, w) => s + syllables(w), 0)
		const score =
			206.835 - 1.015 * (wordCount / sentences) - 84.6 * (totalSyll / wordCount)
		const rounded = Math.round(score * 10) / 10
		if (rounded >= 30) return null
		return [
			{
				severity: "warn",
				message: `Readability score is ${rounded} (below 30 → very difficult).`,
				suggestion: "Shorten sentences, replace multi-syllable words, break dense paragraphs.",
			},
		]
	},
}

export default styleReadability
