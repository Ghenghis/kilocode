# KiloCode Settings Visual Proof

Generated: 2026-04-28T21:16:23.948Z

Total tabs: **26** — pass: **25** — fail: **1**

## Methodology

- Storybook dev server is spawned on port 6007.
- Playwright (chromium) loads `?id=settings--settings-panel`.
- For each tab the `[data-slot='tabs-trigger'][data-value=…]` element is clicked.
- After the panel mounts, a 1024×768 viewport screenshot is captured.
- A tab is marked **pass** when no console errors fire while it renders, **fail** otherwise.

## Trade-off

The brief listed `@vscode/test-electron` as the preferred runner with an explicit fallback to
Playwright if that path was too complex. The Electron path was rejected:
VS Code webviews live inside a sandboxed iframe whose contents are not reachable from the
public extension API, and the unofficial Electron-driver workaround is brittle across VS Code
versions. Storybook renders the exact same Solid.js components, so pixel output is identical.

## Results

| # | Tab | Status | Screenshot |
| -: | --- | --- | --- |
| 1 | Models (`models`) | PASS | [`models.png`](./models.png) |
| 2 | Providers (`providers`) | PASS | [`providers.png`](./providers.png) |
| 3 | Agent Behaviour (`agentBehaviour`) | PASS | [`agentBehaviour.png`](./agentBehaviour.png) |
| 4 | Auto-approve (`autoApprove`) | PASS | [`autoApprove.png`](./autoApprove.png) |
| 5 | Browser (`browser`) | PASS | [`browser.png`](./browser.png) |
| 6 | Checkpoints (`checkpoints`) | PASS | [`checkpoints.png`](./checkpoints.png) |
| 7 | Display (`display`) | PASS | [`display.png`](./display.png) |
| 8 | Autocomplete (`autocomplete`) | PASS | [`autocomplete.png`](./autocomplete.png) |
| 9 | Notifications (`notifications`) | PASS | [`notifications.png`](./notifications.png) |
| 10 | Context (`context`) | PASS | [`context.png`](./context.png) |
| 11 | SSH & Remote (`ssh`) | PASS | [`ssh.png`](./ssh.png) |
| 12 | VPS & Infra (`vps`) | PASS | [`vps.png`](./vps.png) |
| 13 | Hermes (`hermes`) | PASS | [`hermes.png`](./hermes.png) |
| 14 | ZeroClaw (`zeroclaw`) | PASS | [`zeroclaw.png`](./zeroclaw.png) |
| 15 | Provider Routing (`routing`) | PASS | [`routing.png`](./routing.png) |
| 16 | Memory (Shiba) (`memory`) | PASS | [`memory.png`](./memory.png) |
| 17 | Training & GPU (`training`) | PASS | [`training.png`](./training.png) |
| 18 | Governance (`governance`) | PASS | [`governance.png`](./governance.png) |
| 19 | Hub (`hub`) | PASS | [`hub.png`](./hub.png) |
| 20 | OpenClaw (`openclaw`) | PASS | [`openclaw.png`](./openclaw.png) |
| 21 | Agent Backends (`agentBackends`) | FAIL | [`agentBackends.png`](./agentBackends.png) |
| 22 | Speech (`speech`) | PASS | [`speech.png`](./speech.png) |
| 23 | Commit Message (`commitMessage`) | PASS | [`commitMessage.png`](./commitMessage.png) |
| 24 | Experimental (`experimental`) | PASS | [`experimental.png`](./experimental.png) |
| 25 | Language (`language`) | PASS | [`language.png`](./language.png) |
| 26 | About KiloCode (`aboutKiloCode`) | PASS | [`aboutKiloCode.png`](./aboutKiloCode.png) |

## Embedded screenshots

### Models (`models`) — PASS

![Models](./models.png)

### Providers (`providers`) — PASS

![Providers](./providers.png)

### Agent Behaviour (`agentBehaviour`) — PASS

![Agent Behaviour](./agentBehaviour.png)

### Auto-approve (`autoApprove`) — PASS

![Auto-approve](./autoApprove.png)

### Browser (`browser`) — PASS

![Browser](./browser.png)

