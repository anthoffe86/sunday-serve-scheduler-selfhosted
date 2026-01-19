# deploy-functions.ps1
# This script deploys all Supabase Edge Functions in the project.

$functionsPath = "supabase/functions"
$functions = Get-ChildItem -Path $functionsPath -Directory

Write-Host "Starting deployment of Supabase Edge Functions..." -ForegroundColor Cyan

foreach ($function in $functions) {
    $name = $function.Name
    Write-Host "Deploying function: $name..." -ForegroundColor Yellow
    
    # We use npx to ensure the command is found even if not installed globally
    npx supabase functions deploy $name
}

Write-Host "Finished deployment of all functions!" -ForegroundColor Green
