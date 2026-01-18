-- Update event_assignments policy to allow swap acceptance
-- Users can update an assignment if they are accepting a pending swap request for it

DROP POLICY IF EXISTS "Only admins can update assignments" ON public.event_assignments;

CREATE POLICY "Admins and swap acceptors can update assignments" 
ON public.event_assignments 
FOR UPDATE 
USING (
  is_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.swap_requests sr
    WHERE sr.event_assignment_id = id
    AND sr.status = 'pending'
    AND sr.to_user_id IS NULL
  )
);