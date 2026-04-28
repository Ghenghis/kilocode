<#
.SYNOPSIS
  Checks for upstream updates for projects that can safely auto-update.
  Run this script to see what's available to pull without merge conflicts.

  SAFE TO AUTO-UPDATE (unmodified from upstream):
    - OpenClaw: https://github.com/Ghenghis/openclaw
      (fork of openclaw/openclaw — no local modifications detected)

  SKIP (custom forks / heavily modified):
    - kilocode-Azure2: Our main fork, custom MAOS additions
    - Hermes: Custom implementation
    - WebUI: Modified fork

.NOTES
  OpenClaw is published as an npm global package: npm install -g openclaw@latest
  It also ships a built-in update command: openclaw update --channel stable|beta|dev
  The GitHub repo (Ghenghis/openclaw) is a fork of openclaw/openclaw.
  No formal GitHub Releases exist on the Ghenghis fork; use npm or the built-in
  update command to track the actual openclaw/openclaw upstream releases.

.EXAMPLE
  # Dry-run (just see what's available):
  .\scripts\check-upstream-updates.ps1

.EXAMPLE
  # Apply updates to eligible projects:
  .\scripts\check-upstream-updates.ps1 -Apply
#>

param(
  [switch]$Apply  # Pass -Apply to actually pull updates (default: dry-run only)
)

$ErrorActionPreference = "Stop"

Write-Host "`n=== KiloCode MAOS Upstream Update Checker ===" -ForegroundColor Cyan
Write-Host "Mode: $(if ($Apply) { 'APPLY' } else { 'DRY RUN (pass -Apply to update)' })`n" -ForegroundColor Yellow

# ── Project definitions ──────────────────────────────────────────────────────
$projects = @(
  @{
    name           = "OpenClaw (git repo)"
    localPath      = "G:\Github\openclaw"
    upstreamUrl    = "https://github.com/Ghenghis/openclaw"
    upstreamRemote = "origin"
    upstreamBranch = "main"
    canAutoUpdate  = $true
    updateNote     = "Fork of openclaw/openclaw — no local modifications. Fast-forward pull is safe."
    cloneNote      = "git clone https://github.com/Ghenghis/openclaw G:\Github\openclaw"
  },
  @{
    name           = "kilocode-Azure2"
    localPath      = "G:\Github\kilocode-Azure2"
    upstreamUrl    = "https://github.com/Kilo-Org/kilocode"
    upstreamRemote = "upstream"
    upstreamBranch = "main"
    canAutoUpdate  = $false
    updateNote     = "Custom MAOS fork with HERMES, ZeroClaw, OpenClaw tab, Azure integrations. Use classify_upstream_commits.ps1 for selective cherry-picks."
    cloneNote      = ""
  },
  @{
    name           = "Hermes"
    localPath      = "G:\Github\hermes-agent"
    upstreamUrl    = ""
    upstreamRemote = ""
    upstreamBranch = ""
    canAutoUpdate  = $false
    updateNote     = "Custom implementation — no upstream to track."
    cloneNote      = ""
  }
)

# ── OpenClaw npm check ────────────────────────────────────────────────────────
Write-Host "── OpenClaw (npm global package) ─────────────────────────────────" -ForegroundColor White
Write-Host "  OpenClaw is published as an npm package: openclaw@latest" -ForegroundColor Cyan
Write-Host "  Checking installed vs latest npm version..." -ForegroundColor Cyan

try {
  $installed = (npm list -g openclaw --depth=0 2>&1 | Select-String 'openclaw@') -replace '.*openclaw@', '' -replace '\s.*', ''
  $latest    = (npm view openclaw dist-tags.latest 2>&1).Trim()

  if ($installed -and $installed -ne '') {
    Write-Host "  Installed : openclaw@$installed" -ForegroundColor Gray
    Write-Host "  Latest    : openclaw@$latest" -ForegroundColor Gray

    if ($installed -eq $latest) {
      Write-Host "  Up to date!" -ForegroundColor Green
    } else {
      Write-Host "  Update available: $installed -> $latest" -ForegroundColor Cyan
      if ($Apply) {
        Write-Host "  -> Updating via npm..." -ForegroundColor Green
        npm install -g openclaw@latest
        Write-Host "  Updated to openclaw@$latest" -ForegroundColor Green
      } else {
        Write-Host "  -> Run with -Apply to install, or: npm install -g openclaw@latest" -ForegroundColor Yellow
        Write-Host "  -> Or use built-in: openclaw update --channel stable" -ForegroundColor Yellow
      }
    }
  } else {
    Write-Host "  Not installed globally. Latest available: openclaw@$latest" -ForegroundColor Yellow
    Write-Host "  -> Install with: npm install -g openclaw@latest" -ForegroundColor Cyan
    Write-Host "  -> Or: pnpm add -g openclaw  /  bun add -g openclaw" -ForegroundColor Cyan
  }
} catch {
  Write-Host "  Could not check npm (is Node/npm installed?): $_" -ForegroundColor DarkGray
}
Write-Host ""

