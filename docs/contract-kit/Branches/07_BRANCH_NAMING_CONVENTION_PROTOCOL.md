# Branch Naming Convention Protocol

> **SUPERSEDED on prefix shape by `29_NAMING_CONVENTION_CANONICAL.md`.** This doc is retained for V3 history. Where this doc says `feature/`, use `feat/`. Where this doc lists generic prefixes only, also use the canonical scope-token table in doc 29. The forbidden-names section below remains in force.



> ABSOLUTE RULE: Never commit, merge, rebase, reset, force-push, or push user work directly on `main` or `master`. `main/master` may only mirror upstream after verified backups exist. Any attempted push to `main/master` is a critical failure and must stop the run.


Do not use generic branch names. Discover each repo's existing style first.

## Discovery commands
```bash
git branch -a --format='%(refname:short)' | sort | sed -n '1,200p'
git log --all --decorate --oneline -n 200
```

## Naming decision ladder
1. If repo already uses prefixes like `feat/`, `fix/`, `chore/`, match that.
2. If repo uses issue numbers, include issue number only if a real issue exists.
3. If repo uses slash-separated scope names, match scope directory or subsystem.
4. If no convention exists, use the **canonical short-prefix form** (see doc 29):
   - `feat/<scope>-<specific-purpose>`
   - `fix/<scope>-<specific-bug>`
   - `chore/<scope>-<specific-maintenance>`
   - `docs/<scope>-<specific-doc>`
   - `integration/<scope>-<specific-integration>`

## DaveAI ecosystem examples (canonical, see doc 29 for full scope-token table)

- `feat/daveai-hub-ui-kilo-integration`
- `feat/owui-hub-bridge-protocol-v2`
- `feat/daveai-routing-lmstudio-ollama-minimax`
- `feat/hermes-orch-control-plane`
- `feat/daveai-zeroclaw-transport-sandbox-bridge` (in-tree on Kilo) OR `feat/zeroclaw-rust-transport-sandbox-bridge` (on canonical Rust repo)
- `fix/branches-upstream-sync-protection`
- `docs/branches-rescue-evidence-ledger`

## Bad names
Reject these:

- `fix-stuff`
- `update`
- `changes`
- `dave-work`
- `final`
- `new-version`
- `backup`
- `main-copy`
- `my-changes`
