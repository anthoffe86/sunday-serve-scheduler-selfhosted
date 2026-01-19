-- Remove the unsafe RLS policy that allows anyone to query all unexpired invite tokens
-- Token validation is now handled server-side via the validate-invite-token edge function

DROP POLICY IF EXISTS "Anyone can validate their own token" ON public.invite_tokens;

-- Remove any UPDATE policy for anonymous users if it exists
DROP POLICY IF EXISTS "Anyone can mark their token as used" ON public.invite_tokens;