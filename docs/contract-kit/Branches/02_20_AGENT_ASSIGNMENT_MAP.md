# 20-Agent Assignment Map

> ABSOLUTE RULE: Never commit, merge, rebase, reset, force-push, or push user work directly on `main` or `master`. `main/master` may only mirror upstream after verified backups exist. Any attempted push to `main/master` is a critical failure and must stop the run.


## Swarm model
Use 20 agents as specialized reviewers. No single agent may both create and approve a branch. Every feature branch requires at least three independent roles:

- Owner: performs extraction.
- Verifier: checks proof and build/test status.
- Challenger: tries to prove the branch is wrong, incomplete, unsafe, or too broad.

## Agent roster

| Agent | Role | Primary responsibility | Cannot approve |
|---|---|---|---|
| A01 | Run Captain | Owns timeline, stop conditions, final verdict | Own extraction work |
| A02 | Git Safety Officer | Blocks main/master writes, checks hooks/protection | Unsafe bypasses |
| A03 | Backup Officer | Mirror, bundle, zip, restore proof | Repos without restore proof |
| A04 | Repo Cartographer | Finds repo roots, remotes, default branches | Guessed repo locations |
| A05 | Upstream Analyst | Identifies upstream, fork divergence, default branch | Sync without fetched proof |
| A06 | Feature Fingerprinter | Groups changed files into feature cards | Unmapped changes |
| A07 | Commit Historian | Reviews log, reflog, branches, tags | Rewrite without backup |
| A08 | Patch Extraction Owner | Creates patch/cherry-pick branches | Own branches |
| A09 | Dependency Mapper | Finds cross-repo dependencies | Isolated branches with hidden deps |
| A10 | Kilo Code Specialist | Kilo-specific branch naming/build proof | Generic Kilo branches |
| A11 | Open WebUI Specialist | Open WebUI-specific branch naming/build proof | Generic WebUI branches |
| A12 | Hermes Specialist | Hermes-specific branch naming/build proof | Generic Hermes branches |
| A13 | Zero Claw Specialist | Zero Claw-specific branch naming/build proof | Generic Zero Claw branches |
| A14 | Hub Integration Specialist | Tracks Hub surfaces inside Kilo/WebUI | Lost hub files |
| A15 | Security Scanner | Secrets, tokens, private paths, env leakage | Unscanned branches |
| A16 | Build/Test Runner | Executes install/build/test checks | Untested branches |
| A17 | Conflict Analyst | Classifies upstream conflicts | Blind conflict resolution |
| A18 | Release Planner | Prepares release branch assembly plan | Direct main merge |
| A19 | Documentation Auditor | Ensures ledgers are complete | Missing proof |
| A20 | Red Team Reviewer | Attempts to find fatal flaws | Self-approved claims |

## Quorum rules
A feature branch is accepted only when:

- Owner says branch contains the intended change.
- Verifier confirms diff scope and tests.
- Challenger fails to find a blocking defect.
- Security Scanner confirms no secrets.
- Git Safety Officer confirms no `main/master` mutation.

If any one of these fails, the branch status is BLOCKED.
