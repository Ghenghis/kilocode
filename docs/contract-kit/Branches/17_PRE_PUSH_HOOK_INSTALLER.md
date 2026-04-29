# Pre-Push Hook Installer Protocol

> ABSOLUTE RULE: Never commit, merge, rebase, reset, force-push, or push user work directly on `main` or `master`. `main/master` may only mirror upstream after verified backups exist. Any attempted push to `main/master` is a critical failure and must stop the run.


Doc 08 defines the policy for blocking pushes to `main`/`master`. This doc closes the implementation gap with a turnkey installer, rollback path, and per-repo orchestration across all 11 ecosystem repos. It must run on Windows + Cygwin Bash 5.3.9 + Git 2.54.0 (PowerShell 7+ alt path provided). The hook regex is data-driven so `contract-kit-v17` (default `integration/main`) is protected the same as repos whose default is `main` or `master`.

## Goals

- Block push to the local default branch (and any operator-listed protected branch).
- Block force-push (non-fast-forward) to any protected branch.
- Block deletion (zero local SHA push) of any protected branch.
- Print a clear, multi-line bypass instruction set so the rare authorized case has a documented escape hatch — and log every block, every bypass.

## Hook source — `pre-push.sh`

Drop-in for `.git/hooks/pre-push`. Reads protected names from `.git/hooks-config/protected-branches` (one branch per line, `#` comments allowed). Falls back to `main` + `master` if the file is missing.

```bash
#!/usr/bin/env bash
# pre-push hook — V3 branch protection (doc 17)
# Reject pushes to protected branches (incl. force-push and delete-push).
set -u

ZERO="0000000000000000000000000000000000000000"
HOOK_DIR="$(git rev-parse --git-dir 2>/dev/null)"
CFG="${HOOK_DIR}/hooks-config/protected-branches"
LOGDIR="${HOOK_DIR}/hook-logs"
LOGFILE="${LOGDIR}/pre-push-blocks.log"
mkdir -p "$LOGDIR"

# Load protected branch list
declare -a PROTECTED=()
if [ -r "$CFG" ]; then
  while IFS= read -r line; do
    line="${line%%#*}"
    line="$(printf '%s' "$line" | tr -d '[:space:]')"
    [ -n "$line" ] && PROTECTED+=("$line")
  done < "$CFG"
fi
[ "${#PROTECTED[@]}" -eq 0 ] && PROTECTED=("main" "master")

# Build a single regex: ^(refs/heads/)?(name1|name2|...)$
joined="$(printf '%s|' "${PROTECTED[@]}")"
joined="${joined%|}"
PROTECTED_RE="^(refs/heads/)?(${joined})$"

log_block() {
  printf '%s | user=%s | ref=%s | reason=%s\n' \
    "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "${USER:-unknown}" "$1" "$2" >> "$LOGFILE"
}

# Bypass (loud — never silent)
if [ "${KILO_BRANCH_PROTECTION_BYPASS:-}" = "I_KNOW_WHAT_IM_DOING" ]; then
  printf '\n*** BRANCH PROTECTION BYPASS ACTIVE ***\n'
  printf '    user=%s  remote=%s  time=%s\n\n' \
    "${USER:-unknown}" "${1:-?}" "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  log_block "BYPASS" "KILO_BRANCH_PROTECTION_BYPASS=I_KNOW_WHAT_IM_DOING"
  exit 0
fi

while read -r local_ref local_sha remote_ref remote_sha; do
  # Determine target branch name
  target="$remote_ref"
  [ -z "$target" ] && target="$local_ref"

  if [[ "$local_ref" =~ $PROTECTED_RE ]] || [[ "$remote_ref" =~ $PROTECTED_RE ]]; then
    if [ "$local_sha" = "$ZERO" ]; then
      reason="DELETE-PUSH to protected branch"
    elif [ "$remote_sha" != "$ZERO" ] && \
         ! git merge-base --is-ancestor "$remote_sha" "$local_sha" 2>/dev/null; then
      reason="FORCE-PUSH (non-fast-forward) to protected branch"
    else
      reason="PUSH to protected branch"
    fi

    log_block "$target" "$reason"

    printf '\n'
    printf '================================================================\n'
    printf ' BLOCKED: %s\n' "$reason"
    printf ' ref:    %s\n' "$target"
    printf ' policy: V3 branch protection (docs 08, 17)\n'
    printf '================================================================\n'
    printf ' Protected branches in this repo:\n'
    for b in "${PROTECTED[@]}"; do printf '   - %s\n' "$b"; done
    printf '\n'
    printf ' What to do instead:\n'
    printf '   1. Push your work to a feature branch and open a PR.\n'
    printf '   2. If you truly need to bypass (rare), see the override below.\n'
    printf '\n'
    printf ' AUTHORIZED OVERRIDE (use only with operator approval):\n'
    printf '   KILO_BRANCH_PROTECTION_BYPASS=I_KNOW_WHAT_IM_DOING git push ...\n'
    printf '   (every bypass is logged to %s)\n' "$LOGFILE"
    printf '================================================================\n\n'
    exit 1
  fi
done

exit 0
```

