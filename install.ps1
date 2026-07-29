<#
.SYNOPSIS
    DocuMind installer (Windows / PowerShell).

.DESCRIPTION
    Windows equivalent of install.sh. What it does:
      1. Verifies prerequisites (Python 3.10-3.12, Node 18+)
      2. Creates the backend virtualenv and installs Python dependencies
      3. Creates backend\.env (interactively prompting for required API keys/URLs
         if it doesn't exist yet -- never overwrites an existing .env)
      4. Creates frontend\.env with sane localhost defaults (no secrets needed)
      5. Runs Django migrations + initializes the pgvector store (best-effort --
         won't abort the script if the DB isn't reachable yet)
      6. Installs frontend npm dependencies

    This script only installs/updates dependencies -- it does NOT start any
    services. Once it finishes, run .\run.ps1 to start Daphne, Celery, and Vite
    each in their own window.

.NOTES
    If PowerShell refuses to run this ("running scripts is disabled on this
    system"), either right-click install.ps1 -> "Run with PowerShell", or run:
        powershell -ExecutionPolicy Bypass -File .\install.ps1

.EXAMPLE
    .\install.ps1
#>

$ErrorActionPreference = "Stop"

$RootDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$BackendDir = Join-Path $RootDir "backend"
$FrontendDir = Join-Path $RootDir "frontend"

function Info    { param($msg) Write-Host "==> $msg" -ForegroundColor Cyan }
function Ok      { param($msg) Write-Host "[OK] $msg" -ForegroundColor Green }
function WarnMsg { param($msg) Write-Host "[!] $msg" -ForegroundColor Yellow }
function FailMsg { param($msg) Write-Host "[X] $msg" -ForegroundColor Red }

# ---------------------------------------------------------------------------
# Prerequisite checks
# ---------------------------------------------------------------------------
$script:PyExe = $null
$script:PyVerArg = $null

function Test-Prereqs {
    Info "Checking prerequisites"

    $candidates = @(
        @{ Exe = "py"; Ver = "-3.12" },
        @{ Exe = "py"; Ver = "-3.11" },
        @{ Exe = "py"; Ver = "-3.10" },
        @{ Exe = "python"; Ver = $null }
    )

    foreach ($c in $candidates) {
        if (Get-Command $c.Exe -ErrorAction SilentlyContinue) {
            try {
                if ($c.Ver) {
                    $verOutput = & $c.Exe $c.Ver -c "import sys; print('%d.%d' % sys.version_info[:2])" 2>$null
                } else {
                    $verOutput = & $c.Exe -c "import sys; print('%d.%d' % sys.version_info[:2])" 2>$null
                }
                if ($verOutput -in @("3.10", "3.11", "3.12")) {
                    $script:PyExe = $c.Exe
                    $script:PyVerArg = $c.Ver
                    break
                }
            } catch { }
        }
    }

    if (-not $script:PyExe) {
        FailMsg "Python 3.10-3.12 is required (Docling is unstable on 3.13+). Install from python.org or 'winget install Python.Python.3.12'."
        exit 1
    }
    $verStr = if ($script:PyVerArg) { & $script:PyExe $script:PyVerArg --version } else { & $script:PyExe --version }
    Ok "Using $verStr"

    if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
        FailMsg "Node.js is required (v18+). Install from nodejs.org or 'winget install OpenJS.NodeJS.LTS'."
        exit 1
    }
    Ok "Using node $(node --version)"

    if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
        FailMsg "npm is required but was not found alongside node."
        exit 1
    }
}

function Invoke-Python {
    param([string[]]$Args)
    if ($script:PyVerArg) {
        & $script:PyExe $script:PyVerArg @Args
    } else {
        & $script:PyExe @Args
    }
}

# ---------------------------------------------------------------------------
# Backend: venv + dependencies
# ---------------------------------------------------------------------------
function Setup-BackendDeps {
    Info "Setting up backend virtual environment"
    $venvDir = Join-Path $BackendDir "venv"

    if (-not (Test-Path $venvDir)) {
        Invoke-Python @("-m", "venv", $venvDir)
        Ok "Created venv"
    } else {
        Ok "venv already exists"
    }

    $venvPython = Join-Path $venvDir "Scripts\python.exe"
    & $venvPython -m pip install --upgrade pip -q
    & $venvPython -m pip install -q -r (Join-Path $BackendDir "requirements.txt")
    Ok "Backend dependencies installed"
}

# ---------------------------------------------------------------------------
# Backend: .env (interactive, only if missing -- never overwrites secrets)
# ---------------------------------------------------------------------------
function Set-EnvVar {
    param([string]$Path, [string]$Name, [string]$Value)
    if ([string]::IsNullOrWhiteSpace($Value)) { return }
    $content = Get-Content $Path
    $newContent = $content | ForEach-Object {
        if ($_ -match "^$Name=") { "$Name=$Value" } else { $_ }
    }
    Set-Content -Path $Path -Value $newContent
}