# ── Git repo checks ───────────────────────────────────────────────────────────
foreach ($proj in $projects) {
  Write-Host "── $($proj.name) ──────────────────────────────────────────" -ForegroundColor White

  if (-not $proj.canAutoUpdate) {
    Write-Host "  SKIP: $($proj.updateNote)" -ForegroundColor DarkGray
    Write-Host ""
    continue
  }

  if (-not (Test-Path $proj.localPath)) {
    Write-Host "  Not found at $($proj.localPath)" -ForegroundColor Yellow
    if ($proj.cloneNote) {
      Write-Host "  -> Clone with: $($proj.cloneNote)" -ForegroundColor Cyan
    }
    Write-Host ""
    continue
  }

  try {
    $status = git -C $proj.localPath status --porcelain 2>&1
    if ($status) {
      Write-Host "  Uncommitted changes detected — skipping to avoid data loss:" -ForegroundColor Yellow
      $status | ForEach-Object { Write-Host "    $_" -ForegroundColor DarkGray }
      Write-Host ""
      continue
    }

    # Fetch upstream
    Write-Host "  -> Fetching from $($proj.upstreamUrl)..." -ForegroundColor Cyan
    git -C $proj.localPath fetch $proj.upstreamRemote --tags 2>&1 | Out-Null

    $ref    = "$($proj.upstreamRemote)/$($proj.upstreamBranch)"
    $behind = (git -C $proj.localPath rev-list "HEAD..$ref" --count 2>&1).Trim()
    $ahead  = (git -C $proj.localPath rev-list "$ref..HEAD" --count 2>&1).Trim()

    if ($behind -eq "0") {
      Write-Host "  Up to date with $ref!" -ForegroundColor Green
    } else {
      Write-Host "  $behind commit(s) available from $ref" -ForegroundColor Cyan

      # Show up to 5 new commits
      $newCommits = git -C $proj.localPath log "HEAD..$ref" --oneline --max-count=5 2>&1
      $newCommits | ForEach-Object { Write-Host "    · $_" -ForegroundColor Gray }
      if ([int]$behind -gt 5) {
        Write-Host "    · ... and $([int]$behind - 5) more" -ForegroundColor DarkGray
      }

      if ([int]$ahead -gt 0) {
        Write-Host "  Also $ahead local commit(s) ahead of $ref — manual review recommended" -ForegroundColor Yellow
      }

      if ($Apply -and $ahead -eq "0") {
        Write-Host "  -> Applying fast-forward update..." -ForegroundColor Green
        git -C $proj.localPath merge --ff-only $ref 2>&1
        Write-Host "  Updated successfully!" -ForegroundColor Green
      } elseif ($Apply -and [int]$ahead -gt 0) {
        Write-Host "  Cannot fast-forward ($ahead local commit(s) ahead). Manual merge required." -ForegroundColor Yellow
      }
    }

    # Show current HEAD
    $head = git -C $proj.localPath log -1 --oneline 2>&1
    Write-Host "  Current HEAD: $head" -ForegroundColor DarkGray

  } catch {
    Write-Host "  Error: $_" -ForegroundColor Red
  }

  Write-Host ""
}

# ── ZeroClaw note ─────────────────────────────────────────────────────────────
Write-Host "── ZeroClaw ───────────────────────────────────────────────────────" -ForegroundColor White
Write-Host "  SKIP: ZeroClaw is integrated INTO kilocode-Azure2 as a settings tab." -ForegroundColor DarkGray
Write-Host "  It is an original KiloCode MAOS creation — there is no upstream to track." -ForegroundColor DarkGray
Write-Host "  Maintain it via the normal kilocode-Azure2 development workflow." -ForegroundColor DarkGray
Write-Host ""

# ── Summary ───────────────────────────────────────────────────────────────────
Write-Host "=== Summary ==========================================================" -ForegroundColor Cyan
Write-Host "  Auto-update eligible  : OpenClaw (npm: openclaw@latest / git pull)" -ForegroundColor Green
Write-Host "  Manual review only    : kilocode-Azure2, Hermes, WebUI" -ForegroundColor Yellow
Write-Host "  No upstream (original): ZeroClaw (built into kilocode-Azure2)" -ForegroundColor DarkGray
Write-Host ""
Write-Host "  Quick update commands:" -ForegroundColor White
Write-Host "    npm install -g openclaw@latest          # update npm package" -ForegroundColor Gray
Write-Host "    openclaw update --channel stable        # built-in update command" -ForegroundColor Gray
Write-Host "    .\scripts\check-upstream-updates.ps1 -Apply  # git pull (if cloned)" -ForegroundColor Gray
Write-Host ""
if (-not $Apply) {
  Write-Host "Run with -Apply to apply safe updates.`n" -ForegroundColor Yellow
}
