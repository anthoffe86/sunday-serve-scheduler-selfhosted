-- Drop the existing SELECT policy
DROP POLICY IF EXISTS "Users can view assignments for published events" ON public.event_assignments;

-- Create updated policy that allows volunteers to see their own invited assignments regardless of event status
CREATE POLICY "Users can view assignments for published events or their own" 
ON public.event_assignments 
FOR SELECT 
USING (
  (volunteer_id = auth.uid()) 
  OR is_admin(auth.uid()) 
  OR (EXISTS ( 
    SELECT 1
    FROM events e
    WHERE ((e.id = event_assignments.event_id) AND (e.status = 'published'))
  ))
);