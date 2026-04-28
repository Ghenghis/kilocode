/**
 * compliance.in-toto-attestation — Anchor 6 gate.
 *
 * Validates that a SLSA provenance JSON document conforms to the
 * in-toto Attestation Framework v1.0 Statement layer with a SLSA v1.0
 * predicate.
 *
 *   _type           === "https://in-toto.io/Statement/v1"
 *   predicateType   === "https://slsa.dev/provenance/v1"
 *   subject         non-empty array; every element has digest.sha256
 *                   matching /^[0-9a-f]{64}$/i
 *
 * References:
 *   https://github.com/in-toto/attestation/tree/main/spec
 *   https://slsa.dev/spec/v1.0/provenance
 */
import type { Gate, GateIssue } from "../../../RubricCritic"

export const IN_TOTO_STATEMENT_V1 = "https://in-toto.io/Statement/v1"
export const SLSA_PROVENANCE_V1 = "https://slsa.dev/provenance/v1"
const SHA256_RE = /^[0-9a-f]{64}$/i

export interface InTotoSubject {
	name?: string
	digest: { sha256?: string; [k: string]: string | undefined }
}

export interface InTotoStatementV1 {
	_type: string
	subject: InTotoSubject[]
	predicateType: string
	predicate: unknown
}

export interface InTotoValidationResult {
	ok: boolean
	errors: string[]
	parsed?: InTotoStatementV1
}

/**
 * Parse + validate raw provenance text. Accepts a single JSON document or
 * a JSONL file (the slsa-github-generator default emits JSONL with one
 * statement per line).
 */
export function validateInTotoAttestation(raw: string): InTotoValidationResult {
	const errors: string[] = []
	const trimmed = raw.trim()
	if (!trimmed) {
		return { ok: false, errors: ["empty document"] }
	}

	let candidate: unknown
	try {
		candidate = JSON.parse(trimmed)
	} catch {
		// Try JSONL — first non-empty line.
		const firstLine = trimmed.split(/\r?\n/).find((l) => l.trim().length > 0)
		if (!firstLine) return { ok: false, errors: ["empty document"] }
		try {
			candidate = JSON.parse(firstLine)
		} catch (e) {
			return { ok: false, errors: [`not valid JSON: ${(e as Error).message}`] }
		}
	}

	if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
		return { ok: false, errors: ["root must be a JSON object"] }
	}

	const obj = candidate as Record<string, unknown>

	if (obj._type !== IN_TOTO_STATEMENT_V1) {
		errors.push(`_type must be "${IN_TOTO_STATEMENT_V1}" (got ${JSON.stringify(obj._type)})`)
	}
	if (obj.predicateType !== SLSA_PROVENANCE_V1) {
		errors.push(`predicateType must be "${SLSA_PROVENANCE_V1}" (got ${JSON.stringify(obj.predicateType)})`)
	}
	if (!("predicate" in obj) || obj.predicate === null) {
		errors.push("predicate is required")
	}

	if (!Array.isArray(obj.subject) || obj.subject.length === 0) {
		errors.push("subject must be a non-empty array")
	} else {
		obj.subject.forEach((s, i) => {
			if (!s || typeof s !== "object" || Array.isArray(s)) {
				errors.push(`subject[${i}] must be an object`)
				return
			}
			const digest = (s as { digest?: unknown }).digest
			if (!digest || typeof digest !== "object" || Array.isArray(digest)) {
				errors.push(`subject[${i}].digest must be an object`)
				return
			}
			const sha256 = (digest as { sha256?: unknown }).sha256
			if (typeof sha256 !== "string" || !SHA256_RE.test(sha256)) {
				errors.push(`subject[${i}].digest.sha256 must be a 64-char hex string`)
			}
		})
	}

	if (errors.length > 0) {
		return { ok: false, errors }
	}
	return { ok: true, errors: [], parsed: obj as unknown as InTotoStatementV1 }
}

export interface InTotoAttestationRefs {
	/** Path → file content for the provenance file under test. */
	provenance?: { path: string; content: string }
}

export const inTotoAttestation: Gate = {
	id: "compliance.in-toto-attestation",
	name: "Provenance follows in-toto attestation v1.0",
	description:
		"SLSA provenance must be a valid in-toto v1.0 Statement with a " +
		"SLSA v1.0 predicate and a sha256 subject digest.",
	category: "compliance",
	severity: "error",
	docTypes: "*",
	async validate(_doc: string, refs?: unknown): Promise<GateIssue[] | null> {
		const provenance = (refs as InTotoAttestationRefs | undefined)?.provenance
		if (!provenance) {
			return [
				{
					severity: "error",
					message: "No provenance file provided to validator.",
					suggestion:
						"Pass `{ provenance: { path, content } }` as the second arg, " +
						"e.g. the contents of `provenance.intoto.jsonl` from your release.",
				},
			]
		}
		const result = validateInTotoAttestation(provenance.content)
		if (result.ok) return null
		return result.errors.map((message) => ({
			severity: "error" as const,
			message,
			suggestion: `See the in-toto v1.0 spec: https://github.com/in-toto/attestation/tree/main/spec`,
		}))
	},
}

export default inTotoAttestation
