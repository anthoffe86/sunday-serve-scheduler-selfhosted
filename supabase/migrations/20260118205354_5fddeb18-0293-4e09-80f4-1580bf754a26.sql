-- Update event_assignments SELECT policy to allow viewing assignments for published events
-- This is needed so users can see swap request details for assignments they might accept

DROP POLICY IF EXISTS "Users can view their own and published assignments" ON public.event_assignments;

CREATE POLICY "Users can view assignments for published events" 
ON public.event_assignments 
FOR SELECT 
USING (
  volunteer_id = auth.uid() 
  OR is_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.events e 
    WHERE e.id = event_id 
    AND e.status = 'published'
  )
);