#requires -Version 5.1
<#
.SYNOPSIS
  Generate cryptographically random secrets for self-issued KiloCode env vars.

.DESCRIPTION
  Some env vars hold secrets that have no external source — they're "shared
  secrets" between two of YOUR own services (e.g., HERMES_API_KEY between the
  VS Code extension and the Hermes Bridge). For these, you don't get a key
  from a provider — you generate one.

  This script generates strong random values and sets them as Windows User
  environment variables (no admin needed, survives reboot).

  Variables generated:
    LITELLM_MASTER_KEY        (32 hex bytes)
    HERMES_API_KEY            (32 hex bytes)
    WEBUI_AGENT_TOKEN         (32 hex bytes)
    WEBUI_SECRET_KEY          (32 hex bytes)
    OPEN_WEBUI_SECRET_KEY     (32 hex bytes)
    SHIBA_KEY                 (32 hex bytes — must match the Shiba Gateway
                               server config; if Shiba is already running
                               with a different SHIBA_KEY, restart it
                               with this value or it will reject requests)

  By default the script SKIPS variables that are already set. Pass -Force to
  rotate (overwrite) existing values.

  Values are NEVER echoed. Output shows variable names + a "[set, hidden]"
  status. Use `pwsh scripts\setup-windows-env.ps1 -List` to verify after.

.NOTES
  After running, restart any open VS Code / terminals so they pick up the
  new vars (already-running processes keep their old snapshot).

  If your VPS / Hermes / Shiba services are already running with different
  values for these shared secrets, you must restart those services with the
  matching values, or update the service config to use these.
#>

[CmdletBinding()]
param(
  [switch] $Force,    # Rotate (overwrite) values that are already set
  [switch] $List      # Just show which generatable vars are set; do not generate
)

$ErrorActionPreference = 'Stop'

# Self-issuable variables (generated, not obtained from a service)
$generatable = @(
  @{ Name = 'LITELLM_MASTER_KEY';     Desc = 'LiteLLM proxy master auth key' }
  @{ Name = 'HERMES_API_KEY';         Desc = 'Hermes Bridge auth (between VS Code and your Hermes service)' }
  @{ Name = 'WEBUI_AGENT_TOKEN';      Desc = 'WebUI agent token' }
  @{ Name = 'WEBUI_SECRET_KEY';       Desc = 'WebUI session-signing secret' }
  @{ Name = 'OPEN_WEBUI_SECRET_KEY';  Desc = 'Open WebUI secret' }
  @{ Name = 'SHIBA_KEY';              Desc = 'Shiba Gateway X-Shiba-Key (must match server config)' }
)

# ─── Helper: generate 32-byte cryptographic random as hex string ───────────
function New-StrongSecret {
  $bytes = New-Object byte[] 32
  $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
  try { $rng.GetBytes($bytes) }
  finally { $rng.Dispose() }
  -join ($bytes | ForEach-Object { '{0:x2}' -f $_ })
}

# ─── List mode ─────────────────────────────────────────────────────────────
if ($List) {
  Write-Host ""
  Write-Host "Self-issuable secrets — current state:" -ForegroundColor Cyan
  Write-Host ("─" * 64)
  foreach ($v in $generatable) {
    $cur = [Environment]::GetEnvironmentVariable($v.Name, 'User')
    $status = if ([string]::IsNullOrEmpty($cur)) { '(not set)' } else { '(set, hidden)' }
    $color  = if ([string]::IsNullOrEmpty($cur)) { 'DarkGray' }     else { 'Green' }
    Write-Host ("  {0,-25} {1}" -f $v.Name, $status) -ForegroundColor $color
  }
  Write-Host ""
  return
}

# ─── Generate mode ─────────────────────────────────────────────────────────
Write-Host ""
Write-Host "Generating self-issued secrets" -ForegroundColor Cyan
Write-Host ("─" * 64)
Write-Host "Each value is 256-bit random hex, set as Windows User env var."
Write-Host "Existing values are kept unless -Force is passed."
Write-Host "Values are never displayed."
Write-Host ""

$generated = 0
$kept = 0
$rotated = 0

foreach ($v in $generatable) {
  $existing = [Environment]::GetEnvironmentVariable($v.Name, 'User')
  $hasExisting = -not [string]::IsNullOrEmpty($existing)

  if ($hasExisting -and -not $Force) {
    Write-Host ("  {0,-25} kept (already set; pass -Force to rotate)" -f $v.Name) -ForegroundColor DarkGray
    $kept++
    continue
  }

  $secret = New-StrongSecret
  [Environment]::SetEnvironmentVariable($v.Name, $secret, 'User')
  $secret = $null   # eager-clear from memory

  if ($hasExisting) {
    Write-Host ("  {0,-25} rotated [hidden]" -f $v.Name) -ForegroundColor Yellow
    $rotated++
  } else {
    Write-Host ("  {0,-25} generated [hidden]" -f $v.Name) -ForegroundColor Green
    $generated++
  }
}

Write-Host ""
Write-Host ("─" * 64)
Write-Host ("Generated: {0,2}   Rotated: {1,2}   Kept: {2,2}" -f $generated, $rotated, $kept) -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "  1. Restart VS Code / terminals to inherit new vars"
Write-Host "  2. If your Hermes / WebUI / Shiba services are already running with"
Write-Host "     different values, restart them with these new values OR they will"
Write-Host "     reject auth (401)."
Write-Host "  3. Verify: pwsh scripts\setup-windows-env.ps1 -List"
Write-Host ""