### Checkpoints (`checkpoints`) — PASS

![Checkpoints](./checkpoints.png)

### Display (`display`) — PASS

![Display](./display.png)

### Autocomplete (`autocomplete`) — PASS

![Autocomplete](./autocomplete.png)

### Notifications (`notifications`) — PASS

![Notifications](./notifications.png)

### Context (`context`) — PASS

![Context](./context.png)

### SSH & Remote (`ssh`) — PASS

![SSH & Remote](./ssh.png)

### VPS & Infra (`vps`) — PASS

![VPS & Infra](./vps.png)

### Hermes (`hermes`) — PASS

![Hermes](./hermes.png)

### ZeroClaw (`zeroclaw`) — PASS

![ZeroClaw](./zeroclaw.png)

### Provider Routing (`routing`) — PASS

![Provider Routing](./routing.png)

### Memory (Shiba) (`memory`) — PASS

![Memory (Shiba)](./memory.png)

### Training & GPU (`training`) — PASS

![Training & GPU](./training.png)

### Governance (`governance`) — PASS

![Governance](./governance.png)

### Hub (`hub`) — PASS

![Hub](./hub.png)

### OpenClaw (`openclaw`) — PASS

![OpenClaw](./openclaw.png)

### Agent Backends (`agentBackends`) — FAIL

![Agent Backends](./agentBackends.png)

Errors:

```
Error rendering story 'settings--settings-panel':
Error: useBackend must be used inside <BackendProvider>
    at useBackend (http://localhost:6007/webview-ui/src/context/backend-context.tsx:163:11)
    at _$$component.location (http://localhost:6007/webview-ui/src/components/settings/AgentBackendsTab.tsx:243:19)
    at http://localhost:6007/@solid-refresh:25:42
    at untrack (http://localhost:6007/node_modules/.cache/storybook/10.2.10/1b49295c9d7e1b8fbf4004f364ce926a534d3da9a1ff61ecd788909efed6a41f/sb-vite/deps/chunk-5FMQ4FK2.js?v=2c32e8a0:459:12)
    at HMRComp.createMemo.name [as fn] (http://localhost:6007/@solid-refresh:25:28)
    at runComputation (http://localhost:6007/node_modules/.cache/storybook/10.2.10/1b49295c9d7e1b8fbf4004f364ce926a534d3da9a1ff61ecd788909efed6a41f/sb-vite/deps/chunk-5FMQ4FK2.js?v=2c32e8a0:731:22)
    at updateComputation (http://localhost:6007/node_modules/.cache/storybook/10.2.10/1b49295c9d7e1b8fbf4004f364ce926a534d3da9a1ff61ecd788909efed6a41f/sb-vite/deps/chunk-5FMQ4FK2.js?v=2c32e8a0:714:3)
    at Object.readSignal (http://localhost:6007/node_modules/.cache/storybook/10.2.10/1b49295c9d7e1b8fbf4004f364ce926a534d3da9a1ff61ecd788909efed6a41f/sb-vite/deps/chunk-5FMQ4FK2.js?v=2c32e8a0:647:67)
    at normalizeIncomingArray (http://localhost:6007/node_modules/.cache/storybook/10.2.10/1b49295c9d7e1b8fbf4004f364ce926a534d3da9a1ff61ecd788909efed6a41f/sb-vite/deps/chunk-WYAV3TJ7.js?v=2c32e8a0:1040:51)
    at insertExpression (http://localhost:6007/node_modules/.cache/storybook/10.2.10/1b49295c9d7e1b8fbf4004f364ce926a534d3da9a1ff61ecd788909efed6a41f/sb-vite/deps/chunk-WYAV3TJ7.js?v=2c32e8a0:992:9)
```

### Speech (`speech`) — PASS

![Speech](./speech.png)

### Commit Message (`commitMessage`) — PASS

![Commit Message](./commitMessage.png)

### Experimental (`experimental`) — PASS

![Experimental](./experimental.png)

### Language (`language`) — PASS

![Language](./language.png)

### About KiloCode (`aboutKiloCode`) — PASS

![About KiloCode](./aboutKiloCode.png)
