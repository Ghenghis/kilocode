# 30 — ZeroClaw Scope Resolution

> ABSOLUTE RULE: Never commit, merge, rebase, reset, force-push, or push user work directly on `main` or `master`. `main/master` may only mirror upstream after verified backups exist. Any attempted push to `main/master` is a critical failure and must stop the run.

> ZeroClaw is one of the four V3 §00 logical scopes (Zero Claw / Hermes / Kilo Code / Open WebUI / Hub). Earlier docs called it "in-tree only with no standalone repo." That was wrong. This doc supersedes that interpretation.

## Why this doc exists

V3 §00 lists ZeroClaw as a scope. Phase 0 discovery initially found ZeroClaw only inside Kilo Code at `packages/kilo-vscode/src/services/zeroclaw/` and concluded "no standalone repo." A second-pass discovery (run on 2026-04-27 after operator feedback) found:

1. **A standalone Rust workspace** at `G:/Github/upgrade/zeroclaw/` named `zeroclawlabs` v0.6.0, MIT/Apache-2.0, by upstream author `theonlyhennygod`. This is **the canonical ZeroClaw codebase**, but it is **NOT git-init'd locally** and its parent dir `G:/Github/upgrade/` is also not a git repo.
2. **Five in-tree integration adapters** scattered across DaveAI ecosystem repos.
3. **Multiple "kit" / "Clean-Room" reference dirs** that contain ZeroClaw audit artifacts but are not git repos.

The "no standalone repo" claim was therefore drift between the V3 contract scope and the implementation surface. This doc reconciles them.

## Discovered ZeroClaw locations (verified 2026-04-27)

### A — Canonical Rust source (NOT yet git-init'd)
| Path | Lang | Status | Cargo.toml `name`/`version`/`license` |
|---|---|---|---|
| `G:/Github/upgrade/zeroclaw/` | Rust | NOT a git repo | `zeroclawlabs` `0.6.0` MIT OR Apache-2.0 |

The workspace declares members `[".", "crates/robot-kit", "crates/aardvark-sys", "apps/tauri"]` and ships `AGENTS.md`, `CHANGELOG.md`, `CLAUDE.md`, `Dockerfile{,.ci,.debian}`, `Cargo.lock`. Author field: `theonlyhennygod`.

This is **third-party upstream code**. We pin against an upstream tag/commit; we do not own the lineage of this code.

### B — DaveAI in-tree integration adapters (5 found)

| Path | Lang | Role | Host repo |
|---|---|---|---|
| `G:/Github/contract-kit-v17/src/zeroclaw/` | Python | Hub-side adapter | `contract-kit-v17` |
| `G:/Github/hermes-agent-fresh/src/zeroclaw/` | Python | Hermes-side adapter | `hermes-agent-fresh` |
| `G:/Github/hermes.daveai.tech/src/zeroclaw/` | TBD | Website adapter | `hermes.daveai.tech` |
| `G:/Github/kilocode-Azure2/packages/kilo-vscode/src/services/zeroclaw/` | TypeScript | Kilo client | `kilocode-Azure2` |
| `G:/Github/upgrade/zeroclaw/` | Rust | (canonical, see A) | (none — to be promoted) |

### C — Reference / audit / kit dirs (NOT git repos)

| Path | What it is |
|---|---|
| `G:/Github/Claw-Clean-Room/` | "CleanForge clean-room rewrite" project of ZeroClaw; not git-init'd; contains structured audit docs |
| `G:/Github/hermes_master_combined_reviewed_kit/combined_contents/hermes_zero_claw_kit/` | Combined kit dir |
| `G:/Github/testing/hermes_zero_claw_kit/` | Test-context kit |

`PixelClaw` is **unrelated** to ZeroClaw despite the name overlap (it is a separate game/extension product). Do not conflate.

## Canonical scope decision

For the V3 contract going forward:

