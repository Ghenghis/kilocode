/**
 * fix-playbook — AI-style fix playbook generator for OpenSSF Scorecard output.
 *
 * Anchor 7 deliverable. Reads a parsed Scorecard v2 result JSON and emits a
 * markdown playbook explaining — in plain English — what failed, why it
 * matters, and the *exact one-line PR* the user can merge to fix it.
 *
 * The playbook is keyed on Scorecard's check names. Coverage targets the
 * canonical 18+ checks documented at:
 *   https://github.com/ossf/scorecard/blob/main/docs/checks.md
 *
 * No network access, no LLM call — the canonical fixes are encoded as static
 * data. A future iteration can layer an LLM "polish" pass on top, but the
 * baseline must work fully offline (anchor 7 requires deterministic output).
 */
export interface ScorecardCheckResult {
	name: string
	score: number // 0..10, or -1 for unknown / not applicable
	reason?: string
	details?: string[] | null
	documentation?: { short?: string; url?: string }
}

export interface ScorecardJson {
	date?: string
	repo?: { name?: string; commit?: string }
	scorecard?: { version?: string; commit?: string }
	score: number // aggregate, 0..10
	checks: ScorecardCheckResult[]
}

export interface PlaybookOptions {
	/** Per-check threshold — checks scoring strictly less than this trigger a playbook entry. Default 8. */
	checkThreshold?: number
}

interface CanonicalFix {
	plainEnglish: string
	whyItMatters: string
	oneLineFix: string
	docsUrl: string
}

/**
 * Canonical, hand-curated fixes for every Scorecard check. Sourced from the
 * official check documentation. Update when OpenSSF adds new checks.
 */
