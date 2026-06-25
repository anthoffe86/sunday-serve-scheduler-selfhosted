
## Reset Live (production) data — keep admin only

You currently have this in **Live**:

- 23 user profiles (1 admin, 22 volunteers)
- 12 events, 67 event assignments, 57 event roles
- 4 event templates (+ 14 template roles)
- 52 availability records, 5 swap requests, 61 role preferences
- 23 invite tokens, 1 family group, 6 system settings

**Test will not be touched** — all your volunteers, events, and other data there stay exactly as they are. Lovable Cloud keeps Test and Live as fully separate databases, so wiping Live has no effect on Test.

### What will be kept in Live

- The admin user **anthoffe@gmail.com** (and their `profiles` row + `admin` role)
- The 6 rows in **system_settings** (your email/global config — these are project setup, not test data)

### What will be deleted in Live

- All other 22 auth users (volunteers, including the dev/test Resend accounts and `robyn.hoffe@gmail.com`)
- Everything in: `events`, `event_assignments`, `event_roles`, `event_templates`, `event_template_roles`, `assignments`, `availability`, `swap_requests`, `service_history`, `role_preferences`, `invite_tokens`, `family_groups`, `sunday_services`

Note: deleting an auth user automatically removes their `profiles` row, `user_roles` row, and anything else keyed off their user id. But I'll still clear the content tables explicitly so nothing orphaned is left behind.

### How this will run

Lovable's tooling can only write to the Test database. To make changes in Live, **you** need to run a SQL script via Cloud View → Run SQL with **Live selected**.

Here is the exact script I'll give you to paste and run (single transaction so it's all-or-nothing):

```sql
BEGIN;

-- 1. Wipe content tables (order chosen so FKs are happy even if cascades aren't set)
DELETE FROM public.swap_requests;
DELETE FROM public.service_history;
DELETE FROM public.availability;
DELETE FROM public.role_preferences;
DELETE FROM public.assignments;
DELETE FROM public.event_assignments;
DELETE FROM public.event_roles;
DELETE FROM public.events;
DELETE FROM public.event_template_roles;
DELETE FROM public.event_templates;
DELETE FROM public.sunday_services;
DELETE FROM public.invite_tokens;
DELETE FROM public.family_groups;

-- 2. Remove every auth user except the admin.
--    This cascades into profiles + user_roles automatically.
DELETE FROM auth.users
WHERE id <> '0020dbbd-c70d-4cf4-98cd-34ac7d6c1b44';

COMMIT;
```

After it runs, only your admin login will exist in Live and the app will be a clean slate ready for real users.

### Confirm before I finalise

1. **Admin to keep**: `anthoffe@gmail.com` — correct? If you want to also keep `robyn.hoffe@gmail.com` or anyone else, tell me and I'll add their ids to the WHERE clause.
2. **system_settings**: I'm leaving these as-is (your email notification toggles etc.). Say the word if you want those reset to defaults too.
3. **Test**: untouched. Confirm you don't want me to mirror any of this there.

Once you confirm, I'll hand you the final script to paste into Cloud View → Run SQL (Live).
