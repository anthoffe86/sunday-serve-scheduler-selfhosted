import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { buildOrgFromEmail, getOrgName } from "./org-settings.ts";

// Reuse this type rather than importing the generated types (not available in edge functions)
type SupabaseClient = ReturnType<typeof createClient>;

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;

export const PASSWORD_RESET_NOT_CONFIGURED =
  "Password reset is not configured. Please contact your administrator.";

export function escapeHtml(unsafe: string | null | undefined): string {
  if (!unsafe) return "";
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function escapeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      return "#";
    }
    return parsed.href;
  } catch {
    return "#";
  }
}

export function isValidEmail(value: unknown): value is string {
  return typeof value === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

/** Reduce a URL to a bare origin, or null if it is not a usable http(s) URL. */
export function normalizeOrigin(value: string | undefined | null): string | null {
  if (!value) return null;
  try {
    const parsed = new URL(value.trim());
    if (!["http:", "https:"].includes(parsed.protocol)) return null;
    return parsed.origin;
  } catch {
    return null;
  }
}

/**
 * Decide which site a reset link points at.
 *
 * The caller may suggest an origin (useful for Netlify deploy previews and for
 * local dev on a shifting port) but it is only honoured when explicitly
 * allow-listed via ALLOWED_APP_ORIGINS. Trusting the request body here would let
 * an attacker request a reset with a link pointing at a site they control, then
 * harvest the recovery token when the victim clicks it from their own inbox.
 *
 * Returns null when APP_BASE_URL is unset or unusable, which callers should
 * treat as a configuration error rather than a user error.
 */
export function resolveAppOrigin(requestedBaseUrl: unknown): string | null {
  const configured = normalizeOrigin(Deno.env.get("APP_BASE_URL"));
  const allowed = new Set(
    (Deno.env.get("ALLOWED_APP_ORIGINS") ?? "")
      .split(",")
      .map((entry) => normalizeOrigin(entry))
      .filter((entry): entry is string => entry !== null)
  );
  if (configured) allowed.add(configured);

  if (typeof requestedBaseUrl === "string") {
    const requested = normalizeOrigin(requestedBaseUrl);
    if (requested && allowed.has(requested)) return requested;
  }

  return configured;
}

export function isResendConfigured(): boolean {
  return !!RESEND_API_KEY && !!resend;
}

/**
 * Mint a single-use recovery token and build a link to our own /reset-password
 * route.
 *
 * We deliberately use properties.hashed_token rather than properties
 * .action_link: action_link routes through Supabase's /auth/v1/verify endpoint,
 * which redirects to the project's Site URL setting. That is what produced dead
 * localhost links. The hashed token is redeemed client-side with
 * supabase.auth.verifyOtp({ type: 'recovery', token_hash }).
 *
 * Returns null when no link could be produced — most commonly because no
 * account exists for that address.
 */
export async function generateRecoveryLink(
  supabaseAdmin: SupabaseClient,
  email: string,
  appOrigin: string
): Promise<string | null> {
  const { data, error } = await supabaseAdmin.auth.admin.generateLink({
    type: "recovery",
    email,
    options: { redirectTo: `${appOrigin}/reset-password` },
  });

  const hashedToken = (data as { properties?: { hashed_token?: string } } | null)
    ?.properties?.hashed_token;

  if (error || !hashedToken) {
    console.log(
      "No recovery link generated:",
      error?.message ?? "no hashed_token returned"
    );
    return null;
  }

  return `${appOrigin}/reset-password?token_hash=${encodeURIComponent(hashedToken)}&type=recovery`;
}

/**
 * Which flow produced the email. All three hand the recipient the same kind of
 * single-use recovery link; only the wording differs.
 *
 * - `self`  — the recipient asked for a reset on /forgot-password
 * - `admin` — an administrator started a reset for an existing account
 * - `setup` — an administrator created the account, so there is no password yet
 */
type PasswordEmailVariant = "self" | "admin" | "setup";

function buildPasswordResetEmailHtml(params: {
  orgName: string;
  resetLink: string;
  logoUrl: string;
  variant: PasswordEmailVariant;
}): string {
  const { orgName, resetLink, logoUrl, variant } = params;
  const safeOrgName = escapeHtml(orgName);

  const heading = variant === "setup" ? "Set up your account" : "Reset your password";

  const buttonLabel = variant === "setup" ? "Set Your Password" : "Reset Password";

  const intro = variant === "setup"
    ? `An administrator has created a ${safeOrgName} volunteer account for you.
       Click the button below to choose your password and get started:`
    : variant === "admin"
    ? `An administrator has started a password reset for your ${safeOrgName} account.
       Click the button below to choose a new password:`
    : `We received a request to reset the password for your ${safeOrgName} volunteer account.
       Click the button below to choose a new password:`;

  const footerNote = variant === "setup"
    ? `If the link has expired, use "Forgot password?" on the sign-in page to send yourself a new one.<br>
       If you weren't expecting this, contact your administrator before using the link.`
    : variant === "admin"
    ? `If you weren't expecting this, contact your administrator before using the link.`
    : `If you didn't request a password reset, you can safely ignore this email &mdash; your password will not change.`;

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 24px;">${heading}</h1>
      </div>

      <div style="background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;">
        <p style="font-size: 16px; margin-bottom: 20px;">Hello,</p>

        <p style="font-size: 16px; margin-bottom: 25px;">${intro}</p>

        <div style="text-align: center; margin: 30px 0;">
          <a href="${escapeUrl(resetLink)}"
             style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; padding: 14px 30px; border-radius: 8px; font-weight: 600; font-size: 16px;">
            ${buttonLabel}
          </a>
        </div>

        <p style="font-size: 14px; color: #6b7280; margin-top: 25px;">
          Or copy and paste this link into your browser:
        </p>
        <p style="font-size: 12px; color: #9ca3af; word-break: break-all; background: #f3f4f6; padding: 10px; border-radius: 4px;">
          ${escapeHtml(resetLink)}
        </p>

        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">

        <p style="font-size: 12px; color: #9ca3af; text-align: center;">
          This link can only be used once and expires in 1 hour.<br>
          ${footerNote}
        </p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0 10px;">
        ${logoUrl ? `
        <p style="text-align: center; margin: 0 0 8px;">
          <img src="${escapeUrl(logoUrl)}" alt="ServeTogether" style="height: 24px; width: auto;" />
        </p>` : ''}
        <p style="font-size: 11px; color: #9ca3af; text-align: center;">
          Powered by <a href="https://servetogether.co.uk" style="color: #9ca3af; text-decoration: none;">ServeTogether</a>
        </p>
      </div>
    </body>
    </html>
  `;
}

/**
 * Send one of the branded recovery-link emails via Resend.
 * Returns an error message on failure, or null on success.
 */
async function sendRecoveryLinkEmail(params: {
  supabaseAdmin: SupabaseClient;
  email: string;
  resetLink: string;
  variant: PasswordEmailVariant;
}): Promise<string | null> {
  const { supabaseAdmin, email, resetLink, variant } = params;

  if (!resend) {
    console.error("RESEND_API_KEY secret is not set. Cannot send the email.");
    return PASSWORD_RESET_NOT_CONFIGURED;
  }

  const logoUrl = Deno.env.get("SERVETOGETHER_LOGO_URL") || "";
  const orgName = await getOrgName(supabaseAdmin);
  const from = buildOrgFromEmail(orgName);

  const subject = variant === "setup"
    ? `Set up your ${orgName} volunteer account`
    : `Reset your ${orgName} password`;

  const response = await resend.emails.send({
    from,
    to: [email],
    subject,
    // The link itself is never logged: it is a single-use bearer credential for
    // the recipient's account.
    html: buildPasswordResetEmailHtml({ orgName, resetLink, logoUrl, variant }),
  });

  if (response.error) {
    console.error("Resend rejected the email:", response.error);
    return variant === "setup"
      ? "We couldn't send the account setup email. Please try again shortly."
      : "We couldn't send the reset email. Please try again shortly.";
  }

  console.log(`Recovery-link email sent (variant: ${variant}).`);
  return null;
}

/**
 * Send the branded reset email via Resend.
 * Returns an error message on failure, or null on success.
 */
export async function sendPasswordResetEmail(params: {
  supabaseAdmin: SupabaseClient;
  email: string;
  resetLink: string;
  initiatedByAdmin?: boolean;
}): Promise<string | null> {
  const { supabaseAdmin, email, resetLink, initiatedByAdmin = false } = params;

  return await sendRecoveryLinkEmail({
    supabaseAdmin,
    email,
    resetLink,
    variant: initiatedByAdmin ? "admin" : "self",
  });
}

/**
 * Send the "an administrator created your account, now pick a password" email.
 * Uses the same single-use recovery link as a reset, because a freshly created
 * account only has a throwaway password that is never disclosed to anyone.
 */
export async function sendAccountSetupEmail(params: {
  supabaseAdmin: SupabaseClient;
  email: string;
  setupLink: string;
}): Promise<string | null> {
  const { supabaseAdmin, email, setupLink } = params;

  return await sendRecoveryLinkEmail({
    supabaseAdmin,
    email,
    resetLink: setupLink,
    variant: "setup",
  });
}
