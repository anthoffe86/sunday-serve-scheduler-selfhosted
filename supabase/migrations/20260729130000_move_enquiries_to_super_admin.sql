-- Move info/demo enquiries from organisation admins to super admins.
--
-- access_requests holds inbound platform leads, not tenant data: the table has no
-- org_id, so the previous "role = 'admin'" policies let any organisation admin in
-- any tenant read, update and delete every other organisation's enquiry contact
-- details. Re-key the policies to super_admin, which is the role that actually owns
-- this data. Super admins were stripped of their non-super_admin roles by
-- 20260715160000_isolate_super_admin_from_orgs.sql, so a literal 'admin' check
-- excluded them entirely.

-- ─── Drop the organisation-admin policies ───────────────────────────────────
-- From 20260626110946_rebrand_org_name_access_requests.sql
DROP POLICY IF EXISTS "Admins can view access requests" ON public.access_requests;
DROP POLICY IF EXISTS "Admins can update access requests" ON public.access_requests;
-- From 20260715094500_admin_delete_access_requests.sql
DROP POLICY IF EXISTS "Admins can delete access requests" ON public.access_requests;

-- ─── Super-admin-only read/write ────────────────────────────────────────────
-- public.is_super_admin is SECURITY DEFINER STABLE (see
-- 20260715123000_multitenancy_foundation.sql) and is the helper every other
-- super-admin policy in this schema uses.

DROP POLICY IF EXISTS "Super admins can view access requests" ON public.access_requests;

CREATE POLICY "Super admins can view access requests"
  ON public.access_requests
  FOR SELECT
  TO authenticated
  USING (public.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "Super admins can update access requests" ON public.access_requests;

-- No UI writes `status` yet; kept for parity with the policy set being replaced so
-- marking an enquiry as contacted stays possible without another migration.
CREATE POLICY "Super admins can update access requests"
  ON public.access_requests
  FOR UPDATE
  TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "Super admins can delete access requests" ON public.access_requests;

CREATE POLICY "Super admins can delete access requests"
  ON public.access_requests
  FOR DELETE
  TO authenticated
  USING (public.is_super_admin(auth.uid()));

-- NOTE: "Anyone can submit access requests" (INSERT, anon + authenticated) is
-- deliberately left in place — the logged-out landing page form depends on it.

-- ─── Index the list ordering ────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_access_requests_created_at
  ON public.access_requests (created_at DESC);
