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
        const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

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

        const { data: emailData, error: emailError } = await resend.emails.send({
            from: "Sunday Serve <volunteers@sundayserve.com>",
            to: [profile.email],
            subject: `Service Update: Removed from ${eventName}`,
            html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Service Schedule Update</h2>
          <p>Hi ${profile.name},</p>
          <p>You have been removed from the schedule for the following service:</p>
          
          <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0;">${eventName}</h3>
            <p style="margin: 5px 0;"><strong>Date:</strong> ${formatDate(
                eventDate
            )}</p>
            <p style="margin: 5px 0;"><strong>Role:</strong> ${role}</p>
            ${reason
                    ? `<p style="margin: 15px 0 5px;"><strong>Reason:</strong> ${reason}</p>`
                    : ""
                }
          </div>

          <p>Viewing the full schedule is available on your <a href="${baseUrl}/dashboard">dashboard</a>.</p>
          
          <p>Best regards,<br>St Michael's & All Angels</p>
        </div>
      `,
        });

        if (emailError) {
            throw emailError;
        }

        return new Response(JSON.stringify(emailData), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
        });
    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 400,
        });
    }
});
