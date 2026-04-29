# Per-Repo Command Playbook

> ABSOLUTE RULE: Never commit, merge, rebase, reset, force-push, or push user work directly on `main` or `master`. `main/master` may only mirror upstream after verified backups exist. Any attempted push to `main/master` is a critical failure and must stop the run.

This playbook resolves every `<repo_name>` / `<branch_name>` / `<evidence_root>` placeholder in docs 03, 04, and 09 with concrete copy-paste commands tailored to each ecosystem repo. Run as bash (Git Bash / WSL). Where Cygwin path conversion bites, the PowerShell equivalent is given.

Evidence root for runs on 2026-04-27:

```bash
export EVIDENCE_ROOT="G:/Github/_repo_rescue_evidence/2026-04-27"
mkdir -p "$EVIDENCE_ROOT" "$EVIDENCE_ROOT/restore_tmp" "$EVIDENCE_ROOT/proof_logs"
```

## How to use this playbook

Five primary scopes follow. Within each scope, commands appear in Phase 0 to Phase 9 order. Every command is concrete: no `<placeholders>`, no "your repo here". ZeroClaw is in-tree under Repo 1 (Kilo Code) and shares its pipeline. Run the read-only Phase 0 block first for every repo before touching backups.

---

## Repo 1 — Kilo Code (`G:\Github\kilocode-Azure2`)

- Default branch: `main`
- Origin: `github.com/Ghenghis/kilocode` (also pushed to `AiDave71/kilocode`)
- Upstream: `github.com/Kilo-Org/kilocode` (already configured as `upstream`)
- Build: `bun` at root; pnpm-workspace layout under `packages/`
- Custom DaveAI surfaces (do NOT lose): `packages/kilo-vscode/src/services/{hermes,zeroclaw,routing,ssh,vps,memory,training,governance}`

### Phase 0 — Freeze and preserve (read-only)

```bash
cd /g/Github/kilocode-Azure2
git --version
git rev-parse --show-toplevel
git rev-parse HEAD
git status --short --branch
git branch -avv
git remote -v
git log --oneline --decorate --graph -n 80
git reflog --date=iso -n 80
git ls-files --others --exclude-standard
```

Capture all output to:

```bash
mkdir -p "$EVIDENCE_ROOT/kilocode-Azure2/phase0"
{
  git status --short --branch
  echo "---"
  git rev-parse HEAD
  echo "---"
  git branch -avv
  echo "---"
  git remote -v
  echo "---"
  git reflog --date=iso -n 80
} > "$EVIDENCE_ROOT/kilocode-Azure2/phase0/snapshot.txt"
```

### Phase 1 — Backup before mutation

```bash
mkdir -p "$EVIDENCE_ROOT/kilocode-Azure2"

# 1. Mirror clone
git clone --mirror "G:/Github/kilocode-Azure2" \
  "$EVIDENCE_ROOT/kilocode-Azure2/kilocode-Azure2.mirror.git"

# 2. Bundle
cd /g/Github/kilocode-Azure2
git bundle create "$EVIDENCE_ROOT/kilocode-Azure2/kilocode-Azure2.bundle" --all

# 3. Working tree archive (excludes only after listing them)
ls -la node_modules .turbo .next dist build .cache 2>/dev/null \
  > "$EVIDENCE_ROOT/kilocode-Azure2/phase0/excluded-folders.txt"

tar --exclude='node_modules' \
    --exclude='.turbo' \
    --exclude='.next' \
    --exclude='dist' \
    --exclude='build' \
    --exclude='.cache' \
    -czf "$EVIDENCE_ROOT/kilocode-Azure2/kilocode-Azure2.worktree.tar.gz" \
    -C /g/Github kilocode-Azure2

# 4. Hash backups
sha256sum \
  "$EVIDENCE_ROOT/kilocode-Azure2/kilocode-Azure2.bundle" \
  "$EVIDENCE_ROOT/kilocode-Azure2/kilocode-Azure2.worktree.tar.gz" \
  > "$EVIDENCE_ROOT/kilocode-Azure2/SHA256SUMS.txt"

# 5. Restore proof — mirror
git clone "$EVIDENCE_ROOT/kilocode-Azure2/kilocode-Azure2.mirror.git" \
  "$EVIDENCE_ROOT/restore_tmp/kilocode-Azure2_mirror_restore"
( cd "$EVIDENCE_ROOT/restore_tmp/kilocode-Azure2_mirror_restore" && \
  git rev-parse HEAD && git branch -avv ) \
  > "$EVIDENCE_ROOT/kilocode-Azure2/phase0/mirror_restore_proof.txt"

# 6. Restore proof — bundle
git clone "$EVIDENCE_ROOT/kilocode-Azure2/kilocode-Azure2.bundle" \
  "$EVIDENCE_ROOT/restore_tmp/kilocode-Azure2_bundle_restore"
( cd "$EVIDENCE_ROOT/restore_tmp/kilocode-Azure2_bundle_restore" && \
  git rev-parse HEAD && git branch -avv ) \
  > "$EVIDENCE_ROOT/kilocode-Azure2/phase0/bundle_restore_proof.txt"
```

