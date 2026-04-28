# KiloCode Release Checklist

**Package:** `kilo-vscode`  
**Working dir:** `packages/kilo-vscode`

Run this checklist in order before tagging a release. Each item must be marked PASS before proceeding.

---

## Pre-Build Checklist

### 1. TypeScript Clean

```bash
cd packages/kilo-vscode
npx tsc --noEmit 2>&1 | grep -c "error TS"
# Must output: 0
```

- [ ] Zero TypeScript errors (`npx tsc --noEmit` exits with no `error TS` lines)
- [ ] No `@ts-ignore` or `@ts-expect-error` added without a comment explaining why
- [ ] All new files have explicit return types on exported functions

### 2. No `console.error` in Components

Unhandled `console.error` calls in component code produce red output in the webview DevTools and signal unhandled error states.

```bash
# Check webview-ui components only — extension host code is excluded
grep -r "console\.error" packages/kilo-vscode/webview-ui/src/components --include="*.tsx" -l
# Expected: no output (empty)
```

- [ ] No bare `console.error(...)` in any `.tsx` component file
- [ ] Any `console.error` in utility/service files is wrapped in a `try/catch` with a user-visible error state
- [ ] Error boundaries (`ErrorBoundary.tsx`) are present around all lazy-loaded tab `<Suspense>` wrappers

### 3. No `.map()` on Signals

Calling `.map()` directly on a SolidJS signal (e.g., `mySignal().map(...)` inside JSX) will not be reactive. Use `<For>` or `createMemo`.

```bash
# Pattern to catch: signal call immediately followed by .map(
grep -rn "\(\)\.map(" packages/kilo-vscode/webview-ui/src/components --include="*.tsx"
# Review each hit — most are fine (array.map), look only for signal().map()
```

- [ ] No `someSignal().map(fn)` patterns inside JSX return values
- [ ] All list rendering uses `<For each={someSignal()}>` or a `createMemo` intermediate
- [ ] All `createEffect` / `createMemo` dependencies are accessed inside the reactive scope (not captured in outer closures)

### 4. Additional Code Quality

- [ ] No `any` type escapes added without a `// kilocode_change:` comment
- [ ] No `import *` from large modules in hot-path components
- [ ] Lazy imports (`lazy(() => import(...))`) used for all settings tabs
- [ ] No circular imports (check with `npx madge --circular src/` if available)

---

## Build Checklist

### 5. esbuild Success

```bash
cd packages/kilo-vscode
node esbuild.js 2>&1
# Expected: "[watch] build finished" for each bundle, no "ERROR" lines
```

- [ ] All 6 `[watch] build finished` lines appear
- [ ] No `ERROR` lines in esbuild output
- [ ] No `Could not resolve` module errors
- [ ] No `Transform failed` errors

### 6. VSIX Package

```bash
cd packages/kilo-vscode
npx vsce package --no-dependencies 2>&1 | tail -5
ls -lh *.vsix | tail -1
```

- [ ] VSIX created successfully (exit code 0)
- [ ] VSIX size is between **2 MB and 25 MB** (outside this range requires investigation)
- [ ] VSIX file is named `kilocode-maos-<version>.vsix`

### 7. File Count

```bash
npx vsce ls 2>&1 | wc -l
```

- [ ] File count is within ±10% of the previous release's file count
- [ ] No `.env`, `.env.production`, or `*.key` files included in the VSIX (check `npx vsce ls | grep -E "\.env|\.key"`)
- [ ] No `node_modules` folder included accidentally

---

## Post-Install Checklist

Install the VSIX in a clean VS Code profile (`code --profile kilocode-test --install-extension kilocode-maos-<version>.vsix`).

### 8. All Custom Tabs Render

Open KiloCode Settings (`Ctrl+Shift+P` → "KiloCode: Open Settings"). Check each tab below.

| Tab | Expected First Render | PASS |
|-----|-----------------------|------|
| Provider Routing | Health dashboard section visible | |
| Training & GPU | Dataset list section visible | |
| Commit Message | Enable toggle and preset selector visible | |
| Memory (Shiba) | Connection status badge visible | |
| SSH & Remote | Profile list (or empty state) visible | |
| VPS & Infra | Server list (or empty state) visible | |
| Hermes | Enable toggle and Bridge URL field visible | |
| OpenClaw | Status card with gatewayUrl visible | |
| ZeroClaw | Task list (or empty state) visible | |
| Hub | URL field and "Refresh Now" button visible | |
| Governance | Authority tiers section visible | |

### 9. No Error Boundaries Triggered

- [ ] None of the 11 custom tabs show an "Error" / "Something went wrong" boundary on first load
- [ ] Browser DevTools console (webview) shows zero `Uncaught` errors after visiting all tabs
- [ ] No `[object Object]` or `undefined` rendered as visible text in any tab

### 10. Key Features Visible

- [ ] **Hub tab:** "Refresh Now" button large and clickable; URL preset dropdown has 5 options
- [ ] **Commit Message tab:** Live preview updates when preset is changed
- [ ] **ZeroClaw tab:** Network policy dropdown shows 3 options (deny/allowlist/open)
- [ ] **Hermes tab:** Health "Ping" button triggers a status change
- [ ] **Routing tab:** Provider list shows at least column headers even when no providers configured
- [ ] **Memory tab:** "Run Diagnostics" button present
- [ ] **Training tab:** Preset selector shows lora/qlora/custom
- [ ] **SSH tab:** "Add Profile" button present
- [ ] **VPS tab:** Deploy history section present
- [ ] **OpenClaw tab:** Channel list shows type badges
- [ ] **Governance tab:** Constitutional rules section visible

### 11. Sidebar Navigation

- [ ] All 4 sidebar group headers visible: **AI Models**, **Workflow**, **Integrations**, **System**
- [ ] `Ctrl+K` / `Cmd+K` opens the settings command palette
- [ ] Navigating between tabs does not cause a full-page blank flash (keep-alive working)
- [ ] Dirty state indicator appears when any field is modified

---

## Sign-Off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Build engineer | | | |
| QA lead | | | |
| Release owner | | | |

---

*Template version: 2026-04-28*  
*See `docs/E2E_TEST_MATRIX.md` for full per-tab test cases.*
