# 29 — Canonical Branch Naming Convention

> ABSOLUTE RULE: Never commit, merge, rebase, reset, force-push, or push user work directly on `main` or `master`. `main/master` may only mirror upstream after verified backups exist. Any attempted push to `main/master` is a critical failure and must stop the run.

> Canonical truth. When any other V3 doc shows a different shape (e.g. `feature/...` vs `feat/...`), this doc wins.

## Purpose

Phase 0 discovery + parallel-agent doc-drafting in this kit produced inconsistent branch naming across docs:
- Doc 07 used `feature/<scope>-<purpose>`
- Doc 17 used `feature/...`
- Doc 19 used `feat/daveai-...` (shortened prefix + `daveai-` infix)
- Doc 20 used `feature/hermes-...`

That drift is itself a contract violation: agents cannot quorum-approve a branch whose name shape is ambiguous. This doc nails it down.

It also reflects the **observed convention in the actual ecosystem repos**, taken from Phase 0 discovery:
- `kilocode-Azure2`: uses `sync/`, `feat/`, `fix/`, `release/`, `review/`
- `kilocode` (RVC fork): uses `epic/`, `feat/`, `fix/`
- `contract-kit-v17`: uses `integration/`, `feat/`, `fix/`, `docs/`

The repos use the **short** form (`feat/`, `fix/`, `chore/`, `docs/`). The contract canonicalizes on that.

---

## Canonical prefix grammar

```
<prefix>/<scope>-<specific-purpose>[-<discriminator>]
```

Where:

| Field | Meaning | Constraint |
|---|---|---|
| `<prefix>` | One of the canonical prefixes below | Required, lowercase, never plural |
| `<scope>` | Subsystem / package / service identifier | Required, lowercase, kebab-case, repo-aware (see "Scope tokens" below) |
| `<specific-purpose>` | Short imperative phrase describing the change | Required, lowercase, kebab-case, ≥2 words preferred |
| `<discriminator>` | Optional disambiguator (date, version, ticket id) | Lowercase, alphanumeric+hyphen |

Total length: ≤ 80 characters. Must satisfy regex:

```
^(feat|fix|chore|docs|test|refactor|perf|integration|sync|release|hotfix|review|archive|epic)/[a-z0-9][a-z0-9-]*(/[a-z0-9-]+)?$
```

Slashes after the prefix are allowed only inside `<scope>` (e.g. `feat/owui-backend/hub-bridge`) — used sparingly.

---

## Canonical prefix table

| Prefix | When to use | Example |
|---|---|---|
| `feat/` | New feature work, user-visible or internal | `feat/daveai-hermes-orchestrator-retry` |
| `fix/` | Bug fix, no new feature surface | `fix/daveai-zeroclaw-tls-handshake` |
| `chore/` | Maintenance, deps update, build-config change | `chore/kilo-vscode-bun-deps-bump` |
| `docs/` | Docs-only change | `docs/branches-canonical-naming` |
| `test/` | Test additions or refactors only | `test/owui-backend-pytest-coverage` |
| `refactor/` | Pure refactor, no behavior change | `refactor/hub-routing-shim` |
| `perf/` | Performance optimization, no behavior change | `perf/zeroclaw-rust-encoder` |
| `integration/` | Cross-repo integration work | `integration/kilo-hub-tab-api-bump` |
| `sync/` | Upstream cherry-pick stream | `sync/upstream-cherry-2026-04-26` |
| `release/` | Release branch (Phase 9 only) | `release/kilo-2026-04-27` |
| `hotfix/` | Emergency patch against a release branch | `hotfix/kilo-7.2.21-canary-2-vsix-loader` |
| `review/` | Time-boxed review/audit branch | `review/active-fileset-import` |
| `archive/` | Frozen branch kept for blame trail | `archive/feat-daveai-hermes-v1-2026-03-10` |
| `epic/` | Long-lived integration of many feats (rare) | `epic/agent-enhancement` |

