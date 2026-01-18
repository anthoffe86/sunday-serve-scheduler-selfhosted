import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const ROLE_LABELS: Record<string, string> = {
  "sidesman-standard": "Sidesman (Standard)",
  "sidesman-sound": "Sidesman (Sound)",
  "sidesman-welcome": "Sidesman (Welcome)",
  "reader": "Reader",
  "intercessions": "Intercessions",
  "collection": "Collection",
};

interface Assignment {
  volunteer_id: string;
  volunteer_name: string;
  volunteer_email: string;
  role: string;
}

interface EventInfo {
  id: string;
  name: string;
  date: string;
  start_time: string;
  assignments: Assignment[];
}

interface NotificationRequest {
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

    const { eventIds, baseUrl }: NotificationRequest = await req.json();

    console.log(`Sending notifications for ${eventIds.length} events`);

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
    const volunteerIds = [...new Set(assignments?.map(a => a.volunteer_id) || [])];
    
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
    let emailsSent = 0;
    const errors: string[] = [];

    for (const [volunteerId, data] of volunteerAssignments) {
      // Sort events by date
      data.events.sort((a, b) => a.date.localeCompare(b.date));

      const eventRows = data.events.map(e => `
        <tr>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">
            <strong>${formatDate(e.date)}</strong><br>
            <span style="color: #6b7280; font-size: 14px;">${e.name}</span>
          </td>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center;">
            ${formatTime(e.time)}
          </td>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">
            <span style="background: #ede9fe; color: #7c3aed; padding: 4px 10px; border-radius: 12px; font-size: 13px;">
              ${ROLE_LABELS[e.role] || e.role}
            </span>
          </td>
        </tr>
      `).join('');

      try {
        await resend.emails.send({
          from: "Volunteer Scheduler <noreply@updates.lumotutor.co.uk>",
          to: [data.email],
          subject: `Your Volunteer Schedule - ${data.events.length} Assignment${data.events.length > 1 ? 's' : ''} Confirmed`,
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
                <p style="font-size: 16px; margin-bottom: 20px;">Hello <strong>${data.name}</strong>,</p>
                
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
                  <a href="${baseUrl}/schedule" 
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
        emailsSent++;
        console.log(`Email sent to ${data.email}`);
      } catch (emailError: any) {
        console.error(`Failed to send email to ${data.email}:`, emailError);
        errors.push(`${data.email}: ${emailError.message}`);
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
