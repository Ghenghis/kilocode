# 33 — Developer Onboarding Runbook

> **ABSOLUTE RULE**: Never commit, merge, rebase, reset, force-push, or push user work directly on `main` or `master`. `main/master` may only mirror upstream after verified backups exist. Any attempted push to `main/master` is a critical failure and must stop the run. This rule applies to humans, Claude Code sessions, CI agents, and every other actor on this machine — without exception.

## Purpose

The single onboarding script for a new developer or fresh Claude-Code-driven session. Run **Day 0** once per machine. Run **Day 1** once per first feature. Then graduate to doc 28 (Operator Command Order) for everything else.

If you are an LLM session: do not improvise around any step. If a step fails, jump to doc 24 (Failure Mode Library), apply the matching `Fx.y`, and resume.

---

## Day 0 — One-time machine setup

### 0.1 Install required toolchain

| Tool | Minimum | Why | Verify |
|---|---|---|---|
| `git` | 2.40 | Modern `git switch`, `git worktree` | `git --version` |
| `bun` | 1.1+ | Required by `kilocode-Azure2` | `bun --version` |
| `pnpm` | 9.0+ | Workspace manager | `pnpm --version` |
| `npm` | 10+ | Required by `open-webui-current` | `npm --version` |
| `python` | 3.11+ | Required by `contract-kit-v17`, OWUI backend | `python --version` |
| `gh` | 2.40+ | GitHub CLI | `gh --version` |
| `cosign` | 2.2+ | Release signing per doc 23 | `cosign version` |
| `gitleaks` | 8.18+ | Pre-commit secret scan | `gitleaks version` |

Windows + Cygwin Bash 5.3.9 + Git 2.54.0 is the baseline doc 17 already targets. macOS / Linux contributors use platform-native installs.

### 0.2 Configure git identity + signing

```bash
git config --global user.name  "Your Real Name"
git config --global user.email "you@example.com"
git config --global init.defaultBranch main

# Recommended: SSH commit signing
git config --global gpg.format ssh
git config --global user.signingkey ~/.ssh/id_ed25519.pub
git config --global commit.gpgsign true
git config --global tag.gpgsign true

git config --global --list | grep -E '^(user|gpg|init|commit|tag)\.'
```

### 0.3 SSH key + GitHub upload

```bash
ssh-keygen -t ed25519 -C "you@example.com" -f ~/.ssh/id_ed25519
eval "$(ssh-agent -s)"
ssh-add ~/.ssh/id_ed25519

# Print public key — paste into https://github.com/settings/keys
# Add as BOTH "Authentication Key" AND "Signing Key"
cat ~/.ssh/id_ed25519.pub

ssh -T git@github.com   # expect: "Hi <user>! You've successfully authenticated..."
```

### 0.4 GitHub CLI login

```bash
gh auth login --hostname github.com --git-protocol ssh --web
gh auth status
gh api user --jq '.login'
```

### 0.5 Clone the manifest's 11 repos

```bash
mkdir -p /g/Github && cd /g/Github      # Cygwin/Git Bash
# Linux/macOS: mkdir -p ~/Github && cd ~/Github

# V3 §00 in-scope (4 + ZeroClaw post-promotion)
git clone git@github.com:Ghenghis/kilocode.git              kilocode-Azure2
git clone git@github.com:Ghenghis/open-webui.git            open-webui-current
git clone git@github.com:Ghenghis/hermes-agent.git          hermes-agent-fresh
git clone git@github.com:Ghenghis/contract-kit-v17.git      contract-kit-v17
# Zero Claw is in-tree under kilocode-Azure2 — do NOT clone separately (see doc 30)

# Ancillary
git clone git@github.com:Ghenghis/kilocode-RVC.git          kilocode
git clone git@github.com:Ghenghis/Kilocode-Azure.git        kilocode-Azure
git clone git@github.com:Ghenghis/hermes.daveai.tech.git    hermes.daveai.tech
git clone git@github.com:Ghenghis/PixelClaw.git             PixelClaw
```

After cloning, run the manifest identity check from doc 16. Any mismatch = stop and ask.

