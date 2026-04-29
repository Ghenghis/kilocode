# Remote ↔ Local Cross-Reference

Generated: 2026-04-26 05:05:00 (read-only `git ls-remote` against each URL).

## Summary

| # | Online Repo | Default branch | Remote HEAD | Local Path | Local HEAD | Local Class | Match |
|---|-------------|----------------|-------------|-----------|------------|-------------|-------|
| 1 | `Ghenghis/contract-kit-v17` | `integration/main` | `ca5d8f0d94ce328b227ae2d3b59f39ae518670fb` | `G:\Github\contract-kit-v17` | `ca5d8f0d94ce328b227ae2d3b59f39ae518670fb` | SOURCE_OF_TRUTH | ✅ **EXACT MATCH** |
| 2 | `AiDave71/kilocode` | `main` (`68a16ace7c…`) + `feat/azure-voice-studio` (`574658008e…`) | 2 branches, 2 tags | `G:\Github\kilocode-Azure2` | `67bd133d6e87683414b8b7e6746aa772aecaa82d` (feat/azure-voice-studio) | ACTIVE_KILOCODE_REPO | ⚠ **DIVERGED** — local 491 ahead of `aidave71/feat/azure-voice-studio` |
| 3 | `Ghenghis/zeroclaw` | `main` | `ff254b4bb392b7a2b5bac9e881a4327d0e61c870` | `C:\Users\Admin\Downloads\VPS\zeroclaw` | _no .git_ | ACTIVE_ZEROCLAW_FILESET | 🔧 **FILESET ONLY** — needs git init + remote add + diff vs `main` |
| 4 | `Ghenghis/hermes-agent` | `main` | `5ef0fe1665611ebe81235ddec3e5e74a9fc1993e` | `G:\Github\hermes-agent-2026.4.13\hermes-agent-2026.4.13` | _no .git_ | ACTIVE_HERMES_FILESET | 🔧 **FILESET ONLY** — fresh clone + diff vs nested fileset |
| 5 | `Ghenghis/open-webui` | `main` | `8dae237a0bfdac4b7f55b463b3e2769ea4b94a0b` | _none_ | _none_ | MISSING_CLONE_TARGET | ❗ **NO LOCAL** — must clone fresh |

## 1. `contract-kit-v17` — EXACT MATCH ✅

```
Remote : https://github.com/Ghenghis/contract-kit-v17
         refs/heads/integration/main = ca5d8f0d94ce328b227ae2d3b59f39ae518670fb
Local  : G:\Github\contract-kit-v17
         integration/main           = ca5d8f0d94ce328b227ae2d3b59f39ae518670fb
```

**Verdict:** Local working tree is dirty (active v2.1.0 documentation work) but
HEAD is identical to remote. Need to commit + push the docs overhaul on a
review branch.

## 2. `kilocode-Azure2` — DIVERGED ⚠

```
Remote (canonical per user truth map):
  https://github.com/AiDave71/kilocode
    refs/heads/main                     = 68a16ace7c9e4a740a36060969b39ca4ee0faf3f
    refs/heads/feat/azure-voice-studio  = 574658008e82f88c9921d7f5b2d877fbf8a6dd86

Local:
  G:\Github\kilocode-Azure2
    feat/azure-voice-studio = 67bd133d6e87683414b8b7e6746aa772aecaa82d
    Configured remotes:
      origin    = https://github.com/Ghenghis/kilocode.git
      upstream  = https://github.com/Kilo-Org/kilocode.git    (Kilo-Org canonical)
      aidave71  = https://github.com/AiDave71/kilocode.git    (user truth map)

Divergence on feat/azure-voice-studio:
  vs origin (Ghenghis/kilocode)            : ahead 491,  behind 0
  vs aidave71 (AiDave71/kilocode — TRUTH)  : ahead 551,  behind 3
  vs upstream (Kilo-Org/kilocode)          : ahead  70,  behind 385
```

**Verdict:** The user's truth map says canonical kilocode lives at
`AiDave71/kilocode`. Local `aidave71` remote is configured. The local feature
branch has 551 unpushed commits + is 3 commits behind `aidave71/main` ancestor.
Recommended action: change push default to `aidave71`, sync 3 missing commits
on a review branch, push the 551 features to `aidave71/feat/azure-voice-studio`.

## 3. `zeroclaw` — FILESET ONLY 🔧

```
Remote : https://github.com/Ghenghis/zeroclaw
         refs/heads/main = ff254b4bb392b7a2b5bac9e881a4327d0e61c870
Local  : C:\Users\Admin\Downloads\VPS\zeroclaw
         no .git directory
         contents : Cargo.toml + Cargo.lock + crates/ + src/ + app/ +
                    components/ + fuzz/ + firmware/ + benches/ + examples/ +
                    docs/ (4 README locales) + Dockerfile + AGENTS.md +
                    CLAUDE.md + flake.nix + CONTRIBUTING.md + SECURITY.md
```

**Verdict:** Active ZeroClaw fileset (full Rust source tree). Required steps
for Claude agent:

1. `git init` inside the fileset.
2. `git remote add origin https://github.com/Ghenghis/zeroclaw.git`.
3. `git fetch origin`.
4. Three-way diff: fileset → `origin/main` (`ff254b4`) → known good.
5. If fileset is clearly a snapshot of `main` plus DaveAI deltas, branch from
   `origin/main`, copy DaveAI deltas, commit, push to a review branch.
6. **Never** force-push to `main`.

## 4. `hermes-agent` — FILESET ONLY 🔧

```
Remote : https://github.com/Ghenghis/hermes-agent
         refs/heads/main = 5ef0fe1665611ebe81235ddec3e5e74a9fc1993e
Local active : G:\Github\hermes-agent-2026.4.13\hermes-agent-2026.4.13
         no .git directory
         5,257 files / 167.8 MB / 30 top-level dirs
         (acp_adapter, gateway, hermes_cli, plugins, skills, src, tests, etc.)
Local outer  : G:\Github\hermes-agent-2026.4.13                (wrapper, 6,945 files)
Local stale  : G:\Github\hermes-agent                          (1,663 files / 30 MB)
```

**Verdict:** Three on-disk Hermes copies, none with git history. Required:

1. Fresh clone `Ghenghis/hermes-agent` to `G:\Github\hermes-agent-fresh`.
2. Diff fresh clone vs the active nested fileset; produce `hermes_diff.patch`.
3. Apply DaveAI deltas as commits on a review branch.
4. Archive the outer wrapper and the stale partial.

## 5. `open-webui` — NO LOCAL ❗

```
Remote : https://github.com/Ghenghis/open-webui
         refs/heads/main = 8dae237a0bfdac4b7f55b463b3e2769ea4b94a0b
Local  : (none)
```

**Verdict:** Pure missing — clone fresh. The local Hub already references
`kilocode_agents_pipeline.py` from VPS deployment notes; verify against the
remote after clone.

## Truth-map adjustments needed

| Item | Current | Should be |
|------|---------|-----------|
| kilocode-Azure2 `origin` remote | `Ghenghis/kilocode` | **`AiDave71/kilocode`** (per user truth map) — re-point or set push.default |
| Local zeroclaw clone target | `G:\Github\zeroclaw` (missing) | Fileset already lives at `C:\Users\Admin\Downloads\VPS\zeroclaw` — init + push, then OPTIONALLY clone back to `G:\Github\zeroclaw` |
| Local hermes clone target | `G:\Github\hermes-agent` (stale partial) | Fresh clone to `G:\Github\hermes-agent-fresh`; diff against active fileset; never overwrite the active fileset |
