-- Super admin bootstrap migration
-- Goal: promote the existing admin to super_admin in a safe, controlled way.

CREATE OR REPLACE FUNCTION public.bootstrap_super_admin()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_id UUID;
BEGIN
  caller_id := auth.uid();

  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'super_admin') THEN
    RETURN 'super_admin already exists';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = caller_id
      AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Only an existing admin can bootstrap super admin';
  END IF;

  INSERT INTO public.user_roles (user_id, role, org_id)
  VALUES (caller_id, 'super_admin', NULL)
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN 'promoted current admin to super_admin';
END;
$$;

REVOKE ALL ON FUNCTION public.bootstrap_super_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bootstrap_super_admin() TO authenticated;

DO $$
DECLARE
  super_admin_count INTEGER;
  distinct_admin_count INTEGER;
  target_admin UUID;
BEGIN
  SELECT COUNT(*) INTO super_admin_count
  FROM public.user_roles
  WHERE role = 'super_admin';

  IF super_admin_count > 0 THEN
    RAISE NOTICE 'Super admin already configured; skipping automatic bootstrap.';
    RETURN;
  END IF;

  SELECT COUNT(DISTINCT user_id) INTO distinct_admin_count
  FROM public.user_roles
  WHERE role = 'admin';

  IF distinct_admin_count = 1 THEN
    SELECT user_id INTO target_admin
    FROM public.user_roles
    WHERE role = 'admin'
    LIMIT 1;

    INSERT INTO public.user_roles (user_id, role, org_id)
    VALUES (target_admin, 'super_admin', NULL)
    ON CONFLICT (user_id, role) DO NOTHING;

    RAISE NOTICE 'Bootstrapped super_admin for existing admin user %', target_admin;
  ELSE
    RAISE NOTICE 'Automatic bootstrap skipped: expected exactly 1 admin user, found %', distinct_admin_count;
    RAISE NOTICE 'Sign in as intended admin and run: select public.bootstrap_super_admin();';
  END IF;
END;
$$;