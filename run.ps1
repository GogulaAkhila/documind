<#
.SYNOPSIS
    DocuMind launcher (Windows / PowerShell).

.DESCRIPTION
    Windows equivalent of run.sh. Starts all three services -- Daphne
    (backend), Celery worker, and Vite (frontend) -- each in its own
    PowerShell window so you get full native output and can Ctrl+C or
    close any one of them independently.

    Run .\install.ps1 first to set up the venv, .env files, and dependencies.

.NOTES
    If PowerShell refuses to run this ("running scripts is disabled on this
    system"), either right-click run.ps1 -> "Run with PowerShell", or run:
        powershell -ExecutionPolicy Bypass -File .\run.ps1

.EXAMPLE
    .\run.ps1
#>

$ErrorActionPreference = "Stop"

$RootDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$BackendDir = Join-Path $RootDir "backend"
$FrontendDir = Join-Path $RootDir "frontend"
$VenvDir = Join-Path $BackendDir "venv"

function Info    { param($msg) Write-Host "==> $msg" -ForegroundColor Cyan }
function Ok      { param($msg) Write-Host "[OK] $msg" -ForegroundColor Green }
function FailMsg { param($msg) Write-Host "[X] $msg" -ForegroundColor Red }

# ---------------------------------------------------------------------------
# Sanity checks -- make sure install.ps1 has been run
# ---------------------------------------------------------------------------
if (-not (Test-Path $VenvDir)) {
    FailMsg "backend\venv not found. Run .\install.ps1 first."
    exit 1
}
if (-not (Test-Path (Join-Path $FrontendDir "node_modules"))) {
    FailMsg "frontend\node_modules not found. Run .\install.ps1 first."
    exit 1
}
if (-not (Test-Path (Join-Path $BackendDir ".env"))) {
    FailMsg "backend\.env not found. Run .\install.ps1 first."
    exit 1
}

$DaphneExe = Join-Path $VenvDir "Scripts\daphne.exe"
$CeleryExe = Join-Path $VenvDir "Scripts\celery.exe"

$backendCmd = "`$host.UI.RawUI.WindowTitle = 'DocuMind - Backend (Daphne :8000)'; Set-Location '$BackendDir'; Remove-Item Env:GEMINI_API_KEY -ErrorAction SilentlyContinue; & '$DaphneExe' -b 0.0.0.0 -p 8000 config.asgi:application"

# Windows has no fork() at all, so Celery's prefork pool isn't an option
# here either -- same reasoning as the macOS --pool=solo requirement in
# core/rag/chunking.py, just a different underlying platform limitation.
$celeryCmd = "`$host.UI.RawUI.WindowTitle = 'DocuMind - Celery worker'; Set-Location '$BackendDir'; Remove-Item Env:GEMINI_API_KEY -ErrorAction SilentlyContinue; & '$CeleryExe' -A config.celery worker -l info --pool=solo"

$frontendCmd = "`$host.UI.RawUI.WindowTitle = 'DocuMind - Frontend (Vite :5173)'; Set-Location '$FrontendDir'; npm run dev"

Info "Starting Daphne, Celery, and Vite"

Start-Process powershell -ArgumentList @('-NoExit', '-Command', $backendCmd)
Start-Sleep -Seconds 1
Start-Process powershell -ArgumentList @('-NoExit', '-Command', $celeryCmd)
Start-Sleep -Seconds 1
Start-Process powershell -ArgumentList @('-NoExit', '-Command', $frontendCmd)

Ok "Opened 3 PowerShell windows (backend, celery, frontend)"
Write-Host ""
Ok "Backend:  http://localhost:8000/api/v1/"
Ok "Frontend: http://localhost:5173"
Write-Host ""
Write-Host "Close each window (or Ctrl+C inside it) to stop that service."
Write-Host ""
