/**
 * compliance.ssdf-attestation-fresh — the `lastReviewed` field in the SSDF
 * attestation's YAML front-matter must be within the last N days.
 *
 * Default window = 90 days (per the anchor doc). Configurable per-project
 * under `compliance.ssdf-attestation-fresh.windowDays` (positive integer).
 *
 * Reference: https://csrc.nist.gov/publications/detail/sp/800-218/final
 */

import type { Gate, GateIssue } from "../../../RubricCritic"

export const DEFAULT_FRESH_WINDOW_DAYS = 90

interface FreshRefs {
	now?: Date
	config?: {
		"compliance.ssdf-attestation-fresh"?: {
			windowDays?: number
		}
	}
}

const FRONT_MATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---/
const LAST_REVIEWED_RE = /^lastReviewed:\s*(.+?)\s*$/m

export function extractLastReviewed(doc: string): string | null {
	const fm = FRONT_MATTER_RE.exec(doc)
	if (!fm) return null
	const m = LAST_REVIEWED_RE.exec(fm[1] ?? "")
	if (!m) return null
	let raw = (m[1] ?? "").trim()
	// Strip surrounding quotes if present
	if (
		(raw.startsWith('"') && raw.endsWith('"')) ||
		(raw.startsWith("'") && raw.endsWith("'"))
	) {
		raw = raw.slice(1, -1).trim()
	}
	return raw
}

function parseDateUtc(raw: string): Date | null {
	// Accept YYYY-MM-DD or full ISO. Reject placeholder comments.
	if (raw.startsWith("<!--")) return null
	const isoOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw)
	if (isoOnly) {
		const y = Number(isoOnly[1])
		const m = Number(isoOnly[2])
		const d = Number(isoOnly[3])
		const dt = new Date(Date.UTC(y, m - 1, d))
		if (Number.isNaN(dt.getTime())) return null
		return dt
	}
	const dt = new Date(raw)
	return Number.isNaN(dt.getTime()) ? null : dt
}

export const ssdfAttestationFresh: Gate = {
	id: "compliance.ssdf-attestation-fresh",
	name: "NIST SSDF attestation freshness",
	description:
		"`lastReviewed` in front-matter must be within the configured window (default 90 days). Source: NIST SP 800-218 v1.1.",
	category: "compliance",
	severity: "warn",
	docTypes: ["ssdf-attestation"],
	async validate(doc: string, refs?: unknown): Promise<GateIssue[] | null> {
		const r = refs as FreshRefs | undefined
		const cfg = r?.config?.["compliance.ssdf-attestation-fresh"]
		const rawWindow = cfg?.windowDays
		const windowDays =
			typeof rawWindow === "number" && Number.isFinite(rawWindow) && rawWindow > 0
				? Math.floor(rawWindow)
				: DEFAULT_FRESH_WINDOW_DAYS
		const now = r?.now ?? new Date()

		const raw = extractLastReviewed(doc)
		if (!raw) {
			return [
				{
					severity: "warn",
					message: "Missing `lastReviewed` in front-matter.",
					suggestion: "Add `lastReviewed: YYYY-MM-DD` to the YAML front-matter.",
				},
			]
		}
		const reviewed = parseDateUtc(raw)
		if (!reviewed) {
			return [
				{
					severity: "warn",
					message: `Could not parse \`lastReviewed: ${raw}\` as a date.`,
					suggestion: "Use ISO 8601 (YYYY-MM-DD).",
				},
			]
		}
		const ageMs = now.getTime() - reviewed.getTime()
		const ageDays = Math.floor(ageMs / (1000 * 60 * 60 * 24))
		if (ageDays > windowDays) {
			return [
				{
					severity: "warn",
					message: `SSDF attestation is ${ageDays} days old; freshness window is ${windowDays} days.`,
					suggestion:
						"Re-review the attestation, update each practice's status/evidence, then bump `lastReviewed`.",
				},
			]
		}
		return null
	},
}

export default ssdfAttestationFresh