### Phase 2 — Remote and upstream truth

```bash
cd /g/Github/kilocode-Azure2
git remote -v
git fetch origin --prune
git fetch upstream --prune
git rev-parse HEAD
git rev-parse origin/main
git rev-parse upstream/main
git rev-list --left-right --count main...upstream/main
git merge-base main upstream/main
git log --oneline --graph --decorate main..upstream/main | head -n 80
git log --oneline --graph --decorate upstream/main..main | head -n 80
```

### Phase 3 — Main contamination inventory

```bash
mkdir -p "$EVIDENCE_ROOT/kilocode-Azure2/phase3"
git diff --name-status upstream/main..main \
  > "$EVIDENCE_ROOT/kilocode-Azure2/phase3/files-diff.txt"
git log upstream/main..main --oneline \
  > "$EVIDENCE_ROOT/kilocode-Azure2/phase3/local-only-commits.txt"
git diff --diff-filter=R --name-status upstream/main..main \
  > "$EVIDENCE_ROOT/kilocode-Azure2/phase3/renames.txt"
git diff --stat=200 upstream/main..main -- '*.lock' '*.lockb' '*.png' '*.jpg' '*.zip' '*.bin' \
  > "$EVIDENCE_ROOT/kilocode-Azure2/phase3/binaries.txt"
git submodule status \
  > "$EVIDENCE_ROOT/kilocode-Azure2/phase3/submodules.txt"
git diff upstream/main..main -- 'package.json' 'pnpm-lock.yaml' 'bun.lock' '**/package.json' \
  > "$EVIDENCE_ROOT/kilocode-Azure2/phase3/dep-changes.diff"
```

### Phase 4 — Feature fingerprinting (cluster by directory)

```bash
git diff --name-only upstream/main..main \
  | awk -F/ '{print $1"/"$2"/"$3}' \
  | sort | uniq -c | sort -rn \
  > "$EVIDENCE_ROOT/kilocode-Azure2/phase3/cluster-by-dir.txt"

# DaveAI services cluster (these MUST end up on dedicated branches)
git diff --name-only upstream/main..main -- \
  'packages/kilo-vscode/src/services/hermes/**' \
  'packages/kilo-vscode/src/services/zeroclaw/**' \
  'packages/kilo-vscode/src/services/routing/**' \
  'packages/kilo-vscode/src/services/ssh/**' \
  'packages/kilo-vscode/src/services/vps/**' \
  'packages/kilo-vscode/src/services/memory/**' \
  'packages/kilo-vscode/src/services/training/**' \
  'packages/kilo-vscode/src/services/governance/**' \
  > "$EVIDENCE_ROOT/kilocode-Azure2/phase3/daveai-services.txt"
```

### Phase 5 — Branch naming

```bash
git branch -a --format='%(refname:short)' | sort \
  > "$EVIDENCE_ROOT/kilocode-Azure2/phase3/all-branches.txt"
```

Expected prefixes for new extracted branches in this repo:

- `feat/daveai-hermes-*`
- `feat/daveai-zeroclaw-*`
- `feat/daveai-routing-*`
- `feat/daveai-ssh-*`
- `feat/daveai-vps-*`
- `feat/daveai-memory-*`
- `feat/daveai-training-*`
- `feat/daveai-governance-*`
- `fix/kilo-vscode-*`
- `chore/kilo-deps-*`
- `docs/kilo-*`

