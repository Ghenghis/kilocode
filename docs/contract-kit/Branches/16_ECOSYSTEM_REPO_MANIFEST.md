# Ecosystem Repo Manifest

> ABSOLUTE RULE: Never commit, merge, rebase, reset, force-push, or push user work directly on `main` or `master`. `main/master` may only mirror upstream after verified backups exist. Any attempted push to `main/master` is a critical failure and must stop the run.


## Purpose
The V3 Upstream Branch Rescue Contract referenced repos by generic label (Kilo Code, Hermes agents, Open WebUI, Zero Claw, DaveAI Hub). Generic labels caused agents to guess paths, init wrong folders, or operate on stale clones. This manifest is the single source of truth for what each label resolves to on disk, verified 2026-04-27 by Phase 0 read-only discovery. Phase 0 evidence ledger: `G:\Github\_repo_rescue_evidence\2026-04-27\repo_inventory.md`.

Cross-reference: doc 05 (`05_REPO_INVENTORY_AND_UPSTREAM_TRUTH.md`) defines the discovery procedure; doc 08 defines backup/restore proof; doc 10 (`10_CROSS_REPO_HUB_AND_ECOSYSTEM_PROTOCOL.md`) defines cross-repo dependency rules. This doc supplies the concrete identities those docs operate on.

## Canonical repo manifest (V3 §00 in-scope)
| Scope label | Path | Role | Origin URL | Upstream URL | Default | Allowed branch prefixes | Blocking concerns |
|---|---|---|---|---|---|---|---|
| Kilo Code | `G:\Github\kilocode-Azure2` | Primary VS Code extension; Zero Claw lives in-tree | `git@github.com:Ghenghis/kilocode.git` (+ secondary `AiDave71/kilocode`) | `git@github.com:Kilo-Org/kilocode.git` | `main` | `sync/`, `feat/`, `fix/`, `release/`, `review/` | Working tree dirty (`.kilo/governance.json`, `bun.lock`) — must be classified before any branch op |
| Open WebUI | `G:\Github\open-webui-current` | Web UI surface; hosts Hub panel surfaces | `git@github.com:Ghenghis/open-webui.git` | NONE-CONFIGURED — INFER FROM fork-parent metadata: `git@github.com:open-webui/open-webui.git` | `main` | `sync/`, `feat/`, `fix/`, `release/`, `review/` | Currently on `main` ⚠️ — no user work may land here; upstream remote must be added before any sync |
| Hermes agents | `G:\Github\hermes-agent-fresh` | Agent runtime / provider registry | `git@github.com:Ghenghis/hermes-agent.git` | NONE-CONFIGURED — operator-supplied or BLOCKED | `main` | `sync/`, `feat/`, `fix/`, `release/`, `review/` | Untracked: `.git-hooks/`, `scripts/audit/` — classify before commit; upstream unknown |
| Zero Claw | IN-TREE: `G:\Github\kilocode-Azure2\packages\kilo-vscode\src\services\zeroclaw\` | Transport service; not a standalone repo | n/a (covered by Kilo Code remotes) | n/a | n/a | n/a (operate via Kilo Code branches) | Do NOT init as separate repo. UNRELATED to `PixelClaw` despite name overlap |
| DaveAI Hub | `G:\Github\contract-kit-v17` | Internal hub / contract kit (this repo) | `git@github.com:Ghenghis/contract-kit-v17.git` | NONE-CONFIGURED (internal — no upstream) | `integration/main` | `integration/`, `fix/`, `feat/`, `docs/` | `integration/main` 14 commits behind origin; 15+ untracked `.md` files in `docs/Branches/` |

Notes:
- `INFER FROM <source>` means the upstream URL is not configured in `.git/config` and must be confirmed before fetch. Doc 05 defines the inference ladder (fork-parent metadata, README, origin fork relationship, operator confirmation).
- `NONE-CONFIGURED` without an inference target means BLOCKED until operator supplies upstream or confirms there is none.
- Default branch is the branch name `main/master` resolves to in `git remote show origin`. Allowed branch prefixes are the only prefixes new local branches may use during rescue.

## Ancillary repos (rule still applies)
The ABSOLUTE RULE applies to every repo on disk, not only V3 §00 scopes. Ancillary repos must not be force-pushed, reset, or merged on `main/master`.

| Path | Role / status | Origin URL | Upstream URL | Current branch | Dirty? | Notes |
|---|---|---|---|---|---|---|
| `G:\Github\kilocode` | Kilo RVC fork | `git@github.com:Ghenghis/kilocode-RVC.git` | `git@github.com:Kilo-Org/kilocode.git` | `epic/agent-enhancement` | YES (7 files) | Shares upstream with `kilocode-Azure2`; do not cross-merge without explicit operator instruction |
| `G:\Github\kilocode-Azure` | Legacy Kilo clone | `git@github.com:Ghenghis/Kilocode-Azure.git` | NONE-CONFIGURED | `main` ⚠️ | YES (heavy untracked) | Legacy — read-only unless operator scopes a rescue task |
| `G:\Github\kilocode-7.2.4` | Pinned snapshot | (snapshot) | n/a | `clean-master` | YES (`node_modules/` tracked in error) | Do not commit; do not init `node_modules` cleanup without backup |
| `G:\Github\hermes.daveai.tech` | Hermes website | `git@github.com:Ghenghis/hermes.daveai.tech.git` | NONE-CONFIGURED | `master` ⚠️ | NO | Clean but on protected branch — no direct commits |
| `G:\Github\hermes.daveai.tech-new` | New empty repo | (local only) | NONE-CONFIGURED | n/a | n/a | No commits yet; do not push until operator confirms intended remote |
| `G:\Github\open-webui` | Duplicate clone | (matches `open-webui-current`) | (same as canonical) | (matches HEAD `8dae237`) | n/a | Identical HEAD to `open-webui-current` — likely staging clone. Do NOT operate on; treat as read-only mirror until operator decides which is canonical |
| `G:\Github\PixelClaw` | Game/extension | `git@github.com:Ghenghis/PixelClaw.git` | NONE-CONFIGURED | `main` ⚠️ | YES (10+ files) | UNRELATED to ZeroClaw despite the "Claw" name overlap. Do not confuse |

## Not-a-git-repo paths
The following paths under `G:\Github\` are NOT git repositories. Agents must not run `git init`, `git clone`, or any push/pull against them. They are workspace folders, archives, or staging dirs.

```
G:\Github\kilocode-7.2.3
G:\Github\hermes-agent
G:\Github\hermes-agent-2026.4.13
G:\Github\hermes_master_combined_reviewed_kit
G:\Github\Claw-Clean-Room
```

If a future task requires git history for any of these, escalate to operator — do not init silently.

## Repo identity check
Before any branch op, agents must verify the folder on disk matches the manifest entry. Run this exact recipe from the candidate folder. Any mismatch = stop and escalate.

```bash
# 1. Confirm it is a git work tree at the expected root
git rev-parse --is-inside-work-tree
git rev-parse --show-toplevel

