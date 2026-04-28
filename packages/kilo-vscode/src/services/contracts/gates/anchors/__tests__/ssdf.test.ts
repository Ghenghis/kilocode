/**
 * Tests for the NIST SSDF (SP 800-218 v1.1) anchor gates.
 *
 * Covers:
 *  1. compliance.ssdf-coverage at the 80% boundary (default threshold)
 *  2. compliance.ssdf-attestation-fresh at the 90-day boundary
 *  3. compliance.ssdf-evidence-paths-resolve with a virtual exists() probe
 *  4. kilocode-ssdf-defaults.json is well-formed and covers every canonical
 *     SSDF v1.1 practice ID we ship.
 */

import { describe, expect, it } from "bun:test"
import * as fs from "fs"
import * as path from "path"

import ssdfCoverage from "../ssdf/ssdf-coverage"
import ssdfAttestationFresh from "../ssdf/ssdf-attestation-fresh"
import ssdfEvidencePathsResolve from "../ssdf/ssdf-evidence-paths-resolve"

// Canonical SSDF v1.1 practice IDs. PW.3 is retained as a placeholder
// (folded into PW.4 in v1.1) so we count 19 active practices for coverage
// math.
const CANONICAL_PRACTICES = [
	"PO.1", "PO.2", "PO.3", "PO.4", "PO.5",
	"PS.1", "PS.2", "PS.3",
	"PW.1", "PW.2", "PW.4", "PW.5", "PW.6", "PW.7", "PW.8", "PW.9",
	"RV.1", "RV.2", "RV.3",
] as const

function buildAttestation(statuses: Record<string, string>, opts?: { lastReviewed?: string; evidence?: Record<string, string[]> }): string {
	const lr = opts?.lastReviewed ?? "2024-01-01"
	const ev = opts?.evidence ?? {}
	const blocks = CANONICAL_PRACTICES.map((id) => {
		const status = statuses[id] ?? "tbd"
		const evLine = (ev[id] ?? []).join(", ") || "<!-- ai-fill: paths to artifacts -->"
		return [
			`### ${id} — Title`,
			"",
			"Description text.",
			"",
			`- **Status:** ${status}`,
			`- **Evidence:** ${evLine}`,
			"- **Compensating Control:**",
			"- **Notes:**",
			"",
		].join("\n")
	}).join("\n")
	return [
		"---",
		"templateId: ssdf-attestation",
		"version: 1.0.0",
		'nistSsdfVersion: "1.1"',
		`lastReviewed: ${lr}`,
		"---",
		"",
		blocks,
	].join("\n")
}

describe("compliance.ssdf-coverage (80% boundary)", () => {
	it("passes when exactly 80% of practices have a non-tbd status", async () => {
		// 19 practices => need 16 non-tbd to clear 16/19 = 0.842 >= 0.80
		const statuses: Record<string, string> = {}
		for (let i = 0; i < 16; i++) statuses[CANONICAL_PRACTICES[i]!] = "implemented"
		// remaining 3 default to tbd
		const doc = buildAttestation(statuses)
		const issues = await ssdfCoverage.validate(doc)
		expect(issues).toBeNull()
	})

	it("fails when below 80% coverage (default threshold)", async () => {
		const statuses: Record<string, string> = {}
		// only 10 of 19 implemented => 52.6%
		for (let i = 0; i < 10; i++) statuses[CANONICAL_PRACTICES[i]!] = "implemented"
		const doc = buildAttestation(statuses)
		const issues = await ssdfCoverage.validate(doc)
		expect(issues).not.toBeNull()
		expect(issues!.length).toBe(1)
		expect(issues![0]!.message).toMatch(/SSDF coverage is/)
	})

	it("respects a configurable threshold via refs.config", async () => {
		// Mark just 1 of 19 implemented, and lower threshold to 5%.
		const statuses: Record<string, string> = { "PO.1": "implemented" }
		const doc = buildAttestation(statuses)
		const issues = await ssdfCoverage.validate(doc, {
			config: { "compliance.ssdf-coverage": { threshold: 0.05 } },
		})
		expect(issues).toBeNull()
	})
})

