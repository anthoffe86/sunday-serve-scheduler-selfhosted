# Welcome to your Lovable project

## Project info

**URL**: https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID) and click on Share -> Publish.

### Deploying on Netlify

This project is a Vite + React single-page app using client-side routes (for example `/schedule` and `/admin/*`).
To avoid `Page Not Found` on direct URL access and browser refresh, Netlify must rewrite unknown routes to `index.html`.

This repo includes both:

- `netlify.toml` with build/publish settings and a catch-all SPA redirect.
- `public/_redirects` with `/* /index.html 200` (copied into `dist/` during build).

Netlify settings to verify:

- Base directory: empty (repo root)
- Build command: `npm run build`
- Publish directory: `dist`

## Supabase email setup

The Supabase edge functions that send invitations and volunteer emails require a Resend API key in production.

Set these secrets in your Supabase project before deploying the functions:

```sh
supabase secrets set RESEND_API_KEY=your_resend_api_key
supabase secrets set RESEND_FROM_EMAIL="Your Org <noreply@your-verified-domain.com>"
```

If `RESEND_FROM_EMAIL` is not set, the functions fall back to `St Matthews Church <noreply@updates.servetogether.co.uk>`.

## Password reset setup

Password reset emails are sent via Resend, **not** by Supabase's built-in mailer. This is deliberate:
Supabase's own recovery emails build their link from the project's *Site URL*, which produces
`localhost` links on any project that was first set up locally.

There are two entry points, both sharing `supabase/functions/_shared/password-reset.ts`:

| Entry point | Function | Who can trigger it |
| --- | --- | --- |
| **Forgot password?** on the sign-in page | `send-password-reset` | Anyone (unauthenticated, throttled) |
| **Send Reset Email** in Super Admin → Users, and the volunteer edit dialog's Account tab | `admin-user-management`, `reset-password` action | Super admins only |

Both send the same branded email to the **account holder**, and both need the secrets below. The
admin path deliberately does not hand the link back to the caller: a recovery link is a bearer
credential for that account, so emailing it leaves a trail rather than allowing a silent takeover.
This replaces the old "copy reset link to clipboard" behaviour, whose links pointed at `localhost`
anyway.

Required secrets, per Supabase project:

```sh
# The public URL of the site this project serves (no trailing slash).
supabase secrets set APP_BASE_URL="https://your-site.example.com"

# Already required by the other email functions.
supabase secrets set RESEND_API_KEY=your_resend_api_key
```

Optional — additional origins that are allowed to receive reset links, comma separated. Use this for
Netlify deploy previews or a staging host:

```sh
supabase secrets set ALLOWED_APP_ORIGINS="https://staging.example.com,http://localhost:8080"
```

The browser sends its own origin with the request, but the function only honours it when it is in
this allow-list. Anything else falls back to `APP_BASE_URL`. That check is what stops someone
requesting a reset for another person's address with a link pointing at a site they control.

Notes:

- The reset link expires after **1 hour** by default. This follows the project's
  *Authentication → Emails → Email OTP expiration* setting in the Supabase dashboard; change it there
  if you want a different window.
- The public endpoint is throttled to 3 requests per email address per 15 minutes and 10 per IP per
  hour, recorded in `public.password_reset_attempts` (HMAC-hashed, auto-purged after 24 hours).
  Requires the `20260729120000_password_reset_rate_limit.sql` migration. The super-admin path is not
  throttled — the caller is already authenticated and privileged.
- The public endpoint always responds with success whether or not the address is registered, so it
  cannot be used to discover which volunteers have accounts. The super-admin path returns a precise
  "no account found" instead, since that caller can already see the user list.
- Because reset links no longer go through Supabase's Site URL, that dashboard setting does not affect
  this flow. It is still worth pointing Site URL at the production site for any other auth emails.

## Two-project Supabase workflow (free tier)

This repository is designed to work with two Supabase projects:

- Production project: real customer data only
- Non-production project: all development and testing

### 1) Frontend environment setup

Copy the templates and fill in your project values:

```sh
cp .env.development.example .env.development
cp .env.production.example .env.production
```

For normal local development, run:

```sh
npm run dev
```

This should use `.env.development` so local work targets the non-production Supabase project.

### 2) Function deployment setup

Set these environment variables on your machine or CI runner before deploying functions:

```sh
SUPABASE_ACCESS_TOKEN=your_cli_access_token
SUPABASE_PROJECT_REF_NONPROD=your_nonprod_project_ref
SUPABASE_PROJECT_REF_PROD=your_prod_project_ref
```

Deploy to non-production:

```sh
npm run deploy:functions:nonprod
```

Deploy to production:

```sh
npm run deploy:functions:prod
```

Production deploy requires typing `DEPLOY_PROD` to confirm.

If CLI reports an invalid access token format, authenticate with a Supabase Personal Access Token first:

```sh
supabase login
```

The token must be an `sbp_...` token from Supabase account settings.

### 3) Migration promotion flow

1. Create and test migrations in non-production first.
2. Validate key user flows against the non-production project.
3. Apply the same migration files to production.
4. Do not seed production with test/demo data.

Use explicit commands:

```sh
npm run deploy:migrations:nonprod
npm run deploy:migrations:prod
```

Production migration deploy requires typing `DEPLOY_PROD` to confirm.

### 4) Safety preflight checks

Run these before deployments:

```sh
npm run preflight:nonprod
npm run preflight:prod
```

These checks verify project refs are different, required variables exist, and local env files are not accidentally pointing non-production workflows at production.

### 5) One-command production release runner

Use this guided sequence for production backend promotion:

```sh
npm run release:prod
```

What it does:

1. Prompts for a master `RELEASE_PROD` confirmation
2. Runs production preflight checks
3. Deploys production migrations
4. Deploys production edge functions

Optional flags (run script directly):

```sh
powershell -ExecutionPolicy Bypass -File ./scripts/release-prod.ps1 -SkipMigrations
powershell -ExecutionPolicy Bypass -File ./scripts/release-prod.ps1 -SkipFunctions
powershell -ExecutionPolicy Bypass -File ./scripts/release-prod.ps1 -NoPause
```

### 6) Website release guardrails

Use branch protection on `main` so production site builds only from reviewed merges:

1. Require pull requests for `main`
2. Require status checks before merge
3. Block direct pushes to `main`

Feature branch commits can still be used for development, while `main` remains your production release branch.

### 7) Branch protection setup (GitHub)

1. Open repository settings in GitHub.
2. Go to Branches -> Branch protection rules.
3. Add a rule for `main`.
4. Enable:
	- Require a pull request before merging
	- Require approvals (at least 1)
	- Require status checks to pass before merging
	- Restrict who can push to matching branches (optional but recommended)
	- Do not allow bypassing the above settings
5. Save rule.

### 8) Production branch setup (Netlify)

1. Open Netlify site settings.
2. Go to Build & deploy -> Continuous Deployment -> Branches.
3. Set production branch to `main`.
4. Ensure deploy previews are enabled for non-main pull requests.

This gives you a safe split:

- feature branches: preview/test behavior
- main branch: production website deploy

### 9) Branch management quick guide

Detailed guide: see `docs/BRANCHING_STRATEGY.md`

Release checklist: see `docs/RELEASE_CHECKLIST.md`

### 10) Granting an admin user in non-production

After the user has signed up in non-production, grant admin role by email:

```sh
npm run grant:admin:nonprod -- -Email "admin@example.com"
```

For production (explicit confirmation required):

```sh
npm run grant:admin:prod -- -Email "admin@example.com"
```

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/features/custom-domain#custom-domain)
