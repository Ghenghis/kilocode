# Repo Freshness Matrix (Truth Map Aligned)

Generated: 2026-04-26.
Truth map source: user, 2026-04-26 04:48 UTC-07.
Cross-reference source: `git ls-remote` against the 5 canonical URLs.
No pulls, no merges, no pushes were performed.

## Master matrix

| Role | Local Path | Remote | Local HEAD | Remote HEAD | Δ | Risk | Action |
|------|-----------|--------|-----------|-------------|---|------|--------|
| contract-kit-v17 / Hub / WebUI | `G:\Github\contract-kit-v17` | `Ghenghis/contract-kit-v17` | `ca5d8f0` | `ca5d8f0` | **0/0** ✅ | LOW | SAFE_MODE: commit + push docs v2.1.0 on review branch |
| KiloCode (active) | `G:\Github\kilocode-Azure2` | `AiDave71/kilocode` (truth-map) | `67bd133` | `574658` | **551 ahead / 3 behind** ⚠ | **CRITICAL** | REVIEW_MODE: inspect stash, branch from HEAD, sync 3 missing commits, push 551 features to AiDave71 |
| ZeroClaw (active fileset) | `C:\Users\Admin\Downloads\VPS\zeroclaw` | `Ghenghis/zeroclaw` | _no .git_ | `ff254b4` | **uninit** 🔧 | HIGH | REVIEW_MODE: git init → add origin → fetch → 3-way diff → review branch |
| Hermes (active fileset) | `G:\Github\hermes-agent-2026.4.13\hermes-agent-2026.4.13` | `Ghenghis/hermes-agent` | _no .git_ | `5ef0fe1` | **uninit** 🔧 | HIGH | REVIEW_MODE: fresh clone to `G:\Github\hermes-agent-fresh`; diff fileset; patch series |
| Open-WebUI | _none_ | `Ghenghis/open-webui` | _none_ | `8dae237` | **missing** ❗ | LOW | SAFE_MODE: `git clone` to `G:\Github\open-webui` and `…-current` |
| Secrets | `C:\Users\Admin\Downloads\api` | _(never committed)_ | n/a | n/a | n/a | **CRITICAL** | QUARANTINE: import to SecretStorage + 0600 env file; encrypted-archive plaintext; delete |

## 1. contract-kit-v17 — `EXACT_MATCH_DIRTY_TREE`

| Field | Value |
|-------|-------|
| Local path | `G:\Github\contract-kit-v17` |
| Remote | `https://github.com/Ghenghis/contract-kit-v17` |
| Branch | `integration/main` |
| Local HEAD | `ca5d8f0d94ce328b227ae2d3b59f39ae518670fb` |
| Remote HEAD | `ca5d8f0d94ce328b227ae2d3b59f39ae518670fb` |
| Ahead | 0 |
| Behind | 0 |
| Stash | 0 |
| Dirty | YES (v2.1.0 docs work) |
| Last commit | 2026-04-23T00:42:02-07:00 |
| Risk | LOW |
| Verdict | **HEAD MATCHES REMOTE** |

**Sync plan:**
1. `git checkout -b chore/docs-v2.1.0`
2. `git add docs/ README.md CHANGELOG.md skills/ scripts/audit/v79*.py scripts/audit/v80*.py scripts/audit/v81*.py artifacts/`
3. Run V79 + V80 + V81 — must all pass.
4. `git commit -m "docs: v2.1.0 ecosystem documentation overhaul"`
5. `git push origin chore/docs-v2.1.0` — open PR to `integration/main`.

## 2. kilocode-Azure2 — `DIVERGED_551/3` (CRITICAL)

| Field | Value |
|-------|-------|
| Local path | `G:\Github\kilocode-Azure2` |
| Truth-map remote | `https://github.com/AiDave71/kilocode` |
| Configured remotes | origin=Ghenghis · upstream=Kilo-Org · aidave71=AiDave71 |
| Branch | `feat/azure-voice-studio` |
| Local HEAD | `67bd133d6e87683414b8b7e6746aa772aecaa82d` |
| AiDave71 HEAD (`feat/azure-voice-studio`) | `574658008e82f88c9921d7f5b2d877fbf8a6dd86` |
| AiDave71 HEAD (`main`) | `68a16ace7c9e4a740a36060969b39ca4ee0faf3f` |
| **Δ vs aidave71/feat/azure-voice-studio** | **ahead 551 / behind 3** |
| Δ vs origin (Ghenghis) feat/azure-voice-studio | ahead 491 / behind 0 |
| Δ vs origin (Ghenghis) main | ahead 3304 / behind 31 |
| Δ vs upstream (Kilo-Org) main | ahead 70 / behind 385 |
| Stash | 1 |
| Dirty | YES (untracked artefacts) |
| Last commit | 2026-04-24T01:07:41-07:00 |
| Risk | CRITICAL |

**Why critical:**
- The user's truth map says canonical is `AiDave71/kilocode`, not `Ghenghis/kilocode`.
- 551 unpushed commits to AiDave71 + 3 commits we are missing.
- Stash contains uninspected work; could include protected DaveAI customisations.
- Kilo-Org upstream is 385 commits ahead — deferred.

