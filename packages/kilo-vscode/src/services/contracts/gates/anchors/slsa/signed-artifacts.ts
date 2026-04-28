/**
 * compliance.signed-artifacts — Anchor 6 gate.
 *
 * Verifies that the project is wired for cosign signing. Pass criteria
 * (either is sufficient):
 *
 *   1. A `cosign.pub` (or `*.cosign.pub`) file is committed at the repo
 *      root or under `.github/`, OR
 *   2. A release workflow YAML references cosign keyless OIDC signing
 *      (sigstore/cosign-installer + a `cosign sign` invocation).
 *
 * Reference: https://docs.sigstore.dev/cosign/overview/
 */
import type { Gate, GateIssue } from "../../../RubricCritic"

/** Refs payload accepted by this gate. */
export interface SignedArtifactsRefs {
	/** Map of repo file paths → contents (only release/cosign-relevant files needed). */
	files?: Record<string, string>
	/** Pre-filtered map of release workflow YAMLs (path → content). */
	workflows?: Record<string, string>
}

const COSIGN_PUB_RE = /(^|\/)cosign(?:\.[^/]+)?\.pub$/i
const COSIGN_INSTALLER_RE = /\buses:\s*['"]?sigstore\/cosign-installer/i
const COSIGN_SIGN_RE = /\bcosign\s+sign(?:-blob)?\b/i
const KEYLESS_OIDC_RE = /(COSIGN_EXPERIMENTAL|--yes\b|id-token:\s*write)/i

/** True if `content` evidences cosign keyless signing in a workflow YAML. */
export function workflowSignsWithCosign(content: string): boolean {
	if (!COSIGN_INSTALLER_RE.test(content)) return false
	if (!COSIGN_SIGN_RE.test(content)) return false
	// The keyless flow needs either id-token: write or --yes/COSIGN_EXPERIMENTAL.
	return KEYLESS_OIDC_RE.test(content)
}

export const signedArtifacts: Gate = {
	id: "compliance.signed-artifacts",
	name: "Release artifacts are cosign-signed",
	description:
		"Project must ship cosign signing — either a committed cosign.pub key or a " +
		"keyless-OIDC sign step in a release workflow.",
	category: "compliance",
	severity: "error",
	docTypes: "*",
	async validate(_doc: string, refs?: unknown): Promise<GateIssue[] | null> {
		const r = (refs as SignedArtifactsRefs | undefined) ?? {}
		const files = r.files ?? {}
		const workflows = r.workflows ?? {}

		// Path 1 — committed public key.
		for (const path of Object.keys(files)) {
			if (COSIGN_PUB_RE.test(path)) return null
		}

		// Path 2 — workflow signs keylessly via OIDC.
		for (const content of Object.values(workflows)) {
			if (workflowSignsWithCosign(content)) return null
		}
		// Also scan generic files in case the workflow wasn't pre-filtered.
		for (const [path, content] of Object.entries(files)) {
			if (!/\.ya?ml$/i.test(path)) continue
			if (workflowSignsWithCosign(content)) return null
		}

		return [
			{
				severity: "error",
				message: "No cosign signing configuration found.",
				suggestion:
					"Either commit a cosign.pub file or add `sigstore/cosign-installer` " +
					"+ a `cosign sign` step with `id-token: write` permissions in your release workflow.",
			},
		]
	},
}

export default signedArtifacts
