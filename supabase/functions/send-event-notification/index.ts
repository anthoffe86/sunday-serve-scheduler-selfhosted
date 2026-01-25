import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
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

const ROLE_LABELS: Record<string, string> = {
  "sidesman-standard": "Sidesman (Standard)",
  "sidesman-sound": "Sidesman (Sound)",
  "sidesman-welcome": "Sidesman (Welcome)",
  "reader": "Reader",
  "intercessions": "Intercessions",
  "collection": "Collection",
};

interface NotificationRequest {
  eventIds: string[];
  baseUrl: string;
  userIds?: string[];
}

const formatDate = (dateStr: string): string => {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
};

const formatTime = (time: string): string => {
  const [hours, minutes] = time.split(':');
  const hour = parseInt(hours, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${minutes} ${ampm}`;
};

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Authorization: allow service role (internal calls from other edge functions) or require admin
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Check if this is an internal service role call (e.g., from confirm-swap, accept-swap-request)
    const token = authHeader.replace('Bearer ', '');
    const isServiceRoleCall = token === supabaseServiceKey;

    // Use service role client for DB operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // If not a service role call, verify user is admin
    if (!isServiceRoleCall) {
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

      // Check admin status for direct client calls
      const { data: adminCheck } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'admin')
        .maybeSingle();
      
      if (!adminCheck) {
        return new Response(
          JSON.stringify({ error: 'Forbidden: Admin access required' }),
          { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
    } else {
      console.log("Service role call detected - skipping admin check (internal edge function call)");
    }

    const { eventIds, baseUrl, userIds }: NotificationRequest = await req.json();

    // Check if email notifications are enabled by admin
    const settingKey = (userIds && userIds.length > 0) ? "email_on_assignment_add" : "email_on_publish";
    const { data: setting, error: settingError } = await supabase
      .from("system_settings")
      .select("value")
      .eq("key", settingKey)
      .maybeSingle();

    console.log(`Admin setting check (${settingKey}):`, { setting, error: settingError });

    if (settingError) {
      console.error(`Error fetching system setting ${settingKey}:`, settingError);
    } else if (setting && (setting.value === false || setting.value === "false")) {
      console.log(`Email notifications (${settingKey}) are disabled in system settings. Returning early.`);
      return new Response(
        JSON.stringify({
          success: true,
          emailsSent: 0,
          message: `Email notifications (${settingKey}) are disabled by admin.`,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Proceeding with ${settingKey} emails...`);

    console.log(`Sending notifications for ${eventIds.length} events${userIds ? ` to ${userIds.length} specific users` : ''}`);

    // Fetch events with their assignments
    const { data: events, error: eventsError } = await supabase
      .from('events')
      .select(`
        id,
        name,
        date,
        start_time
      `)
      .in('id', eventIds);

    if (eventsError) throw eventsError;

    // Fetch assignments with volunteer info
    const { data: assignments, error: assignmentsError } = await supabase
      .from('event_assignments')
      .select(`
        event_id,
        role,
        volunteer_id
      `)
      .in('event_id', eventIds);

    if (assignmentsError) throw assignmentsError;

    // Fetch all relevant profiles
    let volunteerIds = [...new Set(assignments?.map(a => a.volunteer_id) || [])];

    if (userIds && userIds.length > 0) {
      console.log(`Filtering notifications. Request UserIDs: ${userIds.join(',')}`);
      const originalCount = volunteerIds.length;
      volunteerIds = volunteerIds.filter(id => userIds.includes(id));
      console.log(`Filtered volunteers from ${originalCount} to ${volunteerIds.length}`);
    } else {
      console.log('No userIds filter provided (or empty). Broadcasting to all.');
    }

    if (volunteerIds.length === 0) {
      return new Response(
        JSON.stringify({ success: true, emailsSent: 0, message: 'No volunteers to notify' }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('user_id, name, email')
      .in('user_id', volunteerIds);

    if (profilesError) throw profilesError;

    const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);

    // Group assignments by volunteer
    const volunteerAssignments = new Map<string, { email: string; name: string; events: { date: string; name: string; time: string; role: string }[] }>();

    for (const assignment of assignments || []) {
      const profile = profileMap.get(assignment.volunteer_id);
      if (!profile) continue;

      const event = events?.find(e => e.id === assignment.event_id);
      if (!event) continue;

      if (!volunteerAssignments.has(assignment.volunteer_id)) {
        volunteerAssignments.set(assignment.volunteer_id, {
          email: profile.email,
          name: profile.name,
          events: []
        });
      }

      volunteerAssignments.get(assignment.volunteer_id)!.events.push({
        date: event.date,
        name: event.name,
        time: event.start_time,
        role: assignment.role
      });
    }

    // Send emails to each volunteer
    // Prepare batch emails
    const emailBatch = [];

    for (const [volunteerId, data] of volunteerAssignments) {
      // Sort events by date
      data.events.sort((a, b) => a.date.localeCompare(b.date));

      const eventRows = data.events.map(e => `
        <tr>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">
            <strong>${formatDate(e.date)}</strong><br>
            <span style="color: #6b7280; font-size: 14px;">${escapeHtml(e.name)}</span>
          </td>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center;">
            ${formatTime(e.time)}
          </td>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">
            <span style="background: #ede9fe; color: #7c3aed; padding: 4px 10px; border-radius: 12px; font-size: 13px;">
              ${ROLE_LABELS[e.role] || escapeHtml(e.role)}
            </span>
          </td>
        </tr>
      `).join('');

      emailBatch.push({
        from: "St Matthews Church <noreply@updates.lumotutor.co.uk>",
        to: [data.email],
        subject: `Your St Matthews Church - ${data.events.length} Assignment${data.events.length > 1 ? 's' : ''} Confirmed`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 24px;">Your Schedule is Confirmed</h1>
            </div>
            
            <div style="background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;">
              <p style="font-size: 16px; margin-bottom: 20px;">Hello <strong>${escapeHtml(data.name)}</strong>,</p>
              
              <p style="font-size: 16px; margin-bottom: 20px;">
                Great news! Your volunteer assignments have been published. Here's your upcoming schedule:
              </p>
              
              <table style="width: 100%; border-collapse: collapse; margin: 25px 0; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                <thead>
                  <tr style="background: #f3f4f6;">
                    <th style="padding: 12px; text-align: left; font-weight: 600; color: #374151;">Date</th>
                    <th style="padding: 12px; text-align: center; font-weight: 600; color: #374151;">Time</th>
                    <th style="padding: 12px; text-align: left; font-weight: 600; color: #374151;">Role</th>
                  </tr>
                </thead>
                <tbody>
                  ${eventRows}
                </tbody>
              </table>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${escapeUrl(baseUrl + "/schedule")}" 
                   style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; padding: 14px 30px; border-radius: 8px; font-weight: 600; font-size: 16px;">
                  View Full Schedule
                </a>
              </div>
              
              <p style="font-size: 14px; color: #6b7280; margin-top: 25px;">
                If you're unable to attend any of these dates, please log in to request a swap or update your availability.
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
    }

    let emailsSent = 0;
    const errors: string[] = [];

    // Send in batches of 100 (Resend limit per batch request)
    const BATCH_SIZE = 100;
    for (let i = 0; i < emailBatch.length; i += BATCH_SIZE) {
      const currentBatch = emailBatch.slice(i, i + BATCH_SIZE);
      console.log(`Sending batch ${i / BATCH_SIZE + 1} (${currentBatch.length} emails)`);

      try {
        const { data: batchData, error: batchError } = await resend.batch.send(currentBatch);

        if (batchError) {
          console.error(`Batch error:`, batchError);
          errors.push(`Batch ${i / BATCH_SIZE + 1} failed: ${batchError.message}`);
        } else if (batchData && batchData.data) {
          emailsSent += batchData.data.length;
          console.log(`Successfully sent batch ${i / BATCH_SIZE + 1}`);
        }
      } catch (err: any) {
        console.error(`Batch exception:`, err);
        errors.push(`Batch ${i / BATCH_SIZE + 1} exception: ${err.message}`);
      }
    }

    console.log(`Sent ${emailsSent} notification emails`);

    return new Response(
      JSON.stringify({
        success: true,
        emailsSent,
        totalVolunteers: volunteerAssignments.size,
        errors: errors.length > 0 ? errors : undefined
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in send-event-notification function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
