# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

React 18 + Vite + TypeScript + shadcn-ui + Tailwind CSS. Backend: Supabase (PostgreSQL with RLS, Edge Functions, Auth) on a single multi-tenant instance. Email delivery via Resend. Deployed on Netlify (SPA with client-side routing). Two Supabase project environments: non-prod (development/testing) and prod (live customer data).

## Users

**Volunteers** — members of a church, charity, or community organisation who serve in defined roles (e.g. sidesman, reader, intercessions, collection). They use ServeTogether on their phone or desktop to check their upcoming schedule, mark unavailable dates, respond to invitations in one tap, request swaps, and subscribe their personal rota to their device calendar. They do not want admin complexity; they want clarity.

**Coordinators / Organisation Admins** — the person responsible for building and publishing the rota each week. They manage volunteers, define events from templates, run the auto-scheduler, send invitation emails, monitor schedule confidence, approve or intervene in swaps, and export rotas for printing. Time saved and confidence that nothing falls through the cracks are their success metrics.

**Super Admins** — the platform operator (currently the developer). They provision and manage organisations, add users across orgs, and handle support escalations from a single admin surface.

## Product Purpose

ServeTogether replaces spreadsheets and manual coordination for volunteer-led organisations running recurring rotas. It auto-schedules based on recorded availability and role preferences, notifies volunteers automatically, lets them manage swaps peer-to-peer, and gives coordinators a live confidence score so they always know what needs attention before publish day.

Success means: a coordinator can go from a blank week to a published, emailed rota in minutes rather than hours, with zero chase-up messages sent manually.

## Positioning

The only volunteer rota tool that auto-builds a fair, balanced schedule — respecting every person's recorded availability and role preferences — and then handles swaps, confirmations, and notifications without the coordinator lifting a finger. Neighbouring tools either require manual scheduling or lack the invite-only access control and per-organisation isolation that churches require.

## Operating Context

- Primarily weekly Sunday church services, also fortnightly and monthly patterns
- Roles typically per service: sidesman (standard, sound, welcome), reader, intercessions, collection — quantities vary per event template
- Coordinators plan 4–12 weeks ahead; volunteers record unavailability up to 2 years ahead
- Volunteers respond to email invitations; many will never log in beyond their first setup
- Organisations are onboarded by the platform operator with custom branding, roles, and templates configured from day one — no self-service signup
- Volunteers must not see other volunteers' personal data; admins see only their own organisation

## Capabilities and Constraints

- **Multi-tenant SaaS**: one Supabase instance, row-level security isolates organisations
- **Invite-only access**: single-use expiring tokens; no public registration
- **Draft → Publish workflow**: events stay private until admin publishes and triggers notifications
- **Auto-scheduler**: fills roles while respecting availability exceptions, role preferences, and family groupings
- **Two-stage swap system**: volunteer requests swap → eligible peers offer → requester chooses; admin can override at any point
- **Email notifications**: invitations, swap events, publish, assignment changes — toggleable per org
- **iCal calendar feed**: secure per-volunteer token, rotatable, subscribes in Apple/Google/Outlook
- **Print export**: polished rota export, declined volunteers excluded automatically
- **Admin override**: admins can assign anyone, with visual indicator when preferences/availability are overridden
- **Undecided**: pricing model not yet public; onboarding is currently operator-managed

## Brand Commitments

- Name: **ServeTogether**
- Logo: `src/assets/servetogether-logo.png` — must be preserved in all layouts
- Primary colour: sage green (HSL 150 25% 35%) — conveys trust, calm, community
- Background: warm cream (HSL 40 33% 98%)
- Accent: soft amber (HSL 35 80% 55%)
- Heading typeface: Lora (serif) — warmth, readability, church-appropriate
- Body typeface: Nunito Sans (sans-serif)
- Tone: warm, practical, trustworthy; avoids corporate coldness and religious exclusivity; speaks to coordinators and volunteers equally

## Evidence on Hand

- Logo: `src/assets/servetogether-logo.png`
- UI mockups: `src/assets/mockup-schedule.svg`, `src/assets/mockup-dashboard.svg`, `src/assets/mockup-swaps.svg`
- No testimonials, customer case studies, press, or benchmarks in the codebase — must not be fabricated in design work

## Product Principles

1. **Time is sacred.** Every screen should save the coordinator time, not add steps. If a human can be removed from a loop, remove them.
2. **Volunteers come first.** The rota exists to serve the mission; the product exists to serve the volunteers. Clarity, dignity, and minimal friction for people who serve for free.
3. **Trust through transparency.** Coordinators must always know who is confirmed, who is pending, and what needs attention. Ambiguity erodes confidence in the rota.
4. **Community, not software.** The product should feel like it belongs to the organisation — warm, branded, personal — not like enterprise SaaS dropped on a church hall laptop.
5. **Privacy is non-negotiable.** Invite-only access, RLS isolation, and rotatable tokens are product commitments, not implementation details.

## Accessibility & Inclusion

WCAG 2.1 AA. Mobile-first in practice — many volunteers respond to invitations and check schedules exclusively on their phones.
