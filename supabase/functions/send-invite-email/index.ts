import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { resolveAppOrigin } from "../_shared/app-origin.ts";
import { buildOrgFromEmail, getOrgName, isNotificationEnabled } from "../_shared/org-settings.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const NOT_CONFIGURED =
  "Invitation links are not configured. Set APP_BASE_URL and try again, or contact your administrator.";

// HTML entity escaping to prevent XSS in email content
function escapeHtml(unsafe: string | null | undefined): string {
  if (!unsafe) return "";
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Validate and sanitize URLs
function escapeUrl(url: string): string {
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

interface InviteEmailRequest {
  /** The invite_tokens.token created by the admin. Everything else is read from that row. */
  token: string;
  /** Suggested origin for the link; only honoured when allow-listed. */
  baseUrl?: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const json = (body: unknown, status: number) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const logoUrl = Deno.env.get("SERVETOGETHER_LOGO_URL") || "";
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // This endpoint sends mail from the organisation's own domain, so it is only
    // ever driven by an authenticated admin of the organisation that owns the
    // invite -- never by whoever happens to hold the anon key.
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return json({ error: "Unauthorized" }, 401);
    }

    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !user) {
      return json({ error: "Unauthorized" }, 401);
    }

    const { token, baseUrl }: InviteEmailRequest = await req.json();

    if (!token || typeof token !== "string") {
      return json({ error: "token is required" }, 400);
    }

    // The invite row is the source of truth for the recipient and the
    // organisation. Taking the name, address or link from the request body would
    // let a caller send arbitrary mail under the organisation's branding.
    const { data: invite, error: inviteError } = await supabase
      .from("invite_tokens")
      .select("token, name, email, org_id, used_at, expires_at")
      .eq("token", token)
      .maybeSingle();

    if (inviteError) {
      console.error("Failed to load the invite token:", inviteError);
      return json({ error: "Failed to load the invitation" }, 500);
    }

    if (!invite || invite.used_at || new Date(invite.expires_at as string) <= new Date()) {
      // Deliberately vague: this is also the response an outsider guessing tokens gets.
      return json({ error: "Invalid or expired invitation" }, 404);
    }

    // invite_tokens.org_id is NOT NULL, so this only trips on schema drift --
    // and without it the org check below would silently match nothing.
    const inviteOrgId = invite.org_id as string | null;
    if (!inviteOrgId) {
      console.error("Invite token has no org_id; refusing to send.");
      return json({ error: "Invitation is not attached to an organisation" }, 500);
    }

    const { data: adminRole, error: roleError } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .eq("org_id", inviteOrgId)
      .maybeSingle();

    if (roleError) {
      console.error("Failed to check the caller's role:", roleError);
      return json({ error: "Failed to authorise the request" }, 500);
    }

    if (!adminRole) {
      return json({ error: "Forbidden: admin of the inviting organisation required" }, 403);
    }

    // Only an allow-listed origin is honoured, so an invite created from a deploy
    // preview or from localhost cannot email a link to that origin.
    const appOrigin = resolveAppOrigin(baseUrl);
    if (!appOrigin) {
      console.error("APP_BASE_URL is not set (or is not a valid http/https URL). Cannot build an invite link.");
      return json({ error: NOT_CONFIGURED }, 500);
    }

    const inviteLink = `${appOrigin}/invite?token=${encodeURIComponent(invite.token as string)}`;

    const emailsEnabled = await isNotificationEnabled(supabase, "email_on_invite", inviteOrgId);
    if (!emailsEnabled) {
      console.log("Invite emails are disabled for this organisation. Returning the link only.");
      return json(
        {
          success: true,
          inviteLink,
          emailed: false,
          emailSkippedReason: "disabled",
          message: "Invite emails are switched off for this organisation.",
        },
        200
      );
    }

    if (!RESEND_API_KEY || !resend) {
      console.error("RESEND_API_KEY secret is not set. Cannot send the invite email.");
      return json(
        {
          success: true,
          inviteLink,
          emailed: false,
          emailError: "RESEND_API_KEY secret is not set",
        },
        200
      );
    }

    const orgName = await getOrgName(supabase);
    const resendFrom = buildOrgFromEmail(orgName);
    const name = invite.name as string;
    const email = invite.email as string;

    console.log(`Sending invite email for org ${inviteOrgId}`);

    const emailResponse = await resend.emails.send({
      from: resendFrom,
      to: [email],
      subject: `You've been invited to join ${orgName} as a volunteer`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px;">Welcome to ${escapeHtml(orgName)}</h1>
          </div>

          <div style="background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;">
            <p style="font-size: 16px; margin-bottom: 20px;">Hello <strong>${escapeHtml(name)}</strong>,</p>

            <p style="font-size: 16px; margin-bottom: 20px;">
              You've been invited to join ${escapeHtml(orgName)} as a volunteer. We use this platform to help manage the volunteer rota.
            </p>

            <p style="font-size: 16px; margin-bottom: 25px;">
              Click the button below to create your account and get started:
            </p>

            <div style="text-align: center; margin: 30px 0;">
              <a href="${escapeUrl(inviteLink)}"
                 style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; padding: 14px 30px; border-radius: 8px; font-weight: 600; font-size: 16px;">
                Create Your Account
              </a>
            </div>

            <p style="font-size: 14px; color: #6b7280; margin-top: 25px;">
              Or copy and paste this link into your browser:
            </p>
            <p style="font-size: 12px; color: #9ca3af; word-break: break-all; background: #f3f4f6; padding: 10px; border-radius: 4px;">
              ${escapeHtml(inviteLink)}
            </p>

            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">

            <p style="font-size: 12px; color: #9ca3af; text-align: center;">
              This invitation link will expire in 7 days.<br>
              If you didn't expect this invitation, you can safely ignore this email.
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
      `,
    });

    if (emailResponse.error) {
      console.error("Resend rejected the invite email:", emailResponse.error);
      return json(
        {
          success: true,
          inviteLink,
          emailed: false,
          emailError: "We couldn't send the invitation email. Please share the link manually.",
        },
        200
      );
    }

    // The link is not logged: it is a bearer credential for creating that account.
    console.log("Invite email sent successfully.");

    return json({ success: true, inviteLink, emailed: true }, 200);
  } catch (error: any) {
    console.error("Error in send-invite-email function:", error);
    return json({ error: error?.message ?? "Unexpected error" }, 500);
  }
};

serve(handler);
