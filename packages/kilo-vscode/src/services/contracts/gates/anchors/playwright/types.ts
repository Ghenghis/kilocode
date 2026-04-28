/**
 * Shared types for Anchor 3 (Playwright/Cypress trace evidence) gates.
 *
 * Gates in this folder accept a `refs` payload that lets the host pass in
 * filesystem snapshots (file lists, file contents). This keeps gates pure
 * and unit-testable — the host (StudioController / extension) handles the
 * actual disk reads.
 */

export interface PlaywrightRefs {
	/**
	 * Absolute or workspace-relative paths of every file in the project, used
	 * to count `*.spec.ts` / `*.cy.ts` and screenshot baselines. Optional —
	 * when missing, gates degrade to "warn: cannot verify".
	 */
	files?: string[]

	/**
	 * Map of `path -> contents` for files the gate may need to inspect
	 * (workflow YAMLs, sign-off JSON). The host pre-loads these so the gate
	 * stays sync-ish + sandboxed.
	 */
	fileContents?: Record<string, string>

	/**
	 * Sign-off records keyed by criterion id. Each value is the parsed JSON
	 * body of `verification/sign-offs/{criterionId}.json`. When omitted,
	 * the gate looks for the sign-off paths in `files`.
	 */
	signOffs?: Record<string, SignOffRecord | undefined>
}

export interface SignOffRecord {
	approvedBy: string
	approvedAt: string
	traceUrl: string
}

export function asPlaywrightRefs(refs: unknown): PlaywrightRefs {
	if (!refs || typeof refs !== "object") return {}
	return refs as PlaywrightRefs
}
