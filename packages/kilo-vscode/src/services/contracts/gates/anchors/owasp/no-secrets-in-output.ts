/**
 * safety.no-secrets-in-output — Anchor 4 gate (LLM02 / LLM06 supporting).
 *
 * Scans the contract markdown body for credential-shaped strings:
 *   - AWS access keys (AKIA / ASIA / etc. + 16 base32-uppercase chars)
 *   - OpenAI keys (`sk-...` and `sk-proj-...`)
 *   - Anthropic keys (`sk-ant-...`)
 *   - GitHub PATs (`ghp_`, `gho_`, `ghs_`, `ghu_`)
 *   - JWT-shaped strings (three base64url segments separated by dots)
 *   - High-entropy base64 strings longer than 40 chars (heuristic, low-precision)
 *
 * Code fences are excluded ONLY when they are tagged as one of the harmless
 * languages we know about (e.g. ``` text ```), but any fenced block tagged
 * with no language or with a real language IS scanned — this is the common
 * place secrets slip in (a `bash` block showing how to set an env var).
 *
 * Severity: error. We refuse to ship contracts that contain live-shaped
 * credentials, even by accident.
 *
 * Note: this duplicates `compliance-no-secrets` for the AI-system register
 * specifically; we keep it separate so the safety/anchor4 gate panel can
 * fail independently of the generic compliance gate.
 *
 * Reference: https://genai.owasp.org/llm-top-10/ (LLM02, LLM06)
 */

import type { Gate, GateIssue } from "../../../RubricCritic"

interface Pattern {
	id: string
	label: string
	re: RegExp
}

const PATTERNS: Pattern[] = [
	{ id: "aws-access-key", label: "AWS access key", re: /\b(AKIA|ASIA|AGPA|AROA|AIPA|ANPA|ANVA)[0-9A-Z]{16}\b/g },
	{ id: "openai-key", label: "OpenAI API key", re: /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/g },
	{ id: "anthropic-key", label: "Anthropic API key", re: /\bsk-ant-(?:api03-)?[A-Za-z0-9_-]{20,}\b/g },
	{ id: "github-pat", label: "GitHub PAT", re: /\bghp_[A-Za-z0-9]{36,}\b/g },
	{ id: "github-oauth", label: "GitHub OAuth token", re: /\bgho_[A-Za-z0-9]{36,}\b/g },
	{ id: "github-app", label: "GitHub app token", re: /\b(?:ghs|ghu)_[A-Za-z0-9]{36,}\b/g },
	{ id: "jwt", label: "JWT", re: /\beyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g },
]

// High-entropy base64 — heuristic, only flagged when not adjacent to a
// known "REDACTED" / "EXAMPLE" / "PLACEHOLDER" token on the same line.
const LONG_BASE64_RE = /\b[A-Za-z0-9+/=]{41,}\b/g
const SAFE_TOKENS_RE = /\b(REDACTED|EXAMPLE|PLACEHOLDER|XXXX|TODO|sample|fixture)\b/i

function findLine(doc: string, idx: number): number {
	return doc.slice(0, idx).split("\n").length
}

function lineFor(doc: string, idx: number): string {
	const lineStart = doc.lastIndexOf("\n", idx - 1) + 1
	const lineEndRaw = doc.indexOf("\n", idx)
	const lineEnd = lineEndRaw === -1 ? doc.length : lineEndRaw
	return doc.slice(lineStart, lineEnd)
}

export const noSecretsInOutput: Gate = {
	id: "safety-no-secrets-in-output",
	name: "No secrets / credentials in contract output",
	description:
		"Contract output must not contain credential-shaped strings (AWS / OpenAI / Anthropic / GitHub / JWT / long base64).",
	category: "compliance",
	severity: "error",
	docTypes: "*",
	async validate(doc: string): Promise<GateIssue[] | null> {
		const issues: GateIssue[] = []

		for (const p of PATTERNS) {
			p.re.lastIndex = 0
			let m: RegExpExecArray | null
			while ((m = p.re.exec(doc)) !== null) {
				issues.push({
					line: findLine(doc, m.index),
					severity: "error",
					message: `Possible ${p.label} detected (pattern ${p.id}).`,
					suggestion: "Replace with `<REDACTED>` or move to a secret store; never commit live credentials.",
				})
			}
		}

		LONG_BASE64_RE.lastIndex = 0
		let m: RegExpExecArray | null
		while ((m = LONG_BASE64_RE.exec(doc)) !== null) {
			const matched = m[0]
			// skip if context line marks the value as illustrative
			const line = lineFor(doc, m.index)
			if (SAFE_TOKENS_RE.test(line)) continue
			// skip if it overlaps with a JWT-shaped match (avoid double-report)
			if (matched.includes(".") && /\beyJ/.test(matched)) continue
			issues.push({
				line: findLine(doc, m.index),
				severity: "error",
				message: `Long base64-shaped string (${matched.length} chars) — possible credential.`,
				suggestion:
					"If this is illustrative, mark the line with REDACTED/EXAMPLE/PLACEHOLDER; if it is real, rotate it now.",
			})
		}

		return issues.length ? issues : null
	},
}

export default noSecretsInOutput
