# Release Checklist

Use this checklist for every production release.

## 1) Pre-merge checks (feature branch)

- [ ] Local app points to non-production Supabase project
- [ ] Migrations validated in non-production (if applicable)
- [ ] Edge functions deployed and tested in non-production (if applicable)
- [ ] Core flows tested: auth, schedule, swaps, invitations
- [ ] PR approved and all required checks pass

## 2) Production promotion checks

- [ ] Preferred path: run `npm run release:prod`
- [ ] Run `npm run preflight:prod`
- [ ] Run `npm run deploy:migrations:prod` if schema changed
- [ ] Run `npm run deploy:functions:prod` if edge functions changed
- [ ] Confirm no test/demo seed command was run for production

## 3) Website deploy checks

- [ ] Change merged to `main`
- [ ] Production site build completed successfully
- [ ] Smoke test production pages and core actions

## 4) Rollback prep

- [ ] Identify rollback commit/PR
- [ ] Prepare emergency hotfix branch if needed
- [ ] Confirm owner for incident response
