# 32 — CI/CD and GitHub Actions Blueprint

> ABSOLUTE RULE: Never commit, merge, rebase, reset, force-push, or push user work directly on `main` or `master`. `main/master` may only mirror upstream after verified backups exist. Any attempted push to `main/master` is a critical failure and must stop the run. Every workflow defined here MUST refuse to run mutating jobs against `main`/`master`/`integration/main` — the only sanctioned mutation surface is a `release/*` branch (per doc 23) reached via a PR (per doc 18).

## 1. Overview

Canonical specification for GitHub Actions across every repo in the DaveAI ecosystem: three required workflows (`pr-validate`, `release`, `nightly-audit`), per-runtime variants, supply-chain hardening (SHA pinning, default-deny `permissions:`, no `pull_request_target`), secret inventory, and integration with branch protection (doc 18) and release provenance (doc 23).

### CI audit — current vs required state

| Repo | Runtime | CI today | Required action |
|------|---------|----------|------------------|
| `Ghenghis/kilocode` | bun | partial: `publish-vsix.yml` exists per doc 23 | ADD `pr-validate.yml`, `nightly-audit.yml`; harden `release.yml` |
| `AiDave71/kilocode` | bun | none verified | ADD all three; mirror Ghenghis/kilocode |
| `Ghenghis/open-webui` | npm/pnpm + python | upstream workflows present | OVERLAY ours under `dav3/*` namespace; do NOT remove upstream |
| `Ghenghis/hermes-agent` | python | none verified | ADD all three (python variant) |
| `Ghenghis/contract-kit-v17` | python | partial | ADD `pr-validate.yml` (docs lint + python lint), `nightly-audit.yml`; no `release.yml` |
| `Ghenghis/PixelClaw` | python | none verified | ADD all three (python variant) |
| `Ghenghis/zeroclaw` (post-promotion per doc 30) | cargo | n/a | At promotion: ADD all three (cargo variant) |

A repo without all required workflows is `BLOCKER` in doc 16 manifest.

## 2. Required workflows per repo

| Workflow | Trigger | Purpose | Required for |
|----------|---------|---------|--------------|
| `pr-validate.yml` | `pull_request` | lint + typecheck + test + Tier 1+2 secret scan + lockfile-diff guard (doc 27) | ALL repos |
| `release.yml` | `push: tags: ['v*']` | verify branch shape `release/*` (doc 23 gate), build, sign (cosign), generate SLSA, publish | artifact-shipping repos: `Ghenghis/kilocode`, `AiDave71/kilocode`, `Ghenghis/open-webui`, `Ghenghis/hermes-agent`, `Ghenghis/zeroclaw` (future) |
| `nightly-audit.yml` | `schedule: cron: '0 7 * * *'` UTC | gitleaks `--all` Tier 4, dep audit, action-pin SHA freshness | ALL repos |

`feat/`, `fix/`, `release/` are the only canonical branch shapes (doc 29). All three workflows refuse mutating ops from any other shape.

## 3. `pr-validate.yml` — Bun variant (Kilo)

