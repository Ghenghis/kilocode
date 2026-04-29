# 22 — CLAUDE CODE WORKTREE AND SUBAGENT PROTOCOL

> **ABSOLUTE RULE: NO PUSHES TO MAIN/MASTER. NO MERGES. NO TAGS. WORK ON FEATURE BRANCHES ONLY. EVERY ACTION MUST APPEAR IN THE EVIDENCE LEDGER. WHEN IN DOUBT, STOP AND ASK.**

---

## Why this doc

The V3 contract (docs 01–21) was authored under the implicit assumption that **one human-driven agent operates from one repo's main checkout**. That assumption is wrong for this ecosystem.

Reality, verified across multiple sessions:

- Execution is driven by **Claude Code** with parallel sub-agents.
- The parent process is frequently running **inside a worktree** (e.g. `.claude/worktrees/busy-elgamal-a14bac/`), not the main checkout.
- Sub-agents launched via the `Agent` tool may be **sandboxed to their own worktree** and unable to write outside it.
- The 20-agent quorum model in V3 was specified as if 20 independent processes voted in parallel; in Claude Code the "agents" are dispatched sub-tasks of a single conversation.

This document defines the **concrete operational patterns** that make V3 executable as-is on Claude Code without inventing new contracts. It does not replace docs 02, 04, or 17 — it explains how to honor them when the executor is a sub-agent inside a worktree.

---

## Worktree topology in this ecosystem

