# grant-admin-role.ps1
# Grant admin role to an existing auth user in a target Supabase environment.

param(
    [Parameter(Mandatory = $false)]
    [ValidateSet("nonprod", "prod")]
    [string]$Environment = "nonprod",

    [Parameter(Mandatory = $true)]
    [string]$Email,

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
        $confirmation = Read-Host "Type 'DEPLOY_PROD' to confirm granting admin in PRODUCTION ($ProdProjectRef)"
        if ($confirmation -ne "DEPLOY_PROD") {
            throw "Production admin grant cancelled."
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

# Run guardrail checks first.
& "$PSScriptRoot/preflight-supabase.ps1" -Environment $Environment -NonProdProjectRef $NonProdProjectRef -ProdProjectRef $ProdProjectRef
if (-not $?) {
    throw "Preflight checks failed."
}

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

$escapedEmail = $Email.Replace("'", "''")

$sql = @"
INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'admin'::public.app_role
FROM auth.users u
WHERE lower(u.email) = lower('$escapedEmail')
ON CONFLICT (user_id, role) DO NOTHING;

SELECT u.id AS user_id, u.email,
    EXISTS (
        SELECT 1
        FROM public.user_roles r
        WHERE r.user_id = u.id
            AND r.role = 'admin'
    ) AS is_admin
FROM auth.users u
WHERE lower(u.email) = lower('$escapedEmail');
"@

Write-Host "Granting admin role for $Email in '$Environment' ($projectRef)..." -ForegroundColor Cyan
$tempSqlFile = Join-Path $env:TEMP ("grant-admin-" + [Guid]::NewGuid().ToString("N") + ".sql")
try {
    Set-Content -Path $tempSqlFile -Value $sql -Encoding utf8
    npx supabase db query --linked --file "$tempSqlFile"
}
finally {
    if (Test-Path -Path $tempSqlFile) {
        Remove-Item -Path $tempSqlFile -Force -ErrorAction SilentlyContinue
    }
}

if ($LASTEXITCODE -ne 0) {
    throw "Failed to grant admin role for '$Email'."
}

Write-Host "Admin role grant completed for $Email." -ForegroundColor Green