# 2. Confirm origin URL matches manifest exactly (case-sensitive)
git remote get-url origin

# 3. Confirm upstream URL matches manifest (or confirm NONE-CONFIGURED)
git remote get-url upstream 2>/dev/null || echo "NONE-CONFIGURED"

# 4. Confirm default branch matches manifest
git remote show origin | grep -E "HEAD branch"

# 5. Confirm current branch and dirty state for the run log
git branch --show-current
git status --short --branch
```

Pass criteria — all four must hold:
1. `show-toplevel` equals the manifest path exactly (case-sensitive on case-sensitive filesystems; on Windows, normalize with `cygpath -w` or `realpath`).
2. `origin` URL matches the manifest entry verbatim.
3. `upstream` URL matches the manifest entry verbatim, OR the manifest says `NONE-CONFIGURED` and the candidate has none.
4. `HEAD branch` (the `git remote show origin` "HEAD branch" line) matches the manifest's default branch.

Fail action: stop the run, write the mismatch to the evidence ledger, escalate to operator. Do not "fix" by editing remotes — manifest is source of truth; remote drift is itself a finding.

## Manifest update protocol
Who may edit:
- Operator (Admin) directly.
- An agent only when the operator opens a scoped task whose explicit deliverable is a manifest update, AND a fresh Phase 0 ledger has been written under `G:\Github\_repo_rescue_evidence\<YYYY-MM-DD>\repo_inventory.md`.

When it must be re-verified:
- At the start of every rescue run (Phase 0).
- Whenever a repo is renamed, transferred, or its upstream changes.
- Whenever a path moves on disk.
- Whenever an ancillary repo is promoted to or demoted from V3 §00 scope.
- Quarterly, even if no change is suspected.

Audit log location:
```
G:\Github\_repo_rescue_evidence\<YYYY-MM-DD>\repo_inventory.md     # Phase 0 ledger (raw)
G:\Github\_repo_rescue_evidence\<YYYY-MM-DD>\manifest_diff.md      # Diff vs prior manifest, if changed
G:\Github\contract-kit-v17\docs\Branches\16_ECOSYSTEM_REPO_MANIFEST.md  # This file (current truth)
```

A manifest edit must include:
1. The Phase 0 ledger path that justifies the edit.
2. A diff section in `manifest_diff.md` showing old vs new for every changed row.
3. A commit on `docs/<scope>` branch (NOT on `integration/main`, NOT on `main`) — see ABSOLUTE RULE.
4. Operator sign-off recorded in the commit message.

## Cross-references
- `05_REPO_INVENTORY_AND_UPSTREAM_TRUTH.md` — discovery procedure and divergence proof commands. This manifest is the canonical output of that procedure.
- `08_*` — backup and restore proof requirements. Every repo in this manifest must have backups before any branch op.
- `10_CROSS_REPO_HUB_AND_ECOSYSTEM_PROTOCOL.md` — cross-repo dependency rules. Use the `Scope label` column in this manifest as the key for that doc's feature matrix.
- Phase 0 ledger: `G:\Github\_repo_rescue_evidence\2026-04-27\repo_inventory.md` — the raw evidence behind every row above.
