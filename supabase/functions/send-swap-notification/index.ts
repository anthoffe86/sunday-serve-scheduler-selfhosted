import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { getOrgName } from "../_shared/org-settings.ts";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
    // Ensure baseUrl doesn't end with a slash to avoid double slashes in links
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

interface SwapNotificationRequest {
  swapRequestId: string;
  baseUrl: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const logoUrl = Deno.env.get("SERVETOGETHER_LOGO_URL") || "";

    // Verify user authentication (any authenticated user can trigger swap notifications for their own swaps)
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
  const orgName = await getOrgName(supabase);

    // Check if email notifications are enabled by admin
    const { data: setting, error: settingError } = await supabase
      .from("system_settings")
      .select("value")
      .eq("key", "email_on_swap_request")
      .maybeSingle();

    console.log("Admin setting check (email_on_swap_request):", { setting, error: settingError });

    if (settingError) {
      console.error("Error fetching system setting:", settingError);
    } else if (setting && (setting.value === false || setting.value === "false")) {
      console.log("Swap notification emails are disabled in system settings. Returning early.");
      return new Response(
        JSON.stringify({
          success: true,
          emailsSent: 0,
          message: "Email notifications are disabled by admin.",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Proceeding with swap notification emails...");

    const { swapRequestId, baseUrl }: SwapNotificationRequest = await req.json();

    console.log("Processing swap notification for request:", swapRequestId);

    // Get the swap request with related data
    const { data: swapRequest, error: swapError } = await supabase
      .from("swap_requests")
      .select("*, event_assignment_id")
      .eq("id", swapRequestId)
      .single();

    if (swapError || !swapRequest) {
      console.error("Failed to fetch swap request:", swapError);
      return new Response(
        JSON.stringify({ error: "Swap request not found" }),
        { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Verify the authenticated user owns this swap request
    if (swapRequest.from_user_id !== user.id) {
      // Check if user is admin
      const { data: adminCheck } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'admin')
        .maybeSingle();
      
      if (!adminCheck) {
        return new Response(
          JSON.stringify({ error: 'Forbidden: You can only send notifications for your own swap requests' }),
          { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
    }

    // Get the event assignment details
    const { data: assignment, error: assignmentError } = await supabase
      .from("event_assignments")
      .select("*")
      .eq("id", swapRequest.event_assignment_id)
      .single();

    if (assignmentError || !assignment) {
      console.error("Failed to fetch assignment:", assignmentError);
      return new Response(
        JSON.stringify({ error: "Assignment not found" }),
        { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Get the event details
    const { data: event, error: eventError } = await supabase
      .from("events")
      .select("*")
      .eq("id", assignment.event_id)
      .single();

    if (eventError || !event) {
      console.error("Failed to fetch event:", eventError);
      return new Response(
        JSON.stringify({ error: "Event not found" }),
        { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Get the requester's profile
    const { data: requesterProfile, error: requesterError } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", swapRequest.from_user_id)
      .single();

    if (requesterError || !requesterProfile) {
      console.error("Failed to fetch requester profile:", requesterError);
      return new Response(
        JSON.stringify({ error: "Requester profile not found" }),
        { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Get all volunteers who:
    // 1. Are available on this date
    // 2. Have this role in their preferences
    // 3. Are not the requester
    // 4. Are active

    // First get availability for the date
    const { data: availableVolunteers, error: availabilityError } = await supabase
      .from("availability")
      .select("user_id")
      .eq("date", event.date)
      .eq("available", true);

    if (availabilityError) {
      console.error("Failed to fetch availability:", availabilityError);
    }

    const availableUserIds = availableVolunteers?.map((a) => a.user_id) || [];

    // Get volunteers with this role preference
    const { data: rolePreferences, error: rolePrefsError } = await supabase
      .from("role_preferences")
      .select("user_id")
      .eq("role", assignment.role);

    if (rolePrefsError) {
      console.error("Failed to fetch role preferences:", rolePrefsError);
    }

    const rolePreferenceUserIds = rolePreferences?.map((r) => r.user_id) || [];

    // Get active profiles excluding the requester
    const { data: allProfiles, error: profilesError } = await supabase
      .from("profiles")
      .select("*")
      .eq("active", true)
      .neq("user_id", swapRequest.from_user_id);

    if (profilesError) {
      console.error("Failed to fetch profiles:", profilesError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch profiles" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Filter to eligible volunteers (have role preference AND either available or no availability record)
    // If no availability record exists for a date, we assume they're available
    const eligibleProfiles = allProfiles.filter((profile) => {
      const hasRolePreference = rolePreferenceUserIds.includes(profile.user_id);

      // For now, let's send to all volunteers with the role preference
      // This is more inclusive and ensures the swap gets coverage
      return hasRolePreference;
    });

    console.log(`Found ${eligibleProfiles.length} eligible volunteers for swap notification`);

    if (eligibleProfiles.length === 0) {
      console.log("No eligible volunteers found for swap notification");
      return new Response(
        JSON.stringify({ success: true, emailsSent: 0, message: "No eligible volunteers found" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Format date nicely - use T00:00:00 to avoid timezone shifts
    const eventDate = new Date(event.date + "T00:00:00");
    const formattedDate = eventDate.toLocaleDateString("en-GB", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });

    // Format time
    const formatTime = (time: string) => {
      const [hours, minutes] = time.split(":");
      const hour = parseInt(hours, 10);
      const ampm = hour >= 12 ? "PM" : "AM";
      const displayHour = hour % 12 || 12;
      return `${displayHour}:${minutes} ${ampm}`;
    };

    // Role labels mapping
    const ROLE_LABELS: Record<string, string> = {
      "sidesman-standard": "Sidesman",
      "sidesman-sound": "Sidesman (Sound)",
      "sidesman-welcome": "Sidesman (Welcome)",
      reader: "Reader",
      intercessions: "Intercessions",
      collection: "Collection Count",
    };

    const roleLabel = ROLE_LABELS[assignment.role] || assignment.role;

    // Prepare batch of emails
    const emailBatch = eligibleProfiles.map((profile) => ({
      from: `${orgName} <noreply@updates.servetogether.co.uk>`,
      to: [profile.email],
      subject: `${orgName} Swap Request: ${roleLabel} on ${formattedDate}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #60a5fa 0%, #2563eb 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px;">Swap Request</h1>
          </div>
          
          <div style="background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;">
            <p style="font-size: 16px; margin-bottom: 20px;">Hello <strong>${escapeHtml(profile.name)}</strong>,</p>
            
            <p style="font-size: 16px; margin-bottom: 20px;">
              <strong>${escapeHtml(requesterProfile.name)}</strong> has requested a swap for their volunteer assignment and you've been identified as a potential substitute.
            </p>
            
            <div style="background: white; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px; margin: 25px 0; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
              <h3 style="margin-top: 0; color: #111827; font-size: 18px;">${escapeHtml(event.name)}</h3>
              <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
                <tr>
                  <td style="padding: 4px 0; color: #6b7280; width: 80px; font-size: 14px;">Date:</td>
                  <td style="padding: 4px 0; color: #111827; font-weight: 500;">${formattedDate}</td>
                </tr>
                <tr>
                  <td style="padding: 4px 0; color: #6b7280; font-size: 14px;">Time:</td>
                  <td style="padding: 4px 0; color: #111827; font-weight: 500;">${formatTime(event.start_time)}</td>
                </tr>
                <tr>
                  <td style="padding: 4px 0; color: #6b7280; font-size: 14px;">Role:</td>
                  <td style="padding: 4px 0;">
                    <span style="background: #e0e7ff; color: #4338ca; padding: 2px 8px; border-radius: 12px; font-size: 13px; font-weight: 500;">
                      ${roleLabel}
                    </span>
                  </td>
                </tr>
                ${swapRequest.notes ? `
                <tr>
                  <td style="padding: 8px 0 4px; color: #6b7280; font-size: 14px; vertical-align: top;">Note from ${escapeHtml(requesterProfile.name)}:</td>
                  <td style="padding: 8px 0 4px; color: #4b5563; font-size: 14px; font-style: italic;">${escapeHtml(swapRequest.notes)}</td>
                </tr>` : ''}
              </table>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${escapeUrl(baseUrl)}/swaps" 
                 style="display: inline-block; background: linear-gradient(135deg, #60a5fa 0%, #2563eb 100%); color: white; text-decoration: none; padding: 14px 30px; border-radius: 8px; font-weight: 600; font-size: 16px;">
                View Swap Requests
              </a>
            </div>
            
            <p style="font-size: 14px; color: #6b7280; margin-top: 25px;">
              If you're able to cover this assignment, please log in to accept the swap request.
            </p>
            
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
            
            <p style="font-size: 12px; color: #9ca3af; text-align: center;">
              Thank you for your service!
            </p>
            ${logoUrl ? `
            <p style="text-align: center; margin: 8px 0 6px;">
              <img src="${escapeUrl(logoUrl)}" alt="ServeTogether" style="height: 16px; width: auto;" />
            </p>` : ''}
            <p style="font-size: 11px; color: #9ca3af; text-align: center; margin-top: 8px;">
              Powered by <a href="https://servetogether.co.uk" style="color: #9ca3af; text-decoration: none;">ServeTogether</a>
            </p>
          </div>
        </body>
        </html>
      `,
    }));

    // Send emails in batches of 100 (Resend limit)
    let emailsSent = 0;
    const errors: string[] = [];

    for (let i = 0; i < emailBatch.length; i += 100) {
      const batch = emailBatch.slice(i, i + 100);
      try {
        console.log(`Sending batch of ${batch.length} emails to Resend...`);
        const { data: batchData, error: batchError } = await resend.batch.send(batch);
        if (batchError) {
          console.error("Batch send error details:", batchError);
          errors.push(`Batch ${i / 100 + 1} failed: ${batchError.message}`);
        } else if (batchData) {
          emailsSent += batchData.data?.length || 0;
          console.log(`Successfully sent batch of ${batchData.data?.length} emails`);
        }
      } catch (err: any) {
        console.error("Unexpected batch send error:", err);
        errors.push(`Batch ${i / 100 + 1} unexpected error: ${err.message}`);
      }
    }

    if (errors.length > 0 && emailsSent === 0) {
      console.error("All email batches failed:", errors);
      return new Response(
        JSON.stringify({
          success: false,
          emailsSent: 0,
          totalEligible: eligibleProfiles.length,
          errors,
        }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log(`Swap notification complete. Sent ${emailsSent} emails.`);

    return new Response(
      JSON.stringify({
        success: true,
        emailsSent,
        totalEligible: eligibleProfiles.length,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error in send-swap-notification function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
