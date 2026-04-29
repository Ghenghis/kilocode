# Conflict Risk Matrix (Truth Map Aligned)

Generated: 2026-04-26.

| Repo / op | Risk | Conflict surface | Mitigation |
|-----------|------|------------------|------------|
| **contract-kit-v17** — commit + push docs v2.1.0 | LOW | `docs/`, `README.md`, `CHANGELOG.md`, `skills/`, 3 audit gates, this `artifacts/repo-sync/` tree | Commit on review branch `chore/docs-v2.1.0`; require V79+V80+V81 + docs verifier green before merge to `integration/main` |
| **kilocode-Azure2** — sync to `aidave71/feat/azure-voice-studio` (truth-map remote, 551 ahead / 3 behind) | **CRITICAL** | All 21 `kilo-vscode/src/services/*` dirs are DaveAI custom; 1 stash; 491 also unpushed to Ghenghis/kilocode | Inspect stash first; create `sync/aidave71-2026-04-26` branch; rebase onto `aidave71/feat/azure-voice-studio`; run V06+V07+V09+V15 between batches; push to AiDave71; never force-push |
| kilocode-Azure2 — cherry-pick from `upstream/main` (Kilo-Org, 385 behind) | HIGH | Upstream may modify files in protected paths (`packages/kilo-vscode/src/services/`) | Use the upstream allowlist in `CUSTOM_DAVEAI_FILES.md`; cherry-pick only the allowed paths; defer to a separate batch after AiDave71 sync is stable |
| kilocode-Azure2 — rebase onto `origin/main` (Ghenghis, 3304/31) | **DO NOT DO** | feature branch and main have diverged independently | Treat `feat/azure-voice-studio` as the canonical active branch; do not rebase to main |
| **zeroclaw** at `Downloads\VPS\zeroclaw` — `git init` + adopt `Ghenghis/zeroclaw` | HIGH | Fileset has Cargo.toml + Rust crates; remote main is `ff254b4`; no shared history | Init in place; `fetch` Ghenghis/zeroclaw; create `review/zeroclaw-import` from `origin/main`; copy fileset over with deletions intentional; commit per logical change; push review branch only |
| **hermes-agent** active fileset — fresh clone + import | HIGH | 5,257 files; uncommitted DaveAI deltas live only in fileset | Fresh clone Ghenghis/hermes-agent to `G:\Github\hermes-agent-fresh`; `robocopy /MIR` from active fileset (excluding `.git`); commit on `review/active-fileset-import`; push review branch only |
| **open-webui** — pure clone | LOW | none locally | `git clone Ghenghis/open-webui` to both targets; verify pipeline `kilocode_agents_pipeline.py` integrity |
| **VPS deployment workspace** — `Downloads\VPS` parent | MEDIUM | empty .git with no remotes; many subprojects mixed | Do **not** treat as a single repo; audit each subfolder; init/clone the ones that should be repos (zeroclaw, hermes_folder, daveai-api…) into proper paths |
| **Secrets** at `Downloads\api` | **CRITICAL** | 5 `.env*` files + 4 `.txt` keys + `env/` folder | Run V42_SECRET_SCAN on all working trees before any push; import to vscode.SecretStorage / Hub canonical settings / systemd env file (0600); 7-zip + delete plaintext |
| **DaveAI repacks v1+v2** — dedupe + merge | LOW | 6 shared top-level dirs; possible binary collisions | SHA256 dedupe (see `REPACK_MERGE_MANIFEST.csv`); merge only `v2-only` non-legacy files; archive v1 |

## Hard rules (binding for all agents)

1. No force push to any remote.
2. No destructive `git reset --hard` without backup branch first.
3. No commit of any file under `C:\Users\Admin\Downloads\api`.
4. No overwrite of any path listed in `CUSTOM_DAVEAI_FILES.md` without explicit user approval.
5. All sync work happens on review branches, never directly on `main` / `integration/main` / `feat/*`.
6. Required tests after every batch:
   - contract-kit-v17 → V79 + V80 + V81
   - kilocode-Azure2 → V06 + V07 + V09 + V15 + V42 + V79 + V80 + V81
   - zeroclaw → V62 + V63 + V42
   - hermes-agent → V61 + V42
   - open-webui → V68 + V42
7. Final verdict only from evidence files in `artifacts/repo-sync/` and `artifacts/handoff-to-claude/`.
