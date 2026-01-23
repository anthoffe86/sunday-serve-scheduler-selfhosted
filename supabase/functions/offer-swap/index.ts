import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface OfferSwapBody {
  swapRequestId: string;
  offeredAssignmentId: string;
  baseUrl: string;
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

    const body: OfferSwapBody = await req.json();
    const { swapRequestId, offeredAssignmentId, baseUrl } = body;

    if (!swapRequestId || !offeredAssignmentId) {
      return new Response(JSON.stringify({ error: "swapRequestId and offeredAssignmentId are required" }), {
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
      return new Response(JSON.stringify({ error: "Swap request is no longer pending" }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify the offered assignment exists and belongs to the current user
    const { data: offeredAssignment, error: offeredError } = await supabaseAdmin
      .from("event_assignments")
      .select("*, events!inner(id, name, date, start_time)")
      .eq("id", offeredAssignmentId)
      .single();

    if (offeredError || !offeredAssignment) {
      return new Response(JSON.stringify({ error: "Offered assignment not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (offeredAssignment.volunteer_id !== user.id) {
      return new Response(JSON.stringify({ error: "You can only offer your own assignments" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get the original assignment to verify the original volunteer has the role preference for the offered assignment
    const { data: originalAssignment, error: originalError } = await supabaseAdmin
      .from("event_assignments")
      .select("*, events!inner(id, name, date, start_time)")
      .eq("id", swapRequest.event_assignment_id)
      .single();

    if (originalError || !originalAssignment) {
      return new Response(JSON.stringify({ error: "Original assignment not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify the accepting user has the role preference for the original assignment
    const { data: accepterRolePref } = await supabaseAdmin
      .from("role_preferences")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", originalAssignment.role)
      .maybeSingle();

    if (!accepterRolePref) {
      return new Response(
        JSON.stringify({ error: "You don't have the required role preference for the original assignment" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update the swap request with the offer
    const { error: updateError } = await supabaseAdmin
      .from("swap_requests")
      .update({
        to_user_id: user.id,
        offered_assignment_id: offeredAssignmentId,
        status: "pending", // Keep as pending until original volunteer confirms
        updated_at: new Date().toISOString(),
      })
      .eq("id", swapRequestId);

    if (updateError) {
      console.error("Failed to update swap request:", updateError);
      return new Response(JSON.stringify({ error: "Failed to submit offer" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Send notification to original volunteer
    if (baseUrl) {
      try {
        await fetch(`${supabaseUrl}/functions/v1/send-swap-offer-notification`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${serviceRoleKey}`,
          },
          body: JSON.stringify({
            swapRequestId,
            baseUrl,
          }),
        });
      } catch (err) {
        console.error("Failed to send swap offer notification:", err);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        swapRequestId,
        offeredAssignmentId,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("offer-swap error:", error);
    return new Response(JSON.stringify({ error: error?.message ?? "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
