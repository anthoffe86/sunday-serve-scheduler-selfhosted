-- =============================================
-- CHURCH VOLUNTEER SCHEDULING DATABASE SCHEMA
-- =============================================

-- 1. Create role type enum
CREATE TYPE public.app_role AS ENUM ('volunteer', 'admin');
CREATE TYPE public.service_role AS ENUM ('sidesman-standard', 'sidesman-sound', 'sidesman-welcome', 'reader', 'intercessions', 'collection');
CREATE TYPE public.swap_status AS ENUM ('pending', 'approved', 'denied');
CREATE TYPE public.schedule_status AS ENUM ('draft', 'published');

-- 2. Create user_roles table (for admin permissions)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL DEFAULT 'volunteer',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

-- 3. Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  family_group_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 4. Create family_groups table
CREATE TABLE public.family_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add foreign key for family_group_id after family_groups exists
ALTER TABLE public.profiles 
  ADD CONSTRAINT fk_profiles_family_group 
  FOREIGN KEY (family_group_id) REFERENCES public.family_groups(id) ON DELETE SET NULL;

-- 5. Create role_preferences table
CREATE TABLE public.role_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role service_role NOT NULL,
  preference_order INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

-- 6. Create availability table
CREATE TABLE public.availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  date DATE NOT NULL,
  available BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, date)
);

-- 7. Create sunday_services table
CREATE TABLE public.sunday_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL UNIQUE,
  status schedule_status NOT NULL DEFAULT 'draft',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 8. Create assignments table
CREATE TABLE public.assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id UUID REFERENCES public.sunday_services(id) ON DELETE CASCADE NOT NULL,
  volunteer_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role service_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (service_id, volunteer_id, role)
);

-- 9. Create swap_requests table
CREATE TABLE public.swap_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID REFERENCES public.assignments(id) ON DELETE CASCADE NOT NULL,
  from_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  to_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status swap_status NOT NULL DEFAULT 'pending',
  notes TEXT,
  approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 10. Create service_history table for tracking
CREATE TABLE public.service_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  date DATE NOT NULL,
  role service_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- =============================================
-- HELPER FUNCTIONS (SECURITY DEFINER)
-- =============================================

-- Function to check if user has a specific role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Function to check if user is admin
CREATE OR REPLACE FUNCTION public.is_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'admin')
$$;

-- Function to check if users are in the same family
CREATE OR REPLACE FUNCTION public.is_same_family(_user_id1 UUID, _user_id2 UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p1
    JOIN public.profiles p2 ON p1.family_group_id = p2.family_group_id
    WHERE p1.user_id = _user_id1 
      AND p2.user_id = _user_id2
      AND p1.family_group_id IS NOT NULL
  )
$$;

-- =============================================
-- ENABLE RLS ON ALL TABLES
-- =============================================

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sunday_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.swap_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_history ENABLE ROW LEVEL SECURITY;

-- =============================================
-- RLS POLICIES
-- =============================================

-- USER_ROLES policies
CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT
  USING (user_id = auth.uid() OR public.is_admin(auth.uid()));

CREATE POLICY "Only admins can manage roles"
  ON public.user_roles FOR ALL
  USING (public.is_admin(auth.uid()));

-- PROFILES policies
CREATE POLICY "Users can view all profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid() OR public.is_admin(auth.uid()));

CREATE POLICY "Only admins can delete profiles"
  ON public.profiles FOR DELETE
  USING (public.is_admin(auth.uid()));

-- FAMILY_GROUPS policies
CREATE POLICY "Anyone can view family groups"
  ON public.family_groups FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create family groups"
  ON public.family_groups FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Creators and admins can update family groups"
  ON public.family_groups FOR UPDATE
  TO authenticated
  USING (created_by = auth.uid() OR public.is_admin(auth.uid()));

CREATE POLICY "Only admins can delete family groups"
  ON public.family_groups FOR DELETE
  USING (public.is_admin(auth.uid()));

