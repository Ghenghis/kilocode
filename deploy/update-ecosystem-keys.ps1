#!/usr/bin/env pwsh
<#
.SYNOPSIS
  Updates VS Code settings to reflect ONLY the active ecosystem providers.
  Removes stale/unused provider entries. Sets correct active providers.
  No values printed to console at any point.

  Active ecosystem providers for KiloCode MAOS:
    - MiniMax  (primary LLM, via Hermes router)
    - SiliconFlow (secondary LLM)
    - LiteLLM proxy (local gateway, port 4000)
    - Ollama (local, no key needed)
    - LM Studio (local, no key needed)

  Stale / not used in this project:
    - OpenAI direct (routed via LiteLLM instead)
    - Anthropic direct (routed via LiteLLM instead)
    - HuggingFace, GitHub Models, Azure Speech (not wired into ecosystem)
#>

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$EnvFile      = Join-Path $PSScriptRoot "..\deploy\.env"
$SettingsFile = "$env:APPDATA\Code\User\settings.json"

# ── Load .env ─────────────────────────────────────────────────────────────────
$env_map = @{}
Get-Content $EnvFile | Where-Object { $_ -match '^[A-Z_]+=.+' } | ForEach-Object {
    $p = $_ -split '=', 2
    $env_map[$p[0].Trim()] = $p[1].Trim()
}
Write-Host "Loaded $($env_map.Count) keys from .env"

# ── Load settings.json ────────────────────────────────────────────────────────
$settings = Get-Content $SettingsFile -Raw | ConvertFrom-Json -AsHashtable

# ── REMOVE stale/unused provider entries ──────────────────────────────────────
$staleKeys = @(
    "kilo-code.new.provider.openai.apiKey",
    "kilo-code.new.provider.anthropic.apiKey",
    "kilo-code.new.provider.huggingface.apiKey",
    "kilo-code.new.provider.github.token",
    "kilo-code.new.speech.azure.apiKey",
    "kilo-code.new.speech.google.apiKey",
    "kilo-code.new.speech.openai.apiKey",
    "kilo-code.new.provider.siliconflow.apiKey2",
    "kilo-code.new.training.huggingface",
    "daveai.anthropic.apiKey",
    "daveai.hf.token"
)

$removed = 0
foreach ($k in $staleKeys) {
    if ($settings.ContainsKey($k)) {
        $settings.Remove($k)
        $removed++
    }
}
Write-Host "  🗑  Removed $removed stale provider entries"

# ── SET active ecosystem provider keys (from .env, no printing) ───────────────
$activeMap = @{
    "MINIMAX_API_KEY"     = "kilo-code.new.provider.minimax.apiKey"
    "SILICONFLOW_API_KEY" = "kilo-code.new.provider.siliconflow.apiKey"
    "LITELLM_MASTER_KEY"  = "kilo-code.new.litellm.masterKey"
    "WEBUI_AGENT_TOKEN"   = "kilo-code.new.webui.agentToken"
    "WEBUI_SECRET_KEY"    = "kilo-code.new.webui.secretKey"
}

$written = 0
foreach ($envKey in $activeMap.Keys) {
    if ($env_map.ContainsKey($envKey) -and $env_map[$envKey] -ne "") {
        $settings[$activeMap[$envKey]] = $env_map[$envKey]
        $written++
    }
}
Write-Host "  ✅ Written $written active ecosystem keys to settings.json"

# ── SET active providers list + default provider ──────────────────────────────
$settings["kilo-code.new.provider.active"] = @("minimax", "siliconflow", "litellm", "ollama", "lmstudio")
$settings["kilo-code.new.provider.default"] = "minimax"
$settings["kilo-code.new.hermes.enabled"]   = $true
$settings["kilo-code.new.hermes.endpoint"]  = "http://localhost:8091"
$settings["kilo-code.new.litellm.endpoint"] = "http://localhost:4000/v1"
$settings["kilo-code.new.ollama.endpoint"]  = "http://localhost:11434"
$settings["kilo-code.new.lmstudio.endpoint"]= "http://localhost:1234/v1"

Write-Host "  ✅ Active provider list + endpoints written"

# ── WRITE updated settings.json ───────────────────────────────────────────────
$settings | ConvertTo-Json -Depth 20 | Set-Content $SettingsFile -Encoding UTF8
Write-Host "  ✅ settings.json saved"

# ── UPDATE Windows Credential Manager for active secret keys ──────────────────
$credMap = @{
    "hermes_api_key"  = $env_map["MINIMAX_API_KEY"]
    "minimax_api_key" = $env_map["MINIMAX_API_KEY"]
}

$extId = "kilocode.kilo-code"
$credWritten = 0
foreach ($k in $credMap.Keys) {
    $v = $credMap[$k]
    if ($null -eq $v -or $v -eq "") { continue }
    $result = cmdkey /generic:"vscode/$extId/$k" /user:$extId /pass:$v 2>&1
    if ($LASTEXITCODE -eq 0) { $credWritten++ }
}

# Remove stale credential entries for unused providers
$staleCredsToRemove = @(
    "vscode/$extId/anthropic_api_key",
    "vscode/$extId/hf_token",
    "vscode/$extId/github_token",
    "vscode/$extId/azure_speech_key",
    "vscode/$extId/openai_api_key"
)
$credRemoved = 0
foreach ($t in $staleCredsToRemove) {
    cmdkey /delete:$t 2>&1 | Out-Null
    $credRemoved++
}

Write-Host "  ✅ Credential Manager: $credWritten active written, $credRemoved stale removed"

# ── Done ──────────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "=============================================="
Write-Host " Active ecosystem providers configured:"
Write-Host "   MiniMax   → via Hermes (:8091)"
Write-Host "   SiliconFlow → direct"
Write-Host "   LiteLLM   → local proxy (:4000)"
Write-Host "   Ollama    → local (:11434)"
Write-Host "   LM Studio → local (:1234)"
Write-Host "=============================================="
Write-Host " Reload VS Code: Ctrl+Shift+P → Developer: Reload Window"