### 0.6 Add upstream remotes

```bash
cd /g/Github/kilocode-Azure2
git remote add upstream git@github.com:Kilo-Org/kilocode.git
git fetch upstream

cd /g/Github/open-webui-current
git remote add upstream git@github.com:open-webui/open-webui.git
git fetch upstream
```

`hermes-agent-fresh` and `contract-kit-v17` have `NONE-CONFIGURED` upstreams — do not invent one.

### 0.7 Install branch-protection hooks

```bash
cd /g/Github/contract-kit-v17/scripts/branch-protection
bash install_branch_protection.sh                         # default = all 11 repos

# Verify per doc 17
sha256sum "$(git -C /g/Github/kilocode-Azure2 rev-parse --git-dir)/hooks/pre-push"
cat       "$(git -C /g/Github/kilocode-Azure2 rev-parse --git-dir)/hooks-config/protected-branches"

# Live rejection test (must exit 1 with BLOCKED banner)
cd /g/Github/contract-kit-v17
git push --dry-run origin "HEAD:refs/heads/integration/main"; echo "exit=$?"   # expect: exit=1
```

### 0.8 Day 0 sign-off

Write `<EVIDENCE_ROOT>/00_day0_signoff_<machine>.md`:
```
Day 0 onboarding complete on <hostname> at <UTC>.
- Toolchain floor verified: yes
- git identity + signing key: <fingerprint>
- gh auth status: SSH, login=<gh user>
- All 11 manifest repos cloned and identity-checked: yes
- Branch protection installed and smoke-tested on every repo: yes
Operator: <name>
```

You are not allowed to start Day 1 without this file.

---

## Day 1 — First feature branch

### 1.1 Orientation read order

Read in this order before any command:

1. `00_READ_ME_FIRST_OPERATOR_VERDICT.md`
2. `01_MASTER_PROMPT_FOR_CLAUDE_CODE.md`
3. `28_OPERATOR_COMMAND_ORDER.md`
4. `29_NAMING_CONVENTION_CANONICAL.md`
5. `06_FEATURE_FINGERPRINTING_AND_BRANCH_EXTRACTION.md`

### 1.2 Open a feature card

Per doc 06, write `<EVIDENCE_ROOT>/feature-cards/<REPO>-FC-<NN>.md`:
- `id`, `repo`, `scope`, `branch_name` (must pass doc 29 validator)
- `summary`, `local_only_commits[]`, `dependencies[]`
- `quorum_status: PENDING`

### 1.3 Validate + create the branch

```bash
cd /g/Github/<your-repo>

# Validate name BEFORE creating (doc 29)
bash /g/Github/contract-kit-v17/scripts/validate_branch_name.sh "feat/daveai-hermes-orchestrator-retry"

# Create from upstream default
git fetch upstream --prune
git switch -c feat/daveai-hermes-orchestrator-retry upstream/main
```

Allowed prefixes per doc 29: `feat/`, `fix/`, `chore/`, `docs/`, `test/`, `refactor/`, `perf/`, `integration/`, `sync/`, `release/`, `hotfix/`, `review/`, `archive/`, `epic/`. **Do not** use `feature/`. **Do not** use forbidden generics.

### 1.4 Run universal gates (doc 09)

```bash
gitleaks detect --source . --no-banner
# Per-stack: see Quickstart table below
```

### 1.5 Commit, push, open PR

```bash
git add -p                                       # stage hunks deliberately
git commit -S -m "feat(daveai-hermes): retry policy for orchestrator"
git push -u origin feat/daveai-hermes-orchestrator-retry

gh pr create \
  --base main \
  --head feat/daveai-hermes-orchestrator-retry \
  --title "feat(daveai-hermes): retry policy for orchestrator" \
  --body-file <EVIDENCE_ROOT>/feature-cards/<REPO>-FC-<NN>.md
```

PR template is canonical in doc 38. `gh pr create --template` will pick it up if `.github/pull_request_template.md` matches doc 38.

---

## Per-repo dev quickstart

