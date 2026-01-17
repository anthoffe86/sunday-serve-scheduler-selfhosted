import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import type { Database } from '@/integrations/supabase/types';

type ServiceRole = Database['public']['Enums']['service_role'];

export interface Profile {
  id: string;
  user_id: string;
  name: string;
  email: string;
  active: boolean;
  family_group_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface RolePreference {
  id: string;
  user_id: string;
  role: ServiceRole;
  preference_order: number;
}

export interface Availability {
  id: string;
  user_id: string;
  date: string;
  available: boolean;
  notes: string | null;
}

export interface SundayService {
  id: string;
  date: string;
  status: 'draft' | 'published';
  notes: string | null;
}

export interface Assignment {
  id: string;
  service_id: string;
  volunteer_id: string;
  role: ServiceRole;
  volunteer?: Profile;
}

export interface SwapRequest {
  id: string;
  assignment_id: string;
  from_user_id: string;
  to_user_id: string | null;
  status: 'pending' | 'approved' | 'denied';
  notes: string | null;
  created_at: string;
}

// Profile hooks
export function useProfile() {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['profile', user?.id],
    queryFn: async () => {
      if (!user) return null;
      
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();
      
      if (error) throw error;
      return data as Profile;
    },
    enabled: !!user,
  });
}

export function useProfiles() {
  return useQuery({
    queryKey: ['profiles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('active', true)
        .order('name');
      
      if (error) throw error;
      return data as Profile[];
    },
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  return useMutation({
    mutationFn: async (updates: Partial<Profile>) => {
      if (!user) throw new Error('Not authenticated');
      
      const { data, error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('user_id', user.id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      queryClient.invalidateQueries({ queryKey: ['profiles'] });
      toast.success('Profile updated!');
    },
    onError: (error) => {
      toast.error('Failed to update profile: ' + error.message);
    },
  });
}

// Role preferences hooks
export function useRolePreferences() {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['role-preferences', user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      const { data, error } = await supabase
        .from('role_preferences')
        .select('*')
        .eq('user_id', user.id)
        .order('preference_order');
      
      if (error) throw error;
      return data as RolePreference[];
    },
    enabled: !!user,
  });
}

export function useUpdateRolePreferences() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  return useMutation({
    mutationFn: async (preferences: { role: ServiceRole; preference_order: number }[]) => {
      if (!user) throw new Error('Not authenticated');
      
      // Delete existing preferences
      await supabase
        .from('role_preferences')
        .delete()
        .eq('user_id', user.id);
      
      // Insert new preferences
      if (preferences.length > 0) {
        const { error } = await supabase
          .from('role_preferences')
          .insert(preferences.map(p => ({
            user_id: user.id,
            role: p.role,
            preference_order: p.preference_order,
          })));
        
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['role-preferences'] });
      toast.success('Preferences saved!');
    },
    onError: (error) => {
      toast.error('Failed to save preferences: ' + error.message);
    },
  });
}

// Availability hooks
export function useAvailability() {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['availability', user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      const { data, error } = await supabase
        .from('availability')
        .select('*')
        .eq('user_id', user.id);
      
      if (error) throw error;
      return data as Availability[];
    },
    enabled: !!user,
  });
}

export function useToggleAvailability() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  return useMutation({
    mutationFn: async ({ date, available }: { date: string; available: boolean }) => {
      if (!user) throw new Error('Not authenticated');
      
      // Use upsert to handle both insert and update
      const { error } = await supabase
        .from('availability')
        .upsert({
          user_id: user.id,
          date,
          available,
        }, {
          onConflict: 'user_id,date',
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['availability'] });
    },
    onError: (error) => {
      toast.error('Failed to update availability: ' + error.message);
    },
  });
}

// Schedule hooks
export function useSundayServices() {
  return useQuery({
    queryKey: ['sunday-services'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sunday_services')
        .select('*')
        .order('date');
      
      if (error) throw error;
      return data as SundayService[];
    },
  });
}

export function useAssignments() {
  return useQuery({
    queryKey: ['assignments'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('assignments')
        .select('*');
      
      if (error) throw error;
      return data as Assignment[];
    },
  });
}

export function useScheduleWithAssignments() {
  const { data: services, isLoading: servicesLoading } = useSundayServices();
  const { data: assignments, isLoading: assignmentsLoading } = useAssignments();
  const { data: profiles, isLoading: profilesLoading } = useProfiles();
  
  const isLoading = servicesLoading || assignmentsLoading || profilesLoading;
  
  const schedule = services?.map(service => {
    const serviceAssignments = assignments?.filter(a => a.service_id === service.id) || [];
    return {
      ...service,
      assignments: serviceAssignments.map(a => ({
        ...a,
        volunteerName: profiles?.find(p => p.user_id === a.volunteer_id)?.name || 'Unknown',
      })),
    };
  });
  
  return { data: schedule, isLoading };
}

// Swap request hooks
export function useSwapRequests() {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['swap-requests', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('swap_requests')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as SwapRequest[];
    },
    enabled: !!user,
  });
}

export function useCreateSwapRequest() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  return useMutation({
    mutationFn: async ({ assignmentId, notes }: { assignmentId: string; notes?: string }) => {
      if (!user) throw new Error('Not authenticated');
      
      const { error } = await supabase
        .from('swap_requests')
        .insert({
          assignment_id: assignmentId,
          from_user_id: user.id,
          notes,
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['swap-requests'] });
      toast.success('Swap request submitted!');
    },
    onError: (error) => {
      toast.error('Failed to create swap request: ' + error.message);
    },
  });
}

// Service history hook
export function useServiceHistory(userId?: string) {
  return useQuery({
    queryKey: ['service-history', userId],
    queryFn: async () => {
      let query = supabase.from('service_history').select('*');
      
      if (userId) {
        query = query.eq('user_id', userId);
      }
      
      const { data, error } = await query.order('date', { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: !!userId,
  });
}