Forbidden generic names (per doc 07 + doc 24 F5.2):
- `update`, `changes`, `dave-work`, `final`, `new-version`, `backup`, `main-copy`, `my-changes`, `tmp`, `wip`, `feature/update`, `feat/fix`, `fix/bug`, `chore/cleanup`.

---

## Scope tokens (canonical, per repo)

These are the only `<scope>` values agents may use without operator approval. Adding a new scope token requires updating this table via a PR on `docs/branches-*` branch.

### Repo: `kilocode-Azure2` (Kilo Code)

| Scope token | Maps to | In-tree path |
|---|---|---|
| `daveai-hermes` | DaveAI Hermes service (in-tree) | `packages/kilo-vscode/src/services/hermes/` |
| `daveai-zeroclaw` | DaveAI ZeroClaw client (in-tree) | `packages/kilo-vscode/src/services/zeroclaw/` |
| `daveai-routing` | Provider-routing service | `packages/kilo-vscode/src/services/routing/` |
| `daveai-ssh` | SSH service | `packages/kilo-vscode/src/services/ssh/` |
| `daveai-vps` | VPS service | `packages/kilo-vscode/src/services/vps/` |
| `daveai-memory` | Memory service | `packages/kilo-vscode/src/services/memory/` |
| `daveai-training` | Training service | `packages/kilo-vscode/src/services/training/` |
| `daveai-governance` | Governance service | `packages/kilo-vscode/src/services/governance/` |
| `daveai-hub-ui` | HubTab + Hub UI surfaces | `packages/kilo-vscode/webview-ui/src/components/settings/HubTab.tsx` (and adjacent) |
| `daveai-voice` | Azure voice / VoiceSelector | `packages/kilo-vscode/webview-ui/src/components/chat/VoiceSelector.tsx` |
| `daveai-auto-update` | Auto-update service | `packages/kilo-vscode/src/services/auto-update/` |
| `daveai-marketplace` | Marketplace installer | `packages/kilo-vscode/src/services/marketplace/` |
| `kilo-vscode` | Generic kilo-vscode (non-DaveAI surfaces) | `packages/kilo-vscode/...` |
| `opencode` | Upstream-tracked opencode package | `packages/opencode/` |
| `webview-ui` | Generic webview UI (no specific service) | `packages/kilo-vscode/webview-ui/...` |

### Repo: `kilocode` (RVC fork)

Same scope tokens as `kilocode-Azure2` plus `rvc` for RVC-specific work. Branches that share scope with the canonical fork must be cross-linked in feature cards.

### Repo: `open-webui-current` (Open WebUI)

| Scope token | Maps to |
|---|---|
| `owui-backend` | Backend (Python FastAPI) |
| `owui-frontend` | Frontend (SvelteKit) |
| `owui-pipelines` | Pipelines / functions |
| `owui-hub-bridge` | Hub integration layer (the WebUI side of the contract) |

### Repo: `hermes-agent-fresh` (Hermes standalone)

| Scope token | Maps to |
|---|---|
| `hermes-orch` | Orchestrator core |
| `hermes-providers` | Provider registry / routing |
| `hermes-runtime` | Runtime / job queue |
| `hermes-api` | HTTP API surface |

### Repo: `G:/Github/upgrade/zeroclaw/` (ZeroClaw upstream — see doc 30)

| Scope token | Maps to |
|---|---|
| `zeroclaw-rust` | Rust workspace `zeroclawlabs` |
| `zeroclaw-runtime` | Runtime crate |
| `zeroclaw-tauri` | `apps/tauri` shell |
| `zeroclaw-aardvark` | `crates/aardvark-sys` |
| `zeroclaw-robot-kit` | `crates/robot-kit` |

### Repo: `contract-kit-v17` (DaveAI Hub)