const CANONICAL_FIXES: Record<string, CanonicalFix> = {
	"Binary-Artifacts": {
		plainEnglish: "The repo contains binary files (.exe, .jar, .class, …) committed to git.",
		whyItMatters: "Binaries are unauditable supply-chain risk — reviewers can't see what's inside them.",
		oneLineFix: "git rm <binary-path> && add it to .gitignore; ship binaries via GitHub Releases instead.",
		docsUrl: "https://github.com/ossf/scorecard/blob/main/docs/checks.md#binary-artifacts",
	},
	"Branch-Protection": {
		plainEnglish: "The default branch (and release branches) lack required-review + required-status-check protection.",
		whyItMatters: "Without branch protection, a single compromised account can push malicious code straight to main.",
		oneLineFix: "Apply the included `branch-protection.tf` Terraform module: `cd compliance/branch-protection && terraform apply`.",
		docsUrl: "https://github.com/ossf/scorecard/blob/main/docs/checks.md#branch-protection",
	},
	"CI-Tests": {
		plainEnglish: "PRs are merging without any CI run, or the CI runs aren't visible to the scorecard.",
		whyItMatters: "Untested merges are the #1 source of regressions and supply-chain compromises.",
		oneLineFix: "Add `.github/workflows/ci.yml` running your tests on every pull_request — see scaffold defaults.",
		docsUrl: "https://github.com/ossf/scorecard/blob/main/docs/checks.md#ci-tests",
	},
	"CII-Best-Practices": {
		plainEnglish: "The project hasn't earned a CII (now OpenSSF Best Practices) badge.",
		whyItMatters: "The badge is a public signal that a maintained set of best practices are followed.",
		oneLineFix: "Self-certify at https://www.bestpractices.dev/ and add the badge URL to your README.",
		docsUrl: "https://github.com/ossf/scorecard/blob/main/docs/checks.md#cii-best-practices",
	},
	"Code-Review": {
		plainEnglish: "Some commits to the default branch landed without code review.",
		whyItMatters: "Single-author commits to main bypass the four-eyes principle.",
		oneLineFix: "Add `.github/CODEOWNERS` (scaffold default) and require PR reviews via branch protection.",
		docsUrl: "https://github.com/ossf/scorecard/blob/main/docs/checks.md#code-review",
	},
	"Contributors": {
		plainEnglish: "Recent commits come from fewer than 3 distinct organisations.",
		whyItMatters: "Single-org projects have a higher bus-factor risk and weaker community oversight.",
		oneLineFix: "Encourage external contributions; this check naturally improves with project age.",
		docsUrl: "https://github.com/ossf/scorecard/blob/main/docs/checks.md#contributors",
	},
	"Dangerous-Workflow": {
		plainEnglish: "A GitHub Actions workflow uses an untrusted input directly in a shell command.",
		whyItMatters: "Patterns like `${{ github.event.pull_request.title }}` in `run:` blocks allow PR-author RCE.",
		oneLineFix: "Move untrusted inputs into env vars: `env: TITLE: ${{ github.event.pull_request.title }}` then use `$TITLE`.",
		docsUrl: "https://github.com/ossf/scorecard/blob/main/docs/checks.md#dangerous-workflow",
	},
	"Dependency-Update-Tool": {
		plainEnglish: "No automated dependency-update tool (Dependabot or Renovate) is configured.",
		whyItMatters: "Vulnerable dependencies linger forever without an automated update PR cadence.",
		oneLineFix: "Commit `.github/dependabot.yml` from the scaffold defaults (npm + actions, daily).",
		docsUrl: "https://github.com/ossf/scorecard/blob/main/docs/checks.md#dependency-update-tool",
	},
	"Fuzzing": {
		plainEnglish: "The project has no fuzzing harness wired into CI.",
		whyItMatters: "Fuzzing finds memory safety + parser bugs that unit tests miss.",
		oneLineFix: "Add a ClusterFuzzLite stub (.clusterfuzzlite/) — see https://google.github.io/clusterfuzzlite/.",
		docsUrl: "https://github.com/ossf/scorecard/blob/main/docs/checks.md#fuzzing",
	},
	"License": {
		plainEnglish: "No `LICENSE` file (or it's not on the SPDX allowlist).",
		whyItMatters: "Without an OSI-approved license, downstream users cannot legally consume the code.",
		oneLineFix: "Commit `LICENSE` (MIT scaffold default) at the repo root with a valid SPDX id.",
		docsUrl: "https://github.com/ossf/scorecard/blob/main/docs/checks.md#license",
	},
	"Maintained": {
		plainEnglish: "Fewer than 1 commit per week over the last 90 days.",
		whyItMatters: "Stale projects accumulate unpatched CVEs.",
		oneLineFix: "Set up a weekly Renovate / dependabot auto-merge to keep activity steady.",
		docsUrl: "https://github.com/ossf/scorecard/blob/main/docs/checks.md#maintained",
	},
	"Packaging": {
		plainEnglish: "Releases aren't published through a package manager (npm, PyPI, GitHub Releases, …).",
		whyItMatters: "Source-only distribution makes provenance + signature verification harder for consumers.",
		oneLineFix: "Add `.github/workflows/release.yml` that publishes to npm + creates a GitHub Release.",
		docsUrl: "https://github.com/ossf/scorecard/blob/main/docs/checks.md#packaging",
	},
	"Pinned-Dependencies": {
		plainEnglish: "Some dependencies (npm, Docker, GitHub Actions) reference floating tags instead of exact versions/SHAs.",
		whyItMatters: "Floating tags can be repointed to a malicious commit silently — supply-chain compromise vector.",
		oneLineFix: "Replace `uses: foo/bar@v1` with `uses: foo/bar@<full-sha> # v1` (run `pin-github-action` to bulk-fix).",
		docsUrl: "https://github.com/ossf/scorecard/blob/main/docs/checks.md#pinned-dependencies",
	},
	"SAST": {
		plainEnglish: "No static-analysis (SAST) tool is wired into CI.",
		whyItMatters: "SAST catches injection, XSS, deserialization bugs before they ship.",
		oneLineFix: "Commit `.github/workflows/codeql.yml` from the scaffold defaults.",
		docsUrl: "https://github.com/ossf/scorecard/blob/main/docs/checks.md#sast",
	},
	"SBOM": {
		plainEnglish: "Releases don't ship a Software Bill of Materials.",
		whyItMatters: "Consumers can't audit what's inside without an SBOM — and CISA + EU CRA are mandating it.",
		oneLineFix: "Commit `.github/workflows/sbom.yml` from the scaffold defaults (anchore/sbom-action, SPDX).",
		docsUrl: "https://github.com/ossf/scorecard/blob/main/docs/checks.md#sbom",
	},
	"Security-Policy": {
		plainEnglish: "No `SECURITY.md` describing how to report vulnerabilities.",
		whyItMatters: "Researchers will publicly disclose if they don't see a clear, private channel.",
		oneLineFix: "Commit `SECURITY.md` (scaffold default) at the repo root.",
		docsUrl: "https://github.com/ossf/scorecard/blob/main/docs/checks.md#security-policy",
	},
	"Signed-Releases": {
		plainEnglish: "Release artifacts are unsigned.",
		whyItMatters: "Without a signature consumers can't verify they're running the bytes you shipped.",
		oneLineFix: "Add cosign keyless signing to the release workflow — see anchor 6 (`slsa-framework/slsa-github-generator`).",
		docsUrl: "https://github.com/ossf/scorecard/blob/main/docs/checks.md#signed-releases",
	},
	"Token-Permissions": {
		plainEnglish: "Workflows request more GITHUB_TOKEN scopes than they need.",
		whyItMatters: "Excess token scope amplifies blast radius if a workflow is compromised.",
		oneLineFix: "Add `permissions: read-all` at the workflow root, then grant write only on the specific job that needs it.",
		docsUrl: "https://github.com/ossf/scorecard/blob/main/docs/checks.md#token-permissions",
	},
	"Vulnerabilities": {
		plainEnglish: "OSV reports open vulnerabilities in the project's dependencies.",
		whyItMatters: "Known CVEs are the lowest-effort attack vector — patch them first.",
		oneLineFix: "Run `npm audit fix` (or equivalent) and merge the resulting Dependabot PRs.",
		docsUrl: "https://github.com/ossf/scorecard/blob/main/docs/checks.md#vulnerabilities",
	},
	"Webhooks": {
		plainEnglish: "Webhooks configured on the repo are missing a secret token.",
		whyItMatters: "Unauthenticated webhooks can be replayed or spoofed by anyone who finds the URL.",
		oneLineFix: "In repo settings → Webhooks → set a `Secret` for every active webhook.",
		docsUrl: "https://github.com/ossf/scorecard/blob/main/docs/checks.md#webhooks",
	},
}

