/**
 * compliance-pii-warning — flag any PII-shaped strings (email, phone, SSN,
 * credit card-ish 16-digit runs) and require an explicit Privacy section
 * if any PII patterns are present.
 *
 * Note: false positives are fine here — PII handling is the kind of thing
 * we'd rather over-flag than under-flag.
 */

import type { Gate, GateIssue } from "../RubricCritic"

const EMAIL_RE = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/
const PHONE_RE = /\+?\d{1,3}[\s.-]?\(?\d{2,4}\)?[\s.-]?\d{3,4}[\s.-]?\d{3,4}/
const SSN_RE = /\b\d{3}-\d{2}-\d{4}\b/
const CC_RE = /\b(?:\d[ -]*?){13,19}\b/
const PII_HEADING_RE = /\b(privacy|gdpr|ccpa|pii|personal\s*data)\b/i

const ALLOWLIST_RE = /\b(?:example\.com|test\.com|user@example|noreply@|no-reply@)/i

function findLine(doc: string, idx: number): number {
	return doc.slice(0, idx).split("\n").length
}

export const compliancePiiWarning: Gate = {
	id: "compliance-pii-warning",
	name: "PII patterns require a Privacy section",
	description: "If the doc mentions emails/phones/SSN/CC patterns, a Privacy/GDPR section is required.",
	category: "compliance",
	severity: "warn",
	docTypes: "*",
	async validate(doc: string): Promise<GateIssue[] | null> {
		const findings: { kind: string; line: number }[] = []
		const matchers: { kind: string; re: RegExp }[] = [
			{ kind: "email", re: EMAIL_RE },
			{ kind: "phone", re: PHONE_RE },
			{ kind: "ssn", re: SSN_RE },
			{ kind: "credit-card", re: CC_RE },
		]
		for (const { kind, re } of matchers) {
			const m = re.exec(doc)
			if (m && !ALLOWLIST_RE.test(m[0])) {
				findings.push({ kind, line: findLine(doc, m.index) })
			}
		}
		if (findings.length === 0) return null
		const headings = doc.match(/^#{1,6}\s+([^\n]+)/gm) ?? []
		const hasPrivacy = headings.some((h) => PII_HEADING_RE.test(h))
		if (hasPrivacy) return null
		return findings.map((f) => ({
			line: f.line,
			severity: "warn" as const,
			message: `Possible ${f.kind} found but no Privacy/GDPR section is present.`,
			suggestion: "Add a Privacy or GDPR/CCPA section explaining how this data is handled.",
		}))
	},
}

export default compliancePiiWarning
