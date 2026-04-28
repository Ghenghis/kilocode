/**
 * compliance-no-secrets — flag obvious secret-like strings in the doc.
 * Patterns drawn from the gitleaks default ruleset (subset; the goal is
 * fast inline guard, not exhaustive secret-scanning).
 *
 * Severity = error so generation pipelines see it as a blocker.
 */

import type { Gate, GateIssue } from "../RubricCritic"

interface SecretPattern {
	id: string
	re: RegExp
	label: string
}

const PATTERNS: SecretPattern[] = [
	{ id: "aws-access-key", re: /\b(AKIA|ASIA|AGPA|AROA|AIPA|ANPA|ANVA)[0-9A-Z]{16}\b/, label: "AWS access key" },
	{ id: "aws-secret-key", re: /\b(?<![A-Za-z0-9/+=])(aws_secret(?:_access)?_key|aws_secret)[\s:=]+["']?[A-Za-z0-9/+=]{40}["']?/i, label: "AWS secret key" },
	{ id: "github-pat", re: /\bghp_[A-Za-z0-9]{36,}\b/, label: "GitHub PAT" },
	{ id: "github-oauth", re: /\bgho_[A-Za-z0-9]{36,}\b/, label: "GitHub OAuth token" },
	{ id: "github-app", re: /\b(ghs|ghu)_[A-Za-z0-9]{36,}\b/, label: "GitHub app token" },
	{ id: "slack-token", re: /\bxox[abposr]-[A-Za-z0-9-]{10,}\b/, label: "Slack token" },
	{ id: "openai-key", re: /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/, label: "OpenAI key" },
	{ id: "anthropic-key", re: /\bsk-ant-(?:api03-)?[A-Za-z0-9_-]{20,}\b/, label: "Anthropic key" },
	{ id: "google-api", re: /\bAIza[0-9A-Za-z_-]{35}\b/, label: "Google API key" },
	{ id: "stripe-live", re: /\bsk_live_[A-Za-z0-9]{20,}\b/, label: "Stripe live secret" },
	{ id: "private-key", re: /-----BEGIN (?:RSA|EC|DSA|OPENSSH|PGP)?\s*PRIVATE KEY-----/, label: "Private key block" },
	{ id: "jwt", re: /\beyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/, label: "JWT" },
]

function findLine(doc: string, idx: number): number {
	return doc.slice(0, idx).split("\n").length
}

export const complianceNoSecrets: Gate = {
	id: "compliance-no-secrets",
	name: "No secrets / API keys in doc",
	description: "Refuse to ship docs that leak AWS / GitHub / Slack / Stripe / OpenAI keys or private keys.",
	category: "compliance",
	severity: "error",
	docTypes: "*",
	async validate(doc: string): Promise<GateIssue[] | null> {
		const issues: GateIssue[] = []
		for (const p of PATTERNS) {
			const m = p.re.exec(doc)
			if (m) {
				issues.push({
					line: findLine(doc, m.index),
					severity: "error",
					message: `Possible ${p.label} detected (pattern ${p.id}).`,
					suggestion: "Replace with a placeholder like `<REDACTED>` or move to a secret store.",
				})
			}
		}
		return issues.length ? issues : null
	},
}

export default complianceNoSecrets
