-- Create system_settings table
CREATE TABLE IF NOT EXISTS public.system_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  description TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Anyone can view system settings"
  ON public.system_settings FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Only admins can update system settings"
  ON public.system_settings FOR UPDATE
  TO authenticated
  USING (public.is_admin(auth.uid()));

-- Initialize default email settings
INSERT INTO public.system_settings (key, value, description)
VALUES 
  ('email_on_invite', 'true'::jsonb, 'Send email when a new user is invited'),
  ('email_on_publish', 'true'::jsonb, 'Send emails when events are published'),
  ('email_on_swap_request', 'true'::jsonb, 'Send emails for new swap requests'),
  ('email_on_assignment_add', 'true'::jsonb, 'Send email when a volunteer is added to an event'),
  ('email_on_assignment_remove', 'true'::jsonb, 'Send email when a volunteer is removed from an event')
ON CONFLICT (key) DO NOTHING;

-- Trigger to update updated_at
CREATE TRIGGER update_system_settings_updated_at
  BEFORE UPDATE ON public.system_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
