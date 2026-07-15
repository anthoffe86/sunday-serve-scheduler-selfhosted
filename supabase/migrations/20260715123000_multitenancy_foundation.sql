-- Multi-tenant foundation: organisations, org scoping, and super-admin role

CREATE TABLE IF NOT EXISTS public.organisations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.organisations ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  org_name TEXT;
BEGIN
  SELECT value INTO org_name
  FROM public.system_settings
  WHERE key = 'organisation_name'
  LIMIT 1;

  INSERT INTO public.organisations (name, slug)
  VALUES (COALESCE(org_name, 'Default Organisation'), 'default-org')
  ON CONFLICT (slug) DO NOTHING;
END $$;

CREATE OR REPLACE FUNCTION public.get_default_org_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id
  FROM public.organisations
  WHERE slug = 'default-org'
  LIMIT 1
$$;

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS org_id UUID;
ALTER TABLE public.user_roles ADD COLUMN IF NOT EXISTS org_id UUID;
ALTER TABLE public.family_groups ADD COLUMN IF NOT EXISTS org_id UUID;
ALTER TABLE public.role_preferences ADD COLUMN IF NOT EXISTS org_id UUID;
ALTER TABLE public.availability ADD COLUMN IF NOT EXISTS org_id UUID;
ALTER TABLE public.service_history ADD COLUMN IF NOT EXISTS org_id UUID;
ALTER TABLE public.sunday_services ADD COLUMN IF NOT EXISTS org_id UUID;
ALTER TABLE public.assignments ADD COLUMN IF NOT EXISTS org_id UUID;
ALTER TABLE public.swap_requests ADD COLUMN IF NOT EXISTS org_id UUID;
ALTER TABLE public.event_templates ADD COLUMN IF NOT EXISTS org_id UUID;
ALTER TABLE public.event_template_roles ADD COLUMN IF NOT EXISTS org_id UUID;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS org_id UUID;
ALTER TABLE public.event_roles ADD COLUMN IF NOT EXISTS org_id UUID;
ALTER TABLE public.event_assignments ADD COLUMN IF NOT EXISTS org_id UUID;
ALTER TABLE public.invite_tokens ADD COLUMN IF NOT EXISTS org_id UUID;

DO $$
DECLARE
  default_org UUID;
BEGIN
  SELECT public.get_default_org_id() INTO default_org;

  UPDATE public.profiles
  SET org_id = default_org
  WHERE org_id IS NULL;

  UPDATE public.user_roles ur
  SET org_id = p.org_id
  FROM public.profiles p
  WHERE ur.user_id = p.user_id
    AND ur.org_id IS NULL
    AND ur.role <> 'super_admin';

  UPDATE public.user_roles
  SET org_id = default_org
  WHERE org_id IS NULL
    AND role <> 'super_admin';

  UPDATE public.family_groups
  SET org_id = default_org
  WHERE org_id IS NULL;

  UPDATE public.role_preferences rp
  SET org_id = p.org_id
  FROM public.profiles p
  WHERE rp.user_id = p.user_id
    AND rp.org_id IS NULL;

  UPDATE public.availability a
  SET org_id = p.org_id
  FROM public.profiles p
  WHERE a.user_id = p.user_id
    AND a.org_id IS NULL;

  UPDATE public.service_history sh
  SET org_id = p.org_id
  FROM public.profiles p
  WHERE sh.user_id = p.user_id
    AND sh.org_id IS NULL;

  UPDATE public.event_templates
  SET org_id = default_org
  WHERE org_id IS NULL;

  UPDATE public.events e
  SET org_id = COALESCE(t.org_id, default_org)
  FROM public.event_templates t
  WHERE e.template_id = t.id
    AND e.org_id IS NULL;

  UPDATE public.events
  SET org_id = default_org
  WHERE org_id IS NULL;

  UPDATE public.event_roles er
  SET org_id = e.org_id
  FROM public.events e
  WHERE er.event_id = e.id
    AND er.org_id IS NULL;

  UPDATE public.event_template_roles etr
  SET org_id = et.org_id
  FROM public.event_templates et
  WHERE etr.template_id = et.id
    AND etr.org_id IS NULL;

  UPDATE public.event_assignments ea
  SET org_id = e.org_id
  FROM public.events e
  WHERE ea.event_id = e.id
    AND ea.org_id IS NULL;

  UPDATE public.invite_tokens
  SET org_id = default_org
  WHERE org_id IS NULL;

  UPDATE public.sunday_services
  SET org_id = default_org
  WHERE org_id IS NULL;

  UPDATE public.assignments a
  SET org_id = s.org_id
  FROM public.sunday_services s
  WHERE a.service_id = s.id
    AND a.org_id IS NULL;

  UPDATE public.swap_requests sr
  SET org_id = a.org_id
  FROM public.assignments a
  WHERE sr.assignment_id = a.id
    AND sr.org_id IS NULL;
