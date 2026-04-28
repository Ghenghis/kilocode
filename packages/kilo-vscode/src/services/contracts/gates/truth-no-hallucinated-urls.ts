/**
 * truth-no-hallucinated-urls — every URL in the markdown is HEAD-checked
 * with a 5s timeout. Unreachable URLs are reported as `warn` (not `error`)
 * because transient network issues should not fail the doc.
 *
 * Recognises bare URLs, autolinks `<https://…>`, and markdown links
 * `[text](https://…)`. Skips fragments, mailto:, and ` ```code blocks ` so
 * code samples that mention non-existent URLs do not poison the score.
 */

import type { Gate, GateIssue } from "../RubricCritic"

const URL_RE = /\bhttps?:\/\/[^\s<>"`)\]]+/gi
const HEAD_TIMEOUT_MS = 5000
const MAX_URLS = 25 // hard cap so a 5000-link doc cannot DoS the gate

type FetchLike = (input: string, init?: { method?: string; signal?: AbortSignal }) => Promise<{ ok: boolean; status: number }>

function stripCodeFences(doc: string): string {
	return doc.replace(/```[\s\S]*?```/g, "").replace(/`[^`]*`/g, "")
}

async function head(fetchImpl: FetchLike, url: string): Promise<{ ok: boolean; status: number; error?: string }> {
	const ctrl = new AbortController()
	const timer = setTimeout(() => ctrl.abort(), HEAD_TIMEOUT_MS)
	try {
		const res = await fetchImpl(url, { method: "HEAD", signal: ctrl.signal })
		return { ok: res.ok, status: res.status }
	} catch (err) {
		return { ok: false, status: 0, error: err instanceof Error ? err.message : String(err) }
	} finally {
		clearTimeout(timer)
	}
}

export const truthNoHallucinatedUrls: Gate = {
	id: "truth-no-hallucinated-urls",
	name: "URLs are reachable",
	description: "HEAD-check every URL in the doc; unreachable ones are flagged.",
	category: "truth",
	severity: "warn",
	docTypes: "*",
	async validate(doc: string): Promise<GateIssue[] | null> {
		const stripped = stripCodeFences(doc)
		const urls = Array.from(new Set(stripped.match(URL_RE) ?? [])).slice(0, MAX_URLS)
		if (urls.length === 0) return null

		const fetchImpl: FetchLike | undefined = (globalThis as { fetch?: FetchLike }).fetch
		if (!fetchImpl) {
			return [{ severity: "info", message: "fetch unavailable; URL reachability not checked" }]
		}
		const results = await Promise.all(urls.map((u) => head(fetchImpl, u)))
		const issues: GateIssue[] = []
		urls.forEach((url, i) => {
			const r = results[i]
			if (!r.ok) {
				issues.push({
					severity: "warn",
					message: `URL unreachable (status ${r.status}): ${url}`,
					suggestion: "Verify the URL or remove the citation.",
				})
			}
		})
		return issues.length ? issues : null
	},
}

export default truthNoHallucinatedUrls
