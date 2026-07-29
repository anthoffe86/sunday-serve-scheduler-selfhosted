import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  PASSWORD_RESET_NOT_CONFIGURED,
  generateRecoveryLink,
  isResendConfigured,
  isValidEmail,
  resolveAppOrigin,
  sendPasswordResetEmail,
} from "../_shared/password-reset.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Abuse limits for this unauthenticated endpoint.
const MAX_PER_EMAIL = 3;
const EMAIL_WINDOW_MINUTES = 15;
const MAX_PER_IP = 10;
const IP_WINDOW_MINUTES = 60;
const ATTEMPT_RETENTION_HOURS = 24;

/**
 * HMAC-SHA256 so the throttle table holds no recoverable email addresses or IPs.
 * The service role key is always present in the function environment and never
 * leaves the server, so it doubles as the keying material.
 */
async function hashIdentifier(value: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function clientIp(req: Request): string | null {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim() || null;
  return req.headers.get("cf-connecting-ip");
}

// deno-lint-ignore no-explicit-any
async function isRateLimited(supabase: any, emailHash: string, ipHash: string | null): Promise<boolean> {
  const emailSince = new Date(Date.now() - EMAIL_WINDOW_MINUTES * 60_000).toISOString();
  const { count: emailCount, error: emailError } = await supabase
    .from("password_reset_attempts")
    .select("id", { count: "exact", head: true })
    .eq("email_hash", emailHash)
    .gte("requested_at", emailSince);

  if (emailError) {
    console.error("Rate limit lookup failed (email):", emailError);
  } else if ((emailCount ?? 0) >= MAX_PER_EMAIL) {
    return true;
  }

  if (ipHash) {
    const ipSince = new Date(Date.now() - IP_WINDOW_MINUTES * 60_000).toISOString();
    const { count: ipCount, error: ipError } = await supabase
      .from("password_reset_attempts")
      .select("id", { count: "exact", head: true })
      .eq("ip_hash", ipHash)
      .gte("requested_at", ipSince);

    if (ipError) {
      console.error("Rate limit lookup failed (ip):", ipError);
    } else if ((ipCount ?? 0) >= MAX_PER_IP) {
      return true;
    }
  }

  return false;
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const json = (body: unknown, status: number) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  // Generic response used for every outcome that depends on whether the address
  // is registered, so this endpoint cannot be used to enumerate accounts.
  const genericSuccess = () => json({ success: true }, 200);

  try {
    const body = await req.json().catch(() => ({}));
    const rawEmail = body?.email;

    if (!isValidEmail(rawEmail)) {
      return json({ error: "A valid email address is required" }, 400);
    }

    const email = rawEmail.trim().toLowerCase();

    const appOrigin = resolveAppOrigin(body?.baseUrl);
    if (!appOrigin) {
      console.error("APP_BASE_URL is not set (or is not a valid http/https URL). Cannot build a reset link.");
      return json({ error: PASSWORD_RESET_NOT_CONFIGURED }, 500);
    }

    if (!isResendConfigured()) {
      console.error("RESEND_API_KEY secret is not set. Cannot send the reset email.");
      return json({ error: PASSWORD_RESET_NOT_CONFIGURED }, 500);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const emailHash = await hashIdentifier(email, serviceRoleKey);
    const ip = clientIp(req);
    const ipHash = ip ? await hashIdentifier(ip, serviceRoleKey) : null;

    if (await isRateLimited(supabaseAdmin, emailHash, ipHash)) {
      // Same generic response as success: a throttled caller learns nothing.
      console.warn("Password reset request throttled.");
      return genericSuccess();
    }

    await supabaseAdmin
      .from("password_reset_attempts")
      .insert({ email_hash: emailHash, ip_hash: ipHash });

    // Opportunistic cleanup so the throttle table stays small and short-lived.
    const retentionCutoff = new Date(Date.now() - ATTEMPT_RETENTION_HOURS * 3_600_000).toISOString();
    await supabaseAdmin
      .from("password_reset_attempts")
      .delete()
      .lt("requested_at", retentionCutoff);

    const resetLink = await generateRecoveryLink(supabaseAdmin, email, appOrigin);
    if (!resetLink) {
      // Almost always "user not found". Never surface that to the caller.
      return genericSuccess();
    }

    const sendError = await sendPasswordResetEmail({ supabaseAdmin, email, resetLink });
    if (sendError) {
      return json({ error: sendError }, 502);
    }

    return genericSuccess();
  } catch (error) {
    console.error("Error in send-password-reset function:", error);
    return json({ error: "Unexpected error handling the password reset request." }, 500);
  }
});