Reject any generic name; doc 03 step 60 forbids `feature/update`.

### Phase 6 — Branch extraction

```bash
# Always base off upstream, never polluted local main
git fetch upstream --prune
git checkout -b feat/daveai-hermes-extract upstream/main

# Cherry-pick path (preferred when commits are clean)
git log --oneline --reverse upstream/main..main \
  -- packages/kilo-vscode/src/services/hermes/ \
  > /tmp/hermes-commits.txt
# review /tmp/hermes-commits.txt, then:
git cherry-pick <SHA1> <SHA2> ...

# Patch path (when commits are tangled with unrelated changes)
git diff upstream/main..main \
  -- packages/kilo-vscode/src/services/hermes/ \
  > /tmp/hermes.patch
git apply --index --3way /tmp/hermes.patch
git commit -m "feat(daveai-hermes): extract from polluted main"

# File-checkout path (when only the final state matters)
git checkout main -- packages/kilo-vscode/src/services/hermes/
git add -A packages/kilo-vscode/src/services/hermes/
git commit -m "feat(daveai-hermes): bring forward final state"
```

### Phase 7 — Clean main sync (DESTRUCTIVE — gated)

```bash
# Only after Phase 1 restore proof exists AND every DaveAI service is on its own branch
test -s "$EVIDENCE_ROOT/kilocode-Azure2/phase0/mirror_restore_proof.txt" || { echo BLOCKED; exit 1; }
test -s "$EVIDENCE_ROOT/kilocode-Azure2/phase0/bundle_restore_proof.txt" || { echo BLOCKED; exit 1; }

git fetch upstream --prune
git checkout main
git reset --hard upstream/main
# DO NOT push to origin/main unless explicitly authorized — fork-sync only.
git status --short --branch \
  > "$EVIDENCE_ROOT/kilocode-Azure2/phase0/sync_proof.txt"
```

### Phase 8 — Cross-repo validation (build)

```bash
cd /g/Github/kilocode-Azure2
bun install
bun run typecheck  # per-package via workspace
bun run lint       # warnings expected — see packages/kilo-vscode/package.json
bun test
cd packages/kilo-vscode && npx --yes @vscode/vsce package --no-dependencies
```

### Phase 9 — Release branch

```bash
git checkout -b release/kilo-2026-04-27 upstream/main
git merge --no-ff feat/daveai-hermes-extract
git merge --no-ff feat/daveai-zeroclaw-extract
git merge --no-ff feat/daveai-routing-extract
# repeat per approved branch
bun install && bun run typecheck && bun test
git tag -a kilo-rc-2026-04-27 -m "Release candidate 2026-04-27"
```

ZeroClaw rollup: lives at `packages/kilo-vscode/src/services/zeroclaw/`. Tests at `packages/kilo-vscode/src/services/zeroclaw/__tests__/`. Validate via `bun test --filter zeroclaw` (run from `packages/kilo-vscode`). No separate Phase 0–9 cycle.

---

## Repo 2 — Open WebUI (`G:\Github\open-webui-current`)

- Duplicate copy: `G:\Github\open-webui` (treat as backup-only; do not modify)
- Default: `main`
- Origin: `github.com/Ghenghis/open-webui`
- Upstream: NOT YET CONFIGURED — true upstream is `github.com/open-webui/open-webui`
- Build: Python (uv/poetry) backend + SvelteKit (npm/pnpm) frontend

### Phase 0

```bash
cd /g/Github/open-webui-current
git rev-parse --show-toplevel
git status --short --branch
git branch -avv
git remote -v
git log --oneline -n 60
mkdir -p "$EVIDENCE_ROOT/open-webui-current/phase0"
git status --short --branch \
  > "$EVIDENCE_ROOT/open-webui-current/phase0/snapshot.txt"
```

### Phase 1

