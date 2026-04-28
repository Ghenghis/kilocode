# KiloCode canary.7 — Definitive Clean-Install Guide
# Root cause: stale Chromium Service-Worker cache in VS Code's Electron shell

> Confirmed by AGENT1–AGENT10 synthesis (AGENT10_MASTER_SYNTHESIS.md).
> The "Could not register service worker: InvalidStateError" error is **always** caused by a
> stale SW registration left in VS Code's embedded Chromium profile from a previous extension
> version.  Uninstalling the extension alone does NOT clear the SW cache.

---

## Quick-reference: what must be wiped

| Cache folder (under `%APPDATA%\Code\`) | Why |
|---|---|
| `Cache\`                | HTTP response cache — may serve old JS bundles |
| `CachedData\`           | V8 bytecode cache |
| `CachedExtensions\`     | Packed extension blobs |
| `CachedExtensionVSIXs\` | Downloaded VSIX cache |
| `Database\`             | LevelDB / SQLite — stores SW state |
| `GPUCache\`             | GPU shader cache (rarely relevant, safe to clear) |
| `IndexedDB\`            | **Primary SW registration storage** |
| `ScriptCache\`          | Cached compiled scripts |
| `blob_storage\`         | Binary blobs referenced by IndexedDB |
| `Service Worker\`       | Direct SW install/activate records |

> **Insider / Custom builds**: replace `%APPDATA%\Code` with
> `%APPDATA%\Code - Insiders`, `%APPDATA%\Code - OSS`, or the profile folder for
> your specific build.

---

## One-click PowerShell clean-install script

Save the block below as `clean-install-canary7.ps1`, set `$vsixPath` to the
actual path of the built VSIX, then run it **from an elevated (Administrator)
PowerShell prompt** after closing VS Code.

```powershell
#Requires -Version 5.1
# clean-install-canary7.ps1
# KiloCode canary.7 — Service-Worker cache purge + fresh install
# Run as Administrator after closing VS Code.

param(
    [string]$VsixPath = "G:\Github\kilocode-Azure2\packages\kilo-vscode\kilocode-maos-7.2.21-canary.7.vsix",
    [string]$CodeProfile = "$env:APPDATA\Code"   # change for Insiders: "$env:APPDATA\Code - Insiders"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# ── 1. Confirm VS Code is closed ────────────────────────────────────────────
Write-Host "`n[1/6] Checking for running VS Code processes..." -ForegroundColor Cyan
$vscProcs = Get-Process -Name "Code", "code", "Code - Insiders" -ErrorAction SilentlyContinue
if ($vscProcs) {
    Write-Host "      Found $($vscProcs.Count) VS Code process(es). Closing them now..." -ForegroundColor Yellow
    $vscProcs | Stop-Process -Force
    Start-Sleep -Seconds 3
    $remaining = Get-Process -Name "Code", "code", "Code - Insiders" -ErrorAction SilentlyContinue
    if ($remaining) {
        Write-Error "Could not terminate all VS Code processes. Please close VS Code manually and re-run."
        exit 1
    }
    Write-Host "      All VS Code processes stopped." -ForegroundColor Green
} else {
    Write-Host "      VS Code is not running. Good." -ForegroundColor Green
}

# ── 2. Validate VSIX path ────────────────────────────────────────────────────
Write-Host "`n[2/6] Validating VSIX path..." -ForegroundColor Cyan
if (-not (Test-Path $VsixPath)) {
    Write-Error "VSIX not found at: $VsixPath`nBuild it first with the instructions in this document."
    exit 1
}
$vsixSize = (Get-Item $VsixPath).Length
Write-Host "      Found: $VsixPath ($([math]::Round($vsixSize/1MB,1)) MB)" -ForegroundColor Green

# ── 3. Uninstall ALL KiloCode extension versions ────────────────────────────
Write-Host "`n[3/6] Removing all KiloCode extension folders from ~/.vscode/extensions/ ..." -ForegroundColor Cyan
$extRoot = "$env:USERPROFILE\.vscode\extensions"
$kiloFolders = Get-ChildItem $extRoot -Directory |
               Where-Object { $_.Name -match "^kilocode\.|^kilo-code\." }
if ($kiloFolders) {
    foreach ($f in $kiloFolders) {
        Write-Host "      Removing: $($f.FullName)"
        Remove-Item $f.FullName -Recurse -Force
    }
    Write-Host "      Removed $($kiloFolders.Count) folder(s)." -ForegroundColor Green
} else {
    Write-Host "      No KiloCode extension folders found (clean slate)." -ForegroundColor Green
}

# Also remove from the extensions.json gallery cache if present
$extJson = "$extRoot\.obsolete"
if (Test-Path $extJson) { Remove-Item $extJson -Force -ErrorAction SilentlyContinue }

# ── 4. Clear all VS Code Chromium caches ────────────────────────────────────
Write-Host "`n[4/6] Clearing VS Code Chromium / Service-Worker caches in: $CodeProfile" -ForegroundColor Cyan

$cacheDirs = @(
    "Cache",
    "CachedData",
    "CachedExtensions",
    "CachedExtensionVSIXs",
    "Database",
    "GPUCache",
    "IndexedDB",
    "ScriptCache",
    "blob_storage",
    "Service Worker"
)

$cleared = 0
foreach ($dir in $cacheDirs) {
    $fullPath = Join-Path $CodeProfile $dir
    if (Test-Path $fullPath) {
        $sizeBefore = (Get-ChildItem $fullPath -Recurse -File -ErrorAction SilentlyContinue |
                       Measure-Object Length -Sum).Sum
        Remove-Item $fullPath -Recurse -Force -ErrorAction SilentlyContinue
        Write-Host ("      Cleared: {0,-35} ({1} KB)" -f $dir, [math]::Round($sizeBefore/1KB, 0))
        $cleared++
    } else {
        Write-Host ("      Skipped (not found): {0}" -f $dir) -ForegroundColor DarkGray
    }
}
Write-Host "      Cleared $cleared cache director(ies)." -ForegroundColor Green

# ── 5. Install canary.7 VSIX ─────────────────────────────────────────────────
Write-Host "`n[5/6] Installing canary.7 VSIX..." -ForegroundColor Cyan
$codeExe = (Get-Command "code" -ErrorAction SilentlyContinue)?.Source
if (-not $codeExe) {
    # Common fallback paths
    $candidates = @(
        "$env:LOCALAPPDATA\Programs\Microsoft VS Code\bin\code.cmd",
        "C:\Program Files\Microsoft VS Code\bin\code.cmd",
        "$env:ProgramFiles\Microsoft VS Code\bin\code.cmd"
    )
    $codeExe = $candidates | Where-Object { Test-Path $_ } | Select-Object -First 1
}
if (-not $codeExe) {
    Write-Error "Cannot find 'code' executable. Add VS Code to PATH and re-run."
    exit 1
}
Write-Host "      Using: $codeExe"
& $codeExe --install-extension $VsixPath --force
if ($LASTEXITCODE -ne 0) {
    Write-Error "'code --install-extension' exited with code $LASTEXITCODE"
    exit 1
}
Write-Host "      canary.7 installed successfully." -ForegroundColor Green

# ── 6. Launch VS Code and print verification steps ──────────────────────────
Write-Host "`n[6/6] Launching VS Code..." -ForegroundColor Cyan
Start-Process $codeExe
Write-Host "      VS Code launched." -ForegroundColor Green

Write-Host @"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  VERIFICATION STEPS (manual, inside VS Code)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. Open Developer Tools:  Help > Toggle Developer Tools  (or Ctrl+Shift+I)
2. Go to the Console tab.
3. Filter by "service worker" — you should see:
      ✓  "Service worker registered successfully"
   and NOT see:
      ✗  "Could not register service worker: InvalidStateError"

4. Go to Application > Service Workers in DevTools.
   Confirm the KiloCode scope shows Status: activated and is running.

5. Open the KiloCode sidebar panel.
   Confirm the Hub tab loads without a blank/error screen.

6. (Optional) Take a screenshot of DevTools > Application > Service Workers
   and attach to the bug report to close it.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
"@ -ForegroundColor Cyan

Write-Host "`nDone. canary.7 clean install complete." -ForegroundColor Green
```

---

## How to build canary.7 first (if you need to rebuild)

Run from an elevated terminal:

```powershell
cd G:\Github\kilocode-Azure2\packages\kilo-vscode

# Ensure version is set to 7.2.21-canary.7 in package.json (already done by AGENTH)
node esbuild.js --production
npx @vscode/vsce package --no-dependencies --out kilocode-maos-7.2.21-canary.7.vsix
```

Expected output size: ~76 MB (consistent with canary.1–canary.6 range).

---

## What changed since canary.6

| File | Last modified | Notes |
|---|---|---|
| `src/KiloProvider.ts` | 2026-04-27 19:47 | Modified by agent after canary.6 was packaged |
| `webview-ui/src/components/settings/HubTab.tsx` | 2026-04-27 19:48 | Modified by agent after canary.6 |
| `src/webview-html-utils.ts` | 2026-04-27 17:46 | Modified earlier today |
| `src/services/routing/Router*.ts` | 2026-04-27 10:38 | Routing service changes |
| `src/services/auto-update*.ts` | 2026-04-27 10:28 | Auto-update changes |
| `package.json` | bumped by AGENTH | `7.2.21-canary.6` → `7.2.21-canary.7` |
| `src/utils.ts` | 2026-04-18 | No change since before canary series |

> `KiloProvider.ts` and `HubTab.tsx` were both modified by other agents today
> **after** canary.6 was packaged — rebuild is required.

---

## Troubleshooting

**"InvalidStateError" still appears after clean install**
- Confirm VS Code was fully closed (check Task Manager for `Code.exe` processes)
before running the script.
- Some antivirus products lock `IndexedDB` while VS Code is running — try disabling
real-time protection temporarily during the cache clear.
- On Windows, the profile path for the **system** account differs from the **user**
account. If VS Code is launched as a different user, adjust `$CodeProfile`.

**Extension does not appear after install**
- Run `code --list-extensions | findstr kilo` to confirm it registered.
- If missing, try: `code --install-extension <path>.vsix` again from an
admin terminal.

**Hub tab still blank**
- Open DevTools > Application > Storage > Clear site data (for the extension origin).
- Reload the webview panel via Command Palette: "Developer: Reload Window".