END $$;

ALTER TABLE public.profiles ALTER COLUMN org_id SET DEFAULT public.get_default_org_id();
ALTER TABLE public.role_preferences ALTER COLUMN org_id SET DEFAULT public.get_default_org_id();
ALTER TABLE public.availability ALTER COLUMN org_id SET DEFAULT public.get_default_org_id();
ALTER TABLE public.service_history ALTER COLUMN org_id SET DEFAULT public.get_default_org_id();
ALTER TABLE public.family_groups ALTER COLUMN org_id SET DEFAULT public.get_default_org_id();
ALTER TABLE public.event_templates ALTER COLUMN org_id SET DEFAULT public.get_default_org_id();
ALTER TABLE public.events ALTER COLUMN org_id SET DEFAULT public.get_default_org_id();
ALTER TABLE public.event_roles ALTER COLUMN org_id SET DEFAULT public.get_default_org_id();
ALTER TABLE public.event_template_roles ALTER COLUMN org_id SET DEFAULT public.get_default_org_id();
ALTER TABLE public.event_assignments ALTER COLUMN org_id SET DEFAULT public.get_default_org_id();
ALTER TABLE public.invite_tokens ALTER COLUMN org_id SET DEFAULT public.get_default_org_id();
ALTER TABLE public.sunday_services ALTER COLUMN org_id SET DEFAULT public.get_default_org_id();
ALTER TABLE public.assignments ALTER COLUMN org_id SET DEFAULT public.get_default_org_id();
ALTER TABLE public.swap_requests ALTER COLUMN org_id SET DEFAULT public.get_default_org_id();

ALTER TABLE public.profiles ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE public.role_preferences ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE public.availability ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE public.service_history ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE public.family_groups ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE public.event_templates ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE public.events ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE public.event_roles ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE public.event_template_roles ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE public.event_assignments ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE public.invite_tokens ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE public.sunday_services ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE public.assignments ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE public.swap_requests ALTER COLUMN org_id SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'profiles_org_id_fkey'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_org_id_fkey
      FOREIGN KEY (org_id) REFERENCES public.organisations(id) ON DELETE RESTRICT;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'user_roles_org_id_fkey'
  ) THEN
    ALTER TABLE public.user_roles
      ADD CONSTRAINT user_roles_org_id_fkey
      FOREIGN KEY (org_id) REFERENCES public.organisations(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'family_groups_org_id_fkey'
  ) THEN
    ALTER TABLE public.family_groups
      ADD CONSTRAINT family_groups_org_id_fkey
      FOREIGN KEY (org_id) REFERENCES public.organisations(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'role_preferences_org_id_fkey'
  ) THEN
    ALTER TABLE public.role_preferences
      ADD CONSTRAINT role_preferences_org_id_fkey
      FOREIGN KEY (org_id) REFERENCES public.organisations(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'availability_org_id_fkey'
  ) THEN
    ALTER TABLE public.availability
      ADD CONSTRAINT availability_org_id_fkey
      FOREIGN KEY (org_id) REFERENCES public.organisations(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'service_history_org_id_fkey'
  ) THEN
    ALTER TABLE public.service_history
      ADD CONSTRAINT service_history_org_id_fkey
      FOREIGN KEY (org_id) REFERENCES public.organisations(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'sunday_services_org_id_fkey'
  ) THEN
    ALTER TABLE public.sunday_services
      ADD CONSTRAINT sunday_services_org_id_fkey
      FOREIGN KEY (org_id) REFERENCES public.organisations(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'assignments_org_id_fkey'
  ) THEN
    ALTER TABLE public.assignments
      ADD CONSTRAINT assignments_org_id_fkey
      FOREIGN KEY (org_id) REFERENCES public.organisations(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'swap_requests_org_id_fkey'
  ) THEN
    ALTER TABLE public.swap_requests
      ADD CONSTRAINT swap_requests_org_id_fkey
      FOREIGN KEY (org_id) REFERENCES public.organisations(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'event_templates_org_id_fkey'
  ) THEN
    ALTER TABLE public.event_templates
      ADD CONSTRAINT event_templates_org_id_fkey
      FOREIGN KEY (org_id) REFERENCES public.organisations(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'event_template_roles_org_id_fkey'
  ) THEN
    ALTER TABLE public.event_template_roles
      ADD CONSTRAINT event_template_roles_org_id_fkey
      FOREIGN KEY (org_id) REFERENCES public.organisations(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'events_org_id_fkey'
  ) THEN
    ALTER TABLE public.events
      ADD CONSTRAINT events_org_id_fkey
      FOREIGN KEY (org_id) REFERENCES public.organisations(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'event_roles_org_id_fkey'
  ) THEN
    ALTER TABLE public.event_roles
      ADD CONSTRAINT event_roles_org_id_fkey
      FOREIGN KEY (org_id) REFERENCES public.organisations(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'event_assignments_org_id_fkey'
  ) THEN
    ALTER TABLE public.event_assignments
      ADD CONSTRAINT event_assignments_org_id_fkey
      FOREIGN KEY (org_id) REFERENCES public.organisations(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'invite_tokens_org_id_fkey'
  ) THEN
    ALTER TABLE public.invite_tokens
      ADD CONSTRAINT invite_tokens_org_id_fkey
      FOREIGN KEY (org_id) REFERENCES public.organisations(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'user_roles_org_required'
  ) THEN
    ALTER TABLE public.user_roles
      ADD CONSTRAINT user_roles_org_required
      CHECK (role = 'super_admin' OR org_id IS NOT NULL);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_profiles_org_id ON public.profiles(org_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_org_id ON public.user_roles(org_id);
CREATE INDEX IF NOT EXISTS idx_availability_org_id_date ON public.availability(org_id, date);
CREATE INDEX IF NOT EXISTS idx_event_templates_org_id ON public.event_templates(org_id);
CREATE INDEX IF NOT EXISTS idx_events_org_id_date ON public.events(org_id, date);
CREATE INDEX IF NOT EXISTS idx_event_assignments_org_id_event ON public.event_assignments(org_id, event_id);
CREATE INDEX IF NOT EXISTS idx_swap_requests_org_id ON public.swap_requests(org_id);

CREATE OR REPLACE FUNCTION public.current_user_org_id(_user_id UUID DEFAULT auth.uid())
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT org_id
  FROM public.profiles
  WHERE user_id = _user_id
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = 'super_admin'
  )