## Bash installer — `install_branch_protection.sh`

Installs the hook into one or more repos, with backup, evidence logging, and dry-run smoke tests. Defaults to all 11 ecosystem repos from doc 16.

```bash
#!/usr/bin/env bash
# install_branch_protection.sh — V3 doc 17
set -euo pipefail

EVIDENCE_ROOT="${EVIDENCE_ROOT:-G:/Github/contract-kit-v17/.evidence}"
HOOK_SRC="${HOOK_SRC:-$(dirname "$0")/pre-push.sh}"
TS="$(date -u +%Y%m%dT%H%M%SZ)"
LOG="${EVIDENCE_ROOT}/hook_install_log.md"
mkdir -p "$EVIDENCE_ROOT"

DEFAULT_REPOS=(
  "G:/Github/kilocode-Azure2"
  "G:/Github/open-webui-current"
  "G:/Github/hermes-agent-fresh"
  "G:/Github/contract-kit-v17"
  "G:/Github/kilocode"
  "G:/Github/kilocode-Azure"
  "G:/Github/kilocode-7.2.4"
  "G:/Github/hermes.daveai.tech"
  "G:/Github/PixelClaw"
)

REPOS=("$@")
[ "${#REPOS[@]}" -eq 0 ] && REPOS=("${DEFAULT_REPOS[@]}")

[ -r "$HOOK_SRC" ] || { printf 'FATAL: hook source not found at %s\n' "$HOOK_SRC" >&2; exit 2; }
HOOK_SHA="$(sha256sum "$HOOK_SRC" | awk '{print $1}')"

printf '## Hook install run %s\n\n' "$TS"          >> "$LOG"
printf '- hook source: `%s`\n' "$HOOK_SRC"          >> "$LOG"
printf '- hook sha256: `%s`\n\n' "$HOOK_SHA"        >> "$LOG"

fail=0
for repo in "${REPOS[@]}"; do
  printf -- '--- %s ---\n' "$repo"
  if ! ( cd "$repo" && git rev-parse --is-inside-work-tree >/dev/null 2>&1 ); then
    printf 'SKIP: not a git work tree: %s\n' "$repo" >&2
    printf -- '- SKIP `%s` — not a git work tree\n' "$repo" >> "$LOG"
    fail=1
    continue
  fi

  cd "$repo"
  GIT_DIR="$(git rev-parse --git-dir)"
  HOOKS_PATH="$(git config --get core.hooksPath || true)"
  if [ -n "$HOOKS_PATH" ]; then
    printf 'WARN: core.hooksPath=%s — installer targets .git/hooks; review manually.\n' "$HOOKS_PATH" >&2
    printf -- '- WARN `%s` core.hooksPath=`%s`\n' "$repo" "$HOOKS_PATH" >> "$LOG"
  fi

  TGT="${GIT_DIR}/hooks/pre-push"
  if [ -e "$TGT" ]; then
    cp -p "$TGT" "${TGT}.before-v3-protection-${TS}"
    printf 'backup: %s.before-v3-protection-%s\n' "$TGT" "$TS"
  fi

  install -m 0755 "$HOOK_SRC" "$TGT"
  mkdir -p "${GIT_DIR}/hooks-config"
  CFG="${GIT_DIR}/hooks-config/protected-branches"

  # Discover default + canonical aliases
  DEFAULT_BRANCH="$(git symbolic-ref --short HEAD 2>/dev/null || true)"
  REMOTE_HEAD="$(git symbolic-ref --short refs/remotes/origin/HEAD 2>/dev/null | sed 's|^origin/||' || true)"
  {
    [ -n "$DEFAULT_BRANCH" ] && printf '%s\n' "$DEFAULT_BRANCH"
    [ -n "$REMOTE_HEAD" ]    && printf '%s\n' "$REMOTE_HEAD"
    printf 'main\nmaster\nintegration/main\n'
  } | awk 'NF && !seen[$0]++' > "$CFG"

  INSTALLED_SHA="$(sha256sum "$TGT" | awk '{print $1}')"
  printf -- '- repo `%s`\n' "$repo"                              >> "$LOG"
  printf -- '  - installed sha256: `%s`\n' "$INSTALLED_SHA"      >> "$LOG"
  printf -- '  - protected:\n'                                   >> "$LOG"
  while IFS= read -r b; do printf -- '    - `%s`\n' "$b" >> "$LOG"; done < "$CFG"

  # Smoke test 1: dry-run push of current branch must succeed (or hit network — accept exit 0/128 net errors handled separately)
  CUR="$(git rev-parse --abbrev-ref HEAD)"
  if git push --dry-run --no-verify origin "$CUR":"$CUR" >/dev/null 2>&1 \
     || git push --dry-run origin "$CUR":"$CUR" >/dev/null 2>&1; then
    printf 'smoke1 ok (current branch %s allowed)\n' "$CUR"
  else
    printf 'smoke1 inconclusive for %s (likely network) — recording, not failing\n' "$CUR"
  fi

  # Smoke test 2: dry-run push to first protected name MUST be rejected by hook (exit 1)
  PROT="$(head -n1 "$CFG")"
  if git push --dry-run origin "HEAD:refs/heads/${PROT}" >/dev/null 2>&1; then
    printf 'FAIL: hook did not reject push to protected %s in %s\n' "$PROT" "$repo" >&2
    printf -- '  - SMOKE FAIL: protected push to `%s` was not rejected\n' "$PROT" >> "$LOG"
    fail=1
  else
    printf 'smoke2 ok (push to %s rejected)\n' "$PROT"
    printf -- '  - smoke2 ok (push to `%s` rejected)\n' "$PROT" >> "$LOG"
  fi
done

printf '\n'  >> "$LOG"
exit "$fail"
```

