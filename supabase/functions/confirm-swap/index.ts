import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ConfirmSwapBody {
  swapRequestId: string;
  accept: boolean;
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

    const body: ConfirmSwapBody = await req.json();
    const { swapRequestId, accept, baseUrl } = body;

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

    // Verify the user is the original requester
    if (swapRequest.from_user_id !== user.id) {
      return new Response(JSON.stringify({ error: "Only the original requester can confirm/reject offers" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (swapRequest.status !== "pending") {
      return new Response(JSON.stringify({ error: "Swap request is no longer pending" }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if there's an offer to respond to
    if (!swapRequest.to_user_id || !swapRequest.offered_assignment_id) {
      return new Response(JSON.stringify({ error: "No offer has been made on this swap request" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!accept) {
      // Reject the offer - clear the offer but keep the request open
      const { error: updateError } = await supabaseAdmin
        .from("swap_requests")
        .update({
          to_user_id: null,
          offered_assignment_id: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", swapRequestId);

      if (updateError) {
        console.error("Failed to reject offer:", updateError);
        return new Response(JSON.stringify({ error: "Failed to reject offer" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(
        JSON.stringify({
          success: true,
          action: "rejected",
          message: "Offer rejected. Your swap request remains open for other volunteers.",
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Accept the offer - perform the swap
    const { data: originalAssignment, error: originalError } = await supabaseAdmin
      .from("event_assignments")
      .select("*")
      .eq("id", swapRequest.event_assignment_id)
      .single();

    if (originalError || !originalAssignment) {
      return new Response(JSON.stringify({ error: "Original assignment not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: offeredAssignment, error: offeredError } = await supabaseAdmin
      .from("event_assignments")
      .select("*")
      .eq("id", swapRequest.offered_assignment_id)
      .single();

    if (offeredError || !offeredAssignment) {
      return new Response(JSON.stringify({ error: "Offered assignment not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const nowIso = new Date().toISOString();

    // Swap the volunteer IDs on both assignments
    const { error: updateOriginalError } = await supabaseAdmin
      .from("event_assignments")
      .update({
        volunteer_id: swapRequest.to_user_id,
        status: "confirmed",
        responded_at: nowIso,
        invitation_token: null,
      })
      .eq("id", swapRequest.event_assignment_id);

    if (updateOriginalError) {
      console.error("Failed to update original assignment:", updateOriginalError);
      return new Response(JSON.stringify({ error: "Failed to swap assignments" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { error: updateOfferedError } = await supabaseAdmin
      .from("event_assignments")
      .update({
        volunteer_id: swapRequest.from_user_id,
        status: "confirmed",
        responded_at: nowIso,
        invitation_token: null,
      })
      .eq("id", swapRequest.offered_assignment_id);

    if (updateOfferedError) {
      console.error("Failed to update offered assignment:", updateOfferedError);
      // Try to rollback the first update
      await supabaseAdmin
        .from("event_assignments")
        .update({
          volunteer_id: swapRequest.from_user_id,
          status: originalAssignment.status,
          responded_at: originalAssignment.responded_at,
        })
        .eq("id", swapRequest.event_assignment_id);
      
      return new Response(JSON.stringify({ error: "Failed to swap assignments" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Mark swap request as approved
    const { error: swapUpdateError } = await supabaseAdmin
      .from("swap_requests")
      .update({
        status: "approved",
        approved_at: nowIso,
        approved_by: user.id,
      })
      .eq("id", swapRequestId);

    if (swapUpdateError) {
      console.error("Failed to update swap request status:", swapUpdateError);
    }

    // Get event details for notifications
    const { data: originalEvent } = await supabaseAdmin
      .from("events")
      .select("name, date")
      .eq("id", originalAssignment.event_id)
      .single();

    const { data: offeredEvent } = await supabaseAdmin
      .from("events")
      .select("name, date")
      .eq("id", offeredAssignment.event_id)
      .single();

    // Send notifications to both volunteers
    if (baseUrl) {
      try {
        // Notify the other volunteer about their new assignment
        await fetch(`${supabaseUrl}/functions/v1/send-event-notification`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${serviceRoleKey}`,
          },
          body: JSON.stringify({
            eventIds: [originalAssignment.event_id],
            userIds: [swapRequest.to_user_id],
            baseUrl,
          }),
        });

        // Notify original requester about their new assignment
        await fetch(`${supabaseUrl}/functions/v1/send-event-notification`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${serviceRoleKey}`,
          },
          body: JSON.stringify({
            eventIds: [offeredAssignment.event_id],
            userIds: [swapRequest.from_user_id],
            baseUrl,
          }),
        });
      } catch (err) {
        console.error("Failed to send swap completion notifications:", err);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        action: "accepted",
        message: "Swap completed successfully! Assignments have been swapped.",
        originalAssignmentId: swapRequest.event_assignment_id,
        offeredAssignmentId: swapRequest.offered_assignment_id,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("confirm-swap error:", error);
    return new Response(JSON.stringify({ error: error?.message ?? "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