$$;

CREATE OR REPLACE FUNCTION public.is_org_admin(_user_id UUID, _org_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = 'admin'
      AND org_id = _org_id
  )
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  default_org UUID;
BEGIN
  default_org := public.get_default_org_id();

  INSERT INTO public.profiles (user_id, email, name, org_id)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    default_org
  );

  INSERT INTO public.user_roles (user_id, role, org_id)
  VALUES (NEW.id, 'volunteer', default_org);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP POLICY IF EXISTS "Super admins manage organisations" ON public.organisations;
CREATE POLICY "Super admins manage organisations"
  ON public.organisations FOR ALL
  TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "Org admins can view organisations" ON public.organisations;
CREATE POLICY "Org admins can view organisations"
  ON public.organisations FOR SELECT
  TO authenticated
  USING (public.is_org_admin(auth.uid(), id));

DROP POLICY IF EXISTS "profiles tenant boundary" ON public.profiles;
CREATE POLICY "profiles tenant boundary"
  ON public.profiles
  AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING (
    org_id = public.current_user_org_id(auth.uid())
    OR public.is_super_admin(auth.uid())
  )
  WITH CHECK (
    org_id = public.current_user_org_id(auth.uid())
    OR public.is_super_admin(auth.uid())
  );

DROP POLICY IF EXISTS "family_groups tenant boundary" ON public.family_groups;
CREATE POLICY "family_groups tenant boundary"
  ON public.family_groups
  AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING (
    org_id = public.current_user_org_id(auth.uid())
    OR public.is_super_admin(auth.uid())
  )
  WITH CHECK (
    org_id = public.current_user_org_id(auth.uid())
    OR public.is_super_admin(auth.uid())
  );

DROP POLICY IF EXISTS "role_preferences tenant boundary" ON public.role_preferences;
CREATE POLICY "role_preferences tenant boundary"
  ON public.role_preferences
  AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING (
    org_id = public.current_user_org_id(auth.uid())
    OR public.is_super_admin(auth.uid())
  )
  WITH CHECK (
    org_id = public.current_user_org_id(auth.uid())
    OR public.is_super_admin(auth.uid())
  );

