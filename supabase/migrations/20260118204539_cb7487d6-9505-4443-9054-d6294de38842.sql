-- Add event_assignment_id column to swap_requests table
ALTER TABLE public.swap_requests 
ADD COLUMN IF NOT EXISTS event_assignment_id uuid REFERENCES public.event_assignments(id) ON DELETE CASCADE;

-- Make assignment_id nullable since we'll use event_assignment_id for new swaps
ALTER TABLE public.swap_requests 
ALTER COLUMN assignment_id DROP NOT NULL;

-- Create index for event_assignment_id
CREATE INDEX IF NOT EXISTS idx_swap_requests_event_assignment ON public.swap_requests(event_assignment_id);

-- Update RLS policies to include viewing swap requests where user is eligible (open swaps)
DROP POLICY IF EXISTS "Users can view relevant swap requests" ON public.swap_requests;

CREATE POLICY "Users can view relevant swap requests" 
ON public.swap_requests 
FOR SELECT 
USING (
  from_user_id = auth.uid() 
  OR to_user_id = auth.uid() 
  OR (to_user_id IS NULL AND status = 'pending'::swap_status)
  OR is_admin(auth.uid())
);