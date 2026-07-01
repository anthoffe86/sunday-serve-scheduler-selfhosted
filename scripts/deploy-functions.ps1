# deploy-functions.ps1
# Deploy all Supabase Edge Functions to a specific environment.

param(
    [Parameter(Mandatory = $false)]
    [ValidateSet("nonprod", "prod")]
    [string]$Environment = "nonprod",

    [Parameter(Mandatory = $false)]
    [string]$NonProdProjectRef = "",

    [Parameter(Mandatory = $false)]
    [string]$ProdProjectRef = "",

    [Parameter(Mandatory = $false)]
    [switch]$SkipConfirmation
)

function Assert-SupabaseAuth {
    $token = [Environment]::GetEnvironmentVariable("SUPABASE_ACCESS_TOKEN")
    if (-not [string]::IsNullOrWhiteSpace($token)) {
        return
    }

    npx supabase projects list --output json *> $null
    if ($LASTEXITCODE -ne 0) {
        throw "Missing Supabase authentication. Set SUPABASE_ACCESS_TOKEN or run 'supabase login' with an sbp_ personal access token."
    }
}

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
        $confirmation = Read-Host "Type 'DEPLOY_PROD' to confirm deploying functions to PRODUCTION ($ProdProjectRef)"
        if ($confirmation -ne "DEPLOY_PROD") {
            throw "Production deployment cancelled."
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

Assert-SupabaseAuth

# Run guardrail checks before deploying edge functions.
& "$PSScriptRoot/preflight-supabase.ps1" -Environment $Environment -NonProdProjectRef $NonProdProjectRef -ProdProjectRef $ProdProjectRef
if (-not $?) {
    throw "Preflight checks failed."
}

$functionsPath = "supabase/functions"
$functions = Get-ChildItem -Path $functionsPath -Directory

if (-not $functions -or $functions.Count -eq 0) {
    throw "No functions found under $functionsPath"
}

Write-Host "Starting deployment of Supabase Edge Functions to '$Environment' ($projectRef)..." -ForegroundColor Cyan

foreach ($function in $functions) {
    $name = $function.Name

    if ($name.StartsWith("_")) {
        Write-Host "Skipping internal function folder: $name" -ForegroundColor DarkGray
        continue
    }

    Write-Host "Deploying function: $name..." -ForegroundColor Yellow
    npx supabase functions deploy $name --project-ref $projectRef
    if ($LASTEXITCODE -ne 0) {
        throw "Failed deploying function '$name'"
    }
}

Write-Host "Finished deployment of all functions to '$Environment'!" -ForegroundColor Green
