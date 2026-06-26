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
