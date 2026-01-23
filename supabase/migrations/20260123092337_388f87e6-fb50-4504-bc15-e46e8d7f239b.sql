-- Add new column to track the offered assignment from the accepting volunteer
ALTER TABLE public.swap_requests 
ADD COLUMN offered_assignment_id uuid REFERENCES public.event_assignments(id) ON DELETE SET NULL;

-- Add index for faster lookups
CREATE INDEX idx_swap_requests_offered_assignment ON public.swap_requests(offered_assignment_id) WHERE offered_assignment_id IS NOT NULL;

-- Comment for clarity
COMMENT ON COLUMN public.swap_requests.offered_assignment_id IS 'The assignment the accepting volunteer is offering in exchange';