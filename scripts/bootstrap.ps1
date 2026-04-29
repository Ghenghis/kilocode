#requires -Version 5.1
<#
.SYNOPSIS
  One-shot KiloCode bootstrap — env vars + extension install.

.DESCRIPTION
  Two-step setup for a fresh Windows machine (or a fresh canary install):

  1. Run setup-windows-env.ps1 to securely set Windows User environment
     variables (provider keys, Hermes, Shiba, Discord, VPS, etc.). Input is
     never echoed; values go directly into the user-level registry env store.

  2. Find the latest packaged kilo-code-*-canary.*.vsix and install it via
     `code --install-extension --force`.

  Re-runnable. Skips the env step if -SkipEnv. Skips the install step if
  -SkipInstall.

.NOTES
  After running, restart any open VS Code windows so they pick up:
    - The new env vars (already-running processes keep their old snapshot)
    - The freshly installed extension
#>

[CmdletBinding()]
param(
  [string] $VsixPath,                # explicit VSIX path (otherwise auto-detect latest canary)
  [switch] $SkipEnv,                 # don't prompt for env vars
  [switch] $SkipInstall,             # don't install the VSIX
  [switch] $Force                    # pass -Force to setup-windows-env (overwrite without confirm)
)

$ErrorActionPreference = 'Stop'

# ─── Locate sibling scripts ────────────────────────────────────────────────
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$envScript = Join-Path $here 'setup-windows-env.ps1'
$repoRoot  = Split-Path -Parent $here

if (-not (Test-Path $envScript)) {
  throw "setup-windows-env.ps1 not found next to bootstrap.ps1 (expected at $envScript)"
}

# ─── Step 1: env vars ──────────────────────────────────────────────────────
if (-not $SkipEnv) {
  Write-Host ""
  Write-Host "[bootstrap] Step 1 of 2 — Environment variables" -ForegroundColor Cyan
  Write-Host ("─" * 64)

  $envArgs = @()
  if ($Force) { $envArgs += '-Force' }
  & $envScript @envArgs
} else {
  Write-Host "[bootstrap] Step 1 skipped (-SkipEnv)" -ForegroundColor DarkGray
}

# ─── Step 2: VSIX install ──────────────────────────────────────────────────
if (-not $SkipInstall) {
  Write-Host ""
  Write-Host "[bootstrap] Step 2 of 2 — VS Code extension" -ForegroundColor Cyan
  Write-Host ("─" * 64)

  # Check VS Code CLI
  $codeCmd = Get-Command code -ErrorAction SilentlyContinue
  if (-not $codeCmd) {
    throw "VS Code CLI 'code' not found in PATH. Install VS Code (https://code.visualstudio.com/) and re-run."
  }

  # Resolve VSIX path
  if (-not $VsixPath) {
    $vsixDir = Join-Path $repoRoot 'packages\kilo-vscode'
    if (-not (Test-Path $vsixDir)) {
      throw "Default VSIX search dir not found: $vsixDir. Pass -VsixPath explicitly."
    }
    $candidates = Get-ChildItem -Path $vsixDir -Filter 'kilo-code-*.vsix' -ErrorAction SilentlyContinue |
                  Sort-Object -Property LastWriteTime -Descending
    if (-not $candidates) {
      throw "No kilo-code-*.vsix found in $vsixDir. Pass -VsixPath explicitly or build first (`bun run package`)."
    }
    $VsixPath = $candidates[0].FullName
    Write-Host "  Auto-detected VSIX: $VsixPath" -ForegroundColor DarkGray
  }

  if (-not (Test-Path $VsixPath)) {
    throw "VSIX not found: $VsixPath"
  }

  # Show what's already installed
  $current = & code --list-extensions --show-versions 2>$null | Where-Object { $_ -match '^kilocode\.kilo-code@' }
  if ($current) {
    Write-Host "  Currently installed: $current" -ForegroundColor DarkGray
  }

  # Install (with --force so it overwrites any prior version cleanly)
  Write-Host ""
  Write-Host "  Installing $(Split-Path -Leaf $VsixPath)…" -ForegroundColor Cyan
  & code --install-extension $VsixPath --force
  if ($LASTEXITCODE -ne 0) {
    throw "VS Code extension install failed (exit code $LASTEXITCODE)"
  }

  $installed = & code --list-extensions --show-versions 2>$null | Where-Object { $_ -match '^kilocode\.kilo-code@' }
  Write-Host ""
  Write-Host "  Installed: $installed" -ForegroundColor Green
} else {
  Write-Host "[bootstrap] Step 2 skipped (-SkipInstall)" -ForegroundColor DarkGray
}

# ─── Final summary ─────────────────────────────────────────────────────────
Write-Host ""
Write-Host ("─" * 64)
Write-Host "[bootstrap] Done." -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "  1. Close all VS Code windows (taskbar → right-click → Close all)"
Write-Host "     so child processes inherit the new env + extension."
Write-Host "  2. Reopen VS Code. Open the KiloCode panel and verify:"
Write-Host "     - Settings filter shows '(28 tabs available)'"
Write-Host "     - Hermes tab shows the agent dropdown (kc-main + 20 specialists)"
Write-Host "     - No 'Skip to settings' button anywhere"
Write-Host "  3. Verify env vars are visible: pwsh scripts\setup-windows-env.ps1 -List"
Write-Host ""