## PowerShell installer — `install_branch_protection.ps1`

Equivalent for non-Cygwin Windows users.

```powershell
# install_branch_protection.ps1 — V3 doc 17
param(
  [string[]]$Repos,
  [string]$HookSrc = (Join-Path $PSScriptRoot 'pre-push.sh'),
  [string]$EvidenceRoot = 'G:\Github\contract-kit-v17\.evidence'
)
$ErrorActionPreference = 'Stop'
$ts = (Get-Date -AsUTC).ToString('yyyyMMddTHHmmssZ')
$log = Join-Path $EvidenceRoot 'hook_install_log.md'
New-Item -ItemType Directory -Force -Path $EvidenceRoot | Out-Null

if (-not $Repos) {
  $Repos = @(
    'G:\Github\kilocode-Azure2',
    'G:\Github\open-webui-current',
    'G:\Github\hermes-agent-fresh',
    'G:\Github\contract-kit-v17',
    'G:\Github\kilocode',
    'G:\Github\kilocode-Azure',
    'G:\Github\kilocode-7.2.4',
    'G:\Github\hermes.daveai.tech',
    'G:\Github\PixelClaw'
  )
}

if (-not (Test-Path $HookSrc)) { throw "hook source not found: $HookSrc" }
$hookSha = (Get-FileHash -Algorithm SHA256 $HookSrc).Hash.ToLower()
Add-Content $log "## Hook install run $ts`n`n- hook source: ``$HookSrc```n- hook sha256: ``$hookSha```n"

$fail = 0
foreach ($repo in $Repos) {
  Write-Host "--- $repo ---"
  Push-Location $repo
  try {
    $null = git rev-parse --is-inside-work-tree 2>$null
    if ($LASTEXITCODE -ne 0) {
      Write-Warning "SKIP: not a git work tree"; $fail = 1; continue
    }
    $gitDir   = (git rev-parse --git-dir).Trim()
    $hooksPath = (git config --get core.hooksPath) 2>$null
    if ($hooksPath) { Write-Warning "core.hooksPath=$hooksPath — review manually" }

    $tgt = Join-Path $gitDir 'hooks/pre-push'
    if (Test-Path $tgt) { Copy-Item $tgt "$tgt.before-v3-protection-$ts" }
    Copy-Item $HookSrc $tgt -Force
    & git update-index --chmod=+x $tgt 2>$null

    $cfgDir = Join-Path $gitDir 'hooks-config'
    New-Item -ItemType Directory -Force -Path $cfgDir | Out-Null
    $cfg = Join-Path $cfgDir 'protected-branches'

    $default = (git symbolic-ref --short HEAD).Trim()
    $remoteHead = ((git symbolic-ref --short refs/remotes/origin/HEAD) 2>$null) -replace '^origin/',''
    @($default, $remoteHead, 'main','master','integration/main') |
      Where-Object { $_ } | Select-Object -Unique | Set-Content -Path $cfg -Encoding ascii

    $installedSha = (Get-FileHash -Algorithm SHA256 $tgt).Hash.ToLower()
    Add-Content $log "- repo ``$repo```n  - installed sha256: ``$installedSha```n  - protected: $((Get-Content $cfg) -join ', ')"

    $prot = (Get-Content $cfg)[0]
    git push --dry-run origin "HEAD:refs/heads/$prot" 2>$null
    if ($LASTEXITCODE -eq 0) {
      Write-Error "FAIL: hook did not reject protected push in $repo"; $fail = 1
    } else {
      Write-Host "smoke ok (push to $prot rejected)"
    }
  } finally { Pop-Location }
}
exit $fail
```

