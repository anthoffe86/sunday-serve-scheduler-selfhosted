import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AccessRequestPayload {
  name: string;
  organisationName: string;
  email: string;
  notes?: string;
}

function escapeHtml(unsafe: string | null | undefined): string {
  if (!unsafe) return "";
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const adminEmail = Deno.env.get("ADMIN_NOTIFICATION_EMAIL");
    if (!adminEmail) {
      return new Response(
        JSON.stringify({ error: "ADMIN_NOTIFICATION_EMAIL secret is not set" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const { name, organisationName, email, notes }: AccessRequestPayload = await req.json();

    const emailResponse = await resend.emails.send({
      from: "ServeTogether <noreply@updates.servetogether.co.uk>",
      to: [adminEmail],
      subject: `New info/demo enquiry from ${name} - ${organisationName}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #0ea5e9 0%, #14b8a6 100%); padding: 24px; border-radius: 10px 10px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 22px;">New ServeTogether Info & Demo Enquiry</h1>
          </div>

          <div style="background: #f9fafb; padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; color: #6b7280; width: 160px;">Name</td>
                <td style="padding: 8px 0; font-weight: 600;">${escapeHtml(name)}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6b7280;">Organisation</td>
                <td style="padding: 8px 0; font-weight: 600;">${escapeHtml(organisationName)}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6b7280;">Email</td>
                <td style="padding: 8px 0;"><a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a></td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6b7280; vertical-align: top;">Notes</td>
                <td style="padding: 8px 0;">${escapeHtml(notes) || '<em style="color:#9ca3af">No notes provided</em>'}</td>
              </tr>
            </table>

            <p style="margin: 16px 0 0; font-size: 13px; color: #4b5563;">
              Next step: reply to this contact to arrange a demo and collect onboarding details.
            </p>

            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0 12px;">
            <p style="font-size: 11px; color: #9ca3af; text-align: center; margin: 0;">
              Powered by ServeTogether
            </p>
          </div>
        </body>
        </html>
      `,
    });

    return new Response(JSON.stringify(emailResponse), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
};

serve(handler);
