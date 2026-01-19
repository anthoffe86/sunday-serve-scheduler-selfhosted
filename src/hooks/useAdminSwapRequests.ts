import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export interface AdminSwapRequest {
  id: string;
  event_assignment_id: string | null;
  assignment_id: string | null;
  from_user_id: string;
  to_user_id: string | null;
  status: 'pending' | 'approved' | 'denied';
  notes: string | null;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AdminSwapRequestWithDetails extends AdminSwapRequest {
  from_user_name: string;
  from_user_email: string;
  to_user_name?: string;
  to_user_email?: string;
  event_name: string;
  event_date: string;
  event_start_time: string;
  role: string;
  eligible_volunteers: EligibleVolunteer[];
}

export interface EligibleVolunteer {
  user_id: string;
  name: string;
  email: string;
}

// Fetch all swap requests for admin (including all statuses)
export function useAdminSwapRequests() {
  const { isAdmin } = useAuth();

  return useQuery({
    queryKey: ['admin-swap-requests'],
    queryFn: async () => {
      // Get all swap requests
      const { data: swapRequests, error } = await supabase
        .from('swap_requests')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (!swapRequests || swapRequests.length === 0) return [];

      // Get all event assignments
      const eventAssignmentIds = swapRequests
        .map((sr) => sr.event_assignment_id)
        .filter(Boolean) as string[];

      if (eventAssignmentIds.length === 0) return [];

      const { data: assignments, error: assignmentsError } = await supabase
        .from('event_assignments')
        .select('*')
        .in('id', eventAssignmentIds);

      if (assignmentsError) throw assignmentsError;

      // Get all events
      const eventIds = [...new Set(assignments?.map((a) => a.event_id) || [])];
      const { data: events, error: eventsError } = await supabase
        .from('events')
        .select('*')
        .in('id', eventIds);

      if (eventsError) throw eventsError;

      // Get all user profiles
      const userIds = [
        ...new Set([
          ...swapRequests.map((sr) => sr.from_user_id),
          ...swapRequests.map((sr) => sr.to_user_id).filter(Boolean),
        ]),
      ] as string[];

      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .in('user_id', userIds);

      if (profilesError) throw profilesError;

      // Get all role preferences to find eligible volunteers
      const { data: allRolePrefs } = await supabase
        .from('role_preferences')
        .select('*');

      // Get all profiles for eligible volunteers lookup
      const { data: allProfiles } = await supabase
        .from('profiles')
        .select('*')
        .eq('active', true);

      // Build enriched swap requests
      const enrichedRequests: AdminSwapRequestWithDetails[] = swapRequests
        .map((sr) => {
          const assignment = assignments?.find((a) => a.id === sr.event_assignment_id);
          if (!assignment) return null;

          const event = events?.find((e) => e.id === assignment.event_id);
          if (!event) return null;

          const fromProfile = profiles?.find((p) => p.user_id === sr.from_user_id);
          const toProfile = sr.to_user_id
            ? profiles?.find((p) => p.user_id === sr.to_user_id)
            : null;

          // Find eligible volunteers (have the role preference and not the requester)
          const eligibleVolunteers: EligibleVolunteer[] = (allRolePrefs || [])
            .filter(
              (pref) =>
                pref.role === assignment.role && pref.user_id !== sr.from_user_id
            )
            .map((pref) => {
              const profile = allProfiles?.find((p) => p.user_id === pref.user_id);
              if (!profile) return null;
              return {
                user_id: pref.user_id,
                name: profile.name,
                email: profile.email,
              };
            })
            .filter(Boolean) as EligibleVolunteer[];

          return {
            ...sr,
            from_user_name: fromProfile?.name || 'Unknown',
            from_user_email: fromProfile?.email || '',
            to_user_name: toProfile?.name,
            to_user_email: toProfile?.email,
            event_name: event.name,
            event_date: event.date,
            event_start_time: event.start_time,
            role: assignment.role,
            eligible_volunteers: eligibleVolunteers,
          };
        })
        .filter(Boolean) as AdminSwapRequestWithDetails[];

      return enrichedRequests;
    },
    enabled: isAdmin,
  });
}

// Admin accept swap on behalf of a user
export function useAdminAcceptSwapRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      swapRequestId,
      targetUserId,
    }: {
      swapRequestId: string;
      targetUserId: string;
    }) => {
      const { data: result, error } = await supabase.functions.invoke(
        'admin-accept-swap',
        {
          body: { swapRequestId, targetUserId },
        }
      );

      if (error) throw error;
      if (result?.error) throw new Error(result.error);

      return result as { success: boolean };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-swap-requests'] });
      queryClient.invalidateQueries({ queryKey: ['swap-requests'] });
      queryClient.invalidateQueries({ queryKey: ['events'] });
      toast.success('Swap accepted on behalf of the volunteer.');
    },
    onError: (error) => {
      toast.error('Failed to accept swap: ' + error.message);
    },
  });
}

// Admin cancel a swap request
export function useAdminCancelSwapRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (swapRequestId: string) => {
      const { error } = await supabase
        .from('swap_requests')
        .delete()
        .eq('id', swapRequestId);

      if (error) throw error;
      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-swap-requests'] });
      queryClient.invalidateQueries({ queryKey: ['swap-requests'] });
      toast.success('Swap request cancelled.');
    },
    onError: (error) => {
      toast.error('Failed to cancel swap request: ' + error.message);
    },
  });
}
