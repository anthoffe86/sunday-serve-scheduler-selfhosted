-- Add super_admin enum value in its own migration transaction.
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'super_admin';