| Scope token | Maps to |
|---|---|
| `hub` | Hub UI assets / cross-cutting hub |
| `hub-api` | `src/webui/hub/` FastAPI surface |
| `hub-services` | `src/webui/hub/services/` health monitor |
| `hermes-adapter` | `src/hermes/` (Hub-side adapter) |
| `zeroclaw-adapter` | `src/zeroclaw/` (Hub-side adapter) |
| `blockchain-audit` | `src/blockchain_audit/` |
| `runtime` | `src/runtime/` |
| `branches` | `docs/Branches/` (this contract) |

### Repo: `hermes.daveai.tech` (Hermes website)

| Scope token | Maps to |
|---|---|
| `web-frontend` | Static / SPA frontend |
| `web-zeroclaw` | `src/zeroclaw/` integration in the web stack |

### Repo: `PixelClaw`

PixelClaw is unrelated to ZeroClaw despite the name. Its scope tokens are PixelClaw-specific (`extension`, `webview-ui`, `assets`). Do NOT cross-claim ZeroClaw scope into PixelClaw branches.

---

## Reserved branch names (per repo)

These names are **protected** (doc 17 + doc 21) and must NOT be created or deleted as feature branches:

| Repo | Protected names |
|---|---|
| `kilocode-Azure2` | `main`, `master` (defensive), `integration/main` (defensive) |
| `kilocode` | `main`, `master` |
| `kilocode-Azure` | `main`, `master` |
| `kilocode-7.2.4` | `clean-master`, `main`, `master` |
| `open-webui-current` / `open-webui` | `main`, `master` |
| `hermes-agent-fresh` | `main`, `master` |
| `hermes.daveai.tech` | `master`, `main` (defensive) |
| `hermes.daveai.tech-new` | `main`, `master` |
| `contract-kit-v17` | `integration/main`, `main` (defensive), `master` (defensive) |
| `PixelClaw` | `main`, `master` |

The `protected-branches` config file (doc 17) for each repo includes the entries above plus defensive `main` + `master` even where the local default differs.

---

## Discriminators (when needed)

Append `-<discriminator>` only when:

- A name collision would otherwise occur with an existing branch.
- A re-extraction is needed because the prior attempt was abandoned/blocked.
- The change is dated by nature (sync/release/audit branches).

Acceptable discriminators:
- ISO date: `-2026-04-27`
- SemVer / RC tag: `-7.2.21-canary.2`
- Sequence: `-v2`, `-v3` (only after archiving the prior, see doc 24 F5.1)
- Ticket id: `-issue-1234` (when a real issue exists)

Forbidden discriminators: `-final`, `-real`, `-actual`, `-old`, `-new`, `-test`, `-temp`, `-wip`, `-`. Anything that does not survive being read aloud six months later.

---

## Quick examples — APPROVED

```
feat/daveai-hermes-orchestrator-retry-policy
feat/daveai-zeroclaw-tls-handshake-fix
feat/daveai-hub-ui-tab-reorder
feat/daveai-voice-azure-voice-preview
feat/owui-backend-hub-bridge
feat/owui-frontend-hub-panel
feat/hermes-orch-provider-failover
feat/hermes-providers-minimax-quota-fix
feat/zeroclaw-rust-tauri-handshake
feat/hub-api-services-health-stream
fix/daveai-routing-siliconflow-tld-typo
fix/owui-backend-pytest-deprecation
chore/kilo-vscode-bun-deps-bump
chore/hub-ruff-config-update
docs/branches-canonical-naming
docs/branches-operator-command-order
test/owui-backend-pytest-coverage
refactor/hub-routing-shim
perf/zeroclaw-rust-encoder
integration/kilo-hub-tab-api-bump
integration/owui-hub-bridge-protocol-v2
sync/upstream-cherry-2026-04-26
sync/kilo-org-2026-04-27
release/kilo-2026-04-27
release/hub-2026-04-27
release/daveai-v7.2.21-canary
hotfix/kilo-7.2.21-canary-2-vsix-loader
review/active-fileset-import
review/contract-v3-doc-audit-2026-04-27
archive/feat-daveai-hermes-v1-2026-03-10
epic/agent-enhancement
```

