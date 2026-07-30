-- Make permanent user deletion safe at the database level.
--
-- event_assignments.volunteer_id and event_templates.created_by were declared as bare
-- "REFERENCES auth.users(id)" with no ON DELETE clause, so Postgres defaults them to NO ACTION.
-- Any attempt to delete an auth.users row for someone who has ever been assigned to an event, or
-- who authored an event template, raises a foreign key violation. The admin-user-management
-- "delete-user-permanently" action clears both explicitly before deleting the auth user, but these
-- constraints are the backstop if that ordering is ever changed or a concurrent write slips in.

ALTER TABLE public.event_assignments
DROP CONSTRAINT IF EXISTS event_assignments_volunteer_id_fkey;

ALTER TABLE public.event_assignments
ADD CONSTRAINT event_assignments_volunteer_id_fkey
FOREIGN KEY (volunteer_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- created_by is nullable and only records provenance, so the template survives its author.
ALTER TABLE public.event_templates
DROP CONSTRAINT IF EXISTS event_templates_created_by_fkey;

ALTER TABLE public.event_templates
ADD CONSTRAINT event_templates_created_by_fkey
FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
