-- Ensure system_settings exists and has the expected columns.
CREATE TABLE IF NOT EXISTS public.system_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT 'true'::jsonb,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.system_settings
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now();

ALTER TABLE public.system_settings
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now();

ALTER TABLE public.system_settings
  ALTER COLUMN updated_at SET DEFAULT now();

-- Enable RLS
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- Only admins can view and manage settings
DROP POLICY IF EXISTS "Anyone can view system settings" ON public.system_settings;
DROP POLICY IF EXISTS "Only admins can update system settings" ON public.system_settings;
DROP POLICY IF EXISTS "Admins can view settings" ON public.system_settings;
DROP POLICY IF EXISTS "Admins can update settings" ON public.system_settings;
DROP POLICY IF EXISTS "Admins can insert settings" ON public.system_settings;

CREATE POLICY "Admins can view settings"
ON public.system_settings
FOR SELECT
USING (is_admin(auth.uid()));

CREATE POLICY "Admins can update settings"
ON public.system_settings
FOR UPDATE
USING (is_admin(auth.uid()));

CREATE POLICY "Admins can insert settings"
ON public.system_settings
FOR INSERT
WITH CHECK (is_admin(auth.uid()));

-- Add trigger for updated_at
DROP TRIGGER IF EXISTS update_system_settings_updated_at ON public.system_settings;

CREATE TRIGGER update_system_settings_updated_at
BEFORE UPDATE ON public.system_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default email settings
INSERT INTO public.system_settings (key, value, description) VALUES
  ('email_on_invite', 'true', 'Send email when a new volunteer is invited to the system'),
  ('email_on_publish', 'true', 'Send confirmation emails when events are published'),
  ('email_on_swap_request', 'true', 'Send emails to eligible substitutes when a swap is requested'),
  ('email_on_assignment_add', 'true', 'Send email when a volunteer is manually added to an event'),
  ('email_on_assignment_remove', 'true', 'Send email when a volunteer is removed from an event'),
  ('email_on_invitation_send', 'true', 'Send invitation emails when Send Invitations is clicked')
ON CONFLICT (key) DO NOTHING;