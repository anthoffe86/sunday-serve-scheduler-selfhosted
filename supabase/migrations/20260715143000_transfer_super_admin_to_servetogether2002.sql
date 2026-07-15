-- One-off super-admin email update
-- Target email: servetogether2002@gmail.com
-- Result: update the current super-admin account to use the new login email,
-- while preserving existing org-admin and super-admin roles.

DO $$
DECLARE
  super_admin_user_id UUID;
  existing_user_id UUID;
BEGIN
  SELECT user_id
  INTO existing_user_id
  FROM public.profiles
  WHERE lower(email) = lower('servetogether2002@gmail.com')
  LIMIT 1;

  IF existing_user_id IS NOT NULL THEN
    RAISE EXCEPTION 'Email servetogether2002@gmail.com already belongs to an existing profile';
  END IF;

  SELECT user_id
  INTO super_admin_user_id
  FROM public.user_roles
  WHERE role = 'super_admin'
  LIMIT 1;

  IF super_admin_user_id IS NULL THEN
    RAISE EXCEPTION 'No current super_admin user found';
  END IF;

  UPDATE auth.users
  SET
    email = 'servetogether2002@gmail.com',
    email_confirmed_at = COALESCE(email_confirmed_at, now()),
    updated_at = now()
  WHERE id = super_admin_user_id;

  UPDATE public.profiles
  SET email = 'servetogether2002@gmail.com'
  WHERE user_id = super_admin_user_id;

  IF NOT EXISTS (
    SELECT 1
  FROM public.profiles
    WHERE user_id = super_admin_user_id
      AND lower(email) = lower('servetogether2002@gmail.com')
  ) THEN
    RAISE EXCEPTION 'Profile email update failed for current super_admin user';
  END IF;
END $$;