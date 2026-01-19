import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

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
    const parsed = new URL(url);
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
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

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
      
      // Check if they have explicitly marked themselves as unavailable
      // If no record, assume available. If record says available=true, they're available.
      const hasExplicitAvailability = availableUserIds.includes(profile.user_id);
      
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

    // Format date nicely
    const eventDate = new Date(event.date);
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

    // Send emails to eligible volunteers
    let emailsSent = 0;
    const errors: string[] = [];

    for (const profile of eligibleProfiles) {
      try {
        await resend.emails.send({
          from: "Volunteer Scheduler <noreply@updates.lumotutor.co.uk>",
          to: [profile.email],
          subject: `Swap Request: ${roleLabel} on ${formattedDate}`,
          html: `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <h1 style="color: #1a1a1a; font-size: 24px; margin-bottom: 20px;">Swap Request</h1>
              
              <p style="color: #333; font-size: 16px; line-height: 1.5;">
                Hi ${escapeHtml(profile.name)},
              </p>
              
              <p style="color: #333; font-size: 16px; line-height: 1.5;">
                <strong>${escapeHtml(requesterProfile.name)}</strong> has requested a swap for their volunteer assignment and you've been identified as a potential substitute.
              </p>
              
              <div style="background: #f5f5f5; border-radius: 8px; padding: 20px; margin: 20px 0;">
                <h2 style="color: #1a1a1a; font-size: 18px; margin: 0 0 15px 0;">${escapeHtml(event.name)}</h2>
                <p style="color: #666; margin: 5px 0;"><strong>Date:</strong> ${formattedDate}</p>
                <p style="color: #666; margin: 5px 0;"><strong>Time:</strong> ${formatTime(event.start_time)}</p>
                <p style="color: #666; margin: 5px 0;"><strong>Role:</strong> ${roleLabel}</p>
                ${swapRequest.notes ? `<p style="color: #666; margin: 15px 0 5px 0;"><strong>Note from ${escapeHtml(requesterProfile.name)}:</strong> ${escapeHtml(swapRequest.notes)}</p>` : ""}
              </div>
              
              <p style="color: #333; font-size: 16px; line-height: 1.5;">
                If you're able to cover this assignment, please log in to accept the swap request.
              </p>
              
              <a href="${escapeUrl(baseUrl + "/swaps")}" style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0;">
                View Swap Requests
              </a>
              
              <p style="color: #666; font-size: 14px; margin-top: 30px;">
                Thank you for your service!<br>
                The Volunteer Scheduler Team
              </p>
            </div>
          `,
        });
        emailsSent++;
        console.log(`Sent swap notification to ${profile.email}`);
      } catch (emailError: any) {
        console.error(`Failed to send email to ${profile.email}:`, emailError);
        errors.push(`${profile.email}: ${emailError.message}`);
      }
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
