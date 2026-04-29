#requires -Version 5.1
<#
.SYNOPSIS
  Securely set KiloCode/contract-kit secrets as Windows User environment variables.

.DESCRIPTION
  Prompts for each secret with Read-Host -AsSecureString (no echo, no logs, no chat
  exposure). Sets values at User level (no admin needed, survives reboot).

  Re-runnable. Press Enter on a prompt to skip / keep existing value.

  Excluded by design (per user directive — cost-conscious):
    - ANTHROPIC_API_KEY
    - OPENAI_API_KEY

.NOTES
  After running, restart any open VS Code / terminals so they pick up the new vars.
#>

[CmdletBinding()]
param(
  [switch] $Force,    # Overwrite existing values without confirmation
  [switch] $List      # Only list which vars are set; do not prompt
)

$ErrorActionPreference = 'Stop'

# ─── Variable manifest ──────────────────────────────────────────────────────
# Each entry: Name, Description, Category. NO real values stored here.
$vars = @(
  # Local model runtimes
  @{ Name = 'LM_STUDIO_API_KEY';        Cat = 'Local';     Desc = 'LM Studio local API key (often blank)' }
  @{ Name = 'LITELLM_MASTER_KEY';       Cat = 'Local';     Desc = 'LiteLLM proxy master key' }

  # Cloud providers (Anthropic + OpenAI deliberately omitted)
  @{ Name = 'DEEPSEEK_API_KEY';         Cat = 'Provider';  Desc = 'DeepSeek API — platform.deepseek.com/api-keys' }
  @{ Name = 'GROQ_API_KEY';             Cat = 'Provider';  Desc = 'Groq API — console.groq.com/keys' }
  @{ Name = 'MINIMAX_API_KEY';          Cat = 'Provider';  Desc = 'MiniMax API' }
  @{ Name = 'SILICONFLOW_API_KEY';      Cat = 'Provider';  Desc = 'SiliconFlow API — cloud.siliconflow.cn/account/ak' }
  @{ Name = 'OPENROUTER_API_KEY';       Cat = 'Provider';  Desc = 'OpenRouter API — openrouter.ai/keys' }

  # WebUI / Hermes auth
  @{ Name = 'WEBUI_AGENT_TOKEN';        Cat = 'WebUI';     Desc = 'WebUI agent token' }
  @{ Name = 'WEBUI_SECRET_KEY';         Cat = 'WebUI';     Desc = 'WebUI secret (session signing)' }
  @{ Name = 'OPEN_WEBUI_SECRET_KEY';    Cat = 'WebUI';     Desc = 'Open WebUI secret' }
  @{ Name = 'HERMES_API_KEY';           Cat = 'Hermes';    Desc = 'Hermes Bridge auth key' }
  @{ Name = 'HERMES_MINIMAX_API_KEY';   Cat = 'Hermes';    Desc = 'Hermes default MiniMax model key' }

  # VPS access
  @{ Name = 'VPS_HOST';                 Cat = 'VPS';       Desc = 'VPS hostname (e.g. hermes.daveai.tech)' }
  @{ Name = 'VPS_USER';                 Cat = 'VPS';       Desc = 'VPS SSH username' }
  @{ Name = 'SSH_KEY';                  Cat = 'VPS';       Desc = 'Path to SSH private key (e.g. C:\Users\Admin\.ssh\id_ed25519)' }

  # Shiba Memory
  @{ Name = 'SHIBA_DB_URL';             Cat = 'Shiba';     Desc = 'Shiba postgres URL (postgres://user:pass@host:port/db)' }

  # Discord bots
  @{ Name = 'DISCORD_TOKEN_HERMES1';    Cat = 'Discord';   Desc = 'Discord bot 1 token' }
  @{ Name = 'DISCORD_TOKEN_HERMES2';    Cat = 'Discord';   Desc = 'Discord bot 2 token' }
  @{ Name = 'DISCORD_TOKEN_HERMES3';    Cat = 'Discord';   Desc = 'Discord bot 3 token' }
  @{ Name = 'DISCORD_TOKEN_HERMES4';    Cat = 'Discord';   Desc = 'Discord bot 4 token' }
  @{ Name = 'DISCORD_TOKEN_HERMES5';    Cat = 'Discord';   Desc = 'Discord bot 5 token' }
  @{ Name = 'DISCORD_GUILD_ID';         Cat = 'Discord';   Desc = 'Discord server (guild) ID' }
)

