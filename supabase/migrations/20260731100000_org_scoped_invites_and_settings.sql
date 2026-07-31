-- Tenancy fixes for the volunteer invitation flow.
--
-- Three related defects are addressed here:
--
--   1. handle_new_user() assigned get_default_org_id() to every signup, so a
--      volunteer invited by an Org B admin landed in the default organisation.
--      invite_tokens.org_id was already being set correctly but nothing read it.
--   2. An admin creating an invite could only see profiles inside their own
--      organisation (restrictive tenant RLS), so an address already registered
--      in another organisation was not detected until signup failed with a raw
--      "already registered" error from auth.
--   3. The email_on_* notification flags lived in system_settings as one global
--      row per key, so one organisation switching a notification off switched it
--      off for every organisation.

-- ─── 1. Invited volunteers join the organisation that invited them ───────────

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  supplied_token TEXT;
  invite_id      UUID;
  invite_org     UUID;
  invite_name    TEXT;
  open_org_count INT;
  target_org     UUID;
  resolved_name  TEXT;
BEGIN
  -- Sent by the /invite signup form. Like everything in raw_user_meta_data this
  -- is caller-controlled, so it is only ever used to look up an invite that was
  -- issued to this exact address: holding someone else's token must not let you
  -- choose which organisation you join.
  supplied_token := NULLIF(btrim(COALESCE(NEW.raw_user_meta_data->>'invite_token', '')), '');

  IF supplied_token IS NOT NULL THEN
    SELECT id, org_id, name
    INTO invite_id, invite_org, invite_name
    FROM public.invite_tokens
    WHERE token = supplied_token
      AND used_at IS NULL
      AND expires_at > now()
      AND lower(email) = lower(NEW.email)
    LIMIT 1;
  END IF;

  -- Fall back to matching on the address alone. This covers signups that carry
  -- no token: invites issued before this migration, and direct signups that
  -- happen to have a pending invitation waiting. Only an unambiguous match is
  -- honoured -- if two organisations both have an open invite for the address
  -- there is no way to tell which was meant, so the default org is used.
  IF invite_id IS NULL THEN
    SELECT count(DISTINCT org_id)
    INTO open_org_count
    FROM public.invite_tokens
    WHERE lower(email) = lower(NEW.email)
      AND used_at IS NULL
      AND expires_at > now();

    IF open_org_count = 1 THEN
      SELECT id, org_id, name
      INTO invite_id, invite_org, invite_name
      FROM public.invite_tokens
      WHERE lower(email) = lower(NEW.email)
        AND used_at IS NULL
        AND expires_at > now()
      ORDER BY created_at DESC
      LIMIT 1;
    END IF;
  END IF;

  target_org := COALESCE(invite_org, public.get_default_org_id());

  resolved_name := COALESCE(
    NULLIF(btrim(COALESCE(NEW.raw_user_meta_data->>'name', '')), ''),
    invite_name,
    split_part(NEW.email, '@', 1)
  );

  INSERT INTO public.profiles (user_id, email, name, org_id)
  VALUES (NEW.id, NEW.email, resolved_name, target_org);

  INSERT INTO public.user_roles (user_id, role, org_id)
  VALUES (NEW.id, 'volunteer', target_org);

  -- Consume the invite in the same transaction that creates the account, so a
  -- token can never seed a second one. mark-invite-used stays in place and is a
  -- no-op once this has run.
  IF invite_id IS NOT NULL THEN
    UPDATE public.invite_tokens
    SET used_at = now()
    WHERE id = invite_id
      AND used_at IS NULL;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Re-assert the lockdown from 20260625104651: the trigger is invoked by the
-- table owner and must never be callable directly.
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- ─── 2. Duplicate-email detection that tenant RLS cannot blind ──────────────

CREATE OR REPLACE FUNCTION public.invite_email_status(_email TEXT)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  normalised TEXT;
  caller_org UUID;
  match_org  UUID;
BEGIN
  -- SECURITY DEFINER, so this sees every organisation and auth.users. Gate it on
  -- the caller holding the admin role; without this any volunteer could probe
  -- addresses across the whole deployment.
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  normalised := lower(btrim(COALESCE(_email, '')));
  IF normalised = '' THEN
    RAISE EXCEPTION 'An email address is required';
  END IF;

  caller_org := public.current_user_org_id(auth.uid());

  SELECT p.org_id
  INTO match_org
  FROM public.profiles p
  WHERE lower(p.email) = normalised
  LIMIT 1;

  IF FOUND THEN
    -- Only ever "somewhere else", never which organisation: the caller has no
    -- business knowing the membership of a tenant they are not part of.
    IF match_org IS NOT NULL AND match_org = caller_org THEN
      RETURN 'in_org';
    END IF;
    RETURN 'registered_elsewhere';
  END IF;

  -- A profile row is the normal case, but an auth account with no profile (an
  -- abandoned signup, or a profile removed by hand) still collides on the
  -- auth.users unique index and would fail the volunteer's signup.
  IF EXISTS (SELECT 1 FROM auth.users u WHERE lower(u.email) = normalised) THEN
    RETURN 'registered_elsewhere';
  END IF;

  RETURN 'available';
END;
$$;

REVOKE EXECUTE ON FUNCTION public.invite_email_status(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.invite_email_status(TEXT) TO authenticated;

-- ─── 3. Per-organisation notification toggles ───────────────────────────────
--
-- system_settings stays as it is and keeps serving as the deployment-wide
-- default for each key. This table holds per-organisation overrides: a row here
-- wins, and its absence means "use the system_settings default". That keeps the
-- change backwards compatible -- an organisation that has never touched its
-- settings behaves exactly as before.

CREATE TABLE IF NOT EXISTS public.org_notification_settings (
  org_id     UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  key        TEXT NOT NULL,
  enabled    BOOLEAN NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (org_id, key),
  CONSTRAINT org_notification_settings_key_allowed CHECK (key IN (
    'email_on_invite',
    'email_on_invitation_send',
    'email_on_publish',
    'email_on_swap_request',
    'email_on_assignment_add',
    'email_on_assignment_remove'
  ))
);

ALTER TABLE public.org_notification_settings ENABLE ROW LEVEL SECURITY;

-- Admins see and change their own organisation's overrides and nothing else.
-- Edge functions read this table with the service role, which bypasses RLS.
DROP POLICY IF EXISTS "Org admins manage notification settings" ON public.org_notification_settings;
CREATE POLICY "Org admins manage notification settings"
  ON public.org_notification_settings
  FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()) AND org_id = public.current_user_org_id(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()) AND org_id = public.current_user_org_id(auth.uid()));

DROP TRIGGER IF EXISTS update_org_notification_settings_updated_at ON public.org_notification_settings;
CREATE TRIGGER update_org_notification_settings_updated_at
  BEFORE UPDATE ON public.org_notification_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