**Sync plan:**
1. `git stash show -p stash@{0}` — inspect first.
2. `git fetch aidave71 --prune`.
3. `git checkout -b sync/aidave71-2026-04-26 67bd133`.
4. `git rebase aidave71/feat/azure-voice-studio` (sync 3 commits we're missing).
5. Run V06+V07+V09+V15+V79+V80+V81.
6. `git push aidave71 sync/aidave71-2026-04-26`.
7. Defer Kilo-Org upstream cherry-pick to a separate batch.
8. **Never** force-push.

## 3. ZeroClaw — `UNINIT_FILESET` (HIGH)

| Field | Value |
|-------|-------|
| Local path | `C:\Users\Admin\Downloads\VPS\zeroclaw` |
| Truth-map remote | `https://github.com/Ghenghis/zeroclaw` |
| Local .git | NONE |
| Parent VPS .git | empty (no commits, no remotes) |
| Remote HEAD (main) | `ff254b4bb392b7a2b5bac9e881a4327d0e61c870` |
| Risk | HIGH |
| Verdict | **ACTIVE FILESET — needs git init + diff against remote** |

**Sync plan:**

```bash
cd C:\Users\Admin\Downloads\VPS\zeroclaw
git init
git remote add origin https://github.com/Ghenghis/zeroclaw.git
git fetch origin --prune
# Generate three-way map:
#   tree A = current fileset
#   tree B = origin/main (ff254b4)
#   tree C = closest ancestor (compute via fuzzy match if A has no history)
git checkout -b review/zeroclaw-import origin/main
# Copy fileset over (preserving deletions intentionally tracked)
# Stage deltas + commit per logical change.
# Push review branch:
git push -u origin review/zeroclaw-import
```

Run gates `V62_ZEROCLAW_RUNTIME_TRUTH` and `V63_SHIBA_MEMORY_TRUTH` after the
review branch is up.

## 4. Hermes — `UNINIT_FILESET` (HIGH)

| Field | Value |
|-------|-------|
| Active path | `G:\Github\hermes-agent-2026.4.13\hermes-agent-2026.4.13` |
| Truth-map remote | `https://github.com/Ghenghis/hermes-agent` |
| Active local .git | NONE |
| Wrapper | `G:\Github\hermes-agent-2026.4.13` (6,945 files) |
| Stale partial | `G:\Github\hermes-agent` (1,663 files) |
| Remote HEAD (main) | `5ef0fe1665611ebe81235ddec3e5e74a9fc1993e` |
| Risk | HIGH |

**Sync plan:**

```bash
git clone https://github.com/Ghenghis/hermes-agent.git G:\Github\hermes-agent-fresh
# Mirror the active fileset over the fresh clone (preserve .git!):
robocopy "G:\Github\hermes-agent-2026.4.13\hermes-agent-2026.4.13" \
         "G:\Github\hermes-agent-fresh" /MIR /XD .git
cd G:\Github\hermes-agent-fresh
git status --short        # see deltas
git checkout -b review/active-fileset-import
git add -A
git commit -m "feat: import active fileset deltas (2026-04-26)"
git push -u origin review/active-fileset-import
```

Run gate `V61_HERMES_RUNTIME_TRUTH` after the review branch is up.

## 5. Open-WebUI — `MISSING_PURE_CLONE` (LOW)

| Field | Value |
|-------|-------|
| Local path | _(none)_ |
| Truth-map remote | `https://github.com/Ghenghis/open-webui` |
| Remote HEAD (main) | `8dae237a0bfdac4b7f55b463b3e2769ea4b94a0b` |
| Risk | LOW |

```bash
git clone https://github.com/Ghenghis/open-webui.git G:\Github\open-webui
git clone https://github.com/Ghenghis/open-webui.git G:\Github\open-webui-current
```

Run gate `V68_OPENWEBUI_TRUTH` after.

## 6. Secrets — `QUARANTINE` (CRITICAL)

| Field | Value |
|-------|-------|
| Path | `C:\Users\Admin\Downloads\api` |
| Class | SECRET_ENV_SOURCE_DO_NOT_COMMIT |
| Risk | CRITICAL |
| Files | `.env`, `.env-Azure`, `.env-test`, `.env.contract-kit`, `.env.github`, `API_KEYS_VERIFICATION.md`, `github.txt`, `hf-token.txt`, `minimax.txt`, `siliconflow.txt`, `env/` |

**Hard rules:**
- Never commit any of these files to any repo.
- Run gate `V42_SECRET_SCAN` against every working tree before any push.
- Import flow: `vscode.SecretStorage` (KiloCode) · Hub canonical settings (server-side `:8082` only) · Hermes systemd env file (mode 0600).

## Verdict roll-up

| Verdict bucket | Count | Repos |
|---------------|-------|-------|
| Exact match (clean handoff) | 1 | contract-kit-v17 |
| Diverged (review required) | 1 | kilocode-Azure2 |
| Uninit fileset (init + diff) | 2 | zeroclaw, hermes-agent |
| Pure clone | 1 | open-webui |
| Quarantine (secrets) | 1 | Downloads\api |

**Overall freshness verdict:** `PARTIAL_HANDOFF_WITH_BLOCKERS` — handoff is
ready because every role is mapped to a real location, but ZeroClaw, Hermes,
and Open-WebUI require concrete sync work before any of them can be claimed
"current and stable" against their canonical remotes.
