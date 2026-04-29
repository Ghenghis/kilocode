#!/usr/bin/env pwsh
<#
.SYNOPSIS
  Reads keys from deploy/.env and injects them into:
  1. VS Code User settings.json (plaintext provider config)
  2. Windows Credential Manager (VS Code SecretStorage for Hermes/MiniMax)

  No values are printed to the console at any point.

.USAGE
  cd G:\Github\contract-kit-v17
  pwsh deploy\inject-keys-to-vscode.ps1
#>

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$EnvFile    = "$PSScriptRoot\..\deploy\.env"
$SettingsFile = "$env:APPDATA\Code\User\settings.json"

# ── 1. Load .env into a hashtable ────────────────────────────────────────────
if (-not (Test-Path $EnvFile)) {
    Write-Error "deploy/.env not found at $EnvFile"
    exit 1
}

$env_map = @{}
Get-Content $EnvFile | Where-Object { $_ -match '^[A-Z_]+=.+' } | ForEach-Object {
    $parts = $_ -split '=', 2
    $env_map[$parts[0].Trim()] = $parts[1].Trim()
}

Write-Host "Loaded $($env_map.Count) keys from .env"

# ── 2. Update VS Code settings.json (plaintext config keys) ──────────────────
if (-not (Test-Path $SettingsFile)) {
    Write-Error "VS Code settings.json not found at $SettingsFile"
    exit 1
}

$settings = Get-Content $SettingsFile -Raw | ConvertFrom-Json -AsHashtable

# Map: .env key -> VS Code settings key
$settingsMap = @{
    "MINIMAX_API_KEY"      = "kilo-code.new.provider.minimax.apiKey"
    "SILICONFLOW_API_KEY"  = "kilo-code.new.provider.siliconflow.apiKey"
    "SILICONFLOW_API_KEY_2"= "kilo-code.new.provider.siliconflow.apiKey2"
    "HF_TOKEN"             = "kilo-code.new.provider.huggingface.apiKey"
    "GITHUB_TOKEN"         = "kilo-code.new.provider.github.token"
    "AZURE_SPEECH_KEY"     = "kilo-code.new.speech.azure.apiKey"
    "OPENAI_API_KEY"       = "kilo-code.new.provider.openai.apiKey"
    "ANTHROPIC_API_KEY"    = "kilo-code.new.provider.anthropic.apiKey"
    "LITELLM_MASTER_KEY"   = "kilo-code.new.litellm.masterKey"
    "WEBUI_AGENT_TOKEN"    = "kilo-code.new.webui.agentToken"
}

$updated = 0
foreach ($envKey in $settingsMap.Keys) {
    $vsKey = $settingsMap[$envKey]
    if ($env_map.ContainsKey($envKey) -and $env_map[$envKey] -ne "") {
        $settings[$vsKey] = $env_map[$envKey]
        $updated++
    }
}

$settings | ConvertTo-Json -Depth 20 | Set-Content $SettingsFile -Encoding UTF8
Write-Host "  ✅ VS Code settings.json: $updated keys written"

# ── 3. Windows Credential Manager — VS Code SecretStorage ────────────────────
# VS Code stores extension secrets in Windows Credential Manager with target:
# "vscode/kilocode.kilo-code/<key-name>"

$credTargets = @{
    "hermes_api_key"   = $env_map["MINIMAX_API_KEY"]
    "minimax_api_key"  = $env_map["MINIMAX_API_KEY"]
    "hf_token"         = $env_map["HF_TOKEN"]
    "anthropic_api_key"= $env_map["ANTHROPIC_API_KEY"]
}

$extId = "kilocode.kilo-code"
$credWritten = 0

foreach ($credKey in $credTargets.Keys) {
    $val = $credTargets[$credKey]
    if ($null -eq $val -or $val -eq "") { continue }

    $target = "vscode/$extId/$credKey"

    # Use cmdkey to write — /generic for generic credentials (VS Code uses generic)
    $result = cmdkey /generic:$target /user:$extId /pass:$val 2>&1
    if ($LASTEXITCODE -eq 0) {
        $credWritten++
    } else {
        Write-Warning "  ⚠ Could not write credential: $credKey"
    }
}

Write-Host "  ✅ Windows Credential Manager: $credWritten entries written"

# ── 4. Summary ────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "Done. Reload VS Code window for SecretStorage changes to take effect:"
Write-Host "  Ctrl+Shift+P → Developer: Reload Window"