```bash
mkdir -p "$EVIDENCE_ROOT/open-webui-current"

git clone --mirror "G:/Github/open-webui-current" \
  "$EVIDENCE_ROOT/open-webui-current/open-webui-current.mirror.git"

cd /g/Github/open-webui-current
git bundle create "$EVIDENCE_ROOT/open-webui-current/open-webui-current.bundle" --all

tar --exclude='node_modules' \
    --exclude='.venv' \
    --exclude='venv' \
    --exclude='.svelte-kit' \
    --exclude='dist' \
    --exclude='build' \
    --exclude='__pycache__' \
    -czf "$EVIDENCE_ROOT/open-webui-current/open-webui-current.worktree.tar.gz" \
    -C /g/Github open-webui-current

sha256sum \
  "$EVIDENCE_ROOT/open-webui-current/open-webui-current.bundle" \
  "$EVIDENCE_ROOT/open-webui-current/open-webui-current.worktree.tar.gz" \
  > "$EVIDENCE_ROOT/open-webui-current/SHA256SUMS.txt"

git clone "$EVIDENCE_ROOT/open-webui-current/open-webui-current.mirror.git" \
  "$EVIDENCE_ROOT/restore_tmp/open-webui-current_mirror_restore"
( cd "$EVIDENCE_ROOT/restore_tmp/open-webui-current_mirror_restore" && \
  git rev-parse HEAD && git branch -avv ) \
  > "$EVIDENCE_ROOT/open-webui-current/phase0/mirror_restore_proof.txt"
```

### Phase 2 — ADD UPSTREAM FIRST

```bash
cd /g/Github/open-webui-current
# Upstream is missing — Phase 2 cannot proceed without this:
git remote add upstream https://github.com/open-webui/open-webui.git
git fetch upstream --prune
git remote -v > "$EVIDENCE_ROOT/open-webui-current/phase0/remotes_after.txt"
git rev-list --left-right --count main...upstream/main
git merge-base main upstream/main
```

### Phase 3

```bash
mkdir -p "$EVIDENCE_ROOT/open-webui-current/phase3"
git diff --name-status upstream/main..main \
  > "$EVIDENCE_ROOT/open-webui-current/phase3/files-diff.txt"
git log upstream/main..main --oneline \
  > "$EVIDENCE_ROOT/open-webui-current/phase3/local-only-commits.txt"
git diff upstream/main..main -- 'pyproject.toml' 'requirements.txt' 'package.json' 'package-lock.json' \
  > "$EVIDENCE_ROOT/open-webui-current/phase3/dep-changes.diff"
```

### Phase 4

```bash
git diff --name-only upstream/main..main \
  | awk -F/ '{print $1"/"$2}' | sort | uniq -c | sort -rn \
  > "$EVIDENCE_ROOT/open-webui-current/phase3/cluster-by-dir.txt"
# Critical surfaces:
git diff --name-only upstream/main..main -- 'backend/**' \
  > "$EVIDENCE_ROOT/open-webui-current/phase3/backend-changes.txt"
git diff --name-only upstream/main..main -- 'src/**' \
  > "$EVIDENCE_ROOT/open-webui-current/phase3/frontend-changes.txt"
git diff --name-only upstream/main..main -- 'pipelines/**' \
  > "$EVIDENCE_ROOT/open-webui-current/phase3/pipelines-changes.txt"
```

### Phase 5

```bash
git branch -a --format='%(refname:short)' | sort \
  > "$EVIDENCE_ROOT/open-webui-current/phase3/all-branches.txt"
```

Expected prefixes:

- `feat/owui-backend-*`
- `feat/owui-frontend-*`
- `feat/owui-pipelines-*`
- `fix/owui-*`
- `chore/owui-deps-*`

### Phase 6

```bash
git fetch upstream --prune
git checkout -b feat/owui-backend-hub-bridge upstream/main
git diff upstream/main..main -- backend/ > /tmp/owui-backend.patch
git apply --index --3way /tmp/owui-backend.patch
git commit -m "feat(owui): backend hub bridge extraction"
```

### Phase 7

```bash
test -s "$EVIDENCE_ROOT/open-webui-current/phase0/mirror_restore_proof.txt" || { echo BLOCKED; exit 1; }
git fetch upstream --prune
git checkout main
git reset --hard upstream/main
# DO NOT push origin/main without explicit authorization
```

### Phase 8

