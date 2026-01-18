import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AcceptSwapRequestBody {
  swapRequestId: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Client to identify caller
    const supabaseClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser();

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Service role client for DB writes
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { swapRequestId }: AcceptSwapRequestBody = await req.json();
    if (!swapRequestId) {
      return new Response(JSON.stringify({ error: "swapRequestId is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Load swap request
    const { data: swapRequest, error: swapError } = await supabaseAdmin
      .from("swap_requests")
      .select("*")
      .eq("id", swapRequestId)
      .single();

    if (swapError || !swapRequest) {
      return new Response(JSON.stringify({ error: "Swap request not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (swapRequest.status !== "pending") {
      return new Response(JSON.stringify({ error: "Swap request already processed" }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!swapRequest.event_assignment_id) {
      return new Response(JSON.stringify({ error: "Swap request missing event_assignment_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Ensure assignment exists and still belongs to the requester
    const { data: assignment, error: assignmentError } = await supabaseAdmin
      .from("event_assignments")
      .select("*")
      .eq("id", swapRequest.event_assignment_id)
      .single();

    if (assignmentError || !assignment) {
      return new Response(JSON.stringify({ error: "Assignment not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (assignment.volunteer_id !== swapRequest.from_user_id) {
      return new Response(
        JSON.stringify({ error: "Assignment is no longer held by the requester" }),
        {
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Perform updates (best-effort sequential; service role bypasses RLS)
    const { error: updateAssignmentError } = await supabaseAdmin
      .from("event_assignments")
      .update({ volunteer_id: user.id })
      .eq("id", assignment.id);

    if (updateAssignmentError) {
      console.error("Failed to update assignment:", updateAssignmentError);
      return new Response(JSON.stringify({ error: "Failed to update assignment" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const nowIso = new Date().toISOString();
    const { error: updateSwapError } = await supabaseAdmin
      .from("swap_requests")
      .update({
        status: "approved",
        to_user_id: user.id,
        approved_at: nowIso,
        approved_by: user.id,
      })
      .eq("id", swapRequestId);

    if (updateSwapError) {
      console.error("Failed to update swap request:", updateSwapError);
      return new Response(JSON.stringify({ error: "Failed to update swap request" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        eventAssignmentId: assignment.id,
        eventId: assignment.event_id,
        newVolunteerId: user.id,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("accept-swap-request error:", error);
    return new Response(JSON.stringify({ error: error?.message ?? "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
