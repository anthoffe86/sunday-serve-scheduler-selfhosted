import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/use-toast';

export interface SystemSetting {
    key: string;
    value: any;
    description: string | null;
    updated_at: string;
}

export function useSystemSettings() {
    const queryClient = useQueryClient();

    return useQuery({
        queryKey: ['system-settings'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('system_settings' as any)
                .select('*');

            if (error) throw error;
            return data as any as SystemSetting[];
        },
    });
}

export function useUpdateSystemSetting() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ key, value }: { key: string; value: any }) => {
            const { data, error } = await supabase
                .from('system_settings' as any)
                .update({ value })
                .eq('key', key)
                .select()
                .single();

            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['system-settings'] });
            queryClient.invalidateQueries({ queryKey: ['public-org-settings'] });
            toast({
                title: 'Setting updated',
                description: 'The changes have been saved successfully.',
            });
        },
        onError: (error) => {
            console.error('Failed to update setting:', error);
            toast({
                title: 'Update failed',
                description: 'There was an error updating the setting.',
                variant: 'destructive',
            });
        },
    });
}