```bash
cd /g/Github/open-webui-current
# Backend
python -m venv .venv && source .venv/Scripts/activate
python -m pip install -r backend/requirements.txt
python -m pytest backend/
# Frontend
npm ci
npm run lint
npm run check     # svelte-check
npm run build
```

### Phase 9

```bash
git checkout -b release/owui-2026-04-27 upstream/main
git merge --no-ff feat/owui-backend-hub-bridge
git merge --no-ff feat/owui-frontend-hub-bridge
npm ci && npm run build
python -m pytest backend/
git tag -a owui-rc-2026-04-27 -m "OWUI release candidate 2026-04-27"
```

---

## Repo 3 — Hermes (`G:\Github\hermes-agent-fresh`)

- Default: `main`
- Origin: `github.com/Ghenghis/hermes-agent`
- Upstream: NONE (custom DaveAI service — no public source)
- Build: must be discovered

### Phase 0

```bash
cd /g/Github/hermes-agent-fresh
ls package.json pyproject.toml Cargo.toml go.mod Makefile 2>/dev/null \
  > "$EVIDENCE_ROOT/hermes-agent-fresh/phase0/build-files.txt" || true
git status --short --branch
git remote -v
git log --oneline -n 60
git branch -avv
mkdir -p "$EVIDENCE_ROOT/hermes-agent-fresh/phase0"
```

### Phase 1

```bash
mkdir -p "$EVIDENCE_ROOT/hermes-agent-fresh"
git clone --mirror "G:/Github/hermes-agent-fresh" \
  "$EVIDENCE_ROOT/hermes-agent-fresh/hermes-agent-fresh.mirror.git"
cd /g/Github/hermes-agent-fresh
git bundle create "$EVIDENCE_ROOT/hermes-agent-fresh/hermes-agent-fresh.bundle" --all
tar --exclude='node_modules' --exclude='.venv' --exclude='venv' \
    --exclude='dist' --exclude='build' --exclude='__pycache__' \
    -czf "$EVIDENCE_ROOT/hermes-agent-fresh/hermes-agent-fresh.worktree.tar.gz" \
    -C /g/Github hermes-agent-fresh
sha256sum \
  "$EVIDENCE_ROOT/hermes-agent-fresh/hermes-agent-fresh.bundle" \
  "$EVIDENCE_ROOT/hermes-agent-fresh/hermes-agent-fresh.worktree.tar.gz" \
  > "$EVIDENCE_ROOT/hermes-agent-fresh/SHA256SUMS.txt"
git clone "$EVIDENCE_ROOT/hermes-agent-fresh/hermes-agent-fresh.mirror.git" \
  "$EVIDENCE_ROOT/restore_tmp/hermes-agent-fresh_mirror_restore"
( cd "$EVIDENCE_ROOT/restore_tmp/hermes-agent-fresh_mirror_restore" && \
  git rev-parse HEAD && git branch -avv ) \
  > "$EVIDENCE_ROOT/hermes-agent-fresh/phase0/mirror_restore_proof.txt"
```

### Phase 2 — No upstream

```bash
cd /g/Github/hermes-agent-fresh
git remote -v
echo "WAIVER: Hermes is internal-only DaveAI service. No upstream. Phase 7 reset is N/A." \
  > "$EVIDENCE_ROOT/hermes-agent-fresh/phase0/upstream_waiver.txt"
git fetch origin --prune
```

### Phase 3 — Compare against origin/main only

```bash
mkdir -p "$EVIDENCE_ROOT/hermes-agent-fresh/phase3"
git log origin/main..HEAD --oneline \
  > "$EVIDENCE_ROOT/hermes-agent-fresh/phase3/local-only-commits.txt"
git diff --name-status origin/main..HEAD \
  > "$EVIDENCE_ROOT/hermes-agent-fresh/phase3/files-diff.txt"
```

### Phase 4

```bash
git diff --name-only origin/main..HEAD \
  | awk -F/ '{print $1}' | sort | uniq -c | sort -rn \
  > "$EVIDENCE_ROOT/hermes-agent-fresh/phase3/cluster-by-dir.txt"
```

### Phase 5

```bash
git branch -a --format='%(refname:short)' | sort \
  > "$EVIDENCE_ROOT/hermes-agent-fresh/phase3/all-branches.txt"
```

