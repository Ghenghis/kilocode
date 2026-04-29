# Local Location Inventory (Truth Map Aligned)

Generated: 2026-04-26.
Aligned with the user-provided truth map and cross-referenced against the five
canonical GitHub repos via `git ls-remote` (read-only).

## Truth map (user-provided)

| Role | Local Path | Online Repo | Class |
|------|-----------|-------------|-------|
| contract-kit-v17 / WebUI / Hub | `G:\Github\contract-kit-v17` | `https://github.com/Ghenghis/contract-kit-v17` | **SOURCE_OF_TRUTH_WEBUI_HUB_CONTRACTKIT** |
| KiloCode | `G:\Github\kilocode-Azure2` | `https://github.com/AiDave71/kilocode` | **ACTIVE_KILOCODE_REPO** |
| ZeroClaw | `C:\Users\Admin\Downloads\VPS\zeroclaw` | `https://github.com/Ghenghis/zeroclaw` | **ACTIVE_ZEROCLAW_FILESET_OR_REPO** |
| Hermes | `G:\Github\hermes-agent-2026.4.13\hermes-agent-2026.4.13` | `https://github.com/Ghenghis/hermes-agent` | **ACTIVE_HERMES_FILESET** |
| Open-WebUI | _(no local)_ | `https://github.com/Ghenghis/open-webui` | **MISSING_CLONE_TARGET** |
| Secrets / env / API keys | `C:\Users\Admin\Downloads\api` | _(never committed)_ | **SECRET_ENV_SOURCE_DO_NOT_COMMIT** |

## Full inventory

| # | Path | Class | Git? | Branch | Ahead/Behind (origin) | Stash | Last commit |
|---|------|-------|------|--------|----------------------|-------|-------------|
| 1 | `G:\Github\contract-kit-v17` | SOURCE_OF_TRUTH | ✅ | `integration/main` | **0 / 0** | 0 | 2026-04-23 |
| 2 | `G:\Github\kilocode-Azure2` | ACTIVE_KILOCODE | ✅ | `feat/azure-voice-studio` | **491 / 0** vs origin · 551/3 vs aidave71 · 70/385 vs upstream | 1 | 2026-04-24 |
| 3 | `C:\Users\Admin\Downloads\VPS\zeroclaw` | ACTIVE_ZEROCLAW | ❌ | _no .git_ | n/a | n/a | n/a |
| 4 | `C:\Users\Admin\Downloads\VPS\zeroclaw-config` | ACTIVE_ZEROCLAW_CONFIG | ❌ | n/a | n/a | n/a | n/a |
| 5 | `C:\Users\Admin\Downloads\VPS` (parent) | VPS_DEPLOYMENT_WORKSPACE | ⚠ empty git | `master` (no commits) | n/a | 0 | n/a |
| 6 | `G:\Github\hermes-agent-2026.4.13\hermes-agent-2026.4.13` | ACTIVE_HERMES | ❌ | n/a | n/a | n/a | n/a |
| 7 | `G:\Github\hermes-agent-2026.4.13` | FILESET_DUPLICATE_WRAPPER | ❌ | n/a | n/a | n/a | n/a |
| 8 | `G:\Github\hermes-agent` | FILESET_STALE_HERMES | ❌ | n/a | n/a | n/a | n/a |
| 9 | `G:\Github\zeroclaw` | MISSING_CLONE_TARGET | ❌ | n/a | n/a | n/a | n/a |
|10 | `G:\Github\zeroclaw-current` | MISSING_CLONE_TARGET | ❌ | n/a | n/a | n/a | n/a |
|11 | `G:\Github\open-webui` | MISSING_CLONE_TARGET | ❌ | n/a | n/a | n/a | n/a |
|12 | `G:\Github\open-webui-current` | MISSING_CLONE_TARGET | ❌ | n/a | n/a | n/a | n/a |
|13 | `C:\Users\Admin\Downloads\api` | SECRET_ENV_SOURCE_DO_NOT_COMMIT | ❌ | n/a | n/a | n/a | n/a |
|14 | `G:\Github\contract-kit-v17\DaveAI_Ecosystem_Truth_Skills_Repack-v2` | CURRENT_REPACK | ❌ | n/a | n/a | n/a | n/a |
|15 | `G:\Github\DaveAI_Ecosystem_Truth_Skills_Repack` | STALE_REPACK | ❌ | n/a | n/a | n/a | n/a |

## Per-row evidence

### 1. `contract-kit-v17` — SOURCE_OF_TRUTH_WEBUI_HUB_CONTRACTKIT

