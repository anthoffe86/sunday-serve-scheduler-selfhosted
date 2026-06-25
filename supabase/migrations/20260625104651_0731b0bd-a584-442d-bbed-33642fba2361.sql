
DROP POLICY IF EXISTS "Anyone can view event roles" ON public.event_roles;
DROP POLICY IF EXISTS "Admins can delete event roles" ON public.event_roles;
DROP POLICY IF EXISTS "Admins can insert event roles" ON public.event_roles;
DROP POLICY IF EXISTS "Admins can update event roles" ON public.event_roles;
CREATE POLICY "Authenticated can view event roles" ON public.event_roles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can delete event roles" ON public.event_roles FOR DELETE TO authenticated USING (is_admin(auth.uid()));
CREATE POLICY "Admins can insert event roles" ON public.event_roles FOR INSERT TO authenticated WITH CHECK (is_admin(auth.uid()));
CREATE POLICY "Admins can update event roles" ON public.event_roles FOR UPDATE TO authenticated USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));

DROP POLICY IF EXISTS "Anyone can view template roles" ON public.event_template_roles;
DROP POLICY IF EXISTS "Admins can delete template roles" ON public.event_template_roles;
DROP POLICY IF EXISTS "Admins can insert template roles" ON public.event_template_roles;
DROP POLICY IF EXISTS "Admins can update template roles" ON public.event_template_roles;
CREATE POLICY "Authenticated can view template roles" ON public.event_template_roles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can delete template roles" ON public.event_template_roles FOR DELETE TO authenticated USING (is_admin(auth.uid()));
CREATE POLICY "Admins can insert template roles" ON public.event_template_roles FOR INSERT TO authenticated WITH CHECK (is_admin(auth.uid()));
CREATE POLICY "Admins can update template roles" ON public.event_template_roles FOR UPDATE TO authenticated USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));

DROP POLICY IF EXISTS "Anyone can view active event templates" ON public.event_templates;
DROP POLICY IF EXISTS "Only admins can create event templates" ON public.event_templates;
DROP POLICY IF EXISTS "Only admins can delete event templates" ON public.event_templates;
DROP POLICY IF EXISTS "Only admins can update event templates" ON public.event_templates;
CREATE POLICY "Authenticated can view active event templates" ON public.event_templates FOR SELECT TO authenticated USING (active = true OR is_admin(auth.uid()));
CREATE POLICY "Only admins can create event templates" ON public.event_templates FOR INSERT TO authenticated WITH CHECK (is_admin(auth.uid()));
CREATE POLICY "Only admins can delete event templates" ON public.event_templates FOR DELETE TO authenticated USING (is_admin(auth.uid()));
CREATE POLICY "Only admins can update event templates" ON public.event_templates FOR UPDATE TO authenticated USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));

DROP POLICY IF EXISTS "Anyone can view published events" ON public.events;
DROP POLICY IF EXISTS "Volunteers can view events they are assigned to" ON public.events;
DROP POLICY IF EXISTS "Only admins can create events" ON public.events;
DROP POLICY IF EXISTS "Only admins can delete events" ON public.events;
DROP POLICY IF EXISTS "Only admins can update events" ON public.events;
CREATE POLICY "Authenticated can view published events" ON public.events FOR SELECT TO authenticated USING (status = 'published' OR is_admin(auth.uid()));
CREATE POLICY "Volunteers can view events they are assigned to" ON public.events FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.event_assignments ea WHERE ea.event_id = events.id AND ea.volunteer_id = auth.uid())
);
CREATE POLICY "Only admins can create events" ON public.events FOR INSERT TO authenticated WITH CHECK (is_admin(auth.uid()));
CREATE POLICY "Only admins can delete events" ON public.events FOR DELETE TO authenticated USING (is_admin(auth.uid()));
CREATE POLICY "Only admins can update events" ON public.events FOR UPDATE TO authenticated USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can view invite tokens" ON public.invite_tokens;
DROP POLICY IF EXISTS "Admins can create invite tokens" ON public.invite_tokens;
DROP POLICY IF EXISTS "Admins can update invite tokens" ON public.invite_tokens;
DROP POLICY IF EXISTS "Admins can delete invite tokens" ON public.invite_tokens;
CREATE POLICY "Admins can view invite tokens" ON public.invite_tokens FOR SELECT TO authenticated USING (is_admin(auth.uid()));
CREATE POLICY "Admins can create invite tokens" ON public.invite_tokens FOR INSERT TO authenticated WITH CHECK (is_admin(auth.uid()));
CREATE POLICY "Admins can update invite tokens" ON public.invite_tokens FOR UPDATE TO authenticated USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));
CREATE POLICY "Admins can delete invite tokens" ON public.invite_tokens FOR DELETE TO authenticated USING (is_admin(auth.uid()));

DROP POLICY IF EXISTS "Users can view relevant swap requests" ON public.swap_requests;
CREATE POLICY "Users can view relevant swap requests" ON public.swap_requests FOR SELECT TO authenticated USING (
  from_user_id = auth.uid()
  OR to_user_id = auth.uid()
  OR (to_user_id IS NULL AND status = 'pending')
  OR is_admin(auth.uid())
);

REVOKE EXECUTE ON FUNCTION public.is_event_published(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