Expected prefixes:

- `feat/hermes-*`
- `fix/hermes-*`
- `chore/hermes-*`

### Phase 6

```bash
git checkout -b feat/hermes-routing-update origin/main
git cherry-pick <SHA>
```

### Phase 7

```bash
# No upstream → no destructive reset. Use ff-merge from approved branches only.
git checkout main
git merge --ff-only feat/hermes-routing-update
```

### Phase 8 — discovery-driven

```bash
cd /g/Github/hermes-agent-fresh
# Discover and run whichever applies
[ -f pyproject.toml ] && python -m pip install -e . && python -m pytest
[ -f package.json ]   && npm ci && npm test
[ -f Cargo.toml ]     && cargo build && cargo test
[ -f go.mod ]         && go build ./... && go test ./...
[ -f Makefile ]       && make test
```

### Phase 9

```bash
git checkout -b release/hermes-2026-04-27 main
git tag -a hermes-rc-2026-04-27 -m "Hermes release candidate 2026-04-27"
```

---

## Repo 4 — ZeroClaw

ZeroClaw is in-tree under Repo 1 at:

```
G:\Github\kilocode-Azure2\packages\kilo-vscode\src\services\zeroclaw\
```

It has no separate git history. All Phase 0–9 actions for ZeroClaw are performed inside the Repo 1 cycle. Targeted commands:

```bash
# Inventory
git -C /g/Github/kilocode-Azure2 diff --name-only upstream/main..main \
  -- packages/kilo-vscode/src/services/zeroclaw/

# Extraction
git -C /g/Github/kilocode-Azure2 checkout -b feat/daveai-zeroclaw-extract upstream/main
git -C /g/Github/kilocode-Azure2 checkout main -- \
  packages/kilo-vscode/src/services/zeroclaw/
git -C /g/Github/kilocode-Azure2 add -A packages/kilo-vscode/src/services/zeroclaw/
git -C /g/Github/kilocode-Azure2 commit -m "feat(daveai-zeroclaw): extract services + tests"

# Targeted tests
cd /g/Github/kilocode-Azure2/packages/kilo-vscode
bun test src/services/zeroclaw/__tests__
```

---

## Repo 5 — DaveAI Hub (`G:\Github\contract-kit-v17`)

- Default: `integration/main` (NON-STANDARD — see doc 21)
- Origin: `github.com/Ghenghis/contract-kit-v17`
- Upstream: NONE (internal repo)
- Build: Python FastAPI + ruff + mypy + pytest
- Critical paths: `src/webui/hub/`, `src/hermes/`, `src/zeroclaw/`, `src/blockchain_audit/`, `src/runtime/`, `docs/Branches/`

### Phase 0

```bash
cd /g/Github/contract-kit-v17
git rev-parse --abbrev-ref HEAD     # expect integration/main
git status --short --branch
git remote -v
git branch -avv
git log --oneline -n 60
mkdir -p "$EVIDENCE_ROOT/contract-kit-v17/phase0"
git status --short --branch > "$EVIDENCE_ROOT/contract-kit-v17/phase0/snapshot.txt"
```

### Phase 1

```bash
mkdir -p "$EVIDENCE_ROOT/contract-kit-v17"
git clone --mirror "G:/Github/contract-kit-v17" \
  "$EVIDENCE_ROOT/contract-kit-v17/contract-kit-v17.mirror.git"
cd /g/Github/contract-kit-v17
git bundle create "$EVIDENCE_ROOT/contract-kit-v17/contract-kit-v17.bundle" --all
tar --exclude='node_modules' --exclude='.venv' --exclude='venv' \
    --exclude='dist' --exclude='build' --exclude='__pycache__' \
    --exclude='.pytest_cache' --exclude='.mypy_cache' --exclude='.ruff_cache' \
    -czf "$EVIDENCE_ROOT/contract-kit-v17/contract-kit-v17.worktree.tar.gz" \
    -C /g/Github contract-kit-v17
sha256sum \
  "$EVIDENCE_ROOT/contract-kit-v17/contract-kit-v17.bundle" \
  "$EVIDENCE_ROOT/contract-kit-v17/contract-kit-v17.worktree.tar.gz" \
  > "$EVIDENCE_ROOT/contract-kit-v17/SHA256SUMS.txt"
git clone "$EVIDENCE_ROOT/contract-kit-v17/contract-kit-v17.mirror.git" \
  "$EVIDENCE_ROOT/restore_tmp/contract-kit-v17_mirror_restore"
( cd "$EVIDENCE_ROOT/restore_tmp/contract-kit-v17_mirror_restore" && \
  git rev-parse HEAD && git branch -avv ) \
  > "$EVIDENCE_ROOT/contract-kit-v17/phase0/mirror_restore_proof.txt"
```