```
Remote   : https://github.com/Ghenghis/contract-kit-v17
HEAD     : ca5d8f0d94ce328b227ae2d3b59f39ae518670fb (integration/main)
Branch   : integration/main
Ahead    : 0
Behind   : 0
Stash    : 0
Dirty    : YES (active v2.1.0 docs in working tree)
Cross-ref: ✅ EXACT MATCH with remote integration/main
Contains : Hub v2 (21 routers) · WebUI shell+panels · docs/ (v2.1.0) ·
           skills/ (registry.seed.json + manifest.schema.json) ·
           hermes/ · zeroclaw/ · settings_contract_kit/ · scripts/audit/
           handoff/ · artifacts/
```

### 2. `kilocode-Azure2` — ACTIVE_KILOCODE_REPO

```
Truth-map remote : https://github.com/AiDave71/kilocode
Local remotes    : origin   = https://github.com/Ghenghis/kilocode.git
                    upstream = https://github.com/Kilo-Org/kilocode.git
                    aidave71 = https://github.com/AiDave71/kilocode.git
HEAD             : 67bd133d6e87683414b8b7e6746aa772aecaa82d
Branch           : feat/azure-voice-studio
Stash            : 1 (must be inspected before any sync)
Dirty            : YES (untracked artefacts)
Last commit      : 2026-04-24T01:07:41-07:00
Divergence (HEAD ↔ remote feat/azure-voice-studio):
  - vs Ghenghis/kilocode (origin)        : ahead 491, behind 0
  - vs AiDave71/kilocode (truth-map)     : ahead 551, behind 3
  - vs Kilo-Org/kilocode (upstream)      : ahead  70, behind 385
Contains: 81 audit gates (V01–V81), 21 agent .md files (kc-main + kc-01..20),
          20 service subdirs incl. hub-services/ (v2.1.0), zeroclaw/, hermes/
```

### 3. `Downloads\VPS\zeroclaw` — ACTIVE_ZEROCLAW_FILESET_OR_REPO

```
Truth-map remote : https://github.com/Ghenghis/zeroclaw
Remote HEAD      : ff254b4bb392b7a2b5bac9e881a4327d0e61c870 (main)
Local            : C:\Users\Admin\Downloads\VPS\zeroclaw
                   no .git of its own (parent VPS git is empty/uninit)
Top-level files  : Cargo.toml + Cargo.lock + LICENSE + NOTICE + README*.md ×4 +
                   AGENTS.md + CLAUDE.md + CHANGELOG.md + CONTRIBUTING.md +
                   CODE_OF_CONDUCT.md + SECURITY.md + Dockerfile +
                   docker-compose.yml + flake.nix + flake.lock +
                   rust-toolchain.toml + rustfmt.toml + clippy.toml +
                   deny.toml + bootstrap.sh + zero-claw.jpeg + zeroclaw.png
Top-level dirs   : .cargo + .githooks + .github + .gemini + _scripts +
                   app + benches + components + crates + deploy + dev +
                   docs + examples + firmware + fuzz + lib + migrations +
                   public + python + scripts + src + styles + test_dir +
                   test_helpers + tests
Action           : `git init` + add origin = Ghenghis/zeroclaw + fetch + diff
                   vs origin/main + commit DaveAI deltas on review branch
```

### 4. `Downloads\VPS\zeroclaw-config` — ACTIVE_ZEROCLAW_CONFIG

```
2 files, ~0 MB. Bundle with zeroclaw/ at first commit.
```

### 5. `Downloads\VPS` (parent) — VPS_DEPLOYMENT_WORKSPACE

```
.git/HEAD     : ref: refs/heads/master (NO COMMITS yet)
.git/config   : core only — NO REMOTES configured
Top dirs      : agent-brain · agentic-ui · arcade · audio · chess-bot · code ·
                conscious · daveai · daveai-api · daveai-v7 · docs · env ·
                games · hermes_folder · intros · litellm · nginx · plans ·
                Private-hermes-docs-api-keys · public · scripts · stack ·
                website-workspace · zeroclaw · zeroclaw-config
Loose files   : .env · .env.deploy · cloudflared.exe · docker-compose.hermes.yml
                ecosystem.config.js · AUDIT_RESULTS.txt · deploy-result.txt
                deploy-stdout.txt · deploy-v6-output.txt + screenshots/PNGs
Action        : Treat as a multi-project deployment workspace, NOT a single
                repo. Audit each subfolder; do not git-track the parent.
```

### 6. `hermes-agent-2026.4.13\hermes-agent-2026.4.13` — ACTIVE_HERMES_FILESET

