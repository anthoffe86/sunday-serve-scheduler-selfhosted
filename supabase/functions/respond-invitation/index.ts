import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface ResponseRequest {
  token?: string;
  tokens?: string;
  action: 'accept' | 'decline';
  declineReason?: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    // Service role client for database operations
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const body: ResponseRequest = await req.json();
    const { token, tokens, action, declineReason } = body;

    // Support both single token and multiple tokens
    const tokenList = tokens ? tokens.split(',') : (token ? [token] : []);

    if (tokenList.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No invitation token provided' }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    if (!['accept', 'decline'].includes(action)) {
      return new Response(
        JSON.stringify({ error: 'Invalid action. Must be "accept" or "decline"' }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Check for authentication - if user is logged in, validate ownership
    const authHeader = req.headers.get('Authorization');
    let authenticatedUserId: string | null = null;
    
    if (authHeader) {
      const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } }
      });
      const { data: { user } } = await supabaseAuth.auth.getUser();
      if (user) {
        authenticatedUserId = user.id;
      }
    }

    const results: { token: string; success: boolean; error?: string }[] = [];

    for (const t of tokenList) {
      // Find the assignment by token
      const { data: assignment, error: findError } = await supabaseAdmin
        .from('event_assignments')
        .select('id, event_id, role, volunteer_id, status')
        .eq('invitation_token', t)
        .single();

      if (findError || !assignment) {
        results.push({ token: t, success: false, error: 'Invalid or expired invitation token' });
        continue;
      }

      // If user is authenticated, verify they own this invitation
      if (authenticatedUserId && assignment.volunteer_id !== authenticatedUserId) {
        results.push({ token: t, success: false, error: 'This invitation belongs to another user' });
        continue;
      }

      // Check if already responded
      if (assignment.status === 'confirmed' || assignment.status === 'declined') {
        results.push({ token: t, success: false, error: `Invitation already ${assignment.status}` });
        continue;
      }

      // Check if in invited status
      if (assignment.status !== 'invited') {
        results.push({ token: t, success: false, error: 'Invitation not yet sent or invalid status' });
        continue;
      }

      // Update the assignment
      const newStatus = action === 'accept' ? 'confirmed' : 'declined';
      const updateData: Record<string, unknown> = {
        status: newStatus,
        responded_at: new Date().toISOString(),
        // Clear the invitation token after use to prevent reuse
        invitation_token: null,
      };

      if (action === 'decline' && declineReason) {
        updateData.decline_reason = declineReason;
      }

      const { error: updateError } = await supabaseAdmin
        .from('event_assignments')
        .update(updateData)
        .eq('id', assignment.id);

      if (updateError) {
        console.error('Failed to update invitation:', updateError);
        results.push({ token: t, success: false, error: 'Failed to update invitation response' });
        continue;
      }

      results.push({ token: t, success: true });

      // If declining, we could trigger auto-replacement logic here in the future
      // For now, just log it
      if (action === 'decline') {
        console.log(`Volunteer ${assignment.volunteer_id} declined assignment ${assignment.id} for event ${assignment.event_id}`);
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    return new Response(
      JSON.stringify({
        success: successCount > 0,
        message: action === 'accept' 
          ? `Successfully accepted ${successCount} invitation${successCount !== 1 ? 's' : ''}`
          : `Successfully declined ${successCount} invitation${successCount !== 1 ? 's' : ''}`,
        results,
        successCount,
        failCount,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: unknown) {
    console.error("Error in respond-invitation function:", error);
    return new Response(
      JSON.stringify({ error: 'An unexpected error occurred. Please try again.' }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
