
-- Create event templates table for defining recurring or one-off event patterns
CREATE TABLE public.event_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6), -- 0=Sunday, 6=Saturday
  start_time TIME NOT NULL,
  is_recurring BOOLEAN NOT NULL DEFAULT false,
  recurrence_end_type TEXT CHECK (recurrence_end_type IN ('indefinite', 'date', 'count')),
  recurrence_end_date DATE,
  recurrence_count INTEGER,
  active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create event template roles table for defining volunteer requirements per template
CREATE TABLE public.event_template_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  template_id UUID NOT NULL REFERENCES public.event_templates(id) ON DELETE CASCADE,
  role service_role NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(template_id, role)
);

-- Create events table for actual scheduled event instances
CREATE TABLE public.events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  template_id UUID REFERENCES public.event_templates(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  date DATE NOT NULL,
  start_time TIME NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'cancelled')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create event roles table for volunteer requirements per event instance
CREATE TABLE public.event_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  role service_role NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(event_id, role)
);

-- Create event assignments table for assigning volunteers to events
CREATE TABLE public.event_assignments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  role service_role NOT NULL,
  volunteer_id UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(event_id, role, volunteer_id)
);

-- Enable RLS on all tables
ALTER TABLE public.event_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_template_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_assignments ENABLE ROW LEVEL SECURITY;

-- Event templates policies
CREATE POLICY "Anyone can view active event templates" ON public.event_templates
  FOR SELECT USING (active = true OR is_admin(auth.uid()));

CREATE POLICY "Only admins can create event templates" ON public.event_templates
  FOR INSERT WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Only admins can update event templates" ON public.event_templates
  FOR UPDATE USING (is_admin(auth.uid()));

CREATE POLICY "Only admins can delete event templates" ON public.event_templates
  FOR DELETE USING (is_admin(auth.uid()));

-- Event template roles policies
CREATE POLICY "Anyone can view template roles" ON public.event_template_roles
  FOR SELECT USING (true);

CREATE POLICY "Only admins can manage template roles" ON public.event_template_roles
  FOR ALL USING (is_admin(auth.uid()));

-- Events policies
CREATE POLICY "Anyone can view published events" ON public.events
  FOR SELECT USING (status = 'published' OR is_admin(auth.uid()));

CREATE POLICY "Only admins can create events" ON public.events
  FOR INSERT WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Only admins can update events" ON public.events
  FOR UPDATE USING (is_admin(auth.uid()));

CREATE POLICY "Only admins can delete events" ON public.events
  FOR DELETE USING (is_admin(auth.uid()));

-- Event roles policies
CREATE POLICY "Anyone can view event roles" ON public.event_roles
  FOR SELECT USING (true);

CREATE POLICY "Only admins can manage event roles" ON public.event_roles
  FOR ALL USING (is_admin(auth.uid()));

-- Event assignments policies
CREATE POLICY "Users can view their own and published assignments" ON public.event_assignments
  FOR SELECT USING (volunteer_id = auth.uid() OR is_admin(auth.uid()));

CREATE POLICY "Only admins can create assignments" ON public.event_assignments
  FOR INSERT WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Only admins can update assignments" ON public.event_assignments
  FOR UPDATE USING (is_admin(auth.uid()));

CREATE POLICY "Only admins can delete assignments" ON public.event_assignments
  FOR DELETE USING (is_admin(auth.uid()));

-- Add updated_at triggers
CREATE TRIGGER update_event_templates_updated_at
  BEFORE UPDATE ON public.event_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_events_updated_at
  BEFORE UPDATE ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_event_assignments_updated_at
  BEFORE UPDATE ON public.event_assignments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
