import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { isSandboxMode } from '@/sandbox/mode';
import { getPublicOrgSettings, subscribeSandboxState } from '@/sandbox/runtime';
import { useSyncExternalStore } from 'react';

interface PublicOrgSettings {
  organisationName: string;
  organisationShortName: string;
}

/**
 * Fetches the two publicly-readable organisation branding settings.
 * Works without authentication (relies on the anon RLS policy added in the rebrand migration).
 */
// Stable no-op subscription for live mode. An inline arrow here would be a new
// identity every render, making useSyncExternalStore resubscribe each pass.
const noopSubscribe = () => () => undefined;

export function usePublicOrgSettings(): { data: PublicOrgSettings; isLoading: boolean } {
  const sandboxActive = isSandboxMode();

  // Both hooks below must run on every render regardless of mode -- an early
  // return for the sandbox branch would change the hook count if a mounted
  // component ever crossed the /sandbox boundary, which throws.
  const sandboxSnapshot = useSyncExternalStore(
    sandboxActive ? subscribeSandboxState : noopSubscribe,
    () => (sandboxActive ? JSON.stringify(getPublicOrgSettings()) : ''),
    () => ''
  );

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
    enabled: !sandboxActive, // never touch Supabase from the sandbox
  });

  if (sandboxActive) {
    // sandboxSnapshot is only read to keep the subscription live; the parsed
    // settings come straight from the runtime so the shape stays identical.
    void sandboxSnapshot;
    return { data: getPublicOrgSettings(), isLoading: false };
  }

  return {
    data: data ?? { organisationName: "St Matthew's Church", organisationShortName: 'S' },
    isLoading,
  };
}
