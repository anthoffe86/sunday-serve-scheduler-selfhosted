

## Mobile responsiveness review — plan

After scanning all pages and key shared components at the 393px viewport, the desktop layouts are solid. Most pages are *mostly* responsive, but there are a handful of consistent rough edges on small screens. I'll fix each one without changing any desktop styles or behavior — every change is gated behind the default (mobile-first) styles or replaces a fixed value with a small-screen variant only.

### Issues found and fixes

**1. Page H1 titles overflow / look oversized on phones (multiple pages)**
Pages that hard-code `text-3xl` for the page title squeeze badly at 360–393px (Profile, Schedule, Admin Schedule, Admin Events, Admin Volunteers, Swaps, Invitations, Availability, Admin Settings/Dashboard already fixed).
Fix: change `text-3xl` → `text-2xl sm:text-3xl` on:
- `src/pages/Profile.tsx`
- `src/pages/Schedule.tsx`
- `src/pages/Swaps.tsx`
- `src/pages/Invitations.tsx`
- `src/pages/Availability.tsx`
- `src/pages/admin/Schedule.tsx`
- `src/pages/admin/Events.tsx`
- `src/pages/admin/VolunteerManagement.tsx`
- `src/pages/admin/SwapManagement.tsx`
- `src/pages/admin/EventDetail.tsx`

**2. Invitations card row — meta line overflows on mobile**
`src/pages/Invitations.tsx` shows `event name • time • role badge` on one horizontal flex row with `gap-3`, no wrap, and Accept/Decline buttons next to it. On phones this overflows the card and the role badge gets clipped.
Fix: 
- Change the meta `flex` to `flex flex-wrap items-center gap-2` and remove the `•` text separators (use spacing instead).
- Make Accept/Decline buttons `flex-1 sm:flex-initial` so they fill the row on mobile and sit inline on desktop (button row is already `flex gap-2`, parent already stacks via `flex-col sm:flex-row`).

**3. Admin Volunteers — "Stats" row & VolunteerCard right side overflow on narrow screens**
`src/pages/admin/VolunteerManagement.tsx`:
- The stats row (`Total / Active / Inactive`) uses `flex gap-4` with no wrap; can crowd at 320px.
- `VolunteerCard` right-hand side (`Preferred Roles`, `Times Served`, dropdown) uses `flex-wrap` but the "Preferred Roles" block sets `flex-1 sm:text-right` — on mobile it goes to left-align (good), but the badges + initials avatar combined still feel cramped.
Fix:
- Stats row: add `flex-wrap`.
- VolunteerCard: add `min-w-0` to the name container so long emails don't push layout; ensure the right-side block on mobile is `w-full` (it already stacks via parent `flex-col sm:flex-row` — verify spacing).

**4. Dashboard / Schedule list cards — date block can crowd content on 320px**
The `min-w-[72px]` date block + `p-4` content fits at 393px but is tight at 320px. Already has `px-3 sm:px-4` in Dashboard but not in Schedule and Swaps.
Fix: in `src/pages/Schedule.tsx`, `src/pages/Swaps.tsx`, and `src/pages/admin/Schedule.tsx` list cards, change date block `px-4 py-4 min-w-[72px]` → `px-3 sm:px-4 py-4 min-w-[64px] sm:min-w-[72px]`, and content `p-4` → `p-3 sm:p-4`. Adds `min-w-0` to the content container so the event title can truncate instead of overflow.

**5. Admin Schedule — "Schedule" header buttons (Export + Manage Events) wrap awkwardly**
On mobile the two buttons sit on one row labelled with text only. The `Export` button content is wide.
Fix: Already stacks below the title (`flex-col sm:flex-row` on header). Add `flex-wrap` to the inner button group and `flex-1 sm:flex-initial` to keep them tappable on phone.

**6. Admin Schedule — bulk actions bar overflows on mobile**
The bar is `flex items-center gap-3` with Select All button + counter + spacer + Clear + Delete; on phones the Delete button gets cut off.
Fix: add `flex-wrap` to the bar container.

**7. Admin EventDetail — header action row (Auto Assign / Edit / Delete)**
Buttons already wrap (`flex flex-wrap gap-2`), but the page H1 + buttons row is `flex-col sm:flex-row sm:items-start` — currently fine. Just apply the H1 size fix from #1.

**8. AppHeader — admin badge & user button**
Admin badge is `hidden md:flex` (good). User dropdown trigger has `pl-2 pr-3` which is fine. No change needed.

**9. Profile page — role preferences "Add roles" grid**
Already `grid gap-2 sm:grid-cols-2` (good). The selected-preferences row has 3 small icon buttons (↑↓×) which already work. No change.

**10. Auth / ForgotPassword / ResetPassword / InviteSignup**
Cards center with `max-w-md` and stack naturally — these already work on mobile. No change.

**11. Tables (`ScheduleTableView`, `VolunteerScheduleTableView`)**
Already wrapped in `overflow-x-auto` and hide non-essential columns at md/lg breakpoints. Plus they're explicitly `hidden md:block` in their parent pages with a list view fallback for mobile. No change.

### Out of scope (not changing)
- Desktop layouts at md/lg/xl breakpoints
- Any business logic, data fetching, or component behavior
- The Landing page (already responsive)
- Dialogs (shadcn dialogs are responsive by default)

### Files to edit
- `src/pages/Profile.tsx`
- `src/pages/Schedule.tsx`
- `src/pages/Swaps.tsx`
- `src/pages/Invitations.tsx`
- `src/pages/Availability.tsx`
- `src/pages/admin/Schedule.tsx`
- `src/pages/admin/Events.tsx`
- `src/pages/admin/EventDetail.tsx`
- `src/pages/admin/VolunteerManagement.tsx`
- `src/pages/admin/SwapManagement.tsx`

All changes are CSS-class-only (Tailwind utilities) — no logic touched, no desktop changes.

