# 40 — Dependency Lifecycle

> ABSOLUTE RULE: Never commit, merge, rebase, reset, force-push, or push user work directly on `main` or `master`. `main/master` may only mirror upstream after verified backups exist. Any attempted push to `main/master` is a critical failure and must stop the run. Lockfile mutation, dependency addition, and dependency upgrade are changes under this rule — they land via `chore/*` or `feat/*` branches, never as drive-by edits.

This document specifies the full lifecycle of a third-party dependency in the contract-kit-v17 monorepo and across the DaveAI ecosystem (Kilo Code VSIX, Open WebUI Hub, Hermes provider images, ZeroClaw service). Complements doc 27 (secrets/supply chain) and doc 23 (release provenance).

## Dependency manifests in scope

| Ecosystem | Manifest | Lockfile |
|---|---|---|
| Node (npm) | `package.json` | `package-lock.json` |
| Node (pnpm) | `package.json` | `pnpm-lock.yaml` |
| Node (bun) | `package.json` | `bun.lock` |
| Python (poetry) | `pyproject.toml` | `poetry.lock` |
| Python (pip) | `requirements.txt` | (pinned hashes in same file) |
| Rust | `Cargo.toml` | `Cargo.lock` |
| Go | `go.mod` | `go.sum` |

## Version pinning policy

