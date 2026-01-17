-- Fix the permissive INSERT policy on family_groups
DROP POLICY "Authenticated users can create family groups" ON public.family_groups;

CREATE POLICY "Users can create family groups as creator"
  ON public.family_groups FOR INSERT
  TO authenticated
  WITH CHECK (created_by = auth.uid());