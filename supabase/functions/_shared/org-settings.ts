import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Reuse this type rather than importing the generated types (not available in edge functions)
type SupabaseClient = ReturnType<typeof createClient>;

/**
 * Reads organisation_name from system_settings.
 * Falls back to "St Matthew's Church" if not found or on error.
 */
export async function getOrgName(supabase: SupabaseClient): Promise<string> {
  try {
    const { data } = await supabase
      .from("system_settings")
      .select("value")
      .eq("key", "organisation_name")
      .maybeSingle();

    if (data?.value !== undefined && data?.value !== null) {
      let val: unknown = data.value;
      if (typeof val === "string") {
        try {
          val = JSON.parse(val);
        } catch {
          // Keep plain strings as-is
        }
      }
      if (typeof val === "string" && val.trim()) return val.trim();
    }
  } catch {
    // Fall through to default
  }
  return "St Matthew's Church";
}

/**
 * Reads organisation_short_name from system_settings.
 * Falls back to "S" if not found or on error.
 */
export async function getOrgShortName(supabase: SupabaseClient): Promise<string> {
  try {
    const { data } = await supabase
      .from("system_settings")
      .select("value")
      .eq("key", "organisation_short_name")
      .maybeSingle();

    if (data?.value !== undefined && data?.value !== null) {
      let val: unknown = data.value;
      if (typeof val === "string") {
        try {
          val = JSON.parse(val);
        } catch {
          // Keep plain strings as-is
        }
      }
      if (typeof val === "string" && val.trim()) return val.trim();
    }
  } catch {
    // Fall through to default
  }
  return "S";
}

/** The notification toggles an organisation can override for itself. */
export type NotificationSettingKey =
  | "email_on_invite"
  | "email_on_invitation_send"
  | "email_on_publish"
  | "email_on_swap_request"
  | "email_on_assignment_add"
  | "email_on_assignment_remove";

/**
 * Is a notification flag switched on for one organisation?
 *
 * org_notification_settings holds per-organisation overrides; system_settings
 * keeps the deployment-wide default for the same key. An override wins, and its
 * absence means "use the default", so one organisation switching a notification
 * off no longer switches it off for every organisation.
 *
 * Both lookups default to enabled: a missing row or a failed read must not
 * silently swallow the notification.
 *
 * Callers must pass the organisation the notification belongs to. `null` falls
 * back to the deployment default, which is only correct when there genuinely is
 * no organisation in context.
 */
export async function isNotificationEnabled(
  supabase: SupabaseClient,
  key: NotificationSettingKey,
  orgId: string | null
): Promise<boolean> {
  if (orgId) {
    const { data, error } = await supabase
      .from("org_notification_settings")
      .select("enabled")
      .eq("org_id", orgId)
      .eq("key", key)
      .maybeSingle();

    const override = data as { enabled?: boolean } | null;
    if (error) {
      console.error(`Error reading org override for ${key}:`, error);
    } else if (override && typeof override.enabled === "boolean") {
      return override.enabled;
    }
  }

  const { data: setting, error: settingError } = await supabase
    .from("system_settings")
    .select("value")
    .eq("key", key)
    .maybeSingle();

  if (settingError) {
    console.error(`Error reading system setting ${key}:`, settingError);
    return true;
  }

  const value = (setting as { value?: unknown } | null)?.value;
  return !(value === false || value === "false");
}

/**
 * Build a valid Resend "from" string using the live organisation name.
 *
 * The sender address can be configured via:
 * - RESEND_FROM_ADDRESS (preferred, address only)
 * - RESEND_FROM_EMAIL (legacy, accepts either address or "Name <address>")
 */
export function buildOrgFromEmail(orgName: string): string {
  const rawFrom =
    Deno.env.get("RESEND_FROM_ADDRESS") ??
    Deno.env.get("RESEND_FROM_EMAIL") ??
    "noreply@updates.servetogether.co.uk";

  const fromAddress = extractEmailAddress(rawFrom);
  const safeOrgName = sanitizeDisplayName(orgName) || "ServeTogether";

  return `${safeOrgName} <${fromAddress}>`;
}

function extractEmailAddress(input: string): string {
  const trimmed = input.trim();
  const angleMatch = trimmed.match(/<\s*([^>\s]+@[^>\s]+)\s*>/);
  if (angleMatch?.[1]) return angleMatch[1].trim();

  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return trimmed;

  return "noreply@updates.servetogether.co.uk";
}

function sanitizeDisplayName(name: string): string {
  return name.replace(/[<>"\r\n]/g, "").trim();
}
