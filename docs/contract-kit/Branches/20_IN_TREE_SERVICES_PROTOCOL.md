# 20 — In-Tree Services Protocol

> ABSOLUTE RULE: Never commit, merge, rebase, reset, force-push, or push user work directly on `main` or `master`. `main/master` may only mirror upstream after verified backups exist. Any attempted push to `main/master` is a critical failure and must stop the run.

## 0. Why this document exists

V3 contract §00 enumerates five logical scopes — **Zero Claw, Hermes, Kilo Code, Open WebUI, Hub** — as if each were a separate top-level repository. Phase 0 discovery proved otherwise:

- **Zero Claw** has **no standalone repo**. It lives entirely inside Kilo Code at `packages/kilo-vscode/src/services/zeroclaw/`.
- **Hermes** has **both** a standalone repo *and* in-tree services inside Kilo Code at `packages/kilo-vscode/src/services/hermes/`.
- **Hub** backend lives in `contract-kit-v17` (`src/webui/hub/`), but **integration surfaces** (`HubTab.tsx`, `VoiceSelector.tsx`, etc.) live inside Kilo Code's webview UI.

Whenever a logical feature scope is **physically embedded** inside a different host repo, ownership, branch policy, sync direction, and audit responsibility become ambiguous. This document removes that ambiguity.

Read first:

- `docs/Branches/06_FEATURE_FINGERPRINTING_AND_BRANCH_EXTRACTION.md`
- `docs/Branches/10_CROSS_REPO_HUB_AND_ECOSYSTEM_PROTOCOL.md`
- `docs/Branches/16_ECOSYSTEM_REPO_MANIFEST.md`

---

## 1. Definition: "in-tree service"

An **in-tree service** is a directory inside a *host* repo that contains code which logically belongs to a *different* feature scope.

Properties:

- The **host repo** controls the lifecycle: build, release, tagging, branch protection, CI.
- The **service code** may carry its own feature-card lineage that pre-dates or post-dates the host snapshot.
- Build/CI tooling for the service is bound to the host's pipeline — there is no independent release artifact.
- Cross-repo dependencies (e.g. an in-tree client calling a standalone backend) are governed by **doc 10**, not by the host repo alone.

In-tree services are **not** the same as upstream-tracked vendoring (e.g. `packages/opencode/`), which is governed by doc 06's "Upstream Tracking" section.

---

## 2. Discovered in-tree services in this ecosystem

The following services were verified during Phase 0 discovery against the `kilocode-Azure2` working tree.

| Service name           | Host repo            | Path                                                                | Origin / lineage                              | Cross-repo dependency                       | Branch policy                                                                 |
| ---------------------- | -------------------- | ------------------------------------------------------------------- | --------------------------------------------- | ------------------------------------------- | ----------------------------------------------------------------------------- |
| Hermes (in-tree)       | kilocode-Azure2      | `packages/kilo-vscode/src/services/hermes/` (7 files)               | 100% custom DaveAI; mirrors standalone Hermes | Standalone Hermes repo (canonical TBD)      | Host feature branch; name `feature/hermes-<purpose>`; sync rules per §5       |
| ZeroClaw (in-tree)     | kilocode-Azure2      | `packages/kilo-vscode/src/services/zeroclaw/` (3 files)             | 100% custom DaveAI; **no standalone repo**    | Hermes orchestrator (transport adapter)     | Host feature branch; name `feature/zeroclaw-<purpose>` (see §7)               |
| SSH service            | kilocode-Azure2      | `packages/kilo-vscode/src/services/ssh/`                            | 100% custom DaveAI                            | None                                        | Host feature branch; name `feature/ssh-<purpose>`                             |
| VPS service            | kilocode-Azure2      | `packages/kilo-vscode/src/services/vps/`                            | 100% custom DaveAI                            | Hub backend (deploy targets)                | Host feature branch; name `feature/vps-<purpose>`                             |
| Memory service         | kilocode-Azure2      | `packages/kilo-vscode/src/services/memory/`                         | 100% custom DaveAI                            | None                                        | Host feature branch; name `feature/memory-<purpose>`                          |
| Routing service        | kilocode-Azure2      | `packages/kilo-vscode/src/services/routing/`                        | 100% custom DaveAI                            | Hermes (provider routing)                   | Host feature branch; name `feature/routing-<purpose>`                         |
| Training service       | kilocode-Azure2      | `packages/kilo-vscode/src/services/training/`                       | 100% custom DaveAI                            | None                                        | Host feature branch; name `feature/training-<purpose>`                        |
| Governance service     | kilocode-Azure2      | `packages/kilo-vscode/src/services/governance/`                     | 100% custom DaveAI                            | Hub backend (policy push)                   | Host feature branch; name `feature/governance-<purpose>`                      |
| HubTab (UI surface)    | kilocode-Azure2      | `packages/kilo-vscode/webview-ui/src/components/settings/HubTab.tsx` | DaveAI Hub client                             | **Hub backend in contract-kit-v17**         | Host feature branch; name `feature/hub-ui-<purpose>`; cross-repo per §6        |
| VoiceSelector          | kilocode-Azure2      | `packages/kilo-vscode/webview-ui/src/components/chat/VoiceSelector.tsx` | DaveAI Azure voice integration               | Azure Speech SDK                            | Host feature branch; name `feature/voice-<purpose>`                           |
| opencode (vendored)    | kilocode-Azure2      | `packages/opencode/`                                                | **Upstream-tracked** (Kilo-Org/kilocode)      | Upstream cherry-pick stream                 | **Not** an in-tree service; governed by doc 06 upstream-tracking section      |

