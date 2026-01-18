
-- Drop the foreign key constraint on profiles.user_id to auth.users
-- This allows creating test profiles without corresponding auth users
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_user_id_fkey;
