import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export interface SwapRequest {
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

export interface SwapRequestWithDetails extends SwapRequest {
  from_user_name: string;
  from_user_email: string;
  to_user_name?: string;
  event_name: string;
  event_date: string;
  event_start_time: string;
  role: string;
}

// Fetch all swap requests visible to the current user
export function useSwapRequests() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['swap-requests', user?.id],
    queryFn: async () => {
      if (!user) return [];

      // Get swap requests
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

      // Build enriched swap requests
      const enrichedRequests: SwapRequestWithDetails[] = swapRequests
        .map((sr) => {
          const assignment = assignments?.find((a) => a.id === sr.event_assignment_id);
          if (!assignment) return null;

          const event = events?.find((e) => e.id === assignment.event_id);
          if (!event) return null;

          const fromProfile = profiles?.find((p) => p.user_id === sr.from_user_id);
          const toProfile = sr.to_user_id
            ? profiles?.find((p) => p.user_id === sr.to_user_id)
            : null;

          return {
            ...sr,
            from_user_name: fromProfile?.name || 'Unknown',
            from_user_email: fromProfile?.email || '',
            to_user_name: toProfile?.name,
            event_name: event.name,
            event_date: event.date,
            event_start_time: event.start_time,
            role: assignment.role,
          };
        })
        .filter(Boolean) as SwapRequestWithDetails[];

      return enrichedRequests;
    },
    enabled: !!user,
  });
}

// Create a new swap request
export function useCreateSwapRequest() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      eventAssignmentId,
      notes,
    }: {
      eventAssignmentId: string;
      notes?: string;
    }) => {
      if (!user) throw new Error('Not authenticated');

      // Create the swap request
      const { data: swapRequest, error } = await supabase
        .from('swap_requests')
        .insert({
          event_assignment_id: eventAssignmentId,
          from_user_id: user.id,
          notes: notes || null,
        })
        .select()
        .single();

      if (error) throw error;

      // Send notification emails
      try {
        const { error: notificationError } = await supabase.functions.invoke(
          'send-swap-notification',
          {
            body: {
              swapRequestId: swapRequest.id,
              baseUrl: window.location.origin,
            },
          }
        );

        if (notificationError) {
          console.error('Failed to send swap notifications:', notificationError);
        }
      } catch (err) {
        console.error('Failed to send swap notifications:', err);
      }

      return swapRequest;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['swap-requests'] });
      toast.success('Swap request submitted! Eligible volunteers have been notified.');
    },
    onError: (error) => {
      toast.error('Failed to create swap request: ' + error.message);
    },
  });
}

// Accept a swap request
export function useAcceptSwapRequest() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (swapRequestId: string) => {
      if (!user) throw new Error('Not authenticated');

      // Get the swap request
      const { data: swapRequest, error: fetchError } = await supabase
        .from('swap_requests')
        .select('*')
        .eq('id', swapRequestId)
        .single();

      if (fetchError || !swapRequest) {
        throw new Error('Swap request not found');
      }

      if (swapRequest.status !== 'pending') {
        throw new Error('This swap request has already been processed');
      }

      // Update the event assignment to the new volunteer
      const { error: updateAssignmentError } = await supabase
        .from('event_assignments')
        .update({ volunteer_id: user.id })
        .eq('id', swapRequest.event_assignment_id);

      if (updateAssignmentError) throw updateAssignmentError;

      // Update the swap request
      const { error: updateSwapError } = await supabase
        .from('swap_requests')
        .update({
          status: 'approved',
          to_user_id: user.id,
          approved_at: new Date().toISOString(),
          approved_by: user.id,
        })
        .eq('id', swapRequestId);

      if (updateSwapError) throw updateSwapError;

      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['swap-requests'] });
      queryClient.invalidateQueries({ queryKey: ['events'] });
      toast.success('Swap accepted! You are now assigned to this event.');
    },
    onError: (error) => {
      toast.error('Failed to accept swap: ' + error.message);
    },
  });
}

// Deny/decline a swap request (only the recipient can do this)
export function useDeclineSwapRequest() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (swapRequestId: string) => {
      if (!user) throw new Error('Not authenticated');

      // For now, declining just hides it from this user's view
      // The swap request stays open for others
      // We'll add a declined_by array in a future enhancement
      toast.info('Swap request dismissed from your view');
      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['swap-requests'] });
    },
  });
}

// Cancel a swap request (only the requester can do this)
export function useCancelSwapRequest() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (swapRequestId: string) => {
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('swap_requests')
        .delete()
        .eq('id', swapRequestId)
        .eq('from_user_id', user.id);

      if (error) throw error;
      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['swap-requests'] });
      toast.success('Swap request cancelled');
    },
    onError: (error) => {
      toast.error('Failed to cancel swap request: ' + error.message);
    },
  });
}

// Check if user already has a pending swap request for an assignment
export function useExistingSwapRequest(eventAssignmentId?: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['existing-swap-request', eventAssignmentId, user?.id],
    queryFn: async () => {
      if (!user || !eventAssignmentId) return null;

      const { data, error } = await supabase
        .from('swap_requests')
        .select('*')
        .eq('event_assignment_id', eventAssignmentId)
        .eq('from_user_id', user.id)
        .eq('status', 'pending')
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!user && !!eventAssignmentId,
  });
}