Hub backend (counterpart, lives in `contract-kit-v17`):

- `src/webui/hub/`
- `src/hermes/`
- `src/zeroclaw/`

---

## 3. Branch policy for in-tree services

1. **Branches live on the host repo.** An in-tree change to `packages/kilo-vscode/src/services/hermes/` is a branch on `kilocode-Azure2`, not on the standalone Hermes repo. The host repo owns the working-copy lifecycle.

2. **Branch names must reflect the service**, not just the change.

   Correct:
   ```
   feature/hermes-orchestrator-retry-policy
   feature/zeroclaw-tls-handshake-fix
   feature/hub-ui-tab-reorder
   ```

   Forbidden (silently buries scope):
   ```
   feature/policy-fix
   feature/ui-tweak
   feature/bug
   ```

3. **PR description must call out the in-tree service touched.** Use the template in doc 13. Required line:
   ```
   In-tree service touched: <name> (path: <relative-path>)
   ```

4. **If both standalone repo and in-tree code exist** (Hermes case), the PR must declare:
   ```
   Source-of-truth: <standalone | in-tree>
   Sync direction: <standalone -> in-tree | in-tree -> standalone | none>
   ```
   **NEVER fork the lineage silently.** A change applied only to the in-tree copy without acknowledging the standalone counterpart is a contract violation.

---

## 4. Sync protocol when standalone + in-tree both exist (Hermes case)

When a service has **both** a standalone repo and an in-tree copy:

1. **Designate one as canonical.** Document the choice in this file's table (§2) and in the service's own `LINEAGE.md`. The current default for Hermes is **TBD until Phase 1 sign-off** — until then, treat the contract-kit-v17 Hub backend's `src/hermes/` as canonical and propagate changes outward.

2. **Define copy direction explicitly.** Acceptable directions:
   - `standalone -> in-tree` (mainline development happens standalone; in-tree is a snapshot)
   - `in-tree -> standalone` (mainline development happens in-tree; standalone is published)
   - `bidirectional` (forbidden without explicit migration plan; do not use)

3. **CI drift detection.** Both repos must run a drift check on every push to a release branch:

   ```bash
   # Pseudo, run from contract-kit-v17 release-prep CI:
   manifest_a=$(cd "$STANDALONE/src" && find . -type f -name '*.ts' \
                | sort | xargs sha256sum)
   manifest_b=$(cd "$HOST/packages/kilo-vscode/src/services/hermes" && \
                find . -type f -name '*.ts' | sort | xargs sha256sum)
   diff <(echo "$manifest_a") <(echo "$manifest_b") || {
     echo "::error::Hermes in-tree drift detected — open sync feature branch."
     exit 1
   }
   ```

4. **On drift detection:**
   - Open a feature branch on **both** repos: `feature/hermes-sync-<date>` on the host, `feature/in-tree-sync-<date>` on the standalone.
   - Cross-link PRs in description (`Closes <other-PR-URL>`).
   - Both PRs must merge in the same release-branch assembly window (doc 11).
   - Drift that is **intentional** (e.g. host-only patch) must be recorded in `docs/Branches/06_FEATURE_FINGERPRINTING_AND_BRANCH_EXTRACTION.md` with a rationale paragraph.

---

## 5. Hub integration surfaces inside Kilo / WebUI

`HubTab.tsx`, `VoiceSelector.tsx`, and similar files inside `packages/kilo-vscode/webview-ui/src/components/` are **clients of the Hub backend**, which lives in `contract-kit-v17/src/webui/hub/`.

Rules:

1. The network/IPC endpoints these surfaces consume are **governed by the Hub backend's API contract**, not by Kilo Code's own conventions.

2. **Cross-repo contract test (mandatory):**
   - When changing the Hub API surface in `contract-kit-v17`, the change must be paired with a client update in every consumer (currently: `kilocode-Azure2` webview-ui, plus any future consumers listed in doc 10).
   - Release-branch assembly (doc 11) must include both PRs in the same window.
   - The Hub backend repo must run a contract test that imports the client's API call shapes (or an OpenAPI/JSON-Schema fixture) and verifies they round-trip.

3. **Forbidden:** changing a Hub API endpoint shape on the backend without a matching client PR. The CI gate must reject it.

4. Reference: cross-repo feature matrix in `docs/Branches/10_CROSS_REPO_HUB_AND_ECOSYSTEM_PROTOCOL.md`.

---

## 6. ZeroClaw special case

ZeroClaw is unique: **there is no standalone ZeroClaw repo.** All ZeroClaw work happens inside `packages/kilo-vscode/src/services/zeroclaw/` (3 files, 100% custom DaveAI).

