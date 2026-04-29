# Cross-Repo Hub and Ecosystem Protocol

> ABSOLUTE RULE: Never commit, merge, rebase, reset, force-push, or push user work directly on `main` or `master`. `main/master` may only mirror upstream after verified backups exist. Any attempted push to `main/master` is a critical failure and must stop the run.


The Hub is no longer treated as an independent launcher if it has been merged into Kilo Code and Open WebUI. Its code must be tracked as integration surfaces inside those repos.

## Required Hub investigation
In Kilo Code and Open WebUI, search for Hub-related surfaces:

```bash
git grep -n -I -E "DaveAI|hub|control center|Hermes|ZeroClaw|Zero Claw|Open WebUI|Kilo|provider routing|LM Studio|Ollama|MiniMax" -- .
```

Record files found and classify:

- UI route/page/component
- provider settings
- API bridge
- documentation
- asset/theme
- automation/workflow
- config/env

## Cross-repo feature matrix
Create:

| Feature | Kilo branch | Open WebUI branch | Hermes branch | Zero Claw branch | Required together? | Validation path |
|---|---|---|---|---|---|---|

## Dependency rule
If one feature requires another repo branch, do not hide that dependency. Mark it clearly in the feature card.

Example:

- Kilo UI provider selector may depend on Hermes provider registry.
- Open WebUI Hub panel may depend on Zero Claw transport endpoints.
- Hub integration may depend on local API config under `C:\Users\Admin\Downloads\api`.

## Release rule
Cross-repo features are not “done” until the release branch assembly plan includes all dependent branches or explicitly marks them optional.
