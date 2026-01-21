-- Create enum for assignment status
CREATE TYPE assignment_status AS ENUM ('proposed', 'invited', 'confirmed', 'declined');

-- Add invitation workflow columns to event_assignments
ALTER TABLE public.event_assignments 
  ADD COLUMN status assignment_status NOT NULL DEFAULT 'proposed',
  ADD COLUMN invited_at timestamp with time zone,
  ADD COLUMN responded_at timestamp with time zone,
  ADD COLUMN decline_reason text,
  ADD COLUMN invitation_token text UNIQUE;

-- Create index for efficient status queries
CREATE INDEX idx_event_assignments_status ON public.event_assignments(status);
CREATE INDEX idx_event_assignments_event_status ON public.event_assignments(event_id, status);

-- Update existing assignments to 'confirmed' status (they were previously published)
-- This maintains backward compatibility
UPDATE public.event_assignments 
SET status = 'confirmed' 
WHERE EXISTS (
  SELECT 1 FROM events e 
  WHERE e.id = event_assignments.event_id 
  AND e.status = 'published'
);

-- Add confidence tracking to events table
ALTER TABLE public.events
  ADD COLUMN invitations_sent_at timestamp with time zone;