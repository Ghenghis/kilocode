# What Was Missing and How Remade V3 Fixes It

> ABSOLUTE RULE: Never commit, merge, rebase, reset, force-push, or push user work directly on `main` or `master`. `main/master` may only mirror upstream after verified backups exist. Any attempted push to `main/master` is a critical failure and must stop the run.


## Missing in earlier kits

| Gap | Why it matters | V3 fix |
|---|---|---|
| Backup said but not proven | Fake backups fail during disaster | Mirror + bundle + working archive + restore test |
| Main/master rule was instruction only | Agents can still push by mistake | Local hook + GitHub protection checklist + hard stop |
| Feature branches were vague | Mixed branches become impossible to maintain | Feature cards + fingerprint matrix + extraction ladder |
| No upstream truth protocol | Wrong upstream can destroy sync | Remote discovery + divergence proof + blocker rules |
| No dirty tree handling | Untracked files can be lost | Archive and inventory before mutation |
| No cross-repo map | Hub/Kilo/WebUI/Hermes/ZeroClaw dependencies get lost | Cross-repo matrix and dependency declarations |
| No adversarial approval | One agent can self-certify bad work | Owner/Verifier/Challenger quorum |
| No release assembly | User might merge back to main | Release branch protocol only |
| No baseline failure logic | Old upstream failures can be blamed on new branch | Baseline-vs-branch validation rule |
| No disaster path | Mistakes become panic | Rollback playbook |

## Why this should avoid a V4
This V3 is structured around failure modes, not just happy-path Git commands. It includes prevention, proof, extraction, validation, release assembly, and recovery. A V4 should only be needed if real repo inspection reveals new facts that cannot be known from outside the machine.