Rules:

1. **Branch prefix:** `feature/zeroclaw-<purpose>` on the `kilocode-Azure2` host.

2. **Backup is implicit.** ZeroClaw's git history is fully covered by the Kilo Code host repo backup. No separate backup job is required.

3. **No drift check applies** (there is nothing to compare against).

4. **If ZeroClaw is later split into a standalone repo** (only on explicit user request), the migration MUST follow §8 below and additionally:
   - Use `git subtree split --prefix=packages/kilo-vscode/src/services/zeroclaw/`.
   - Cross-link the new standalone feature cards back to every in-tree feature branch that touched ZeroClaw, so blame and rationale survive the split.
   - Add a `LINEAGE.md` to the new standalone repo pointing to the in-tree origin commit SHA.

---

## 7. Forbidden patterns

The following patterns are forbidden ecosystem-wide:

1. **DO NOT `git init` inside an in-tree service path.**
   ```
   # FORBIDDEN — breaks host repo:
   cd packages/kilo-vscode/src/services/zeroclaw && git init
   ```
   This creates a nested repo that the host repo will refuse to track properly and breaks every clone.

2. **DO NOT use git submodules to "extract" an in-tree service** without an explicit migration plan signed off per doc 11. Submodules introduce checkout fragility, CI complexity, and silent-divergence risk; they are only acceptable as the final step of a planned migration.

3. **DO NOT commit in-tree service changes directly to the host repo's `main`/`master`.** The ABSOLUTE RULE applies — feature branch + PR + verification + merge.

4. **DO NOT split a single feature card** so that the in-tree portion lands on the host PR and the standalone portion lands on the standalone PR **without a dependency declaration.** If you must split, every PR description must contain:
   ```
   Depends-on: <other-PR-URL>
   Part-of: <feature-card-id>
   ```

5. **DO NOT delete in-tree code as part of a migration commit.** History preservation rules in §8 step 5 apply.

---

## 8. Migration ladder: in-tree -> standalone (only if explicitly requested)

This ladder runs only when the user explicitly requests promoting an in-tree service to a standalone repo. Default posture is **do not migrate**.

**Step 1 — Capture full history.**
```bash
cd "$HOST_REPO"
git subtree split --prefix=packages/kilo-vscode/src/services/<svc> \
                  -b split/<svc>
```

**Step 2 — Push the split branch to a new remote.**
```bash
git remote add <svc>-origin git@github.com:DaveAI/<svc>.git
git push <svc>-origin split/<svc>:main
```

**Step 3 — In the host repo, replace the directory.**
Choose ONE:
- Replace with submodule pointer (acceptable only if doc 11 sign-off recorded).
- Remove the directory and switch consumers to the new package via the package manager.

**Step 4 — Update build pipelines + release notes.**
- Host repo CI: drop the in-tree build steps for the migrated service.
- Standalone repo CI: enable the build/release pipeline.
- Release notes (doc 11) must announce the migration, the new repo URL, and the consumer-update PRs.

**Step 5 — Preserve historical in-tree code in host history.**
- **NEVER force-push, rebase-drop, or filter-branch out** the in-tree commits from the host repo. Blame, audit, and incident forensics depend on those commits remaining accessible.
- The migration removes the *files* from the host's working tree at a specific commit; the *history* must remain intact.

---

## 9. Audit checks

1. **Quarterly in-tree audit.**
   - List every directory matching `packages/*/src/services/*/` across all DaveAI host repos.
   - For each, confirm an entry exists in §2 of this document with a named owner and lineage.
   - Any unlisted service is a contract violation; open a feature branch to either document it (preferred) or remove it.

2. **Hermes drift check (continuous).**
   ```bash
   # Run nightly + on every release-branch assembly:
   diff -r "$STANDALONE_HERMES/src" \
           "$HOST/packages/kilo-vscode/src/services/hermes/" \
        | tee hermes-drift.log
   wc -l hermes-drift.log
   ```
   Alert thresholds:
   - File-count delta > 0 — open sync feature branch within 1 business day.
   - Size delta > 5% — review and either reconcile or document intentional drift.

3. **Hub API contract check (per release-branch assembly).**
   - Every consumer of `src/webui/hub/` API listed in doc 10 must have its API-call shapes round-tripped against the backend's contract fixture. Failure blocks the release.

---

## 10. Cross-references

- `docs/Branches/06_FEATURE_FINGERPRINTING_AND_BRANCH_EXTRACTION.md` — feature-card lineage rules; upstream-tracking section covers the `packages/opencode/` exclusion.
- `docs/Branches/10_CROSS_REPO_HUB_AND_ECOSYSTEM_PROTOCOL.md` — cross-repo feature matrix, Hub consumer registry.
- `docs/Branches/11_RELEASE_BRANCH_ASSEMBLY_PROTOCOL.md` — release-branch assembly, sign-off windows, migration sign-off requirements.
- `docs/Branches/16_ECOSYSTEM_REPO_MANIFEST.md` — repo manifest including in-tree services.

---

**End of document. ABSOLUTE RULE applies to every change in this protocol.**
