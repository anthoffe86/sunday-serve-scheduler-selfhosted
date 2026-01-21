-- Fix the security definer view issue by dropping and recreating with SECURITY INVOKER
DROP VIEW IF EXISTS public.event_assignments_safe;

-- Create view with SECURITY INVOKER (the default, but being explicit)
CREATE VIEW public.event_assignments_safe 
WITH (security_invoker = true)
AS
SELECT 
  id,
  created_at,
  event_id,
  role,
  volunteer_id,
  updated_at,
  status,
  invited_at,
  responded_at,
  decline_reason,
  -- Only show invitation_token to the volunteer themselves or admins
  CASE 
    WHEN volunteer_id = auth.uid() OR is_admin(auth.uid()) 
    THEN invitation_token 
    ELSE NULL 
  END AS invitation_token
FROM public.event_assignments;

-- Grant access to the view
GRANT SELECT ON public.event_assignments_safe TO authenticated;
GRANT SELECT ON public.event_assignments_safe TO anon;