DROP POLICY IF EXISTS "availability tenant boundary" ON public.availability;
CREATE POLICY "availability tenant boundary"
  ON public.availability
  AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING (
    org_id = public.current_user_org_id(auth.uid())
    OR public.is_super_admin(auth.uid())
  )
  WITH CHECK (
    org_id = public.current_user_org_id(auth.uid())
    OR public.is_super_admin(auth.uid())
  );

DROP POLICY IF EXISTS "service_history tenant boundary" ON public.service_history;
CREATE POLICY "service_history tenant boundary"
  ON public.service_history
  AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING (
    org_id = public.current_user_org_id(auth.uid())
    OR public.is_super_admin(auth.uid())
  )
  WITH CHECK (
    org_id = public.current_user_org_id(auth.uid())
    OR public.is_super_admin(auth.uid())
  );

DROP POLICY IF EXISTS "event_templates tenant boundary" ON public.event_templates;
CREATE POLICY "event_templates tenant boundary"
  ON public.event_templates
  AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING (
    org_id = public.current_user_org_id(auth.uid())
    OR public.is_super_admin(auth.uid())
  )
  WITH CHECK (
    org_id = public.current_user_org_id(auth.uid())
    OR public.is_super_admin(auth.uid())
  );

DROP POLICY IF EXISTS "event_template_roles tenant boundary" ON public.event_template_roles;
CREATE POLICY "event_template_roles tenant boundary"
  ON public.event_template_roles
  AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING (
    org_id = public.current_user_org_id(auth.uid())
    OR public.is_super_admin(auth.uid())
  )
  WITH CHECK (
    org_id = public.current_user_org_id(auth.uid())
    OR public.is_super_admin(auth.uid())
  );

DROP POLICY IF EXISTS "events tenant boundary" ON public.events;
CREATE POLICY "events tenant boundary"
  ON public.events
  AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING (
    org_id = public.current_user_org_id(auth.uid())
    OR public.is_super_admin(auth.uid())
  )
  WITH CHECK (
    org_id = public.current_user_org_id(auth.uid())
    OR public.is_super_admin(auth.uid())
  );

DROP POLICY IF EXISTS "event_roles tenant boundary" ON public.event_roles;
CREATE POLICY "event_roles tenant boundary"
  ON public.event_roles
  AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING (
    org_id = public.current_user_org_id(auth.uid())
    OR public.is_super_admin(auth.uid())
  )
  WITH CHECK (
    org_id = public.current_user_org_id(auth.uid())
    OR public.is_super_admin(auth.uid())
  );

DROP POLICY IF EXISTS "event_assignments tenant boundary" ON public.event_assignments;
CREATE POLICY "event_assignments tenant boundary"
  ON public.event_assignments
  AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING (
    org_id = public.current_user_org_id(auth.uid())
    OR public.is_super_admin(auth.uid())
  )
  WITH CHECK (
    org_id = public.current_user_org_id(auth.uid())
    OR public.is_super_admin(auth.uid())
  );

DROP POLICY IF EXISTS "invite_tokens tenant boundary" ON public.invite_tokens;
CREATE POLICY "invite_tokens tenant boundary"
  ON public.invite_tokens
  AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING (
    org_id = public.current_user_org_id(auth.uid())
    OR public.is_super_admin(auth.uid())
  )
  WITH CHECK (
    org_id = public.current_user_org_id(auth.uid())
    OR public.is_super_admin(auth.uid())
  );

DROP POLICY IF EXISTS "sunday_services tenant boundary" ON public.sunday_services;
CREATE POLICY "sunday_services tenant boundary"
  ON public.sunday_services
  AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING (
    org_id = public.current_user_org_id(auth.uid())
    OR public.is_super_admin(auth.uid())
  )
  WITH CHECK (
    org_id = public.current_user_org_id(auth.uid())
    OR public.is_super_admin(auth.uid())
  );

DROP POLICY IF EXISTS "assignments tenant boundary" ON public.assignments;
CREATE POLICY "assignments tenant boundary"
  ON public.assignments
  AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING (
    org_id = public.current_user_org_id(auth.uid())
    OR public.is_super_admin(auth.uid())
  )
  WITH CHECK (
    org_id = public.current_user_org_id(auth.uid())
    OR public.is_super_admin(auth.uid())
  );

DROP POLICY IF EXISTS "swap_requests tenant boundary" ON public.swap_requests;
CREATE POLICY "swap_requests tenant boundary"
  ON public.swap_requests
  AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING (
    org_id = public.current_user_org_id(auth.uid())
    OR public.is_super_admin(auth.uid())
  )
  WITH CHECK (
    org_id = public.current_user_org_id(auth.uid())
    OR public.is_super_admin(auth.uid())
  );

