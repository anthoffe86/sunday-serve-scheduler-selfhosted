-- Allow admins to delete access requests from the admin enquiries view
DROP POLICY IF EXISTS "Admins can delete access requests" ON public.access_requests;

CREATE POLICY "Admins can delete access requests"
  ON public.access_requests
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );
