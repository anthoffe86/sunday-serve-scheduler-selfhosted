-- Add organisation name settings
INSERT INTO public.system_settings (key, value, description)
VALUES 
  ('organisation_name', '"St Matthew''s Church"', 'The organisation name shown in the app header and emails'),
  ('organisation_short_name', '"S"', 'Short name / initials shown in the app header avatar mark')
ON CONFLICT (key) DO NOTHING;

-- Allow public (anon) users to read the two non-sensitive organisation branding keys.
-- This lets logged-out pages (invite signup, invitation response) show the org name.
CREATE POLICY "Public can read organisation branding settings"
  ON public.system_settings
  FOR SELECT
  TO anon, authenticated
  USING (key IN ('organisation_name', 'organisation_short_name'));

-- ─── Access requests ────────────────────────────────────────────────────────

CREATE TABLE public.access_requests (
  id               UUID                     PRIMARY KEY DEFAULT gen_random_uuid(),
  name             TEXT                     NOT NULL,
  organisation_name TEXT                    NOT NULL,
  email            TEXT                     NOT NULL,
  notes            TEXT,
  status           TEXT                     NOT NULL DEFAULT 'pending'
                                            CHECK (status IN ('pending', 'contacted', 'approved', 'rejected')),
  created_at       TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.access_requests ENABLE ROW LEVEL SECURITY;

-- Anyone (including anonymous visitors) can submit a request
CREATE POLICY "Anyone can submit access requests"
  ON public.access_requests
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (status = 'pending');

-- Only admins can view requests
CREATE POLICY "Admins can view access requests"
  ON public.access_requests
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Only admins can update request status
CREATE POLICY "Admins can update access requests"
  ON public.access_requests
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );
