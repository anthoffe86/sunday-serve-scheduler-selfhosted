# Branching Strategy (One Repo, Production on main)

This project uses one repository with strict branch controls.

## Branch roles

- `main`: production release branch only
- `feature/*`: day-to-day development and fixes
- `hotfix/*`: urgent production fixes

## Rules

1. Do not commit directly to `main`.
2. Open a pull request from `feature/*` or `hotfix/*` into `main`.
3. Merge to `main` only when non-production validation is complete.
4. Production website builds are allowed only from `main`.

## Daily workflow

1. Create branch from latest main:
   - `git checkout main`
   - `git pull`
   - `git checkout -b feature/your-change`
2. Develop and test against non-production Supabase project.
3. Run preflight checks and deploy to non-production:
   - `npm run preflight:nonprod`
   - `npm run deploy:migrations:nonprod` (if schema changed)
   - `npm run deploy:functions:nonprod` (if edge functions changed)
4. Run application checks and smoke tests locally.
5. Open PR to `main`.
6. After PR approval and checks pass, merge to `main`.
7. Perform production promotion steps:
   - `npm run preflight:prod`
   - `npm run deploy:migrations:prod` (if schema changed)
   - `npm run deploy:functions:prod` (if edge functions changed)
8. Confirm production website build from `main` is successful.

## Hotfix workflow

1. Create `hotfix/*` from `main`.
2. Make the minimum change required.
3. Validate quickly on non-production where possible.
4. PR into `main`.
5. Merge and run production promotion commands.

## Why this works

- Keeps one codebase while protecting production deploys.
- Ensures schema and function changes are tested before production.
- Prevents test data from entering production by separating migration promotion from seed/test workflows.
