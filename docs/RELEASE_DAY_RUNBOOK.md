# Release Day Runbook (Simple, Repeatable)

This guide is designed for someone with little or no technical background.
Follow the steps in order.

## Before you start

1. Confirm your code changes are finished and tested on your feature branch.
2. Confirm you are NOT on `main` while preparing the release.
3. Confirm you have approval to release.

## Step 1: Open terminal in project folder

Open PowerShell in the project root and run:

```powershell
$env:SUPABASE_PROJECT_REF_NONPROD="sonuenajksrpndzffzzj"
$env:SUPABASE_PROJECT_REF_PROD="yudsjgwfzsmiassafdwr"
Remove-Item Env:SUPABASE_ACCESS_TOKEN -ErrorAction SilentlyContinue
```

## Step 2: Final safety check on test environment

Run:

```powershell
npm run preflight:nonprod
```

If this fails, stop and ask for help before continuing.

## Step 3: Push backend changes to test environment (if needed)

If database changed, run:

```powershell
npm run deploy:migrations:nonprod
```

If edge functions changed, run:

```powershell
npm run deploy:functions:nonprod
```

Then test key flows on non-production:

1. Login and logout
2. Admin dashboard
3. Schedule pages
4. Swap flow
5. Invitation flow

## Step 4: Create pull request to main

1. Push your feature branch.
2. Open a PR into `main`.
3. Wait for checks and approvals.
4. Do not merge yet if production backend steps are not done.

## Step 5: Promote backend to production

Run:

```powershell
npm run release:prod
```

When prompted:

1. Type `RELEASE_PROD`
2. Follow prompts until complete

This runs production backend steps in the correct order:

1. Preflight
2. Migrations
3. Edge functions

## Step 6: Merge PR to main

After Step 5 succeeds:

1. Merge PR to `main`
2. Production frontend deploy starts automatically from `main`

## Step 7: Production smoke test

After deploy:

1. Open production site
2. Check login works
3. Check admin dashboard loads
4. Check schedule page loads
5. Check one action that uses edge functions (invite/swap)

## If something goes wrong

1. Stop changes
2. Revert the PR merge commit
3. Open a hotfix branch if needed
4. Use a forward-fix migration for DB issues unless urgent restore is required

## Admin user setup (non-production)

If you need to grant admin in non-production:

1. Ensure that user already exists in non-production Auth users
2. Run:

```powershell
powershell -ExecutionPolicy Bypass -File ./scripts/grant-admin-role.ps1 -Environment nonprod -Email "admin@example.com"
```

## Golden rules

1. Develop on `feature/*`
2. Release from `main`
3. Test first, then production backend, then merge for production frontend deploy
4. Never run test/demo seed data in production
