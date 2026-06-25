import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function escapeHtml(unsafe: string | null | undefined): string {
  if (!unsafe) return "";
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeUrl(url: string): string {
  try {
    const normalizedUrl = url.endsWith('/') ? url.slice(0, -1) : url;
    const parsed = new URL(normalizedUrl);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      return "#";
    }
    return parsed.href;
  } catch {
    return "#";
  }
}

interface SwapOfferNotificationRequest {
  swapRequestId: string;
  baseUrl: string;
}

const ROLE_LABELS: Record<string, string> = {
  "sidesman-standard": "Sidesman",
  "sidesman-sound": "Sidesman (Sound)",
  "sidesman-welcome": "Sidesman (Welcome)",
  reader: "Reader",
  intercessions: "Intercessions",
  collection: "Collection Count",
};

const formatTime = (time: string) => {
  const [hours, minutes] = time.split(":");
  const hour = parseInt(hours, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${minutes} ${ampm}`;
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify user authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });
    
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check if email notifications are enabled
    const { data: setting } = await supabase
      .from("system_settings")
      .select("value")
      .eq("key", "email_on_swap_request")
      .maybeSingle();

    if (setting && (setting.value === false || setting.value === "false")) {
      return new Response(
        JSON.stringify({ success: true, emailsSent: 0, message: "Email notifications are disabled." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { swapRequestId, baseUrl }: SwapOfferNotificationRequest = await req.json();

    // Get the swap request
    const { data: swapRequest, error: swapError } = await supabase
      .from("swap_requests")
      .select("*")
      .eq("id", swapRequestId)
      .single();

    if (swapError || !swapRequest) {
      return new Response(
        JSON.stringify({ error: "Swap request not found" }),
        { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Verify the authenticated user is the one making the offer (to_user_id)
    if (swapRequest.to_user_id !== user.id) {
      // Check if user is admin
      const { data: adminCheck } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'admin')
        .maybeSingle();
      
      if (!adminCheck) {
        return new Response(
          JSON.stringify({ error: 'Forbidden: You can only send notifications for your own swap offers' }),
          { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
    }

    if (!swapRequest.to_user_id || !swapRequest.offered_assignment_id) {
      return new Response(
        JSON.stringify({ error: "No offer on this swap request" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Get original assignment and event
    const { data: originalAssignment } = await supabase
      .from("event_assignments")
      .select("*, events!inner(id, name, date, start_time)")
      .eq("id", swapRequest.event_assignment_id)
      .single();

    // Get offered assignment and event
    const { data: offeredAssignment } = await supabase
      .from("event_assignments")
      .select("*, events!inner(id, name, date, start_time)")
      .eq("id", swapRequest.offered_assignment_id)
      .single();

    if (!originalAssignment || !offeredAssignment) {
      return new Response(
        JSON.stringify({ error: "Assignment not found" }),
        { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Get profiles
    const { data: originalVolunteer } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", swapRequest.from_user_id)
      .single();

    const { data: offeringVolunteer } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", swapRequest.to_user_id)
      .single();

    if (!originalVolunteer || !offeringVolunteer) {
      return new Response(
        JSON.stringify({ error: "Profile not found" }),
        { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const originalEvent = originalAssignment.events;
    const offeredEvent = offeredAssignment.events;

    const formatDate = (dateStr: string) => {
      const date = new Date(dateStr + "T00:00:00");
      return date.toLocaleDateString("en-GB", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      });
    };

    // Send email to original requester
    const emailResponse = await resend.emails.send({
      from: "St Matthews Church <noreply@updates.servetogether.co.uk>",
      to: [originalVolunteer.email],
      subject: `Swap Offer from ${offeringVolunteer.name}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px;">Swap Offer Received!</h1>
          </div>
          
          <div style="background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;">
            <p style="font-size: 16px; margin-bottom: 20px;">Hello <strong>${escapeHtml(originalVolunteer.name)}</strong>,</p>
            
            <p style="font-size: 16px; margin-bottom: 20px;">
              <strong>${escapeHtml(offeringVolunteer.name)}</strong> has offered to swap with you!
            </p>
            
            <div style="background: white; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px; margin: 25px 0;">
              <h3 style="margin-top: 0; color: #dc2626; font-size: 16px;">Your Current Assignment (to give up):</h3>
              <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
                <tr>
                  <td style="padding: 4px 0; color: #6b7280; width: 80px; font-size: 14px;">Event:</td>
                  <td style="padding: 4px 0; color: #111827; font-weight: 500;">${escapeHtml(originalEvent.name)}</td>
                </tr>
                <tr>
                  <td style="padding: 4px 0; color: #6b7280; font-size: 14px;">Date:</td>
                  <td style="padding: 4px 0; color: #111827; font-weight: 500;">${formatDate(originalEvent.date)}</td>
                </tr>
                <tr>
                  <td style="padding: 4px 0; color: #6b7280; font-size: 14px;">Time:</td>
                  <td style="padding: 4px 0; color: #111827; font-weight: 500;">${formatTime(originalEvent.start_time)}</td>
                </tr>
                <tr>
                  <td style="padding: 4px 0; color: #6b7280; font-size: 14px;">Role:</td>
                  <td style="padding: 4px 0;">
                    <span style="background: #fecaca; color: #b91c1c; padding: 2px 8px; border-radius: 12px; font-size: 13px; font-weight: 500;">
                      ${ROLE_LABELS[originalAssignment.role] || originalAssignment.role}
                    </span>
                  </td>
                </tr>
              </table>
            </div>
            
            <div style="text-align: center; margin: 15px 0; font-size: 24px;">⬇️ ⬆️</div>
            
            <div style="background: white; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px; margin: 25px 0;">
              <h3 style="margin-top: 0; color: #059669; font-size: 16px;">You Will Receive:</h3>
              <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
                <tr>
                  <td style="padding: 4px 0; color: #6b7280; width: 80px; font-size: 14px;">Event:</td>
                  <td style="padding: 4px 0; color: #111827; font-weight: 500;">${escapeHtml(offeredEvent.name)}</td>
                </tr>
                <tr>
                  <td style="padding: 4px 0; color: #6b7280; font-size: 14px;">Date:</td>
                  <td style="padding: 4px 0; color: #111827; font-weight: 500;">${formatDate(offeredEvent.date)}</td>
                </tr>
                <tr>
                  <td style="padding: 4px 0; color: #6b7280; font-size: 14px;">Time:</td>
                  <td style="padding: 4px 0; color: #111827; font-weight: 500;">${formatTime(offeredEvent.start_time)}</td>
                </tr>
                <tr>
                  <td style="padding: 4px 0; color: #6b7280; font-size: 14px;">Role:</td>
                  <td style="padding: 4px 0;">
                    <span style="background: #d1fae5; color: #047857; padding: 2px 8px; border-radius: 12px; font-size: 13px; font-weight: 500;">
                      ${ROLE_LABELS[offeredAssignment.role] || offeredAssignment.role}
                    </span>
                  </td>
                </tr>
              </table>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${escapeUrl(baseUrl)}/swaps" 
                 style="display: inline-block; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; text-decoration: none; padding: 14px 30px; border-radius: 8px; font-weight: 600; font-size: 16px;">
                Review & Respond
              </a>
            </div>
            
            <p style="font-size: 14px; color: #6b7280; margin-top: 25px;">
              Log in to accept or decline this swap offer. If you decline, your original swap request will remain open for other volunteers.
            </p>
            
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
            
            <p style="font-size: 12px; color: #9ca3af; text-align: center;">
              Thank you for your service!
            </p>
          </div>
        </body>
        </html>
      `,
    });

    return new Response(
      JSON.stringify({ success: true, emailsSent: 1 }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error in send-swap-offer-notification function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
