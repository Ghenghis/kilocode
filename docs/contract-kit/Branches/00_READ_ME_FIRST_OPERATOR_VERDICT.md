# V3 FINAL REMADE — Upstream Branch Rescue Contract Kit

> ABSOLUTE RULE: Never commit, merge, rebase, reset, force-push, or push user work directly on `main` or `master`. `main/master` may only mirror upstream after verified backups exist. Any attempted push to `main/master` is a critical failure and must stop the run.


## Verdict
Use this remade V3, not the earlier V3. A V4 should not be needed unless the actual local repositories reveal unknown conditions such as missing Git history, broken remotes, private upstream URLs that cannot be accessed, or uncommitted files that cannot be classified.

This kit is markdown-only and is designed for Claude Code plus a 20-agent execution swarm. It is not a generic Git tutorial. It is a safety contract for recovering four polluted repos and keeping them synced with upstream:

1. Zero Claw
2. Hermes agents
3. Kilo Code
4. Open WebUI
5. DaveAI Hub integration surfaces inside Kilo Code and Open WebUI

## Why this remade V3 exists
The earlier V3 was too small for the risk level. It had the right direction but not enough operational depth. The missing pieces were:

- No complete repo-discovery protocol before touching code.
- No mandatory restore test before extraction.
- No branch-protection proof checklist.
- No precise feature-fingerprinting process.
- No multi-method extraction ladder for polluted `main/master`.
- No agent quorum rules.
- No evidence ledger format strict enough to audit later.
- No release assembly protocol for selected feature branches.
- No stop conditions for ambiguous or dangerous states.
- No cross-repo dependency handling for Kilo Code / Open WebUI / Hub features.

## Minimum success definition
The run is successful only when all of these are true:

- Every repo has a verified mirror backup, bundle backup, working-tree backup, and restore proof.
- Local `main/master` is either untouched or reset only after backup proof exists.
- User-created features currently on `main/master` have been inventoried and assigned to named feature branches.
- Each branch has a feature card, diff proof, build/test proof, and rollback notes.
- Upstream is fetched and tracked correctly.
- `main/master` is clean and synced to upstream or documented as blocked with proof.
- No user feature is lost.
- No secrets are committed.
- No agent claims “done” without command output evidence.

## Operator usage
Give Claude Code the file `01_MASTER_PROMPT_FOR_CLAUDE_CODE.md` first. Then attach or point it to this entire folder. Claude Code should read every markdown before running commands.

## Required local repo discovery
Claude must discover the real repo roots from the machine, but begin by checking known ecosystem paths:

- `G:\Github\contract-kit-v17`
- `G:\Github\kilocode-Azure2`
- `G:\Github\hermes-agent-2026.4.13\hermes-agent-2026.4.13`
- `C:\Users\Admin\Downloads\VPS`
- `C:\Users\Admin\Downloads\api`

Do not assume folder names equal repo names. Confirm each repo by running `git rev-parse --show-toplevel` and `git remote -v`.