```yaml
name: pr-validate
on:
  pull_request:
    branches: [main, integration/main, release/*]

permissions:
  contents: read

concurrency:
  group: pr-validate-${{ github.ref }}
  cancel-in-progress: true

jobs:
  validate:
    name: lint + typecheck + test + scan
    runs-on: ubuntu-latest
    timeout-minutes: 30
    steps:
      - uses: actions/checkout@b4ffde65f46336ab88eb53be808477a3936bae11  # v4.1.1
        with:
          persist-credentials: false
          fetch-depth: 0

      - uses: oven-sh/setup-bun@f4d14e03ff726c06358e5557344e1da148b56cf7  # v1.2.2
        with:
          bun-version: 1.1.x

      - name: Install (frozen)
        run: bun install --frozen-lockfile

      - name: Lockfile-diff guard (doc 27)
        env:
          BASE_SHA: ${{ github.event.pull_request.base.sha }}
          HEAD_SHA: ${{ github.event.pull_request.head.sha }}
        run: |
          set -euo pipefail
          DIFF=$(git diff --stat "$BASE_SHA" "$HEAD_SHA" -- 'bun.lock' 'package-lock.json' 'pnpm-lock.yaml' || true)
          if [ -n "$DIFF" ]; then
            LABELS='${{ toJSON(github.event.pull_request.labels.*.name) }}'
            echo "$LABELS" | grep -q '"deps"' || {
              echo "::error::Lockfile changed without 'deps' label (doc 27)"; exit 1
            }
          fi

      - run: bun run lint
      - run: bun run typecheck
      - run: bun run test

      - uses: gitleaks/gitleaks-action@44c470ffc35caa8b1eb3e8012ca53c2f9bea4eb5  # v2.3.7
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### Python variant (Hermes / Hub / contract-kit-v17 / PixelClaw)

```yaml
name: pr-validate
on:
  pull_request:
    branches: [main, integration/main, release/*]

permissions:
  contents: read

concurrency:
  group: pr-validate-${{ github.ref }}
  cancel-in-progress: true

jobs:
  validate:
    runs-on: ubuntu-latest
    timeout-minutes: 30
    steps:
      - uses: actions/checkout@b4ffde65f46336ab88eb53be808477a3936bae11  # v4.1.1
        with: { persist-credentials: false, fetch-depth: 0 }
      - uses: actions/setup-python@0a5c61591373683505ea898e09a3ea4f39ef2b9c  # v5.0.0
        with: { python-version: '3.12', cache: 'pip' }

      - name: Install (no-update)
        run: |
          python -m pip install --upgrade pip
          if [ -f poetry.lock ]; then
            pipx install poetry==1.8.3
            poetry install --no-update --no-interaction
          else
            pip install -r requirements.txt
            [ -f requirements-dev.txt ] && pip install -r requirements-dev.txt || true
          fi

      - name: Lockfile-diff guard
        env:
          BASE_SHA: ${{ github.event.pull_request.base.sha }}
          HEAD_SHA: ${{ github.event.pull_request.head.sha }}
        run: |
          set -euo pipefail
          DIFF=$(git diff --stat "$BASE_SHA" "$HEAD_SHA" -- 'poetry.lock' 'Pipfile.lock' 'requirements*.txt' || true)
          if [ -n "$DIFF" ]; then
            LABELS='${{ toJSON(github.event.pull_request.labels.*.name) }}'
            echo "$LABELS" | grep -q '"deps"' || {
              echo "::error::Lockfile changed without 'deps' label (doc 27)"; exit 1
            }
          fi

      - run: ruff check .
      - run: |
          if [ -f mypy.ini ] || grep -q '\[tool.mypy\]' pyproject.toml 2>/dev/null; then
            mypy .
          fi
      - run: pytest -q

      - uses: gitleaks/gitleaks-action@44c470ffc35caa8b1eb3e8012ca53c2f9bea4eb5  # v2.3.7
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### npm/pnpm + python variant (Open WebUI)

```yaml
name: pr-validate
on:
  pull_request:
    branches: [main, integration/main, release/*]

permissions:
  contents: read

concurrency:
  group: pr-validate-${{ github.ref }}
  cancel-in-progress: true

jobs:
  validate:
    runs-on: ubuntu-latest
    timeout-minutes: 45
    steps:
      - uses: actions/checkout@b4ffde65f46336ab88eb53be808477a3936bae11  # v4.1.1
        with: { persist-credentials: false, fetch-depth: 0 }
      - uses: pnpm/action-setup@a3252b78c470c02df07e9d59298aecedc3ccdd6d  # v3.0.0
        with: { version: 9 }
      - uses: actions/setup-node@1e60f620b9541d16bece96c5465dc8ee9832be0b  # v4.0.3
        with: { node-version: '20', cache: 'pnpm' }
      - uses: actions/setup-python@0a5c61591373683505ea898e09a3ea4f39ef2b9c  # v5.0.0
        with: { python-version: '3.12', cache: 'pip' }

      - run: pnpm install --frozen-lockfile
      - run: pip install -r backend/requirements.txt

      - name: Lockfile-diff guard
        env:
          BASE_SHA: ${{ github.event.pull_request.base.sha }}
          HEAD_SHA: ${{ github.event.pull_request.head.sha }}
        run: |
          set -euo pipefail
          DIFF=$(git diff --stat "$BASE_SHA" "$HEAD_SHA" -- 'pnpm-lock.yaml' 'package-lock.json' 'backend/requirements*.txt' || true)
          if [ -n "$DIFF" ]; then
            LABELS='${{ toJSON(github.event.pull_request.labels.*.name) }}'
            echo "$LABELS" | grep -q '"deps"' || {
              echo "::error::Lockfile changed without 'deps' label"; exit 1
            }
          fi

      - run: pnpm lint
      - run: pnpm typecheck
      - run: pnpm test
      - run: pytest backend/ -q

      - uses: gitleaks/gitleaks-action@44c470ffc35caa8b1eb3e8012ca53c2f9bea4eb5  # v2.3.7
        env: { GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }} }
```

### Cargo variant (ZeroClaw, post-promotion per doc 30)

```yaml
name: pr-validate
on:
  pull_request:
    branches: [main, integration/main, release/*]

permissions:
  contents: read

concurrency:
  group: pr-validate-${{ github.ref }}
  cancel-in-progress: true

jobs:
  validate:
    runs-on: ubuntu-latest
    timeout-minutes: 45
    steps:
      - uses: actions/checkout@b4ffde65f46336ab88eb53be808477a3936bae11  # v4.1.1
        with: { persist-credentials: false, fetch-depth: 0 }
      - uses: dtolnay/rust-toolchain@21dc36fb71dd22e3317045c0c31a3f4249868b17  # stable
        with: { toolchain: stable, components: rustfmt, clippy }
      - uses: Swatinem/rust-cache@23bce251a8cd2ffc3c1075eaa2367cf899916d84  # v2.7.3

      - name: Lockfile-diff guard
        env:
          BASE_SHA: ${{ github.event.pull_request.base.sha }}
          HEAD_SHA: ${{ github.event.pull_request.head.sha }}
        run: |
          set -euo pipefail
          DIFF=$(git diff --stat "$BASE_SHA" "$HEAD_SHA" -- 'Cargo.lock' || true)
          if [ -n "$DIFF" ]; then
            LABELS='${{ toJSON(github.event.pull_request.labels.*.name) }}'
            echo "$LABELS" | grep -q '"deps"' || {
              echo "::error::Cargo.lock changed without 'deps' label"; exit 1
            }
          fi

      - run: cargo fmt --all -- --check
      - run: cargo clippy --all-targets --all-features -- -D warnings
      - run: cargo test --all-features --locked

      - uses: gitleaks/gitleaks-action@44c470ffc35caa8b1eb3e8012ca53c2f9bea4eb5  # v2.3.7
        env: { GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }} }
```

> SHA pinning: every `uses:` line is pinned to a 40-hex commit SHA per doc 27. Tag-based pinning is FORBIDDEN. Update via `gh api repos/<owner>/<action>/git/refs/tags/<tag> --jq .object.sha`.

## 4. `release.yml` — branch-shape gated, signed, attested

The publish-side of doc 23. MUST NOT run on any branch other than `release/*`, and the gate precedes the build step.

```yaml
name: release
on:
  push:
    tags: ['v*']

permissions:
  contents: read
  id-token: write       # cosign keyless OIDC
  attestations: write   # SLSA build provenance
  packages: write       # ghcr publish

concurrency:
  group: release-${{ github.ref }}
  cancel-in-progress: false   # never cancel a partial release

jobs:
  release:
    runs-on: ubuntu-latest
    timeout-minutes: 60
    steps:
      - uses: actions/checkout@b4ffde65f46336ab88eb53be808477a3936bae11  # v4.1.1
        with: { fetch-depth: 0, persist-credentials: false }

      # ---- DOC 23 GATE: tag MUST be on a release/* branch ----
      - name: Verify tag is on release/* branch
        id: branchshape
        run: |
          set -euo pipefail
          BRANCH=$(git branch -r --contains "$GITHUB_REF" \
            | grep -E 'origin/release/' | head -n1 | sed 's|.*origin/||' || true)
          if [ -z "$BRANCH" ]; then
            echo "::error::Tag $GITHUB_REF is NOT on a release/* branch (doc 23)"
            exit 1
          fi
          case "$BRANCH" in
            main|master|integration/main|feat/*|fix/*|hotfix/*)
              echo "::error::Tag $GITHUB_REF resolves to forbidden branch '$BRANCH' (doc 23)"
              exit 1 ;;
          esac
          echo "release_branch=$BRANCH" >> "$GITHUB_OUTPUT"

      - name: Verify tag is signed
        run: git tag --verify "${GITHUB_REF#refs/tags/}"

      - name: Verify head commit signed
        run: git verify-commit "$GITHUB_SHA"

      - uses: oven-sh/setup-bun@f4d14e03ff726c06358e5557344e1da148b56cf7  # v1.2.2
      - run: bun install --frozen-lockfile

      - name: Build artifact
        id: build
        run: |
          bun run build:vsix
          F=$(ls *.vsix | head -n1)
          echo "artifact=$F" >> "$GITHUB_OUTPUT"
          echo "sha256=$(sha256sum "$F" | cut -d' ' -f1)" >> "$GITHUB_OUTPUT"
          echo "size=$(stat -c%s "$F")" >> "$GITHUB_OUTPUT"

      - name: Generate SLSA build provenance
        uses: actions/attest-build-provenance@173725a1209d09b31f9d30a3890cf2757ebbff0d  # v1.4.4
        with: { subject-path: ${{ steps.build.outputs.artifact }} }

      - uses: sigstore/cosign-installer@4959ce089c160fddf62f7b42464195ba1a56d382  # v3.6.0

      - name: Sign artifact (keyless OIDC)
        env: { COSIGN_EXPERIMENTAL: '1' }
        run: cosign sign-blob --yes "${{ steps.build.outputs.artifact }}" \
              --output-signature "${{ steps.build.outputs.artifact }}.sig" \
              --output-certificate "${{ steps.build.outputs.artifact }}.pem"

      - name: Compose + sign manifest
        env:
          RELEASE_BRANCH: ${{ steps.branchshape.outputs.release_branch }}
          TAG: ${{ github.ref_name }}
          COMMIT: ${{ github.sha }}
          SHA256: ${{ steps.build.outputs.sha256 }}
          SIZE: ${{ steps.build.outputs.size }}
          RUN_URL: ${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}
        run: |
          python scripts/compose_manifest.py \
            --tag "$TAG" --commit "$COMMIT" \
            --release-branch "$RELEASE_BRANCH" \
            --sha256 "$SHA256" --size "$SIZE" \
            --run-url "$RUN_URL" --out manifest.json
          cosign sign-blob --yes manifest.json --output-signature manifest.sig

      - name: Publish to Hub
        env: { HUB_PUBLISH_TOKEN: ${{ secrets.HUB_PUBLISH_TOKEN }} }
        run: python scripts/publish_release.py \
              --branch "${{ steps.branchshape.outputs.release_branch }}" \
              --tag "${GITHUB_REF#refs/tags/}" \
              --manifest manifest.json --signature manifest.sig \
              --artifact "${{ steps.build.outputs.artifact }}"

      - name: Append evidence ledger row
        run: python scripts/append_release_evidence.py
```

The branch-shape gate is the load-bearing control. Mirror in `publish_release.py` as defense in depth.

## 5. `nightly-audit.yml` — Tier 4 history scan + dep audit + pin freshness

```yaml
name: nightly-audit
on:
  schedule:
    - cron: '0 7 * * *'   # 07:00 UTC daily
  workflow_dispatch: {}

permissions:
  contents: read
  issues: write           # file an issue when audit finds something

concurrency:
  group: nightly-audit
  cancel-in-progress: true

jobs:
  audit:
    runs-on: ubuntu-latest
    timeout-minutes: 30
    steps:
      - uses: actions/checkout@b4ffde65f46336ab88eb53be808477a3936bae11  # v4.1.1
        with: { fetch-depth: 0 }

      - name: Tier 4 — gitleaks --all (doc 27)
        run: |
          curl -sSL https://github.com/gitleaks/gitleaks/releases/download/v8.18.4/gitleaks_8.18.4_linux_x64.tar.gz \
            | tar xz -C /usr/local/bin gitleaks
          gitleaks detect --log-opts="--all" --report-format=json \
            --report-path=gitleaks-fullhistory.json --redact || true
          test -s gitleaks-fullhistory.json && jq -e '. | length == 0' gitleaks-fullhistory.json

      - name: Dep audit (matrix per runtime)
        run: |
          [ -f package.json ]   && npm audit --omit=dev || true
          [ -f pnpm-lock.yaml ] && pnpm audit --prod || true
          [ -f bun.lock ]       && bun audit || true
          [ -f requirements.txt ] && pip install pip-audit && pip-audit -r requirements.txt || true
          [ -f Cargo.lock ]     && cargo install --quiet cargo-audit && cargo audit || true

      - name: Action-pin SHA freshness
        run: python scripts/check_action_pin_freshness.py .github/workflows/

      - name: File issue on failure
        if: failure()
        uses: actions/github-script@60a0d83039c74a4aee543508d2ffcb1c3799cdea  # v7.0.1
        with:
          script: |
            github.rest.issues.create({
              owner: context.repo.owner, repo: context.repo.repo,
              title: `nightly-audit failed ${context.runId}`,
              body: `Run: ${context.serverUrl}/${context.repo.owner}/${context.repo.repo}/actions/runs/${context.runId}`,
              labels: ['security', 'nightly-audit']
            })
```

A finding files a `security`-labeled issue → trigger for `fix/<incident-id>` branch (doc 29) + incident report (doc 27 / doc 39).

## 6. Required-status-checks integration with branch protection (doc 18)

After workflows merged + run once on the default branch:

```bash
# Discover check-run names:
gh api repos/Ghenghis/kilocode/commits/$(gh api repos/Ghenghis/kilocode --jq .default_branch)/check-runs \
  --jq '.check_runs[].name'

# Append required_status_checks to existing ruleset:
RULESET_ID=$(gh api repos/Ghenghis/kilocode/rulesets \
  --jq '.[] | select(.name=="v3-default-branch-lockdown") | .id')

# Append rule (PUT the full ruleset; see doc 18).
```

`release.yml` is NOT a required status check (only fires on `v*` tags). Its branch-shape gate enforces the `release/*` constraint.

## 7. Secret-handling: GitHub Secrets vs OIDC keyless

Default to OIDC keyless (cosign signing, attestations, AWS/GCP role assumption). Long-lived `secrets.*` only when consumer cannot accept short-lived OIDC.

| Repo | Secret | Why | Rotation | OIDC alt |
|------|--------|-----|----------|----------|
| `Ghenghis/kilocode` | `HUB_PUBLISH_TOKEN` | publish manifest | 90d | none today |
| `Ghenghis/kilocode` | `VSCODE_MARKETPLACE_PAT` | publish to MS marketplace | 90d | not supported |
| `AiDave71/kilocode` | mirror | alternate origin | 90d | n/a |
| `Ghenghis/open-webui` | `GHCR_PUSH_TOKEN` | push container | 90d | YES — replace with OIDC |
| `Ghenghis/hermes-agent` | `OPENROUTER_KEY` (CI test only) | smoke test | 30d | n/a |
| `Ghenghis/contract-kit-v17` | none | docs | n/a | n/a |
| `Ghenghis/PixelClaw` | `PYPI_API_TOKEN` (if/when published) | wheel publish | 90d | YES — PyPI Trusted Publishing |
| `Ghenghis/zeroclaw` (future) | `CARGO_REGISTRY_TOKEN` (if published) | crate publish | 90d | not yet supported |

Rotation evidence: `<EVIDENCE_ROOT>/secret_rotations.md` records secret name, repo, rotated-at UTC, verified-non-functional UTC. Quarterly audit.

## 8. Self-hosted runner policy

FORBIDDEN for any workflow triggered on `pull_request` from a fork, `pull_request_target`, or public-repo issue/comment.

Permitted only for:
- `release.yml` jobs needing HSM or private network resource.
- `workflow_dispatch` jobs invoked by authorized maintainer.
- Push-triggered jobs on `release/*` branches when GitHub-hosted runners can't satisfy the build.

Every self-hosted runner MUST be ephemeral (`actions/runner --ephemeral`). Long-lived self-hosted runners are forbidden.

## 9. Concurrency

| Workflow | `concurrency.group` | `cancel-in-progress` |
|----------|---------------------|----------------------|
| `pr-validate.yml` | `pr-validate-${{ github.ref }}` | `true` |
| `release.yml` | `release-${{ github.ref }}` | **`false`** (atomic publish) |
| `nightly-audit.yml` | `nightly-audit` | `true` |

`cancel-in-progress: false` on release is non-negotiable.

## 10. Forbidden patterns (CI)

### F-CI-1. Untrusted input interpolated into shell

```yaml
# FORBIDDEN — substitution before shell parsing
- run: |
    echo "PR says: ${{ github.event.pull_request.body }}"
```

Correct:
```yaml
- env: { BODY: ${{ github.event.pull_request.body }} }
  run: printf '%s\n' "$BODY"
```

Same rule for `pull_request.title`, `head_ref`, `issue.title`, comment bodies.

### F-CI-2. Workflow without explicit `permissions:` block
Top-level `permissions:` MUST be present. Default `contents: read`.

### F-CI-3. Tag-based action pinning
40-hex SHA + comment recording version. NEVER `@v4`, `@main`.

### F-CI-4. `pull_request_target` on a fork-controlled checkout
FORBIDDEN BY DEFAULT. Allowed only with all of: security-reviewer sign-off, no checkout of fork's head, only metadata reads.

### F-CI-5. `contents: write` granted workflow-wide "just in case"
Scope per-job.

### F-CI-6. `fetch-depth: 0` without `persist-credentials: false`
Always paired.

### F-CI-7. Self-hosted runner on public-repo `pull_request`
Blanket ban.

## 11. PR-from-fork policy

Fork PRs run with read-only `GITHUB_TOKEN` and no `secrets.*`. Any workflow needing to comment/label a fork PR uses a separate `pull_request_target` workflow that ONLY consumes metadata + is gated by security-reviewer CODEOWNERS approval.

Repo-level "Send write tokens to workflows from pull requests" must be OFF:
```bash
gh api repos/<owner>/<repo>/actions/permissions/workflow \
  --jq '.default_workflow_permissions, .can_approve_pull_request_reviews'
# Expected: "read", false
```

## 12. Adoption checklist (per repo)

Open `feat/ci-blueprint-v1` branch per repo. Each branch:

1. Add `pr-validate.yml` from variant matching runtime (§3).
2. Add `nightly-audit.yml` (§5).
3. Add `release.yml` (§4) for artifact-shipping repos.
4. Add `.github/CODEOWNERS` with `.github/workflows/  @daveai/security-reviewers` (doc 27/38).
5. Set `default_workflow_permissions=read` (§11).
6. Open PR; PR runs `pr-validate.yml` (self-test); merge through doc 18 protection.
7. Run `nightly-audit.yml` once via `workflow_dispatch` to seed check-run name.
8. Append `required_status_checks` to ruleset (§6).
9. Evidence row: repo, PR URL, ruleset PUT response, default_workflow_permissions verification.

`BLOCKER` until all nine evidence rows exist.

## 13. Cross-references

- doc 09 — universal validation; this doc is its CI mechanization.
- doc 18 — branch protection rulesets; §6 integration.
- doc 23 — release provenance; `release.yml` in §4.
- doc 27 — supply-chain hardening; SHA pinning, lockfile-diff, fork policy, CODEOWNERS gate.
- doc 28 — failure routing for nightly-audit failures.
- doc 29 — canonical branch shapes.
- doc 30 — repo promotion path; `Ghenghis/zeroclaw` future row.
- doc 38 — PR template + CODEOWNERS canonical files.
- doc 39 — incident runbook (paged on nightly-audit failure).

## 14. TL;DR

1. Three workflows everywhere: `pr-validate.yml`, `release.yml` (artifact repos only), `nightly-audit.yml`.
2. Default-deny `permissions:`, SHA-pinned actions, no `pull_request_target` checkout of fork code, no untrusted input in shell.
3. `release.yml` refuses to build unless tag is on `release/*` (doc 23).
4. Lockfile changes without `deps` label fail PR (doc 27).
5. Required-status-checks added to doc 18 ruleset only for PR workflows.
6. Self-hosted runners forbidden for fork-triggered jobs; ephemeral if used.
7. Secrets rotated quarterly (90d) or monthly (30d for vendor keys); OIDC keyless preferred.
8. Each repo `BLOCKER` until §12 checklist has nine evidence rows.
