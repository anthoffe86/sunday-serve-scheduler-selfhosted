-- Create invite_tokens table for tracking volunteer invitations
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE public.invite_tokens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  token TEXT NOT NULL UNIQUE DEFAULT encode(extensions.gen_random_bytes(32), 'hex'),
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  invited_by UUID NOT NULL,
  used_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '7 days'),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.invite_tokens ENABLE ROW LEVEL SECURITY;

-- Only admins can view and manage invite tokens
CREATE POLICY "Admins can view invite tokens"
  ON public.invite_tokens FOR SELECT
  USING (is_admin(auth.uid()));

CREATE POLICY "Admins can create invite tokens"
  ON public.invite_tokens FOR INSERT
  WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Admins can update invite tokens"
  ON public.invite_tokens FOR UPDATE
  USING (is_admin(auth.uid()));

CREATE POLICY "Admins can delete invite tokens"
  ON public.invite_tokens FOR DELETE
  USING (is_admin(auth.uid()));

-- Allow anonymous users to read valid tokens (for signup flow)
CREATE POLICY "Anyone can validate their own token"
  ON public.invite_tokens FOR SELECT
  USING (used_at IS NULL AND expires_at > now());

-- Update profiles RLS to allow admins to insert profiles for invited users
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile or admins can insert"
  ON public.profiles FOR INSERT
  WITH CHECK ((user_id = auth.uid()) OR is_admin(auth.uid()));