# ─── Helper: convert SecureString → plain text only at the moment of use ────
function ConvertFrom-SecureToPlain {
  param([System.Security.SecureString] $Secure)
  if ($null -eq $Secure -or $Secure.Length -eq 0) { return $null }
  $bstr = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($Secure)
  try {
    return [System.Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
  } finally {
    [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
  }
}

# ─── List mode ──────────────────────────────────────────────────────────────
if ($List) {
  Write-Host ""
  Write-Host "Current Windows User environment variables:" -ForegroundColor Cyan
  Write-Host ("─" * 72)
  $byCat = $vars | Group-Object Cat
  foreach ($g in $byCat) {
    Write-Host ""
    Write-Host "[$($g.Name)]" -ForegroundColor Yellow
    foreach ($v in $g.Group) {
      $cur = [Environment]::GetEnvironmentVariable($v.Name, 'User')
      $status = if ([string]::IsNullOrEmpty($cur)) { '(not set)' } else { '(set, hidden)' }
      $color  = if ([string]::IsNullOrEmpty($cur)) { 'DarkGray' }     else { 'Green' }
      Write-Host ("  {0,-30} {1}" -f $v.Name, $status) -ForegroundColor $color
    }
  }
  Write-Host ""
  Write-Host "Run without -List to set or update values." -ForegroundColor Cyan
  Write-Host ""
  return
}

# ─── Interactive prompt loop ────────────────────────────────────────────────
Write-Host ""
Write-Host "KiloCode Ecosystem — Secret Setup" -ForegroundColor Cyan
Write-Host ("─" * 72)
Write-Host "Press Enter to SKIP a variable (keeps existing value, if any)."
Write-Host "Input is NEVER echoed to screen, logs, or terminal history."
Write-Host ""

$set = 0; $skipped = 0; $kept = 0
foreach ($v in $vars) {
  $name = $v.Name
  $existing = [Environment]::GetEnvironmentVariable($name, 'User')
  $hasExisting = -not [string]::IsNullOrEmpty($existing)

  $label = if ($hasExisting) { "$name [already set, Enter=keep]" } else { $name }
  Write-Host ""
  Write-Host ("  {0}" -f $v.Desc) -ForegroundColor DarkGray

  $secure = Read-Host -AsSecureString -Prompt $label
  $plain  = ConvertFrom-SecureToPlain $secure

  if ([string]::IsNullOrEmpty($plain)) {
    if ($hasExisting) { $kept++ } else { $skipped++ }
    continue
  }

  if ($hasExisting -and -not $Force) {
    $confirm = Read-Host "  $name already exists. Overwrite? (y/N)"
    if ($confirm -notmatch '^[Yy]') {
      $kept++
      $plain = $null
      continue
    }
  }

  [Environment]::SetEnvironmentVariable($name, $plain, 'User')
  $plain = $null   # eager-clear from memory
  $set++
}

# Final summary (counts only — no values)
Write-Host ""
Write-Host ("─" * 72)
Write-Host ("Set: {0,3}   Kept: {1,3}   Skipped: {2,3}" -f $set, $kept, $skipped) -ForegroundColor Cyan
Write-Host ""
Write-Host "Done. Restart VS Code / terminals to pick up new values." -ForegroundColor Green
Write-Host "Verify with: pwsh scripts\setup-windows-env.ps1 -List" -ForegroundColor DarkGray
Write-Host ""