/** Fallback used when scorecard adds a new check we haven't catalogued yet. */
const FALLBACK_FIX: CanonicalFix = {
	plainEnglish: "This Scorecard check is failing.",
	whyItMatters: "OpenSSF flags this as a security-hygiene issue worth addressing.",
	oneLineFix: "Read the linked docs for the canonical remediation.",
	docsUrl: "https://github.com/ossf/scorecard/blob/main/docs/checks.md",
}

function severityLabel(score: number): string {
	if (score < 0) return "Unknown"
	if (score === 0) return "Critical"
	if (score < 4) return "High"
	if (score < 7) return "Medium"
	if (score < 9) return "Low"
	return "Pass"
}

function escapeMd(s: string): string {
	return s.replace(/\|/g, "\\|")
}

/**
 * Generate the markdown playbook from a Scorecard JSON.
 *
 * The playbook orders failing checks by severity (lowest score first), making
 * the highest-impact fixes immediately visible.
 */
export function generateFixPlaybook(scorecard: ScorecardJson, opts: PlaybookOptions = {}): string {
	const threshold = opts.checkThreshold ?? 8
	const aggregate = typeof scorecard.score === "number" ? scorecard.score : -1
	const failing = (scorecard.checks ?? [])
		.filter((c) => typeof c.score === "number" && c.score >= 0 && c.score < threshold)
		.slice()
		.sort((a, b) => a.score - b.score)

	const lines: string[] = []
	lines.push("# OpenSSF Scorecard — fix playbook")
	lines.push("")
	if (scorecard.repo?.name) {
		lines.push(`Repo: \`${escapeMd(scorecard.repo.name)}\``)
	}
	if (scorecard.date) {
		lines.push(`Generated: ${scorecard.date}`)
	}
	lines.push("")
	lines.push(`**Aggregate score:** ${aggregate.toFixed(1)}/10`)
	lines.push(`**Per-check threshold:** ${threshold.toFixed(1)}/10`)
	lines.push(`**Failing checks:** ${failing.length}`)
	lines.push("")

	if (failing.length === 0) {
		lines.push("All checks pass the configured threshold. No remediation required.")
		lines.push("")
		return lines.join("\n")
	}

	lines.push("## Summary")
	lines.push("")
	lines.push("| Check | Score | Severity | One-line fix |")
	lines.push("|---|---|---|---|")
	for (const c of failing) {
		const fix = CANONICAL_FIXES[c.name] ?? FALLBACK_FIX
		lines.push(
			`| ${escapeMd(c.name)} | ${c.score.toFixed(1)}/10 | ${severityLabel(c.score)} | ${escapeMd(fix.oneLineFix)} |`,
		)
	}
	lines.push("")

	lines.push("## Detailed remediation")
	lines.push("")
	for (const c of failing) {
		const fix = CANONICAL_FIXES[c.name] ?? FALLBACK_FIX
		lines.push(`### ${c.name} — ${c.score.toFixed(1)}/10 (${severityLabel(c.score)})`)
		lines.push("")
		lines.push(`**What failed.** ${fix.plainEnglish}`)
		if (c.reason) {
			lines.push("")
			lines.push(`> Scorecard reason: ${c.reason}`)
		}
		lines.push("")
		lines.push(`**Why it matters.** ${fix.whyItMatters}`)
		lines.push("")
		lines.push(`**One-line fix.**`)
		lines.push("")
		lines.push("```")
		lines.push(fix.oneLineFix)
		lines.push("```")
		lines.push("")
		const docs = c.documentation?.url ?? fix.docsUrl
		lines.push(`**Docs.** <${docs}>`)
		if (c.details && c.details.length) {
			lines.push("")
			lines.push("<details><summary>Scorecard details</summary>")
			lines.push("")
			for (const d of c.details.slice(0, 20)) {
				lines.push(`- ${escapeMd(d)}`)
			}
			lines.push("")
			lines.push("</details>")
		}
		lines.push("")
	}

	lines.push("---")
	lines.push("")
	lines.push("_Generated by Contract Kit Creator (Anchor 7 — OpenSSF Scorecard)._")
	lines.push("")
	return lines.join("\n")
}

/** Default output location used by the gate runner. */
export const DEFAULT_PLAYBOOK_PATH = "compliance/scorecard-fix-playbook.md"

export default generateFixPlaybook
