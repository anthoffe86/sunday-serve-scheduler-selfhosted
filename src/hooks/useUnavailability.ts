import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

// Hook to add multiple unavailable dates at once
export function useAddUnavailableDates() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ dates, notes }: { dates: string[]; notes?: string }) => {
      if (!user) throw new Error('Not authenticated');

      // Insert all dates as unavailable
      const records = dates.map(date => ({
        user_id: user.id,
        date,
        available: false,
        notes: notes || null,
      }));

      const { error } = await supabase
        .from('availability')
        .upsert(records, { onConflict: 'user_id,date' });

      if (error) throw error;
    },
    onSuccess: (_, { dates }) => {
      queryClient.invalidateQueries({ queryKey: ['availability'] });
      toast.success(
        dates.length === 1
          ? 'Date marked as unavailable'
          : `${dates.length} dates marked as unavailable`
      );
    },
    onError: (error) => {
      toast.error('Failed to save unavailable dates: ' + error.message);
    },
  });
}

// Hook to remove an unavailable date (restores availability)
export function useRemoveUnavailableDate() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (date: string) => {
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('availability')
        .delete()
        .eq('user_id', user.id)
        .eq('date', date);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['availability'] });
    },
    onError: (error) => {
      toast.error('Failed to remove date: ' + error.message);
    },
  });
}

// Hook to update notes on an unavailable date
export function useUpdateUnavailableDate() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ date, notes }: { date: string; notes?: string }) => {
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('availability')
        .update({ notes: notes || null })
        .eq('user_id', user.id)
        .eq('date', date);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['availability'] });
      toast.success('Note updated');
    },
    onError: (error) => {
      toast.error('Failed to update note: ' + error.message);
    },
  });
}
