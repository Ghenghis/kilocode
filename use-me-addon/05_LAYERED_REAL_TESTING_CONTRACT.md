# Layered Real Testing Contract

## Layer 0 — Static truth
Goal:
- every Python file parses
- no marker-based contradictions remain in handoff docs
- required configs exist

## Layer 1 — Unit + local integration
Run:
- `pytest tests/`
- provider router tests
- packet schema validation
- runtime API tests
- WebUI route tests
- VSIX sync tests

## Layer 2 — Repo-grounded integration
Run against actual working trees:
- `G:\Github\kilocode-Azure2`
- `G:\Github\hermes-agent-2026.4.13\hermes-agent-2026.4.13`
- `C:\Users\Admin\Downloads\VPS`

Checks:
- patched files exist
- services/configs are written
- expected imports/build steps succeed

## Layer 3 — Live VPS integration
Run against:
- Open WebUI
- LiteLLM
- Hermes containers
- runtime core
- NATS
- safemode server

Checks:
- services healthy
- ports reachable
- packet flow works
- settings sync works
- provider lane visible

## Layer 4 — Playwright proof
Run real browser tests for:
- control center
- settings questions
- provider panel
- evidence panel
- repair timeline
- safemode / unlock

## Layer 5 — Repair and restart drills
Run:
- provider failure drill
- runtime failure drill
- Hermes bridge failure drill
- restart / reboot / refresh enforcement drill