1. **`G:/Github/upgrade/zeroclaw/` is the canonical ZeroClaw source.** It must be promoted to a real git repo (see Step 1 below) before Phase 1 backups proceed.
2. **The five in-tree adapters are governed by doc 20** (`In-Tree Services Protocol`). Their lifecycle, branch policy, and sync direction relative to the canonical source are doc 20's job.
3. **Branch naming** for ZeroClaw work follows doc 29:
   - On the **canonical Rust source repo** (once promoted): `feat/zeroclaw-rust-<purpose>`, `feat/zeroclaw-runtime-<purpose>`, etc. — see scope tokens for `G:/Github/upgrade/zeroclaw/` in doc 29.
   - On a **host repo with an adapter**: `feat/<host-prefix>-zeroclaw-<purpose>`. E.g. `feat/daveai-zeroclaw-tls-handshake-fix` on `kilocode-Azure2`.
4. **Cross-repo coordination**: when the canonical ZeroClaw API/protocol changes, every adapter must follow the cross-repo protocol from doc 10 + the in-tree drift check from doc 20.
5. **Reference / audit dirs (Section C)** are kept read-only. They are not promoted to git repos.

## Promotion plan for `G:/Github/upgrade/zeroclaw/`

This is a write operation. It must be operator-approved per doc 28 GATE B (post-backup) and **only after** Phase 1 has produced a backup of the directory's current state as a tarball.

```bash
# 0. Backup the directory state first (Phase 1 working-tree archive applies)
EVID="$EVIDENCE_ROOT/zeroclaw-promotion"
mkdir -p "$EVID"
tar --exclude='target' --exclude='node_modules' \
    -czf "$EVID/zeroclaw_pre_init.tar.gz" \
    -C G:/Github/upgrade zeroclaw
sha256sum "$EVID/zeroclaw_pre_init.tar.gz" > "$EVID/SHA256SUMS.txt"

# 1. Determine the upstream identity
#    The author field is theonlyhennygod; check public source location
gh api -X GET "search/repositories" \
       -F q='zeroclawlabs in:name user:theonlyhennygod' \
       --jq '.items[] | {full_name, html_url, default_branch}' \
       2>/dev/null

# 2. If a public upstream exists, the recommended path is:
#    a) Move the local dir aside.
#    b) Clone the upstream into G:/Github/zeroclaw/ as a sibling of other ecosystem repos.
#    c) Diff against the local copy and capture differences as patches under
#       <EVIDENCE_ROOT>/zeroclaw-local-deltas/ for cross-link to feature cards.
#    Operator confirms the upstream URL via `gh repo view <url>`.

# 3. If NO public upstream exists, the local copy IS the canonical:
#    a) cd G:/Github/upgrade/zeroclaw
#    b) git init
#    c) git add . && git commit -m "chore(zeroclaw): seed canonical from upgrade/zeroclaw 2026-04-27"
#    d) Create remote: gh repo create Ghenghis/zeroclaw --private --source=. --push
#    e) git remote add upstream <if applicable> ; git fetch upstream
#    f) Apply doc 17 pre-push hook + doc 18 GitHub ruleset.
#    Then move the directory to G:/Github/zeroclaw/ for path consistency with the rest of the ecosystem.
```

**STOP & ASK**: which path applies (public upstream vs internal-only) requires operator answer. Do not pick silently.

## Updated repo manifest entry (after promotion)

Once promoted, update doc 16 manifest:

```
| Scope label | Path | Role | Origin URL | Upstream URL | Default | Allowed branch prefixes | Blocking concerns |
|---|---|---|---|---|---|---|---|
| ZeroClaw (canonical) | `G:\Github\zeroclaw\` | Rust workspace `zeroclawlabs` | `git@github.com:Ghenghis/zeroclaw.git` (TBD) | `git@github.com:theonlyhennygod/zeroclaw.git` (TBD — verify) | `main` | `feat/zeroclaw-*`, `fix/zeroclaw-*`, `release/zeroclaw-*`, `sync/zeroclaw-upstream-*` | Newly promoted; first commit must be operator-signed |
```

Until promotion, the manifest entry remains:

```
| ZeroClaw | UNPROMOTED at `G:\Github\upgrade\zeroclaw\` (Rust workspace `zeroclawlabs` v0.6.0; NOT git-init'd) | Canonical source | n/a (pending) | INFER FROM `theonlyhennygod` GitHub | `main` (pending) | n/a until promotion | BLOCKED for branch operations until git-init + remote setup completes |
```

## Adapter sync protocol

Each of the five in-tree adapters has an independent host repo lifecycle but a shared dependency on the canonical Rust crate. When the canonical ZeroClaw API changes:

| Step | Action |
|---|---|
| 1 | Operator opens a feature card on the canonical Rust repo: `feat/zeroclaw-rust-<api-change>` |
| 2 | Card declares `cross_repo_links` to every adapter: `kilocode-Azure2:feat/daveai-zeroclaw-<adapter-update>`, `contract-kit-v17:feat/zeroclaw-adapter-<adapter-update>`, etc. |
| 3 | Each adapter PR is opened in its host repo using doc 29 naming + doc 26 quorum |
| 4 | Release-branch assembly (doc 11) merges canonical + all adapters in the same release window |
| 5 | A14 Hub Integration Specialist runs the cross-repo contract test |

**Forbidden**: changing the canonical ZeroClaw protocol on the Rust repo without coordinated PRs against every adapter. Caught by the cross-repo CI gate from doc 10.

## Adapter drift check

```bash
# Run on every release-branch assembly:
SOURCE="G:/Github/zeroclaw"  # post-promotion
for adapter in \
    "G:/Github/contract-kit-v17/src/zeroclaw" \
    "G:/Github/hermes-agent-fresh/src/zeroclaw" \
    "G:/Github/hermes.daveai.tech/src/zeroclaw" \
    "G:/Github/kilocode-Azure2/packages/kilo-vscode/src/services/zeroclaw"
do
  echo "=== drift: $SOURCE vs $adapter ==="
  diff -rq "$SOURCE/protocol" "$adapter/protocol" 2>/dev/null || echo "(adapter has no protocol/ dir — see card)"
done > "$EVIDENCE_ROOT/zeroclaw_drift_$(date -u +%Y%m%d).txt"
```

Drift findings get a feature card per affected adapter under `feat/<host-prefix>-zeroclaw-sync-<date>`.

## What this doc does NOT do

- Does NOT git-init `G:/Github/upgrade/zeroclaw/` automatically. Promotion requires operator approval.
- Does NOT alter any in-tree adapter. Adapters change only via their host repo's feature-branch + quorum process.
- Does NOT promote `Claw-Clean-Room/` or `hermes_zero_claw_kit/`. Those remain reference / audit dirs.
- Does NOT change the relationship between Hermes (canonical) and the in-tree Hermes adapter — that is doc 20's job.

## Cross-references

- `02_20_AGENT_ASSIGNMENT_MAP.md` — A13 Zero Claw Specialist owns the canonical Rust validation gate.
- `10_CROSS_REPO_HUB_AND_ECOSYSTEM_PROTOCOL.md` — cross-repo feature matrix for protocol changes.
- `16_ECOSYSTEM_REPO_MANIFEST.md` — entry to be updated post-promotion.
- `17_PRE_PUSH_HOOK_INSTALLER.md` — apply hook to the new repo after promotion.
- `18_GITHUB_PROTECTION_SETUP.md` — apply GitHub ruleset after first push.
- `19_PER_REPO_COMMAND_PLAYBOOK.md` — playbook to be extended with ZeroClaw rust commands once promoted.
- `20_IN_TREE_SERVICES_PROTOCOL.md` — governs the five in-tree adapters.
- `26_TWENTY_AGENT_DISPATCH_TEMPLATES.md` — A13 Zero Claw Specialist prompt.
- `28_OPERATOR_COMMAND_ORDER.md` — promotion runs at GATE B + 1 (after Phase 1 backups, before Phase 2 upstream truth).
- `29_NAMING_CONVENTION_CANONICAL.md` — `zeroclaw-*` scope tokens.
