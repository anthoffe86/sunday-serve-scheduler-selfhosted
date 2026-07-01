# release-prod.ps1
# Guided production release runner for preflight, migrations, and edge functions.

param(
    [Parameter(Mandatory = $false)]
    [switch]$SkipMigrations,

    [Parameter(Mandatory = $false)]
    [switch]$SkipFunctions,

    [Parameter(Mandatory = $false)]
    [switch]$NoPause
)

function Invoke-Step {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Title,

        [Parameter(Mandatory = $true)]
        [scriptblock]$Script
    )

    Write-Host "";
    Write-Host "==> $Title" -ForegroundColor Cyan

    & $Script
    if ($LASTEXITCODE -ne 0) {
        throw "Step failed: $Title"
    }

    Write-Host "Completed: $Title" -ForegroundColor Green

    if (-not $NoPause) {
        Read-Host "Press Enter to continue"
    }
}

$banner = @"
You are about to run PRODUCTION release actions.

This script can perform:
1) Production preflight checks
2) Production migration deployment
3) Production edge function deployment

Use flags if you need partial release:
-SkipMigrations
-SkipFunctions
"@

Write-Host $banner -ForegroundColor Yellow

$confirm = Read-Host "Type 'RELEASE_PROD' to continue"
if ($confirm -ne "RELEASE_PROD") {
    throw "Release cancelled."
}

Invoke-Step -Title "Run production preflight" -Script {
    powershell -ExecutionPolicy Bypass -File ./scripts/preflight-supabase.ps1 -Environment prod
}

if (-not $SkipMigrations) {
    Invoke-Step -Title "Deploy production migrations" -Script {
        powershell -ExecutionPolicy Bypass -File ./scripts/deploy-migrations.ps1 -Environment prod -SkipConfirmation
    }
}
else {
    Write-Host "Skipping production migrations by request." -ForegroundColor DarkYellow
}

if (-not $SkipFunctions) {
    Invoke-Step -Title "Deploy production functions" -Script {
        powershell -ExecutionPolicy Bypass -File ./scripts/deploy-functions.ps1 -Environment prod -SkipConfirmation
    }
}
else {
    Write-Host "Skipping production functions by request." -ForegroundColor DarkYellow
}

Write-Host "";
Write-Host "Production release sequence complete." -ForegroundColor Green
Write-Host "Next: merge/release on main and verify production website deploy health." -ForegroundColor Cyan