```
Truth-map remote : https://github.com/Ghenghis/hermes-agent
Remote HEAD      : 5ef0fe1665611ebe81235ddec3e5e74a9fc1993e (main)
Local            : 5,257 files / 167.8 MB
Top dirs (30)    : .github · .kilo · .plans · .Private-Exclude · acp_adapter ·
                   acp_registry · agent · assets · cron ·
                   datagen-config-examples · docker · docs · environments ·
                   gateway · hermes_cli · img · landingpage · nix ·
                   optional-skills · packaging · plans · plugins · scripts ·
                   skills · src · tests · tinker-atropos · tools · web · website
Top files        : AGENTS.md · CONTRIBUTING.md · Dockerfile · LICENSE ·
                   MANIFEST.in · pyproject.toml · README.md ·
                   RELEASE_v0.2.0…v0.9.0.md · cli.py · run_agent.py ·
                   setup-hermes.sh · uv.lock · package.json · package-lock.json
Action           : Fresh clone Ghenghis/hermes-agent to G:\Github\hermes-agent-fresh
                   Diff fileset against fresh clone; preserve fileset deltas
                   as patches on review branch.
```

### 7. `hermes-agent-2026.4.13` (outer) — FILESET_DUPLICATE_WRAPPER

```
Total : 6,945 files / 206.7 MB (38.9 MB more than nested copy)
Holds : the nested ACTIVE_HERMES_FILESET above plus extras
Action: Audit the 1,688-file delta; archive the wrapper after migration.
```

### 8. `hermes-agent` (smaller) — FILESET_STALE_HERMES

```
Total : 1,663 files / 30.1 MB
Action: Diff against ACTIVE_HERMES_FILESET; archive after migration.
```

### 9–12. Missing clone targets

```
G:\Github\zeroclaw           : will hold mirror of Ghenghis/zeroclaw
G:\Github\zeroclaw-current   : working copy
G:\Github\open-webui         : will hold Ghenghis/open-webui
G:\Github\open-webui-current : working copy

git clone https://github.com/Ghenghis/zeroclaw.git    G:\Github\zeroclaw
git clone https://github.com/Ghenghis/zeroclaw.git    G:\Github\zeroclaw-current
git clone https://github.com/Ghenghis/open-webui.git  G:\Github\open-webui
git clone https://github.com/Ghenghis/open-webui.git  G:\Github\open-webui-current
```

### 13. `Downloads\api` — SECRET_ENV_SOURCE_DO_NOT_COMMIT

```
21 files / 0.3 MB (plaintext secrets)
Files :
  .env  .env-Azure  .env-test  .env.contract-kit  .env.github
  API_KEYS_VERIFICATION.md
  github.txt  hf-token.txt  minimax.txt  siliconflow.txt
  env/ (nested)
HARD RULE : NEVER commit any of these.
Import targets:
  - vscode.SecretStorage    (KiloCode SettingsAgentAPI.ts)
  - Hub canonical settings   (POST /settings, server-side at :8082 only)
  - Hermes systemd env file  (mode 0600 on VPS)
After import: 7-zip with passphrase + delete plaintext.
```

### 14–15. DaveAI repacks

```
v2 (current) : G:\Github\contract-kit-v17\DaveAI_Ecosystem_Truth_Skills_Repack-v2
               535 files / 43.3 MB
v1 (stale)   : G:\Github\DaveAI_Ecosystem_Truth_Skills_Repack
               536 files / 53.3 MB
Both have 6 top dirs: agentic-truth · audits · contract-kit-v17 · install ·
manifests · skills + a .zip + README.md.
Action: SHA256 dedupe (see REPACK_MERGE_MANIFEST.csv).
```

## Verdict counts

| Class | Count |
|-------|-------|
| SOURCE_OF_TRUTH_WEBUI_HUB_CONTRACTKIT | 1 |
| ACTIVE_KILOCODE_REPO | 1 |
| ACTIVE_ZEROCLAW_FILESET_OR_REPO + CONFIG | 2 |
| ACTIVE_HERMES_FILESET | 1 |
| FILESET_DUPLICATE_WRAPPER / FILESET_STALE_HERMES | 2 |
| VPS_DEPLOYMENT_WORKSPACE | 1 |
| MISSING_CLONE_TARGET | 4 |
| SECRET_ENV_SOURCE_DO_NOT_COMMIT | 1 |
| CURRENT_REPACK / STALE_REPACK | 2 |

**Overall location verdict:** `READY_FOR_HANDOFF_WITH_NOTED_BLOCKERS` — every
required role is identifiable; only `open-webui` requires a fresh clone before
work can begin there.
