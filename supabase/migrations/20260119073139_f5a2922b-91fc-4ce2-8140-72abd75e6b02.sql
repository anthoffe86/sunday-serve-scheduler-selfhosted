-- Fix: Replace overly permissive RLS policy with admin-only policy
-- Swap acceptance is securely handled by the accept-swap-request edge function
-- which uses service role (bypasses RLS) and has proper validation

DROP POLICY IF EXISTS "Admins and swap acceptors can update assignments" ON public.event_assignments;
DROP POLICY IF EXISTS "Only admins can update assignments" ON public.event_assignments;

CREATE POLICY "Only admins can update assignments" 
ON public.event_assignments 
FOR UPDATE 
USING (is_admin(auth.uid()));