-- Isolate super admins from organisation membership and tenant data access.

ALTER TABLE public.profiles ALTER COLUMN org_id DROP NOT NULL;

DO $$
DECLARE
  super_admin_ids UUID[];
BEGIN
  SELECT COALESCE(array_agg(user_id), ARRAY[]::UUID[])
  INTO super_admin_ids
  FROM public.user_roles
  WHERE role = 'super_admin';

  IF cardinality(super_admin_ids) = 0 THEN
    RAISE NOTICE 'No super_admin users found to isolate.';
    RETURN;
  END IF;

  DELETE FROM public.user_roles
  WHERE user_id = ANY(super_admin_ids)
    AND role <> 'super_admin';

  UPDATE public.profiles
  SET org_id = NULL,
      family_group_id = NULL,
      active = false
  WHERE user_id = ANY(super_admin_ids);

  DELETE FROM public.role_preferences
  WHERE user_id = ANY(super_admin_ids);

  DELETE FROM public.availability
  WHERE user_id = ANY(super_admin_ids);

  DELETE FROM public.service_history
  WHERE user_id = ANY(super_admin_ids);

  DELETE FROM public.event_assignments
  WHERE volunteer_id = ANY(super_admin_ids);

  DELETE FROM public.assignments
  WHERE volunteer_id = ANY(super_admin_ids);

  UPDATE public.swap_requests
  SET to_user_id = NULL,
      approved_by = NULL,
      updated_at = now()
  WHERE to_user_id = ANY(super_admin_ids)
     OR approved_by = ANY(super_admin_ids);

  DELETE FROM public.swap_requests
  WHERE from_user_id = ANY(super_admin_ids);
END $$;

DROP POLICY IF EXISTS "family_groups tenant boundary" ON public.family_groups;
CREATE POLICY "family_groups tenant boundary"
  ON public.family_groups
  AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING (org_id = public.current_user_org_id(auth.uid()))
  WITH CHECK (org_id = public.current_user_org_id(auth.uid()));

DROP POLICY IF EXISTS "role_preferences tenant boundary" ON public.role_preferences;
CREATE POLICY "role_preferences tenant boundary"
  ON public.role_preferences
  AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING (org_id = public.current_user_org_id(auth.uid()))
  WITH CHECK (org_id = public.current_user_org_id(auth.uid()));

DROP POLICY IF EXISTS "availability tenant boundary" ON public.availability;
CREATE POLICY "availability tenant boundary"
  ON public.availability
  AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING (org_id = public.current_user_org_id(auth.uid()))
  WITH CHECK (org_id = public.current_user_org_id(auth.uid()));

DROP POLICY IF EXISTS "service_history tenant boundary" ON public.service_history;
CREATE POLICY "service_history tenant boundary"
  ON public.service_history
  AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING (org_id = public.current_user_org_id(auth.uid()))
  WITH CHECK (org_id = public.current_user_org_id(auth.uid()));

DROP POLICY IF EXISTS "event_templates tenant boundary" ON public.event_templates;
CREATE POLICY "event_templates tenant boundary"
  ON public.event_templates
  AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING (org_id = public.current_user_org_id(auth.uid()))
  WITH CHECK (org_id = public.current_user_org_id(auth.uid()));

DROP POLICY IF EXISTS "event_template_roles tenant boundary" ON public.event_template_roles;
CREATE POLICY "event_template_roles tenant boundary"
  ON public.event_template_roles
  AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING (org_id = public.current_user_org_id(auth.uid()))
  WITH CHECK (org_id = public.current_user_org_id(auth.uid()));

DROP POLICY IF EXISTS "events tenant boundary" ON public.events;
CREATE POLICY "events tenant boundary"
  ON public.events
  AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING (org_id = public.current_user_org_id(auth.uid()))
  WITH CHECK (org_id = public.current_user_org_id(auth.uid()));

DROP POLICY IF EXISTS "event_roles tenant boundary" ON public.event_roles;
CREATE POLICY "event_roles tenant boundary"
  ON public.event_roles
  AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING (org_id = public.current_user_org_id(auth.uid()))
  WITH CHECK (org_id = public.current_user_org_id(auth.uid()));

DROP POLICY IF EXISTS "event_assignments tenant boundary" ON public.event_assignments;
CREATE POLICY "event_assignments tenant boundary"
  ON public.event_assignments
  AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING (org_id = public.current_user_org_id(auth.uid()))
  WITH CHECK (org_id = public.current_user_org_id(auth.uid()));

DROP POLICY IF EXISTS "invite_tokens tenant boundary" ON public.invite_tokens;
CREATE POLICY "invite_tokens tenant boundary"
  ON public.invite_tokens
  AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING (org_id = public.current_user_org_id(auth.uid()))
  WITH CHECK (org_id = public.current_user_org_id(auth.uid()));

DROP POLICY IF EXISTS "sunday_services tenant boundary" ON public.sunday_services;
CREATE POLICY "sunday_services tenant boundary"
  ON public.sunday_services
  AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING (org_id = public.current_user_org_id(auth.uid()))
  WITH CHECK (org_id = public.current_user_org_id(auth.uid()));

DROP POLICY IF EXISTS "assignments tenant boundary" ON public.assignments;
CREATE POLICY "assignments tenant boundary"
  ON public.assignments
  AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING (org_id = public.current_user_org_id(auth.uid()))
  WITH CHECK (org_id = public.current_user_org_id(auth.uid()));

DROP POLICY IF EXISTS "swap_requests tenant boundary" ON public.swap_requests;
CREATE POLICY "swap_requests tenant boundary"
  ON public.swap_requests
  AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING (org_id = public.current_user_org_id(auth.uid()))
  WITH CHECK (org_id = public.current_user_org_id(auth.uid()));