# deploy-migrations.ps1
# Push schema migrations to a specific Supabase environment.

param(
    [Parameter(Mandatory = $false)]
    [ValidateSet("nonprod", "prod")]
    [string]$Environment = "nonprod",

    [Parameter(Mandatory = $false)]
    [string]$NonProdProjectRef = "",

    [Parameter(Mandatory = $false)]
    [string]$ProdProjectRef = "",

    [Parameter(Mandatory = $false)]
    [string]$DatabasePassword = "",

    [Parameter(Mandatory = $false)]
    [switch]$SkipConfirmation
)

if ([string]::IsNullOrWhiteSpace($NonProdProjectRef)) {
    $NonProdProjectRef = [Environment]::GetEnvironmentVariable("SUPABASE_PROJECT_REF_NONPROD")
}

if ([string]::IsNullOrWhiteSpace($ProdProjectRef)) {
    $ProdProjectRef = [Environment]::GetEnvironmentVariable("SUPABASE_PROJECT_REF_PROD")
}

$projectRef = ""
if ($Environment -eq "prod") {
    if ([string]::IsNullOrWhiteSpace($ProdProjectRef)) {
        throw "Production project ref is required. Set SUPABASE_PROJECT_REF_PROD or pass -ProdProjectRef."
    }

    if (-not $SkipConfirmation) {
        $confirmation = Read-Host "Type 'DEPLOY_PROD' to confirm applying migrations to PRODUCTION ($ProdProjectRef)"
        if ($confirmation -ne "DEPLOY_PROD") {
            throw "Production migration deployment cancelled."
        }
    }

    $projectRef = $ProdProjectRef
}
else {
    if ([string]::IsNullOrWhiteSpace($NonProdProjectRef)) {
        throw "Non-production project ref is required. Set SUPABASE_PROJECT_REF_NONPROD or pass -NonProdProjectRef."
    }

    $projectRef = $NonProdProjectRef
}

# Run guardrail checks before pushing schema changes.
& "$PSScriptRoot/preflight-supabase.ps1" -Environment $Environment -NonProdProjectRef $NonProdProjectRef -ProdProjectRef $ProdProjectRef
if (-not $?) {
    throw "Preflight checks failed."
}

Write-Host "Applying migrations to '$Environment' ($projectRef)..." -ForegroundColor Cyan

if ([string]::IsNullOrWhiteSpace($DatabasePassword)) {
    $DatabasePassword = [Environment]::GetEnvironmentVariable("SUPABASE_DB_PASSWORD")
}

if ([string]::IsNullOrWhiteSpace($DatabasePassword)) {
    npx supabase link --project-ref $projectRef
}
else {
    npx supabase link --project-ref $projectRef --password $DatabasePassword
}

if ($LASTEXITCODE -ne 0) {
    throw "Failed to link Supabase project '$projectRef'."
}

npx supabase db push --linked --include-all
if ($LASTEXITCODE -ne 0) {
    throw "Migration deployment failed for '$Environment'."
}

Write-Host "Migrations applied successfully to '$Environment'." -ForegroundColor Green
Write-Host "Note: This command applies schema changes only. It does not apply test/demo seed data." -ForegroundColor DarkYellow