function Read-EnvVar {
    param([string]$Path, [string]$Name, [string]$PromptText)
    $value = $null
    try {
        $value = Read-Host "  $PromptText"
    } catch { }
    if (-not [string]::IsNullOrWhiteSpace($value)) {
        Set-EnvVar -Path $Path -Name $Name -Value $value
    } else {
        WarnMsg "  Left $Name as a placeholder -- edit backend\.env before starting services."
    }
}

function Setup-BackendEnv {
    Info "Setting up backend\.env"
    $envPath = Join-Path $BackendDir ".env"
    $examplePath = Join-Path $BackendDir ".env.example"

    if (Test-Path $envPath) {
        Ok "backend\.env already exists -- leaving it untouched"
        return
    }

    Copy-Item $examplePath $envPath

    $venvPython = Join-Path $BackendDir "venv\Scripts\python.exe"
    $secretKey = & $venvPython -c "import secrets; print(secrets.token_urlsafe(50))"
    Set-EnvVar -Path $envPath -Name "DJANGO_SECRET_KEY" -Value $secretKey

    Write-Host ""
    Write-Host "backend\.env was created from the template. Paste your credentials now"
    Write-Host "(press Enter to skip any of these and fill them in later):"
    Write-Host ""
    Read-EnvVar $envPath "GEMINI_API_KEY"  "Gemini API key (aistudio.google.com/apikey)"
    Read-EnvVar $envPath "JINA_API_KEY"    "Jina API key (jina.ai/reranker)"
    Read-EnvVar $envPath "DATABASE_URL"    "Supabase DATABASE_URL (postgres://...)"
    Read-EnvVar $envPath "SUPABASE_DB_URL" "Supabase SUPABASE_DB_URL (usually same as above)"
    Read-EnvVar $envPath "SUPABASE_URL"    "Supabase project URL (https://<ref>.supabase.co)"
    Read-EnvVar $envPath "SUPABASE_KEY"    "Supabase anon key"
    Read-EnvVar $envPath "REDIS_URL"       "Redis URL (Upstash rediss://... or redis://localhost:6379/0)"
    Write-Host ""

    Ok "backend\.env ready"
}

# ---------------------------------------------------------------------------
# Backend: migrations + vector store init (best-effort)
# ---------------------------------------------------------------------------
function Invoke-Migrations {
    Info "Running database migrations"
    Push-Location $BackendDir
    try {
        $venvPython = Join-Path $BackendDir "venv\Scripts\python.exe"
        Remove-Item Env:GEMINI_API_KEY -ErrorAction SilentlyContinue

        & $venvPython manage.py migrate --noinput
        if ($LASTEXITCODE -ne 0) {
            WarnMsg "Migrations failed -- check DATABASE_URL/SUPABASE_DB_URL in backend\.env, then re-run this script."
            return
        }
        Ok "Migrations applied"

        $env:DJANGO_SETTINGS_MODULE = "config.settings"
        $initScript = @"
import django
django.setup()
from core.vectorstore.pgvector_store import PgVectorStore
PgVectorStore().initialize()
"@
        & $venvPython -c $initScript 2>$null
        if ($LASTEXITCODE -eq 0) {
            Ok "pgvector store initialized"
        } else {
            WarnMsg "Could not initialize the pgvector store yet (will be created automatically on first document upload)."
        }
        Remove-Item Env:DJANGO_SETTINGS_MODULE -ErrorAction SilentlyContinue
    } finally {
        Pop-Location
    }
}

# ---------------------------------------------------------------------------
# Frontend: .env + npm dependencies
# ---------------------------------------------------------------------------
function Setup-Frontend {
    Info "Setting up frontend"
    Push-Location $FrontendDir
    try {
        $envPath = Join-Path $FrontendDir ".env"
        if (-not (Test-Path $envPath)) {
            @"
VITE_API_URL=http://localhost:8000/api/v1
VITE_WS_URL=ws://localhost:8000
"@ | Set-Content -Path $envPath
            Ok "Created frontend\.env with local defaults"
        } else {
            Ok "frontend\.env already exists -- leaving it untouched"
        }

        npm install --silent
        Ok "Frontend dependencies installed"
    } finally {
        Pop-Location
    }
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
Test-Prereqs
Setup-BackendDeps
Setup-BackendEnv
Invoke-Migrations
Setup-Frontend

Write-Host ""
Ok "Setup complete."
Write-Host ""
Info "Next: run .\run.ps1 to start the backend, Celery worker, and frontend."
Write-Host ""
