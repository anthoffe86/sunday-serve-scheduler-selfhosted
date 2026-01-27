-- Fix circular RLS dependency between public.event_assignments and public.events
-- event_assignments SELECT policy referenced events, while events SELECT policy can reference event_assignments.
-- This can lead to slow/empty queries due to recursive RLS checks.

-- 1) Helper function that can read event status without triggering RLS recursion
CREATE OR REPLACE FUNCTION public.is_event_published(_event_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.events e
    WHERE e.id = _event_id
      AND e.status = 'published'
  );
$$;

-- 2) Replace the existing policy with a version that calls the helper function
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'event_assignments'
      AND policyname = 'Users can view assignments for published events or their own'
  ) THEN
    DROP POLICY "Users can view assignments for published events or their own" ON public.event_assignments;
  END IF;
END $$;

CREATE POLICY "Users can view assignments for published events or their own"
ON public.event_assignments
FOR SELECT
USING (
  volunteer_id = auth.uid()
  OR is_admin(auth.uid())
  OR public.is_event_published(event_id)
);