-- ROLE_PREFERENCES policies
CREATE POLICY "Users can view their own preferences"
  ON public.role_preferences FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR public.is_admin(auth.uid()));

CREATE POLICY "Users can manage their own preferences"
  ON public.role_preferences FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own preferences"
  ON public.role_preferences FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own preferences"
  ON public.role_preferences FOR DELETE
  TO authenticated
  USING (user_id = auth.uid() OR public.is_admin(auth.uid()));

-- AVAILABILITY policies
CREATE POLICY "Users can view all availability"
  ON public.availability FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert their own availability"
  ON public.availability FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own availability"
  ON public.availability FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid() OR public.is_admin(auth.uid()));

CREATE POLICY "Users can delete their own availability"
  ON public.availability FOR DELETE
  TO authenticated
  USING (user_id = auth.uid() OR public.is_admin(auth.uid()));

-- SUNDAY_SERVICES policies
CREATE POLICY "Anyone can view published services"
  ON public.sunday_services FOR SELECT
  TO authenticated
  USING (status = 'published' OR public.is_admin(auth.uid()));

CREATE POLICY "Only admins can create services"
  ON public.sunday_services FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Only admins can update services"
  ON public.sunday_services FOR UPDATE
  TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Only admins can delete services"
  ON public.sunday_services FOR DELETE
  USING (public.is_admin(auth.uid()));

-- ASSIGNMENTS policies
CREATE POLICY "Users can view assignments"
  ON public.assignments FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Only admins can create assignments"
  ON public.assignments FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Only admins can update assignments"
  ON public.assignments FOR UPDATE
  TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Only admins can delete assignments"
  ON public.assignments FOR DELETE
  USING (public.is_admin(auth.uid()));

-- SWAP_REQUESTS policies
CREATE POLICY "Users can view relevant swap requests"
  ON public.swap_requests FOR SELECT
  TO authenticated
  USING (from_user_id = auth.uid() OR to_user_id = auth.uid() OR public.is_admin(auth.uid()));

CREATE POLICY "Users can create swap requests"
  ON public.swap_requests FOR INSERT
  TO authenticated
  WITH CHECK (from_user_id = auth.uid());

CREATE POLICY "Users and admins can update swap requests"
  ON public.swap_requests FOR UPDATE
  TO authenticated
  USING (
    (from_user_id = auth.uid() AND status = 'pending') 
    OR public.is_admin(auth.uid())
  );

CREATE POLICY "Users and admins can delete swap requests"
  ON public.swap_requests FOR DELETE
  TO authenticated
  USING (from_user_id = auth.uid() OR public.is_admin(auth.uid()));

-- SERVICE_HISTORY policies
CREATE POLICY "Users can view all service history"
  ON public.service_history FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Only admins can manage service history"
  ON public.service_history FOR ALL
  USING (public.is_admin(auth.uid()));

-- =============================================
-- TRIGGERS
-- =============================================

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_availability_updated_at
  BEFORE UPDATE ON public.availability
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_sunday_services_updated_at
  BEFORE UPDATE ON public.sunday_services
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_assignments_updated_at
  BEFORE UPDATE ON public.assignments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_swap_requests_updated_at
  BEFORE UPDATE ON public.swap_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger to create profile when user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1))
  );
  
  -- Assign default volunteer role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'volunteer');
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =============================================
-- INDEXES FOR PERFORMANCE
-- =============================================

CREATE INDEX idx_profiles_user_id ON public.profiles(user_id);
CREATE INDEX idx_profiles_family_group_id ON public.profiles(family_group_id);
CREATE INDEX idx_availability_user_date ON public.availability(user_id, date);
CREATE INDEX idx_assignments_service_id ON public.assignments(service_id);
CREATE INDEX idx_assignments_volunteer_id ON public.assignments(volunteer_id);
CREATE INDEX idx_sunday_services_date ON public.sunday_services(date);
CREATE INDEX idx_swap_requests_from_user ON public.swap_requests(from_user_id);
CREATE INDEX idx_service_history_user_id ON public.service_history(user_id);