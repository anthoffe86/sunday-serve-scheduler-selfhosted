import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/use-toast';
import { useAuth } from '@/hooks/useAuth';

export const NOTIFICATION_SETTING_KEYS = [
    'email_on_invite',
    'email_on_invitation_send',
    'email_on_publish',
    'email_on_swap_request',
    'email_on_assignment_add',
    'email_on_assignment_remove',
] as const;

export type NotificationSettingKey = typeof NOTIFICATION_SETTING_KEYS[number];

export type NotificationOverrides = Partial<Record<NotificationSettingKey, boolean>>;

/**
 * Per-organisation overrides for the email_on_* notification toggles.
 *
 * These used to be single global rows in system_settings, so one organisation
 * switching a notification off switched it off for every organisation. An
 * override here wins; where there is none, the system_settings row is still the
 * deployment-wide default (see useEffectiveNotificationSetting below and
 * isNotificationEnabled in supabase/functions/_shared/org-settings.ts).
 *
 * RLS restricts rows to the caller's own organisation, so no org filter is
 * needed in the query.
 */
export function useOrgNotificationSettings() {
    const { orgId } = useAuth();

    return useQuery({
        queryKey: ['org-notification-settings', orgId],
        enabled: !!orgId,
        queryFn: async (): Promise<NotificationOverrides> => {
            const { data, error } = await supabase
                .from('org_notification_settings')
                .select('key, enabled');

            if (error) throw error;

            const overrides: NotificationOverrides = {};
            for (const row of data ?? []) {
                overrides[row.key as NotificationSettingKey] = row.enabled;
            }
            return overrides;
        },
    });
}

export function useUpdateOrgNotificationSetting() {
    const queryClient = useQueryClient();
    const { orgId } = useAuth();

    return useMutation({
        mutationFn: async ({ key, enabled }: { key: NotificationSettingKey; enabled: boolean }) => {
            if (!orgId) {
                throw new Error('No organisation is associated with your account.');
            }

            // org_id is written explicitly and checked again by RLS, which only
            // accepts the caller's own organisation.
            const { error } = await supabase
                .from('org_notification_settings')
                .upsert(
                    { org_id: orgId, key, enabled, updated_at: new Date().toISOString() },
                    { onConflict: 'org_id,key' }
                );

            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['org-notification-settings'] });
            toast({
                title: 'Setting updated',
                description: 'The changes have been saved successfully.',
            });
        },
        onError: (error) => {
            console.error('Failed to update notification setting:', error);
            toast({
                title: 'Update failed',
                description: 'There was an error updating the setting.',
                variant: 'destructive',
            });
        },
    });
}
