
-- Drop the overly broad ALL policy and create specific policies for event_template_roles
DROP POLICY IF EXISTS "Only admins can manage template roles" ON public.event_template_roles;

CREATE POLICY "Admins can insert template roles" ON public.event_template_roles
  FOR INSERT WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Admins can update template roles" ON public.event_template_roles
  FOR UPDATE USING (is_admin(auth.uid()));

CREATE POLICY "Admins can delete template roles" ON public.event_template_roles
  FOR DELETE USING (is_admin(auth.uid()));

-- Same for event_roles
DROP POLICY IF EXISTS "Only admins can manage event roles" ON public.event_roles;

CREATE POLICY "Admins can insert event roles" ON public.event_roles
  FOR INSERT WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Admins can update event roles" ON public.event_roles
  FOR UPDATE USING (is_admin(auth.uid()));

CREATE POLICY "Admins can delete event roles" ON public.event_roles
  FOR DELETE USING (is_admin(auth.uid()));