DROP POLICY IF EXISTS "No super-admin schedule writes to events" ON public.events;
CREATE POLICY "No super-admin schedule writes to events"
  ON public.events
  AS RESTRICTIVE
  FOR UPDATE
  TO authenticated
  USING (NOT public.is_super_admin(auth.uid()))
  WITH CHECK (NOT public.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "No super-admin schedule inserts to events" ON public.events;
CREATE POLICY "No super-admin schedule inserts to events"
  ON public.events
  AS RESTRICTIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (NOT public.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "No super-admin schedule deletes to events" ON public.events;
CREATE POLICY "No super-admin schedule deletes to events"
  ON public.events
  AS RESTRICTIVE
  FOR DELETE
  TO authenticated
  USING (NOT public.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "No super-admin schedule writes to templates" ON public.event_templates;
CREATE POLICY "No super-admin schedule writes to templates"
  ON public.event_templates
  AS RESTRICTIVE
  FOR UPDATE
  TO authenticated
  USING (NOT public.is_super_admin(auth.uid()))
  WITH CHECK (NOT public.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "No super-admin schedule inserts to templates" ON public.event_templates;
CREATE POLICY "No super-admin schedule inserts to templates"
  ON public.event_templates
  AS RESTRICTIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (NOT public.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "No super-admin schedule deletes to templates" ON public.event_templates;
CREATE POLICY "No super-admin schedule deletes to templates"
  ON public.event_templates
  AS RESTRICTIVE
  FOR DELETE
  TO authenticated
  USING (NOT public.is_super_admin(auth.uid()));

ALTER TABLE public.role_preferences ALTER COLUMN org_id SET DEFAULT public.current_user_org_id(auth.uid());
ALTER TABLE public.availability ALTER COLUMN org_id SET DEFAULT public.current_user_org_id(auth.uid());
ALTER TABLE public.service_history ALTER COLUMN org_id SET DEFAULT public.current_user_org_id(auth.uid());
ALTER TABLE public.family_groups ALTER COLUMN org_id SET DEFAULT public.current_user_org_id(auth.uid());
ALTER TABLE public.event_templates ALTER COLUMN org_id SET DEFAULT public.current_user_org_id(auth.uid());
ALTER TABLE public.events ALTER COLUMN org_id SET DEFAULT public.current_user_org_id(auth.uid());
ALTER TABLE public.event_roles ALTER COLUMN org_id SET DEFAULT public.current_user_org_id(auth.uid());
ALTER TABLE public.event_template_roles ALTER COLUMN org_id SET DEFAULT public.current_user_org_id(auth.uid());
ALTER TABLE public.event_assignments ALTER COLUMN org_id SET DEFAULT public.current_user_org_id(auth.uid());
ALTER TABLE public.invite_tokens ALTER COLUMN org_id SET DEFAULT public.current_user_org_id(auth.uid());
ALTER TABLE public.sunday_services ALTER COLUMN org_id SET DEFAULT public.current_user_org_id(auth.uid());
ALTER TABLE public.assignments ALTER COLUMN org_id SET DEFAULT public.current_user_org_id(auth.uid());
ALTER TABLE public.swap_requests ALTER COLUMN org_id SET DEFAULT public.current_user_org_id(auth.uid());

CREATE INDEX IF NOT EXISTS idx_invite_tokens_org_id ON public.invite_tokens(org_id);
CREATE INDEX IF NOT EXISTS idx_role_preferences_org_id_user ON public.role_preferences(org_id, user_id);

DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Only admins can manage roles" ON public.user_roles;

DROP POLICY IF EXISTS "Users can view relevant roles" ON public.user_roles;
CREATE POLICY "Users can view relevant roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_super_admin(auth.uid())
    OR public.is_org_admin(auth.uid(), org_id)
  );

DROP POLICY IF EXISTS "Super admins can manage roles" ON public.user_roles;
CREATE POLICY "Super admins can manage roles"
  ON public.user_roles FOR ALL
  TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "Org admins can manage own-org roles" ON public.user_roles;
CREATE POLICY "Org admins can manage own-org roles"
  ON public.user_roles FOR ALL
  TO authenticated
  USING (
    public.is_org_admin(auth.uid(), org_id)
    AND role <> 'super_admin'
  )
  WITH CHECK (
    public.is_org_admin(auth.uid(), org_id)
    AND role <> 'super_admin'
  );