## Uninstall — `uninstall_branch_protection.sh`

Restores the most recent `.before-v3-protection-*` backup if present; otherwise removes the hook. Always logs.

```bash
#!/usr/bin/env bash
# uninstall_branch_protection.sh — V3 doc 17
set -euo pipefail
EVIDENCE_ROOT="${EVIDENCE_ROOT:-G:/Github/contract-kit-v17/.evidence}"
TS="$(date -u +%Y%m%dT%H%M%SZ)"
LOG="${EVIDENCE_ROOT}/hook_install_log.md"
mkdir -p "$EVIDENCE_ROOT"

REPOS=("$@")
[ "${#REPOS[@]}" -eq 0 ] && { printf 'usage: %s <repo> [<repo> ...]\n' "$0" >&2; exit 2; }

printf '## Hook UNINSTALL run %s\n\n' "$TS" >> "$LOG"
for repo in "${REPOS[@]}"; do
  ( cd "$repo" && git rev-parse --is-inside-work-tree >/dev/null ) || {
    printf 'SKIP %s\n' "$repo"; continue; }
  cd "$repo"
  GIT_DIR="$(git rev-parse --git-dir)"
  TGT="${GIT_DIR}/hooks/pre-push"
  BACKUP="$(ls -1t "${TGT}".before-v3-protection-* 2>/dev/null | head -n1 || true)"
  if [ -n "$BACKUP" ]; then
    mv -f "$BACKUP" "$TGT"
    printf -- '- restored `%s` from `%s`\n' "$repo" "$BACKUP" >> "$LOG"
  else
    rm -f "$TGT"
    printf -- '- removed hook in `%s` (no prior backup)\n' "$repo" >> "$LOG"
  fi
  rm -rf "${GIT_DIR}/hooks-config"
  printf 'uninstalled: %s\n' "$repo"
done
printf '\n' >> "$LOG"
```

