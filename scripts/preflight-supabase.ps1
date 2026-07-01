# preflight-supabase.ps1
# Validate Supabase environment targeting before any deploy or migration operation.

param(
    [Parameter(Mandatory = $false)]
    [ValidateSet("nonprod", "prod")]
    [string]$Environment = "nonprod",

    [Parameter(Mandatory = $false)]
    [string]$NonProdProjectRef = "",

    [Parameter(Mandatory = $false)]
    [string]$ProdProjectRef = ""
)

function Get-RequiredEnvVar {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Name
    )

    $value = [Environment]::GetEnvironmentVariable($Name)
    if ([string]::IsNullOrWhiteSpace($value)) {
        throw "Missing required environment variable: $Name"
    }
    return $value
}

function Get-OptionalProjectIdFromEnvFile {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path
    )

    if (-not (Test-Path -Path $Path)) {
        return ""
    }

    $line = Select-String -Path $Path -Pattern '^VITE_SUPABASE_PROJECT_ID\s*=\s*"?([^"\r\n]+)"?' | Select-Object -First 1
    if (-not $line) {
        return ""
    }

    if ($line.Matches.Count -gt 0) {
        return $line.Matches[0].Groups[1].Value.Trim()
    }

    return ""
}

if ([string]::IsNullOrWhiteSpace($NonProdProjectRef)) {
    $NonProdProjectRef = [Environment]::GetEnvironmentVariable("SUPABASE_PROJECT_REF_NONPROD")
}

if ([string]::IsNullOrWhiteSpace($ProdProjectRef)) {
    $ProdProjectRef = [Environment]::GetEnvironmentVariable("SUPABASE_PROJECT_REF_PROD")
}

if ([string]::IsNullOrWhiteSpace($NonProdProjectRef)) {
    throw "Missing non-production project ref. Set SUPABASE_PROJECT_REF_NONPROD or pass -NonProdProjectRef."
}

if ([string]::IsNullOrWhiteSpace($ProdProjectRef)) {
    throw "Missing production project ref. Set SUPABASE_PROJECT_REF_PROD or pass -ProdProjectRef."
}

if ($NonProdProjectRef -eq $ProdProjectRef) {
    throw "Non-production and production project refs are identical. They must be different."
}

$null = Get-RequiredEnvVar -Name "SUPABASE_ACCESS_TOKEN"

$rootEnvProjectRef = Get-OptionalProjectIdFromEnvFile -Path ".env"
$devEnvProjectRef = Get-OptionalProjectIdFromEnvFile -Path ".env.development"
$prodEnvProjectRef = Get-OptionalProjectIdFromEnvFile -Path ".env.production"

if ($Environment -eq "nonprod") {
    if (-not [string]::IsNullOrWhiteSpace($devEnvProjectRef) -and $devEnvProjectRef -eq $ProdProjectRef) {
        throw ".env.development points to production project ref. Fix before continuing."
    }

    if (-not [string]::IsNullOrWhiteSpace($rootEnvProjectRef) -and $rootEnvProjectRef -eq $ProdProjectRef) {
        throw ".env points to production project ref. Keep .env as non-production only."
    }
}

if ($Environment -eq "prod") {
    if (-not [string]::IsNullOrWhiteSpace($prodEnvProjectRef) -and $prodEnvProjectRef -ne $ProdProjectRef) {
        throw ".env.production does not match SUPABASE_PROJECT_REF_PROD. Verify production environment configuration."
    }
}

Write-Host "Preflight checks passed for '$Environment'." -ForegroundColor Green
