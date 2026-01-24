import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const resend = new Resend(RESEND_API_KEY);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface RemovalNotificationRequest {
  volunteerId: string;
  eventName: string;
  eventDate: string;
  role: string;
  reason?: string;
  baseUrl: string;
}

const formatDate = (dateStr: string): string => {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify admin authorization
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });
    
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use service role client
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Check admin status
    const { data: adminCheck } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle();
    
    if (!adminCheck) {
      return new Response(
        JSON.stringify({ error: 'Forbidden: Admin access required' }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if email notifications are enabled by admin
    const { data: setting, error: settingError } = await supabase
      .from("system_settings")
      .select("value")
      .eq("key", "email_on_assignment_remove")
      .maybeSingle();

    console.log("Admin setting check (email_on_assignment_remove):", { setting, error: settingError });

    if (settingError) {
      console.error("Error fetching system setting email_on_assignment_remove:", settingError);
    } else if (setting && (setting.value === false || setting.value === "false")) {
      console.log("Assignment removal emails are disabled in system settings. Returning early.");
      return new Response(
        JSON.stringify({
          success: true,
          message: "Email notifications are disabled by admin.",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Proceeding with assignment removal notification email...");

    const {
      volunteerId,
      eventName,
      eventDate,
      role,
      reason,
      baseUrl,
    }: RemovalNotificationRequest = await req.json();

    // Get volunteer email
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("email, name")
      .eq("user_id", volunteerId)
      .single();

    if (profileError || !profile || !profile.email) {
      console.error("Profile not found or no email:", profileError);
      return new Response(
        JSON.stringify({ error: "Volunteer profile not found" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

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

    const ROLE_LABELS: Record<string, string> = {
      "sidesman-standard": "Sidesman (Standard)",
      "sidesman-sound": "Sidesman (Sound)",
      "sidesman-welcome": "Sidesman (Welcome)",
      "reader": "Reader",
      "intercessions": "Intercessions",
      "collection": "Collection",
    };

    const { data: emailData, error: emailError } = await resend.emails.send({
      from: "St Matthews Church <noreply@updates.lumotutor.co.uk>",
      to: [profile.email],
      subject: `Service Update: Removed from ${eventName}`,
      html: `
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
            </head>
            <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
              <div style="background: linear-gradient(135deg, #f87171 0%, #dc2626 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
                <h1 style="color: white; margin: 0; font-size: 24px;">Service Schedule Update</h1>
              </div>
              
              <div style="background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;">
                <p style="font-size: 16px; margin-bottom: 20px;">Hello <strong>${escapeHtml(profile.name)}</strong>,</p>
                
                <p style="font-size: 16px; margin-bottom: 20px;">
                  You have been removed from the schedule for the following service:
                </p>
                
                <div style="background: white; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px; margin: 25px 0; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                  <h3 style="margin-top: 0; color: #111827; font-size: 18px;">${escapeHtml(eventName)}</h3>
                  <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
                    <tr>
                      <td style="padding: 4px 0; color: #6b7280; width: 80px; font-size: 14px;">Date:</td>
                      <td style="padding: 4px 0; color: #111827; font-weight: 500;">${formatDate(eventDate)}</td>
                    </tr>
                    <tr>
                      <td style="padding: 4px 0; color: #6b7280; font-size: 14px;">Role:</td>
                      <td style="padding: 4px 0;">
                        <span style="background: #fee2e2; color: #b91c1c; padding: 2px 8px; border-radius: 12px; font-size: 13px; font-weight: 500;">
                          ${ROLE_LABELS[role] || escapeHtml(role)}
                        </span>
                      </td>
                    </tr>
                    ${reason ? `
                    <tr>
                      <td style="padding: 8px 0 4px; color: #6b7280; font-size: 14px; vertical-align: top;">Reason:</td>
                      <td style="padding: 8px 0 4px; color: #4b5563; font-size: 14px; font-style: italic;">${escapeHtml(reason)}</td>
                    </tr>` : ''}
                  </table>
                </div>
                
                <div style="text-align: center; margin: 30px 0;">
                  <a href="${escapeUrl(baseUrl + "/dashboard")}" 
                     style="display: inline-block; background: #4b5563; color: white; text-decoration: none; padding: 12px 25px; border-radius: 8px; font-weight: 600; font-size: 16px;">
                    View Dashboard
                  </a>
                </div>
                
                <p style="font-size: 14px; color: #6b7280; margin-top: 25px;">
                  If you think this is a mistake or have questions, please contact your administrator.
                </p>
                
                <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
                
                <p style="font-size: 12px; color: #9ca3af; text-align: center;">
                  Thank you for your continued support and understanding.
                </p>
              </div>
            </body>
            </html>
            `,
    });

    if (emailError) {
      throw emailError;
    }

    return new Response(JSON.stringify(emailData), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
