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

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/features/custom-domain#custom-domain)