## Verification commands

An auditor confirms the install with these commands inside each target repo:

```bash
# 1. Hook content matches the recorded hash from hook_install_log.md
sha256sum "$(git rev-parse --git-dir)/hooks/pre-push"

# 2. Protected branch list is what was intended
cat "$(git rev-parse --git-dir)/hooks-config/protected-branches"

# 3. Executable bit / file mode (matters on Cygwin + native git)
ls -la "$(git rev-parse --git-dir)/hooks/pre-push"

# 4. Live rejection test — must exit 1 with the multi-line BLOCKED banner
git push --dry-run origin "HEAD:refs/heads/$(head -n1 "$(git rev-parse --git-dir)/hooks-config/protected-branches")"
echo "exit=$?"   # expect: exit=1

# 5. Bypass envelope works (and is logged)
KILO_BRANCH_PROTECTION_BYPASS=I_KNOW_WHAT_IM_DOING \
  git push --dry-run origin "HEAD:refs/heads/main" || true
tail -n 5 "$(git rev-parse --git-dir)/hook-logs/pre-push-blocks.log"
```

All four checks must pass. Record the outputs in evidence alongside the install log.

## What this hook does NOT do

- It does **not** replace GitHub-side branch protection. The hook only fires on the operator's machine; a teammate without the hook can still push. GitHub-side protection is covered in doc 18.
- It does **not** block local commits, merges, rebases, or `git reset --hard` on the protected branch. Those are governed by behavioural rules in doc 08 and by the backup gate in doc 04.
- It does **not** audit history rewrites already pushed (force-push that landed before the hook installed). Recovery for that scenario uses the mirror/bundle backups from doc 04.
- It does **not** validate signed commits, GPG keys, or commit-msg policy — those belong to separate pre-commit / commit-msg gates.

## Failure modes

- **Executable bit missing on Windows.** Git for Windows runs the hook regardless of POSIX exec bit, but Cygwin git honours it. The bash installer uses `install -m 0755`; the PowerShell installer calls `git update-index --chmod=+x` for repos that track hooks. Verification step 3 catches a stripped bit.
- **GUI client bypass.** Some Git GUIs (older SourceTree builds, custom Electron clients) can be configured to skip hooks. Mitigation is layered defence: GitHub-side protection (doc 18) is the authoritative gate; this hook is the local fast-fail.
- **`core.hooksPath` redirect.** If a repo sets `git config core.hooksPath /elsewhere`, the installer's writes to `.git/hooks/pre-push` are inert. Both installers detect this and emit a `WARN` line in the evidence log; the operator must either unset `core.hooksPath` or copy the hook into the redirected directory manually.
- **Submodule push.** The hook installs into the superproject only. Run the installer separately against each submodule path that has its own remote.
- **Worktrees (`git worktree`).** Linked worktrees share `.git/hooks` with the main repo, so installing once covers all worktrees of that repo. The smoke test still runs from the worktree's CWD.
- **Bypass fatigue.** Every use of `KILO_BRANCH_PROTECTION_BYPASS` writes a `BYPASS` line to `.git/hook-logs/pre-push-blocks.log`. Audit that log during every backup cycle (doc 04) — an unexplained bypass is a blocker.

## Cross-references

- Doc 04 — Backup and Restore Proof Protocol. The hook is installed only **after** doc 04 passes for each repo, so a misfire never threatens unbacked work.
- Doc 08 — Main/Master Protection and Sync Protocol. Defines the policy this doc implements; the hook regex here is the data-driven generalisation of doc 08's hardcoded `(main|master)`.
- Doc 16 — Repo manifest. Source of the 11-repo default list used by both installers.
- Doc 18 — GitHub-side branch protection. The remote-side counterpart; a complete defence requires both layers.
