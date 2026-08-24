import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/use-toast';
import { isSandboxMode } from '@/sandbox/mode';
import { getSystemSettings, updateSystemSetting } from '@/sandbox/runtime';

export interface SystemSetting {
    key: string;
    value: any;
    description: string | null;
    updated_at: string;
}

export function useSystemSettings() {
    const queryClient = useQueryClient();
    const sandboxActive = isSandboxMode();

    return useQuery({
        queryKey: ['system-settings'],
        queryFn: async () => {
            if (sandboxActive) {
                return getSystemSettings() as SystemSetting[];
            }

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
    const sandboxActive = isSandboxMode();

    return useMutation({
        mutationFn: async ({ key, value }: { key: string; value: any }) => {
            if (sandboxActive) {
                updateSystemSetting(key, value);
                return { key, value };
            }

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
