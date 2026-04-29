# Acceptance Gates

## Gate A — Contradiction cleanup
Pass only if no source-of-truth docs conflict on completion state.

## Gate B — Source merge
Pass only if the required patch targets exist in the unified repo and/or actual working trees.

## Gate C — WebUI
Pass only if all control-center routes and panels are wired and proven.

## Gate D — VSIX
Pass only if sync, autofill, task/completion flow, provider state, and mode state are proven.

## Gate E — Hermes / ZeroClaw / Runtime
Pass only if the packet lifecycle is proven.

## Gate F — Boot / Repair / Restart
Pass only if fail/pass enforcement and unlock discipline are proven.

## Gate G — Full E2E
Pass only if the settings + workflow + repair + restart lifecycle passes end to end.
