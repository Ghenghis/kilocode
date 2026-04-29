# run_local_hub.ps1
# Starts all KiloCode services locally for development/testing
# Usage: .\scripts\run_local_hub.ps1
# Stop all:  Get-Job | Stop-Job ; Get-Job | Remove-Job

$ROOT = Split-Path -Parent $PSScriptRoot
Set-Location $ROOT

Write-Host "=== KiloCode Local Hub Launcher ===" -ForegroundColor Cyan
Write-Host "Root: $ROOT"

# Activate venv if present
$VENV = "$ROOT\venv\Scripts\python.exe"
if (-not (Test-Path $VENV)) {
    $VENV = "python"
    Write-Host "No venv found, using system python" -ForegroundColor Yellow
}

# Helper: start background job with label
function Start-Service($Name, $Port, $Module) {
    Write-Host "  Starting $Name on :$Port  ($Module)" -ForegroundColor Green
    Start-Job -Name $Name -ScriptBlock {
        param($root, $venv, $mod, $port)
        Set-Location $root
        & $venv -m uvicorn $mod --host 127.0.0.1 --port $port --log-level info
    } -ArgumentList $ROOT, $VENV, $Module, $Port | Out-Null
}

# ── Launch services ───────────────────────────────────────────────────────────
Start-Service "runtime"  8081 "src.runtime.app:app"
Start-Sleep 1
Start-Service "settings" 8082 "src.runtime.settings_canonical:app"
Start-Sleep 1
Start-Service "webui"    8095 "src.webui.dashboard:app"

Write-Host ""
Write-Host "Services starting. Waiting 5s for health checks..." -ForegroundColor Cyan
Start-Sleep 5

# ── Health check ──────────────────────────────────────────────────────────────
$services = @{
    "Runtime"  = "http://localhost:8081/health"
    "Settings" = "http://localhost:8082/health"
    "WebUI"    = "http://localhost:8095/health"
}

foreach ($name in $services.Keys) {
    try {
        $r = Invoke-WebRequest -Uri $services[$name] -TimeoutSec 4 -UseBasicParsing -ErrorAction Stop
        $data = $r.Content | ConvertFrom-Json
        if ($data.status -eq "healthy") {
            Write-Host "  OK  $name ($($services[$name]))" -ForegroundColor Green
        } else {
            Write-Host "  WARN $name - status: $($data.status)" -ForegroundColor Yellow
        }
    } catch {
        Write-Host "  FAIL $name - not reachable" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "Control Hub: http://localhost:8095/" -ForegroundColor Cyan
Write-Host ""
Write-Host "To run Playwright tests:" -ForegroundColor White
Write-Host "  npx playwright test tests/e2e/test_hub_playwright.ts --project=chromium" -ForegroundColor Gray
Write-Host ""
Write-Host "To run Python settings E2E tests:" -ForegroundColor White
Write-Host "  python -m pytest tests/e2e/test_settings_live.py -v" -ForegroundColor Gray
Write-Host ""
Write-Host "Press Ctrl+C to stop all services" -ForegroundColor Yellow
Write-Host "(or run: Get-Job | Stop-Job)" -ForegroundColor Gray

# Keep running until interrupted
try { while ($true) { Start-Sleep 10 } }
finally { Get-Job | Stop-Job ; Get-Job | Remove-Job }