- **contract-kit-v17 main checkout**: `G:\Github\contract-kit-v17\`
- **Worktrees** live under `<repo>/.claude/worktrees/<short-id>/`
  - Example active worktree: `G:\Github\contract-kit-v17\.claude\worktrees\busy-elgamal-a14bac\`
- Each worktree has its **own `HEAD` + index + working tree**.
- All worktrees share `.git/objects` and `.git/refs` with the main checkout.
- A commit made inside a worktree is **immediately visible** to `git log` from the main checkout (same object database).
- A push from a worktree pushes to the **same remote** as the main checkout.

Enumerate worktrees at the start of every run:

```
git worktree list
```

Record the output in the evidence ledger before any other action.

---

## Parent vs sub-agent capabilities

| Capability                            | Parent (Run Captain) | Sub-agent (worktree-isolated) | Sub-agent (general) |
|---------------------------------------|:---:|:---:|:---:|
| Read any absolute path                | YES | YES | YES |
| Write inside its worktree             | YES | YES | YES |
| Write outside its worktree            | YES | **NO** | depends on policy |
| Run git commands inside worktree      | YES | YES | YES |
| Run git commands outside worktree     | YES | **NO** (no shell access there) | YES |
| Create a new worktree                 | YES | NO  | YES |
| Push to remote                        | YES | YES (governed by hook) | YES |
| Run long-running build                | YES (via `run_in_background: true`) | LIMITED (single-turn budget) | YES |
| Read shared credentials (gh, ssh)     | YES | NO  | NO  |
| Apply Edit/Write patches              | YES | YES (in sandbox) | YES |

**Key consequence**: when a sub-agent reports "I cannot write to `<path>`," the parent must apply the patch itself. This is not a failure of the sub-agent — it is the expected protocol.

---

## Pattern: parallel doc drafting by sub-agents

Use case: this very document was drafted by a sub-agent and written by the parent.

Protocol:

1. Parent dispatches a sub-agent with a **self-contained prompt** (no implicit context the sandbox cannot see).
2. Sub-agent does NOT call the `Write` tool. Instead, it returns the **complete file body verbatim** in its final report.
3. Parent applies the result via the `Write` tool from the parent process.
4. Parent records the round-trip in the evidence ledger: prompt hash, sub-agent ID, output hash, target path.

Why: this works regardless of whether the sub-agent is sandboxed.

---

## Pattern: cross-repo investigation

Sub-agents can `Read` any absolute path on the host, even outside their worktree.

Protocol:

- Parent dispatches an investigation sub-agent with a list of absolute paths to inspect across repos (e.g. `G:\Github\repo-a\src\...`, `G:\Github\repo-b\src\...`).
- Sub-agent returns a **markdown summary** including findings and any recommended Edit/Write patches as verbatim diffs.
- Parent applies any cross-repo writes itself.

Forbidden: a sub-agent attempting `git push` from a directory outside its worktree. It has no shell context there.

---

## Pattern: 20-agent quorum simulation

The V3 quorum model is preserved by **role-based sub-agent dispatch**, with the Run Captain (the parent) as A01.

For each feature-branch operation:

| Step | Agent role | Action |
|---|---|---|
| 1 | A08 Patch Extraction | Produces the extraction plan + proposed diff |
| 2 | A06 Feature Fingerprinter | Confirms scope matches the feature fingerprint |
| 3 | A20 Red Team / Challenger | Attempts to invalidate the plan (find leaks, missed files, conflicts) |
| 4 | A15 Security Scanner | Runs `git grep` for secret patterns across the diff |
| 5 | A02 Git Safety Officer | Confirms target branch is **not** `main`/`master` and pre-existing branch is not being clobbered |
| 6 | A01 Run Captain (parent) | Tallies votes |

The actual `git switch -c <feature-branch>` and any subsequent `git push` happens **only if all five sub-agents return PASS**. The Run Captain runs the git commands itself — never delegates them to a quorum member.

Tally rules:

- Any single FAIL → STOP, do not proceed, record in ledger.
- Any sub-agent reporting "I could not verify" is treated as FAIL.
- Quorum is recorded with the agent role, sub-agent invocation ID, and verbatim verdict line.

---

## Pattern: Phase 1 backups in parallel

Mirror-clone backups for many repos are independent and embarrassingly parallel.

Protocol:

- Parent launches each `git clone --mirror` via `Bash` with `run_in_background: true`, one per repo.
- Parent does **not** poll. The runtime notifies on completion.
- After all background clones complete, parent runs **restore tests** sequentially: clone-from-mirror into a scratch dir, `git fsck`, `git log -1` sanity check.
- Each backup + restore test is a separate ledger entry.

Forbidden: running mirror clones in foreground sequentially. That burns the turn budget and stalls the entire run.

---

## Forbidden patterns

- A sub-agent calling `git push` targeting `main` or `master` on any remote. **Parent-only, and only after explicit operator approval.**
- A sub-agent writing outside its sandbox without **surfacing the limitation in its report**. Silent failure is a contract violation.
- Parent claiming "task complete" based on a sub-agent's narrative ("I think I did X") without **independent verification** (re-read the file, run the test, check `git log`).
- Running long commands (builds, mirror clones, full test suites) **without** `run_in_background: true`. This consumes turn budget and risks timeout cancellation mid-operation.
- Dispatching two sub-agents to edit the **same file in parallel**. Always serialize writes to a single file.
- A sub-agent invoking `gh` commands that require auth from inside a sandbox where the auth token is unavailable.

---

## Worktree-specific hook installation

Hooks behave differently depending on how they are installed:

| Install method | Effect |
|---|---|
| `.git/hooks/<name>` (in main checkout) | Shared by **all worktrees** by default |
| `core.hooksPath = <abs-path>` (repo config) | Shared by all worktrees |
| `git config --worktree core.hooksPath <path>` | **Only that worktree** uses the override |

**Recommendation**: install protective hooks (pre-push main-branch guard, secret scanner, Phase 1 backup verifier) at the **main checkout level** under `.git/hooks/` so every worktree inherits them automatically. Per-worktree overrides should be reserved for ad-hoc debugging.

Verification step: after installing, run from each worktree:

```
git config --get core.hooksPath
ls -l "$(git rev-parse --git-path hooks)"
```

and record the result in the ledger.

---

## Audit trail when working from a worktree

At the start of every run, the evidence ledger MUST capture:

- `git worktree list` output (verbatim).
- The parent process **cwd** (`pwd` from a Bash call), to make explicit which worktree is driving.
- The current branch (`git rev-parse --abbrev-ref HEAD`) of that worktree.
- The corresponding main-checkout HEAD (`git -C <main-checkout-abs-path> rev-parse HEAD`) for reference.

Because worktrees share refs, any commit produced on a worktree branch will appear in `git log --all` from the main checkout. Sanity-check this after every commit:

```
git -C <main-checkout> log --oneline --all | head -20
```

If the worktree's commit is **not** visible from the main checkout, something is wrong (separate object database, broken link, detached worktree) — **STOP and ASK**.

---

## When to refuse sub-agent dispatch

The Run Captain must **not** dispatch a sub-agent when:

- The task involves **shared mutable state** that two agents would touch concurrently (e.g. both editing the same file). Serialize: do it in the parent, or chain agents sequentially.
- The task requires **credentials** the sub-agent's sandbox cannot access (`gh auth login`, ssh keys, signed commits with the operator's GPG key). Parent-only.
- The task requires an **interactive TTY** (`git rebase -i`, `git add -p`, `git commit --amend` with editor, `npm login`). These cannot run under `-NonInteractive`/headless contexts and must be deferred to a human operator.
- The task is **irreversible without operator confirmation** (`git push --force`, `git reset --hard origin/...`, deleting branches, deleting tags). Parent + explicit operator approval.

When refusing, the parent records the refusal in the ledger with the reason, then prompts the operator.

---

## Cross-references

- **Doc 02** — Git Safety Officer role definition; this doc shows how to instantiate it as a sub-agent.
- **Doc 04** — Evidence ledger schema; this doc adds worktree-list and cwd as required fields per run.
- **Doc 17** — pre-push hook installer; this doc explains worktree-aware deployment.
- **Doc 26** — 20-agent dispatch templates; companion runnable prompts.