## Quick examples — REJECTED

```
feature/hermes              → use feat/daveai-hermes-<purpose>
feat/hermes                 → missing daveai- prefix when in kilocode-Azure2 in-tree
feat/Update                 → uppercase + generic
feat/fix-stuff              → generic + ambiguous prefix
feat/                       → empty body
feat/daveai-hermes          → no <specific-purpose>
feat-daveai-hermes-retry    → wrong delimiter (dash before scope)
my-changes                  → no prefix at all
main-copy                   → forbidden (suggests cloning protected ref)
backup                      → forbidden
final                       → forbidden discriminator-shaped name
WIP-2026-04-27              → uppercase + reserved word
```

---

## Cross-doc reconciliation

Where any other V3 doc disagrees with this doc, the other doc is **superseded** for the disagreement only. Specifically (as of 2026-04-27):

| Doc | Disagreement | Reconciled to |
|---|---|---|
| 07 | Used `feature/<scope>-<purpose>` | Use `feat/<scope>-<purpose>` |
| 17 | Used `feature/...` in installer comments | Use `feat/...` |
| 19 | Used `feat/daveai-*` ✅ already canonical | (keep) |
| 20 | Used `feature/hermes-*` | Use `feat/daveai-hermes-*` (in-tree case) |
| 26 | Referenced doc 29 — now anchored | (keep) |

The next doc-update PR should rewrite all 5 references in docs 07/17/20 to the canonical shape and delete this reconciliation table from this doc once consistent.

---

## Validator script

Save as `<EVIDENCE_ROOT>/scripts/validate_branch_name.sh`:

```bash
#!/usr/bin/env bash
# validate_branch_name.sh <branch-name>
# Exit 0 = valid; exit 1 = invalid + reason on stderr
set -u
B="${1:-}"
if [ -z "$B" ]; then echo "usage: $0 <branch-name>" >&2; exit 64; fi

if [ ${#B} -gt 80 ]; then
  echo "REJECT: length ${#B} > 80" >&2; exit 1
fi

if [[ ! "$B" =~ ^(feat|fix|chore|docs|test|refactor|perf|integration|sync|release|hotfix|review|archive|epic)/[a-z0-9][a-z0-9-]*(/[a-z0-9-]+)?$ ]]; then
  echo "REJECT: does not match canonical regex (doc 29)" >&2; exit 1
fi

case "$B" in
  feat/update|feat/fix|fix/bug|chore/cleanup|main-copy|backup|final|tmp|wip|*-final|*-real|*-actual|*-old|*-new)
    echo "REJECT: matches forbidden generic name" >&2; exit 1 ;;
esac

# Reserved name guard
case "$B" in
  main|master|integration/main|clean-master)
    echo "REJECT: protected branch name" >&2; exit 1 ;;
esac

echo "OK: $B" >&2
exit 0
```

Run before every `git switch -c <branch>`:

```bash
bash validate_branch_name.sh "feat/daveai-hermes-retry" && \
  git switch -c feat/daveai-hermes-retry upstream/main
```

A02 Git Safety Officer (doc 26) MUST call this validator before APPROVING any branch-create command.

---

## Cross-references

- `07_BRANCH_NAMING_CONVENTION_PROTOCOL.md` — V3 original; superseded by this doc on prefix shape.
- `16_ECOSYSTEM_REPO_MANIFEST.md` — repo identity (allowed prefixes column).
- `17_PRE_PUSH_HOOK_INSTALLER.md` — protected-branches config consumes the reserved table here.
- `21_NON_STANDARD_DEFAULT_BRANCHES.md` — non-`main` defaults (`integration/main`, `clean-master`) covered in protected list.
- `26_TWENTY_AGENT_DISPATCH_TEMPLATES.md` — A02 / A06 / A08 must invoke `validate_branch_name.sh`.
- `28_OPERATOR_COMMAND_ORDER.md` — Step 7 GATE C signs off on the feature-card branch-name set.