### Phase 2 — Internal-only, no upstream

```bash
cd /g/Github/contract-kit-v17
echo "WAIVER: contract-kit-v17 is internal-only. Default branch is integration/main (see doc 21). No upstream." \
  > "$EVIDENCE_ROOT/contract-kit-v17/phase0/upstream_waiver.txt"
git fetch origin --prune
git rev-list --left-right --count integration/main...origin/integration/main
```

### Phase 3 — Compare local vs origin/integration/main

```bash
mkdir -p "$EVIDENCE_ROOT/contract-kit-v17/phase3"
git log origin/integration/main..HEAD --oneline \
  > "$EVIDENCE_ROOT/contract-kit-v17/phase3/local-only-commits.txt"
git diff --name-status origin/integration/main..HEAD \
  > "$EVIDENCE_ROOT/contract-kit-v17/phase3/files-diff.txt"
```

### Phase 4

```bash
git diff --name-only origin/integration/main..HEAD \
  | awk -F/ '{print $1"/"$2}' | sort | uniq -c | sort -rn \
  > "$EVIDENCE_ROOT/contract-kit-v17/phase3/cluster-by-dir.txt"
git diff --name-only origin/integration/main..HEAD -- 'src/webui/hub/**' \
  > "$EVIDENCE_ROOT/contract-kit-v17/phase3/hub-changes.txt"
git diff --name-only origin/integration/main..HEAD -- 'src/hermes/**' \
  > "$EVIDENCE_ROOT/contract-kit-v17/phase3/hermes-changes.txt"
git diff --name-only origin/integration/main..HEAD -- 'src/zeroclaw/**' \
  > "$EVIDENCE_ROOT/contract-kit-v17/phase3/zeroclaw-changes.txt"
git diff --name-only origin/integration/main..HEAD -- 'docs/Branches/**' \
  > "$EVIDENCE_ROOT/contract-kit-v17/phase3/contract-changes.txt"
```

### Phase 5

```bash
git branch -a --format='%(refname:short)' | sort \
  > "$EVIDENCE_ROOT/contract-kit-v17/phase3/all-branches.txt"
```

Expected prefixes:

- `feat/hub-*`
- `feat/hermes-*` (Hub-side adapters)
- `feat/zeroclaw-*` (Hub-side adapters)
- `feat/blockchain-audit-*`
- `feat/runtime-*`
- `docs/branches-*`
- `fix/hub-*`
- `chore/hub-*`

### Phase 6

```bash
git checkout -b feat/hub-routing-shim origin/integration/main
git diff origin/integration/main..HEAD -- src/webui/hub/ > /tmp/hub.patch
git apply --index --3way /tmp/hub.patch
git commit -m "feat(hub): routing shim extraction"
```

### Phase 7 — Internal repo, no destructive sync

```bash
test -s "$EVIDENCE_ROOT/contract-kit-v17/phase0/mirror_restore_proof.txt" || { echo BLOCKED; exit 1; }
git fetch origin --prune
git checkout integration/main
git pull --ff-only origin integration/main
```

### Phase 8

```bash
cd /g/Github/contract-kit-v17
python -m pip install -e .
python -m ruff check src/ tests/
python -m mypy src/
python -m pytest -q
```

### Phase 9

```bash
git checkout -b release/hub-2026-04-27 integration/main
git merge --no-ff feat/hub-routing-shim
python -m pytest -q
git tag -a hub-rc-2026-04-27 -m "Hub release candidate 2026-04-27"
```

---

## Validation gates concrete

