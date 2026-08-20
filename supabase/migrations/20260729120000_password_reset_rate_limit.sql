-- Throttle table for the send-password-reset edge function.
--
-- The reset endpoint is unauthenticated by design (a locked-out user cannot
-- authenticate), so it needs its own abuse control to stop it being used as a
-- mail bomb / Resend cost amplifier.
--
-- Only salted-and-hashed identifiers are stored: this table must never become a
-- log of which email addresses exist or which IPs used the service.

CREATE TABLE IF NOT EXISTS public.password_reset_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_hash TEXT NOT NULL,
  ip_hash TEXT,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS password_reset_attempts_email_idx
  ON public.password_reset_attempts (email_hash, requested_at DESC);

CREATE INDEX IF NOT EXISTS password_reset_attempts_ip_idx
  ON public.password_reset_attempts (ip_hash, requested_at DESC);

CREATE INDEX IF NOT EXISTS password_reset_attempts_requested_at_idx
  ON public.password_reset_attempts (requested_at);

-- RLS on with no policies: nothing reachable via the anon or authenticated
-- roles. The edge function uses the service role key, which bypasses RLS.
ALTER TABLE public.password_reset_attempts ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.password_reset_attempts FROM anon, authenticated;
