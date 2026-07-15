# grant-admin-role.ps1
# Grant admin role to an existing auth user in a target Supabase environment.

param(
    [Parameter(Mandatory = $false)]
    [ValidateSet("nonprod", "prod")]
    [string]$Environment = "nonprod",

    [Parameter(Mandatory = $true)]
    [string]$Email,

    [Parameter(Mandatory = $false)]
    [string]$OrgName = "St Matthew's Church",

    [Parameter(Mandatory = $false)]
    [string]$OrgSlug = "",

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
$escapedOrgName = $OrgName.Replace("'", "''")
$escapedOrgSlug = $OrgSlug.Replace("'", "''")

$sql = @"
INSERT INTO public.profiles (user_id, name, email, active, org_id)
SELECT
    u.id,
    COALESCE(p.name, u.raw_user_meta_data ->> 'name', split_part(u.email, '@', 1)),
    lower(u.email),
    true,
    o.id
FROM auth.users u
JOIN public.organisations o
    ON (
        (NULLIF('$escapedOrgSlug', '') IS NOT NULL AND lower(o.slug) = lower('$escapedOrgSlug'))
        OR (NULLIF('$escapedOrgSlug', '') IS NULL AND lower(o.name) = lower('$escapedOrgName'))
    )
LEFT JOIN public.profiles p
    ON p.user_id = u.id
WHERE lower(u.email) = lower('$escapedEmail')
ON CONFLICT (user_id)
DO UPDATE SET
    name = COALESCE(public.profiles.name, EXCLUDED.name),
    email = EXCLUDED.email,
    active = true,
    org_id = EXCLUDED.org_id,
    updated_at = now();

UPDATE public.role_preferences
SET org_id = (
    SELECT o.id
    FROM public.organisations o
    WHERE (
        (NULLIF('$escapedOrgSlug', '') IS NOT NULL AND lower(o.slug) = lower('$escapedOrgSlug'))
        OR (NULLIF('$escapedOrgSlug', '') IS NULL AND lower(o.name) = lower('$escapedOrgName'))
    )
    LIMIT 1
)
WHERE user_id = (
    SELECT u.id
    FROM auth.users u
    WHERE lower(u.email) = lower('$escapedEmail')
    LIMIT 1
);

UPDATE public.availability
SET org_id = (
    SELECT o.id
    FROM public.organisations o
    WHERE (
        (NULLIF('$escapedOrgSlug', '') IS NOT NULL AND lower(o.slug) = lower('$escapedOrgSlug'))
        OR (NULLIF('$escapedOrgSlug', '') IS NULL AND lower(o.name) = lower('$escapedOrgName'))
    )
    LIMIT 1
)
WHERE user_id = (
    SELECT u.id
    FROM auth.users u
    WHERE lower(u.email) = lower('$escapedEmail')
    LIMIT 1
);

UPDATE public.service_history
SET org_id = (
    SELECT o.id
    FROM public.organisations o
    WHERE (
        (NULLIF('$escapedOrgSlug', '') IS NOT NULL AND lower(o.slug) = lower('$escapedOrgSlug'))
        OR (NULLIF('$escapedOrgSlug', '') IS NULL AND lower(o.name) = lower('$escapedOrgName'))
    )
    LIMIT 1
)
WHERE user_id = (
    SELECT u.id
    FROM auth.users u
    WHERE lower(u.email) = lower('$escapedEmail')
    LIMIT 1
);

DELETE FROM public.user_roles
WHERE user_id = (
    SELECT u.id
    FROM auth.users u
    WHERE lower(u.email) = lower('$escapedEmail')
    LIMIT 1
)
  AND role IN ('volunteer', 'admin');

INSERT INTO public.user_roles (user_id, role, org_id)
SELECT u.id, 'admin'::public.app_role, o.id
FROM auth.users u
JOIN public.organisations o
    ON (
        (NULLIF('$escapedOrgSlug', '') IS NOT NULL AND lower(o.slug) = lower('$escapedOrgSlug'))
        OR (NULLIF('$escapedOrgSlug', '') IS NULL AND lower(o.name) = lower('$escapedOrgName'))
    )
WHERE lower(u.email) = lower('$escapedEmail')
ON CONFLICT (user_id, role) DO UPDATE
SET org_id = EXCLUDED.org_id;

SELECT u.id AS user_id,
       lower(u.email) AS email,
       p.org_id,
       o.name AS organisation_name,
       r.role
FROM auth.users u
JOIN public.profiles p ON p.user_id = u.id
JOIN public.user_roles r ON r.user_id = u.id
LEFT JOIN public.organisations o ON o.id = p.org_id
WHERE lower(u.email) = lower('$escapedEmail')
  AND r.role IN ('admin', 'super_admin');
"@

Write-Host "Granting admin role for $Email in '$Environment' ($projectRef)..." -ForegroundColor Cyan
$tempSqlFile = Join-Path $env:TEMP ("grant-admin-" + [Guid]::NewGuid().ToString("N") + ".sql")
try {
    Set-Content -Path $tempSqlFile -Value $sql -Encoding utf8
    $queryOutput = npx supabase db query --linked --file "$tempSqlFile" | Out-String
    Write-Host $queryOutput
}
finally {
    if (Test-Path -Path $tempSqlFile) {
        Remove-Item -Path $tempSqlFile -Force -ErrorAction SilentlyContinue
    }
}

if ($LASTEXITCODE -ne 0) {
    throw "Failed to grant admin role for '$Email'."
}

if ($queryOutput -match '"rows"\s*:\s*\[\s*\]') {
    throw "No admin assignment row was returned for '$Email'. Verify the user exists in the target environment and the organisation name or slug is correct."
}

Write-Host "Admin role grant completed for $Email." -ForegroundColor Green