### Repo 1 — Kilo Code

```bash
cd /g/Github/kilocode-Azure2
bun install
bun run typecheck
bun run lint
bun test
( cd packages/kilo-vscode && \
  npx --yes @vscode/vsce package --no-dependencies )
```

### Repo 2 — Open WebUI

```bash
cd /g/Github/open-webui-current
python -m pytest backend/
npm run lint
npm run check
npm run build
```

### Repo 3 — Hermes

```bash
cd /g/Github/hermes-agent-fresh
python -m pytest
python -m compileall .
```

### Repo 5 — DaveAI Hub

```bash
cd /g/Github/contract-kit-v17
python -m ruff check src/ tests/
python -m mypy src/
python -m pytest -q
```

Universal gates from doc 09 (run on every feature branch):

```bash
git status --short --branch
git diff --check
git diff --name-status upstream/main...HEAD || git diff --name-status origin/integration/main...HEAD
git log --oneline --decorate --max-count=30
git grep -n -I -E "(api[_-]?key|secret|token|password|passwd|bearer|private[_-]?key|BEGIN RSA|BEGIN OPENSSH|BEGIN PRIVATE)" HEAD -- .
```

---

## Common errors and fixes

### Cygwin path conversion

`tar` and `git clone` under Git Bash will sometimes mangle `G:\Github\...`. Symptoms: "No such file or directory" with a path like `/g/Github/...` that obviously exists.

Fix:

```bash
# Use POSIX-style paths inside Git Bash:
ls /g/Github/kilocode-Azure2

# Disable conversion for one-shot commands that fight you:
MSYS_NO_PATHCONV=1 git clone --mirror "G:/Github/kilocode-Azure2" \
  "$EVIDENCE_ROOT/kilocode-Azure2/kilocode-Azure2.mirror.git"
```

### Large repos timing out on `git clone --mirror`

Emergency-only path (NOT a substitute for full backup):

```bash
git clone --no-tags --depth=1 "G:/Github/open-webui-current" \
  "$EVIDENCE_ROOT/open-webui-current/EMERGENCY_shallow.git"
echo "EMERGENCY shallow clone — full mirror still REQUIRED before mutation" \
  > "$EVIDENCE_ROOT/open-webui-current/EMERGENCY.txt"
```

### Disk space

| Repo | Approx. mirror | Bundle | Tarball | Subtotal |
|---|---|---|---|---|
| kilocode-Azure2 | 8 GB | 8 GB | 4 GB | 20 GB |
| open-webui-current | 6 GB | 6 GB | 3 GB | 15 GB |
| hermes-agent-fresh | 1 GB | 1 GB | 0.5 GB | 2.5 GB |
| contract-kit-v17 | 2 GB | 2 GB | 1 GB | 5 GB |
| Restore_tmp scratch | — | — | — | 15 GB |
| Total | | | | ~57 GB |

```bash
df -h /g
```

### `upstream` fetch returns 404 (forks-of-private)

```bash
echo "BLOCKER: upstream fetch 404. Repo: <repo>. Tested URL: <url>. Date: 2026-04-27." \
  >> "$EVIDENCE_ROOT/BLOCKERS.txt"
```

### `bun.lock` churn on every install

```bash
git stash push -m "pre-extract bun.lock churn" -- bun.lock
# Run extraction, restore only if unrelated:
git stash pop
```

---

## When the playbook can't be followed

### Repo is in worktree mode

```bash
[ -f /g/Github/kilocode-Azure2/.git ] && cat /g/Github/kilocode-Azure2/.git
git -C /g/Github/kilocode-Azure2 rev-parse --git-common-dir
```

### User is offline

```bash
echo "BLOCKER: offline mode. Phase 2/3 deferred. Local backups only on 2026-04-27." \
  >> "$EVIDENCE_ROOT/BLOCKERS.txt"
```

### Origin URL has changed since manifest

```bash
cd /g/Github/<repo>
git remote -v > "$EVIDENCE_ROOT/<repo>/phase0/remotes_observed.txt"
diff "$EVIDENCE_ROOT/<repo>/phase0/remotes_observed.txt" \
     /g/Github/contract-kit-v17/docs/Branches/inventory_remotes.txt
```
