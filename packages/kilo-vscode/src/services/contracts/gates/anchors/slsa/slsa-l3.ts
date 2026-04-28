/**
 * compliance.slsa-l3 — Anchor 6 gate.
 *
 * Validates that a project ships a SLSA L3 release workflow that uses
 * one of the canonical `slsa-framework/slsa-github-generator` reusable
 * workflows. Pass criteria:
 *
 *   1. At least one file matching `.github/workflows/release*.yml` exists
 *   2. That file's `uses:` line references a SLSA L3 generator workflow
 *      from the allowlist below.
 *
 * Reference: https://slsa.dev/spec/v1.0/, https://github.com/slsa-framework/slsa-github-generator
 */
import type { Gate, GateIssue } from "../../../RubricCritic"

/** Canonical filenames for the SLSA generator reusable workflows. */
export const SLSA_L3_GENERATOR_ALLOWLIST: ReadonlyArray<string> = [
	"slsa-framework/slsa-github-generator/.github/workflows/generator_generic_slsa3.yml",
	"slsa-framework/slsa-github-generator/.github/workflows/generator_go_slsa3.yml",
	"slsa-framework/slsa-github-generator/.github/workflows/generator_nodejs_slsa3.yml",
	"slsa-framework/slsa-github-generator/.github/workflows/generator_container_slsa3.yml",
	"slsa-framework/slsa-github-generator/.github/workflows/builder_go_slsa3.yml",
	"slsa-framework/slsa-github-generator/.github/workflows/builder_docker-based_slsa3.yml",
	"slsa-framework/slsa-github-generator/.github/workflows/builder_maven_slsa3.yml",
]

/** Refs payload the gate accepts at validate-time. */
export interface SlsaL3Refs {
	/** Map of `.github/workflows/release*.yml` file path → file content. */
	workflows?: Record<string, string>
}

function fileMatchesReleaseGlob(name: string): boolean {
	// Accept both forward- and back-slash paths; normalise.
	const norm = name.replace(/\\/g, "/").toLowerCase()
	if (!norm.includes(".github/workflows/")) return false
	const base = norm.slice(norm.lastIndexOf("/") + 1)
	return /^release.*\.ya?ml$/.test(base)
}

/** Returns the canonical generator path if this `uses:` line is in the allowlist. */
export function findGeneratorReference(workflowYaml: string): string | null {
	// Scan every `uses:` directive. We accept both quoted and unquoted forms,
	// case-insensitive on the leading `uses` keyword.
	const re = /^[\t ]*uses:[\t ]*['"]?([^'"\s#]+)['"]?/gim
	let m: RegExpExecArray | null
	while ((m = re.exec(workflowYaml)) !== null) {
		const ref = (m[1] ?? "").trim()
		if (!ref) continue
		// Strip the @<git-ref> suffix to compare the canonical workflow path.
		const at = ref.indexOf("@")
		const path = at === -1 ? ref : ref.slice(0, at)
		if (SLSA_L3_GENERATOR_ALLOWLIST.includes(path)) return path
	}
	return null
}

export const slsaL3: Gate = {
	id: "compliance.slsa-l3",
	name: "Release workflow produces SLSA L3 provenance",
	description:
		"Project must ship a `.github/workflows/release*.yml` that uses the canonical " +
		"slsa-framework/slsa-github-generator reusable workflow (SLSA L3).",
	category: "compliance",
	severity: "error",
	docTypes: "*",
	async validate(_doc: string, refs?: unknown): Promise<GateIssue[] | null> {
		const workflows = (refs as SlsaL3Refs | undefined)?.workflows ?? {}
		const releaseWorkflows = Object.entries(workflows).filter(([name]) => fileMatchesReleaseGlob(name))

		if (releaseWorkflows.length === 0) {
			return [
				{
					severity: "error",
					message: "No `.github/workflows/release*.yml` file found.",
					suggestion:
						"Add a release workflow that uses slsa-framework/slsa-github-generator (see Anchor 6 templates in assets/contract-kit-anchors/slsa/workflows/).",
				},
			]
		}

		for (const [, content] of releaseWorkflows) {
			if (findGeneratorReference(content)) return null
		}

		return [
			{
				severity: "error",
				message:
					"Release workflow exists but does NOT use a SLSA L3 generator from " +
					"slsa-framework/slsa-github-generator.",
				suggestion:
					"Replace your release job with a `uses:` reference to one of: " +
					SLSA_L3_GENERATOR_ALLOWLIST.join(", "),
			},
		]
	},
}

export default slsaL3