describe("compliance.ssdf-attestation-fresh", () => {
	const allImplemented: Record<string, string> = Object.fromEntries(
		CANONICAL_PRACTICES.map((id) => [id, "implemented"]),
	)

	it("passes when lastReviewed is within 90 days", async () => {
		const now = new Date("2024-04-01T00:00:00Z")
		const doc = buildAttestation(allImplemented, { lastReviewed: "2024-03-15" })
		const issues = await ssdfAttestationFresh.validate(doc, { now })
		expect(issues).toBeNull()
	})

	it("fails when lastReviewed is older than 90 days (default)", async () => {
		const now = new Date("2024-06-01T00:00:00Z")
		const doc = buildAttestation(allImplemented, { lastReviewed: "2024-01-01" })
		const issues = await ssdfAttestationFresh.validate(doc, { now })
		expect(issues).not.toBeNull()
		expect(issues![0]!.message).toMatch(/days old/)
	})

	it("respects a configurable windowDays", async () => {
		const now = new Date("2024-06-01T00:00:00Z")
		const doc = buildAttestation(allImplemented, { lastReviewed: "2024-01-01" })
		const issues = await ssdfAttestationFresh.validate(doc, {
			now,
			config: { "compliance.ssdf-attestation-fresh": { windowDays: 365 } },
		})
		expect(issues).toBeNull()
	})

	it("flags missing or unparseable lastReviewed", async () => {
		const doc = buildAttestation(allImplemented, { lastReviewed: "not-a-date" })
		const issues = await ssdfAttestationFresh.validate(doc, { now: new Date() })
		expect(issues).not.toBeNull()
	})
})

describe("compliance.ssdf-evidence-paths-resolve", () => {
	it("passes when every implemented practice's evidence path exists", async () => {
		const statuses: Record<string, string> = { "PO.3": "implemented" }
		const evidence = { "PO.3": [".github/workflows/ci.yml"] }
		const doc = buildAttestation(statuses, { evidence })
		const issues = await ssdfEvidencePathsResolve.validate(doc, {
			workspaceRoot: "/repo",
			exists: (p: string) => p === path.join("/repo", ".github/workflows/ci.yml"),
		})
		expect(issues).toBeNull()
	})

	it("flags an implemented practice whose evidence path does not exist", async () => {
		const statuses: Record<string, string> = { "PO.3": "implemented" }
		const evidence = { "PO.3": [".github/workflows/missing.yml"] }
		const doc = buildAttestation(statuses, { evidence })
		const issues = await ssdfEvidencePathsResolve.validate(doc, {
			workspaceRoot: "/repo",
			exists: (_p: string) => false,
		})
		expect(issues).not.toBeNull()
		expect(issues![0]!.severity).toBe("error")
		expect(issues![0]!.message).toMatch(/PO\.3/)
	})

	it("flags an implemented practice with no evidence paths at all", async () => {
		const statuses: Record<string, string> = { "PW.1": "implemented" }
		// evidence omitted -> defaults to <!-- ai-fill --> placeholder, which tokenizes to nothing
		const doc = buildAttestation(statuses)
		const issues = await ssdfEvidencePathsResolve.validate(doc, {
			workspaceRoot: "/repo",
			exists: () => true,
		})
		expect(issues).not.toBeNull()
		expect(issues!.some((i) => /no evidence paths/.test(i.message))).toBe(true)
	})

	it("ignores tbd / n/a practices", async () => {
		const statuses: Record<string, string> = { "PO.1": "tbd", "PO.2": "n/a" }
		const evidence = { "PO.1": [".github/missing.yml"] }
		const doc = buildAttestation(statuses, { evidence })
		const issues = await ssdfEvidencePathsResolve.validate(doc, {
			workspaceRoot: "/repo",
			exists: () => false,
		})
		expect(issues).toBeNull()
	})
})

describe("kilocode-ssdf-defaults.json", () => {
	it("is well-formed JSON and maps every shipped SSDF practice id", () => {
		// Path resolves from this test file up through src/services/contracts/gates/anchors/__tests__
		// to the package root, then into assets/contract-kit-anchors/compliance.
		const here = __dirname
		const pkgRoot = path.resolve(here, "..", "..", "..", "..", "..", "..")
		const jsonPath = path.join(
			pkgRoot,
			"assets",
			"contract-kit-anchors",
			"compliance",
			"kilocode-ssdf-defaults.json",
		)
		const raw = fs.readFileSync(jsonPath, "utf8")
		const parsed = JSON.parse(raw) as {
			templateId: string
			nistSsdfVersion: string
			mappings: Array<{ practice: string; title: string; evidence: string[]; rationale: string }>
		}
		expect(parsed.templateId).toBe("kilocode-ssdf-defaults")
		expect(parsed.nistSsdfVersion).toBe("1.1")
		expect(Array.isArray(parsed.mappings)).toBe(true)
		const mapped = new Set(parsed.mappings.map((m) => m.practice))
		// Every canonical practice (excluding the retired PW.3 placeholder) is mapped.
		for (const id of CANONICAL_PRACTICES) {
			expect(mapped.has(id)).toBe(true)
		}
		// Every entry has a non-empty evidence list.
		for (const m of parsed.mappings) {
			expect(m.evidence.length).toBeGreaterThan(0)
			expect(typeof m.title).toBe("string")
			expect(typeof m.rationale).toBe("string")
		}
	})
})
