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

// Generate a random token for invitation responses
function generateToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

const ROLE_LABELS: Record<string, string> = {
  "sidesman-standard": "Sidesman (Standard)",
  "sidesman-sound": "Sidesman (Sound)",
  "sidesman-welcome": "Sidesman (Welcome)",
  "reader": "Reader",
  "intercessions": "Intercessions",
  "collection": "Collection",
};

interface InvitationRequest {
  eventIds: string[];
  baseUrl: string;
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
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { eventIds, baseUrl }: InvitationRequest = await req.json();

    console.log(`Sending invitations for ${eventIds.length} events`);

    // Check if email notifications are enabled
    const { data: setting, error: settingError } = await supabase
      .from("system_settings")
      .select("value")
      .eq("key", "email_on_publish")
      .maybeSingle();

    if (settingError) {
      console.error("Error fetching system setting:", settingError);
    } else if (setting && (setting.value === false || setting.value === "false")) {
      console.log("Email notifications are disabled. Returning early.");
      return new Response(
        JSON.stringify({
          success: true,
          emailsSent: 0,
          message: "Email notifications are disabled by admin.",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch events
    const { data: events, error: eventsError } = await supabase
      .from('events')
      .select('id, name, date, start_time')
      .in('id', eventIds);

    if (eventsError) throw eventsError;

    // Fetch assignments that are in 'proposed' status (ready to be invited)
    const { data: assignments, error: assignmentsError } = await supabase
      .from('event_assignments')
      .select('id, event_id, role, volunteer_id, status, invitation_token')
      .in('event_id', eventIds)
      .eq('status', 'proposed');

    if (assignmentsError) throw assignmentsError;

    if (!assignments || assignments.length === 0) {
      return new Response(
        JSON.stringify({ success: true, emailsSent: 0, message: 'No proposed assignments to invite' }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Generate invitation tokens for each assignment
    const assignmentUpdates = assignments.map(a => ({
      id: a.id,
      status: 'invited' as const,
      invited_at: new Date().toISOString(),
      invitation_token: generateToken(),
    }));

    // Update assignments to 'invited' status with tokens
    for (const update of assignmentUpdates) {
      const { error: updateError } = await supabase
        .from('event_assignments')
        .update({
          status: update.status,
          invited_at: update.invited_at,
          invitation_token: update.invitation_token,
        })
        .eq('id', update.id);

      if (updateError) {
        console.error(`Failed to update assignment ${update.id}:`, updateError);
      }
    }

    // Update events with invitations_sent_at
    const { error: eventUpdateError } = await supabase
      .from('events')
      .update({ invitations_sent_at: new Date().toISOString() })
      .in('id', eventIds);

    if (eventUpdateError) {
      console.error('Failed to update events invitations_sent_at:', eventUpdateError);
    }

    // Get volunteer profiles
    const volunteerIds = [...new Set(assignments.map(a => a.volunteer_id))];
    
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('user_id, name, email')
      .in('user_id', volunteerIds);

    if (profilesError) throw profilesError;

    const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);
    const tokenMap = new Map(assignmentUpdates.map(a => [a.id, a.invitation_token]));

    // Group assignments by volunteer
    const volunteerInvitations = new Map<string, {
      email: string;
      name: string;
      invitations: {
        assignmentId: string;
        token: string;
        eventName: string;
        date: string;
        time: string;
        role: string;
      }[];
    }>();

    for (const assignment of assignments) {
      const profile = profileMap.get(assignment.volunteer_id);
      if (!profile) continue;

      const event = events?.find(e => e.id === assignment.event_id);
      if (!event) continue;

      const token = tokenMap.get(assignment.id);
      if (!token) continue;

      if (!volunteerInvitations.has(assignment.volunteer_id)) {
        volunteerInvitations.set(assignment.volunteer_id, {
          email: profile.email,
          name: profile.name,
          invitations: []
        });
      }

      volunteerInvitations.get(assignment.volunteer_id)!.invitations.push({
        assignmentId: assignment.id,
        token,
        eventName: event.name,
        date: event.date,
        time: event.start_time,
        role: assignment.role,
      });
    }

    // Prepare batch emails
    const emailBatch = [];

    for (const [volunteerId, data] of volunteerInvitations) {
      // Sort invitations by date
      data.invitations.sort((a, b) => a.date.localeCompare(b.date));

      const invitationRows = data.invitations.map(inv => {
        const acceptUrl = `${escapeUrl(baseUrl)}/respond-invitation?token=${inv.token}&action=accept`;
        const declineUrl = `${escapeUrl(baseUrl)}/respond-invitation?token=${inv.token}&action=decline`;
        
        return `
          <tr>
            <td style="padding: 16px; border-bottom: 1px solid #e5e7eb;">
              <strong>${formatDate(inv.date)}</strong><br>
              <span style="color: #6b7280; font-size: 14px;">${escapeHtml(inv.eventName)}</span>
            </td>
            <td style="padding: 16px; border-bottom: 1px solid #e5e7eb; text-align: center;">
              ${formatTime(inv.time)}
            </td>
            <td style="padding: 16px; border-bottom: 1px solid #e5e7eb;">
              <span style="background: #ede9fe; color: #7c3aed; padding: 4px 10px; border-radius: 12px; font-size: 13px;">
                ${ROLE_LABELS[inv.role] || escapeHtml(inv.role)}
              </span>
            </td>
            <td style="padding: 16px; border-bottom: 1px solid #e5e7eb; text-align: center;">
              <a href="${acceptUrl}" 
                 style="display: inline-block; background: #10b981; color: white; text-decoration: none; padding: 8px 16px; border-radius: 6px; font-size: 13px; font-weight: 500; margin-right: 8px;">
                Accept
              </a>
              <a href="${declineUrl}" 
                 style="display: inline-block; background: #ef4444; color: white; text-decoration: none; padding: 8px 16px; border-radius: 6px; font-size: 13px; font-weight: 500;">
                Decline
              </a>
            </td>
          </tr>
        `;
      }).join('');

      // Also include a bulk accept all link
      const allTokens = data.invitations.map(i => i.token).join(',');
      const acceptAllUrl = `${escapeUrl(baseUrl)}/respond-invitation?tokens=${allTokens}&action=accept`;
      const viewAllUrl = `${escapeUrl(baseUrl)}/invitations`;

      emailBatch.push({
        from: "St Matthews Church <noreply@updates.lumotutor.co.uk>",
        to: [data.email],
        subject: `You're Invited to Serve - ${data.invitations.length} Assignment${data.invitations.length > 1 ? 's' : ''}`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 700px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 24px;">You're Invited to Serve</h1>
            </div>
            
            <div style="background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;">
              <p style="font-size: 16px; margin-bottom: 20px;">Hello <strong>${escapeHtml(data.name)}</strong>,</p>
              
              <p style="font-size: 16px; margin-bottom: 20px;">
                You've been invited to serve at the following events. Please respond to confirm your availability:
              </p>
              
              <table style="width: 100%; border-collapse: collapse; margin: 25px 0; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                <thead>
                  <tr style="background: #f3f4f6;">
                    <th style="padding: 12px; text-align: left; font-weight: 600; color: #374151;">Date</th>
                    <th style="padding: 12px; text-align: center; font-weight: 600; color: #374151;">Time</th>
                    <th style="padding: 12px; text-align: left; font-weight: 600; color: #374151;">Role</th>
                    <th style="padding: 12px; text-align: center; font-weight: 600; color: #374151;">Response</th>
                  </tr>
                </thead>
                <tbody>
                  ${invitationRows}
                </tbody>
              </table>
              
              ${data.invitations.length > 1 ? `
              <div style="text-align: center; margin: 30px 0;">
                <a href="${acceptAllUrl}" 
                   style="display: inline-block; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; text-decoration: none; padding: 14px 30px; border-radius: 8px; font-weight: 600; font-size: 16px;">
                  Accept All ${data.invitations.length} Invitations
                </a>
              </div>
              ` : ''}
              
              <div style="text-align: center; margin: 20px 0;">
                <a href="${viewAllUrl}" 
                   style="display: inline-block; color: #667eea; text-decoration: underline; font-size: 14px;">
                  View all invitations in app
                </a>
              </div>
              
              <p style="font-size: 14px; color: #6b7280; margin-top: 25px;">
                If you're unable to attend, please decline so we can find a replacement. You can also log in to manage your responses.
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

    // Send in batches of 100 (Resend limit)
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

    console.log(`Sent ${emailsSent} invitation emails`);

    return new Response(
      JSON.stringify({
        success: true,
        emailsSent,
        totalVolunteers: volunteerInvitations.size,
        totalAssignments: assignments.length,
        errors: errors.length > 0 ? errors : undefined
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in send-invitations function:", error);
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
