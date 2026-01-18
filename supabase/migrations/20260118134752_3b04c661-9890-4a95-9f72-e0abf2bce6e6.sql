-- Add subheading and reading columns to events table
ALTER TABLE public.events 
ADD COLUMN subheading text,
ADD COLUMN reading text;