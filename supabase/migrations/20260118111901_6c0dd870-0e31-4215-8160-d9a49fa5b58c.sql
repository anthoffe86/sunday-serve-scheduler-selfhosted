-- Add recurrence_pattern column to event_templates
-- Values: 'weekly', 'monthly-day', 'monthly-nth' (or null for one-off)
ALTER TABLE public.event_templates 
ADD COLUMN IF NOT EXISTS recurrence_pattern text;

-- Add start_date column to event_templates (the first event date)
ALTER TABLE public.event_templates
ADD COLUMN IF NOT EXISTS start_date date;

-- Add comments for documentation
COMMENT ON COLUMN public.event_templates.recurrence_pattern IS 'Recurrence pattern: weekly, monthly-day (same day of month), monthly-nth (e.g. 2nd Sunday)';
COMMENT ON COLUMN public.event_templates.start_date IS 'The start date for the event series';