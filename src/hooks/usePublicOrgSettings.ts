import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface PublicOrgSettings {
  organisationName: string;
  organisationShortName: string;
}

/**
 * Fetches the two publicly-readable organisation branding settings.
 * Works without authentication (relies on the anon RLS policy added in the rebrand migration).
 */
export function usePublicOrgSettings(): { data: PublicOrgSettings; isLoading: boolean } {
  const { data, isLoading } = useQuery({
    queryKey: ['public-org-settings'],
    queryFn: async () => {
      const { data: rows } = await supabase
        .from('system_settings')
        .select('key, value')
        .in('key', ['organisation_name', 'organisation_short_name']);

      const getValue = (key: string, fallback: string): string => {
        const row = rows?.find((r) => r.key === key);
        if (!row) return fallback;
        try {
          let val: unknown = row.value;
          if (typeof val === 'string') {
            try {
              val = JSON.parse(val);
            } catch {
              // Keep plain strings as-is
            }
          }
          if (typeof val === 'string' && val.trim()) return val.trim();
        } catch {
          // ignore
        }
        return fallback;
      };

      return {
        organisationName: getValue('organisation_name', "St Matthew's Church"),
        organisationShortName: getValue('organisation_short_name', 'S'),
      };
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  return {
    data: data ?? { organisationName: "St Matthew's Church", organisationShortName: 'S' },
    isLoading,
  };
}
