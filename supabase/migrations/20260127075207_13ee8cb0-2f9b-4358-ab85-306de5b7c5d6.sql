-- Allow invited/assigned volunteers to see the event row they are attached to.
-- This fixes Invitations page where assignments are visible but related events are blocked by RLS.

-- Ensure RLS is enabled (safe if already enabled)
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

-- Policy: volunteers can read events they are assigned/invited to
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'events'
      AND policyname = 'Volunteers can view events they are assigned to'
  ) THEN
    CREATE POLICY "Volunteers can view events they are assigned to"
    ON public.events
    FOR SELECT
    USING (
      EXISTS (
        SELECT 1
        FROM public.event_assignments ea
        WHERE ea.event_id = events.id
          AND ea.volunteer_id = auth.uid()
      )
    );
  END IF;
END $$;