
-- 1) event_assignments: drop anon/public-via-published-event SELECT branch
DROP POLICY IF EXISTS "Users can view assignments for published events or their own" ON public.event_assignments;
CREATE POLICY "Volunteers see own assignments, admins see all"
ON public.event_assignments
FOR SELECT
TO authenticated
USING (volunteer_id = auth.uid() OR public.is_admin(auth.uid()));

-- 2) profiles: restrict SELECT and hide calendar_feed_token from clients
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;
CREATE POLICY "View own, admin all, co-assignees on shared events"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR public.is_admin(auth.uid())
  OR EXISTS (
    SELECT 1
    FROM public.event_assignments ea_self
    JOIN public.event_assignments ea_other
      ON ea_other.event_id = ea_self.event_id
    WHERE ea_self.volunteer_id = auth.uid()
      AND ea_other.volunteer_id = profiles.user_id
  )
);

REVOKE SELECT (calendar_feed_token) ON public.profiles FROM anon, authenticated, PUBLIC;

-- 3) availability: only owner or admin can read (notes no longer public)
DROP POLICY IF EXISTS "Users can view all availability" ON public.availability;
CREATE POLICY "View own availability or admin"
ON public.availability
FOR SELECT
TO authenticated
USING (user_id = auth.uid() OR public.is_admin(auth.uid()));

-- 4) service_history: only owner or admin can read
DROP POLICY IF EXISTS "Users can view all service history" ON public.service_history;
CREATE POLICY "View own service history or admin"
ON public.service_history
FOR SELECT
TO authenticated
USING (user_id = auth.uid() OR public.is_admin(auth.uid()));

-- 5) SECURITY DEFINER functions: revoke from anon and authenticated.
--    is_event_published is no longer referenced by any policy (removed above),
--    and handle_new_user is invoked by trigger as table owner.
REVOKE EXECUTE ON FUNCTION public.is_event_published(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