| Class | Examples | Pin form | Rationale |
|---|---|---|---|
| Security-critical | `argon2`, `bcrypt`, `jsonwebtoken`, `jose`, `cosign`, `axios`, `undici`, `cryptography`, `pyjwt`, `ring`, `rustls` | **Exact** (`"1.2.3"`, no `^`/`~`) | Compromised-maintainer threat (doc 27 #5) |
| Production runtime | UI libs, ORMs, log libs, telemetry SDKs | `~minor` (`"~1.2.3"` allows 1.2.x, blocks 1.3.0) | Patch fixes flow automatically; minor upgrades deliberate |
| Dev / build / test | `eslint`, `vitest`, `tsx`, `pytest`, `cargo-watch` | `^major` (`"^1.2.3"` allows <2.0.0) | Tooling churn high, dev-only |
| Internal `@daveai/*` | `@daveai/internal-utils`, `@daveai/hermes-shared` | **Exact** | Doc 27 dep-confusion mitigation |

Concrete `package.json`:
```json
{
  "dependencies": {
    "jsonwebtoken": "9.0.2",
    "axios": "1.7.4",
    "@daveai/internal-utils": "0.42.1",
    "react": "~18.3.1",
    "zod": "~3.23.8"
  },
  "devDependencies": {
    "vitest": "^2.0.5",
    "typescript": "^5.5.4"
  }
}
```

If a dep is reclassified (e.g. logging lib starts handling auth tokens), bump to security-critical and tighten pin in `chore/*-deps-tighten-<dep>` PR.

## Lockfile-integrity gate

Per doc 27, every install in CI uses frozen mode:

```bash
pnpm install --frozen-lockfile
npm ci
bun install --frozen-lockfile
poetry install --no-update
pip install --require-hashes -r requirements.txt
cargo build --locked
go build -mod=readonly ./...
```

Any CI job not using frozen mode is a critical workflow defect — opened as `fix/ci-deps-frozen-<workflow>`.

PR review verification:
```bash
git diff --stat origin/integration/main HEAD -- \
  '*lock*' 'package-lock.json' 'pnpm-lock.yaml' 'bun.lock' \
  'poetry.lock' 'Cargo.lock' 'go.sum'
```

Non-empty → PR MUST be `chore/*-deps-*` or `feat/*` whose stated scope includes the dependency change.

## Adding a new dependency — checklist

Dedicated `chore/<scope>-deps-add-<dep>` branch. Steps before merge:

1. **License audit.** Dep's license MUST be on approved list:
   ```bash
   pnpm licenses list --prod | grep -E "(GPL|AGPL|SSPL|Commons-Clause)"
   pip-licenses --format=markdown --with-urls
   cargo deny check licenses
   go-licenses report ./... 2>/dev/null
   ```
   Non-empty match for forbidden licenses blocks add.
2. **Maintainer reputation.** `socket.dev` (or equivalent). `npm audit signatures` post-add. <12mo registry presence, sole maintainer, or socket.dev risk >50 requires written justification.
3. **Last release date.** >2 years stale presumed unmaintained; needs explicit justification + security-reviewer CODEOWNERS approval.
4. **Dependency tree size.** +20 transitive without justification is yellow; >50 red. Measure: `pnpm why <dep> | wc -l`.
5. **Bundle size impact.** For browser/VSIX deps, run `bundlephobia`/`size-limit`. >100 KB minified+gzipped requires justification.
6. **PR shape**: manifest change (one entry added) + lockfile diff (mechanically generated) + `## Dependency add` section covering license, maintainer, last release, tree-size delta, bundle-size delta, use case.

Concrete branch + title:
```
chore/hub-deps-add-zod
```
PR title: `chore(hub): add zod 3.23.8 for manifest schema validation`

## Upgrading a dependency — checklist

`chore/<scope>-deps-bump-<dep>` branch:

1. **Read the changelog** between old and new version. Note new postinstall hooks, new network endpoints, new file-system writes outside package directory, or new maintainers.
2. **Run the full test suite** including integration and e2e tiers.
3. **Run a vulnerability scan post-upgrade**:
   ```bash
   pnpm audit --prod
   npm audit --omit=dev
   pip-audit --strict
   cargo audit
   ```
   Output attached to PR.
4. **Major-version bumps** are separate feature cards (`feat/<scope>-<dep>-vN-upgrade`) with migration notes.
5. **Tighten pin if reclassified.**

Examples:
- `chore(vsix): bump axios 1.7.4 -> 1.7.7` (patch, security-critical, exact pin)
- `chore(hub): bump zod ~3.23.8 -> ~3.23.10` (patch, runtime)
- `feat(hermes): upgrade fastapi to v0.115` (major, separate card)

## Removing a dependency — checklist

1. Search codebase for every import of the removed package.
2. Remove entry from manifest.
3. Regenerate lockfile.
4. Run full test suite.
5. Verify no transitive dependent silently re-introduces it: `pnpm why <dep>` post-remove.
6. Branch: `chore/<scope>-deps-remove-<dep>`.

## Periodic audit cadence (per doc 37)

| Interval | Action |
|---|---|
| Pre-commit (daily) | `gitleaks` pre-commit hook |
| Per-PR | Lockfile-diff guard, `npm audit signatures`, workflow CODEOWNERS gate, license check on new entry |
| Weekly | Full vuln audit: `npm audit`, `pnpm audit`, `pip-audit`, `cargo audit`. Output to `artifacts/dep-audit/<YYYY-WW>.json`; HIGH/CRITICAL → `fix/security-deps-<cve>` card |
| Monthly | SBOM diff vs prior month; Tier 4 full-history gitleaks |
| Quarterly | Registry-pin audit, action-pin SHA freshness, license re-attestation, SBOM diff vs prior quarter |

Monthly + quarterly via `mcp__scheduled-tasks` so they survive maintainer rotation.

## Dependency confusion / typosquat protection (doc 27)

Internal packages live under `@daveai/*` from a private registry. `.npmrc`:
```
@daveai:registry=https://npm.private.daveai.example/
registry=https://registry.npmjs.org/
```

Every `package.json` for an internal package:
```json
{
  "publishConfig": {
    "registry": "https://npm.private.daveai.example/",
    "access": "restricted"
  }
}
```

When adding any new dep, search npm for typosquats of candidate name. Edit-distance diff between candidate and top-3 closest names recorded in PR for any dep with socket.dev risk >25.

## Approved license list

### Permissive — always allowed
- MIT
- Apache-2.0
- BSD-2-Clause, BSD-3-Clause
- ISC
- Unlicense / 0BSD / CC0-1.0

### Weak copyleft — allowed with justification
- MPL-2.0 (file-level copyleft; doesn't infect consumer)
- LGPL-2.1+, LGPL-3+ (only when dynamically linked; static linking forbidden in shipped binaries)

Requires written justification + CODEOWNERS approval from legal/security reviewer.

### Strong copyleft — FORBIDDEN in shipped products
- GPL-2.0, GPL-2.0-only, GPL-2.0-or-later
- GPL-3.0, GPL-3.0-only, GPL-3.0-or-later
- AGPL-1.0, AGPL-3.0
- SSPL-1.0, BUSL-*, Commons-Clause amendments

Per-PR license check blocks. Hard-block.

### Tooling-only / dev-only exception process

GPL/AGPL/SSPL allowed as dev-only tool that runs on dev machines and CI but NEVER ships to user. Conditions:

1. Dep in `devDependencies` only.
2. Dockerfile multi-stage builds DO NOT carry dev install into final image.
3. PR explicitly invokes exception: `License-Exception: dev-only — <dep> is GPL-3.0, used in CI for X, not bundled into shipped artifacts`.
4. CODEOWNERS approval from security reviewer.

## SBOM generation

Per doc 27, every release produces SBOM via `syft` in CycloneDX format:

```bash
syft packages dir:. -o cyclonedx-json=artifacts/sbom/<version>.cdx.json
```

SBOM is required release-evidence per doc 23. Release without valid SBOM is rejected.

Monthly SBOM diff:
```bash
diff <(jq -S . artifacts/sbom/2026-03.cdx.json) \
     <(jq -S . artifacts/sbom/2026-04.cdx.json)
```

New top-level component without corresponding `chore/*-deps-add-*` PR → supply-chain alarm; opened as incident under doc 27 template.

## Forbidden patterns

1. **Adding dep without lockfile diff in PR** — frozen mode CI fails anyway, but PR rejected at review.
2. **Bumping security-critical dep without exact pin** — regression of policy, reverted.
3. **Skipping signature audit on dep upgrade** — empty output is a failed run.
4. **Mixing dev + prod deps in same install command in production Dockerfile** — production images use `pnpm install --prod --frozen-lockfile`.
5. **Adding GPL/AGPL/SSPL to a shipped product** — no exceptions.
6. **Direct edit of a lockfile** — mechanically generated only.
7. **Publishing release without SBOM** — doc 23 + doc 27 reject.
8. **Drive-by manifest edits in unrelated feature PRs** — blocks PR.

## Cross-references

- doc 23 — Release provenance; SBOM is required release artifact.
- doc 27 — Secrets and supply chain hardening.
- doc 29 — Branch-prefix policy.
- doc 32 — CI/CD blueprint; lockfile-diff guard implemented there.
- doc 35 — Docker discipline; dev/prod install separation enforced.
- doc 37 — Operator daily runbook (audit cadence integration).
- doc 38 — PR template + CODEOWNERS gate on lockfiles.

## TL;DR

1. Pinning is non-uniform: exact for security-critical and `@daveai/*`, `~minor` for runtime, `^major` for dev.
2. Every install in CI runs in frozen mode.
3. New deps pass license, maintainer, freshness, tree-size, and bundle-size checks.
4. GPL/AGPL/SSPL forbidden in shipped products; dev-only exceptions explicit and CODEOWNERS-gated.
5. Weekly vuln audits, monthly SBOM diff, quarterly registry-pin audit.
6. Forbidden patterns are hard blocks: no dep without lockfile diff, no loose pin on security-critical, no skipped signature audit, no dev/prod commingling.