### `kilocode-Azure2`
```bash
bun install
bun run typecheck
bun test
# Optional VSIX build (after operator green-light): bun run package
```

### `open-webui-current`
```bash
npm ci
python -m pip install -r backend/requirements.txt
pytest backend/
# Frontend dev: npm run dev
```

### `hermes-agent-fresh`
Discovery first:
```bash
ls package.json pyproject.toml Cargo.toml 2>/dev/null
# Then run whichever applies
```

### `contract-kit-v17`
```bash
python -m pip install -e .
pytest -q
ruff check src/ tests/
```

### `upgrade/zeroclaw` (only after promotion per doc 30)
```bash
cd /g/Github/upgrade/zeroclaw
cargo build
cargo test
```

---

## IDE setup

Recommended VS Code extensions:
- **kilocode-vsix** — install once operator publishes a `.vsix` from a `release/kilo-*` branch.
- **ESLint** + **Prettier** — TS/JS packages.
- **Ruff** + **Pylance** — `contract-kit-v17` and OWUI backend.
- **rust-analyzer** — for ZeroClaw post-promotion.
- **GitLens** — useful for cross-repo provenance.

JetBrains and Neovim are fine substitutes — toolchain is what matters.

---

## Common errors

| Symptom | Cause | Fix |
|---|---|---|
| `cd: /g/Github/...: No such file or directory` in PowerShell | PS uses `G:\Github\`; Git Bash uses `/g/Github/` | Pick the matching shell, or `cygpath -u` / `cygpath -w` |
| `bun: command not found` after install | `bun.exe` not on PATH | Restart shell; add `~/.bun/bin` to PATH |
| `husky` / pre-commit hooks "did not run" | Cygwin stripped exec bit | `chmod +x .git/hooks/*`, or re-run `install_branch_protection.sh` |
| `gpg: signing failed: No secret key` | `commit.gpgsign=true` but no key | Configure `gpg.format=ssh` (recommended); never disable signing |
| `git push` rejected with V3 BLOCKED banner | You tried to push to `main`/`master`/`integration/main` | Read banner. Move work to feature branch (doc 29). Bypass envelope is operator-only. |
| `pytest` `ModuleNotFoundError` in `contract-kit-v17` | Forgot `pip install -e .` | Re-run from repo root |
| OWUI backend Python crash on Windows paths with spaces | `uvicorn --reload` watcher | Path without spaces, or use Docker compose |
| `gh pr create` "no upstream branch" | First push didn't use `-u` | `git push -u origin <branch>` then retry |

---

## Where to ask questions

In order:

1. **Operator (Admin)** — for ambiguity, blocked gate, doc contradiction.
2. **Doc 28** — for "what runs when?" doubts.
3. **Doc 24** — for "this command failed, what now?"
4. **Doc 16** — for "is this the right path / origin?"
5. **Doc 29** — for "is this branch name OK?"

Do not ask other contributors to relax a gate.

---

## Forbidden actions for new contributors

- **Push to `main` / `master` / `integration/main` / `clean-master`.**
- **Force-push** without operator approval.
- **`--no-verify`.** Skipping pre-commit, commit-msg, or pre-push hook on any commit.
- **Commit secrets.** API keys, tokens, `.env`, private keys, signing material.
- **`git reset --hard` on a protected branch.**
- **`git rebase -i`** on shared branch without operator approval.
- **Delete a remote branch** with an open PR or feature card pointing at it.
- **Edit `.git/config`** to "fix" a manifest mismatch.
- **Init a new git repo** under any path listed in doc 16 §"Not-a-git-repo paths".

---

## Cross-references

- **Doc 16** — Ecosystem Repo Manifest.
- **Doc 17** — Pre-Push Hook Installer Protocol.
- **Doc 27** — Toolchain pinning + secrets/supply-chain.
- **Doc 28** — Operator Command Order.
- **Doc 29** — Canonical Branch Naming.
- **Doc 38** — Canonical PR Template.

If any step here disagrees with doc 28 on sequencing, doc 28 wins. If any step disagrees with doc 29 on naming, doc 29 wins.
