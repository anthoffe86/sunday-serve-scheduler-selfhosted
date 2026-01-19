import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AdminAcceptSwapBody {
  swapRequestId: string;
  targetUserId: string;
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
      console.error("Missing authorization header");
      return new Response(JSON.stringify({ error: "Missing authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Client to identify caller
    console.log("Identifying caller...");
    const supabaseClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser();

    if (userError || !user) {
      console.error("Auth error or no user:", userError);
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    console.log("Caller identified as user:", user.id);

    // Service role client for DB operations
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Verify the caller is an admin
    console.log("Checking admin status for user:", user.id);
    const { data: adminCheck, error: adminCheckError } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (adminCheckError) {
      console.error("Error checking admin status:", adminCheckError);
    }
    console.log("Admin check result:", adminCheck);

    if (!adminCheck) {
      console.error("User is not an admin");
      return new Response(JSON.stringify({ error: "Forbidden: Admin access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    console.log("Request body:", body);
    const { swapRequestId, targetUserId, baseUrl }: AdminAcceptSwapBody = body;

    if (!swapRequestId) {
      console.error("swapRequestId is missing");
      return new Response(JSON.stringify({ error: "swapRequestId is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!targetUserId) {
      console.error("targetUserId is missing");
      return new Response(JSON.stringify({ error: "targetUserId is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Load swap request
    console.log("Loading swap request:", swapRequestId);
    const { data: swapRequest, error: swapError } = await supabaseAdmin
      .from("swap_requests")
      .select("*")
      .eq("id", swapRequestId)
      .single();

    if (swapError || !swapRequest) {
      console.error("Failed to fetch swap request:", swapError);
      return new Response(JSON.stringify({ error: "Swap request not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    console.log("Swap request loaded:", swapRequest);

    if (swapRequest.status !== "pending") {
      console.error("Swap request status is not pending:", swapRequest.status);
      return new Response(JSON.stringify({ error: "Swap request already processed" }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!swapRequest.event_assignment_id) {
      console.error("Swap request missing event_assignment_id");
      return new Response(JSON.stringify({ error: "Swap request missing event_assignment_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Ensure assignment exists and still belongs to the requester
    console.log("Checking assignment:", swapRequest.event_assignment_id);
    const { data: assignment, error: assignmentError } = await supabaseAdmin
      .from("event_assignments")
      .select("*")
      .eq("id", swapRequest.event_assignment_id)
      .single();

    if (assignmentError || !assignment) {
      console.error("Assignment not found:", assignmentError);
      return new Response(JSON.stringify({ error: "Assignment not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (assignment.volunteer_id !== swapRequest.from_user_id) {
      console.error("Assignment volunteer mismatch:", assignment.volunteer_id, "vs", swapRequest.from_user_id);
      return new Response(
        JSON.stringify({ error: "Assignment is no longer held by the requester" }),
        {
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Load event details for notifications
    const { data: event, error: eventError } = await supabaseAdmin
      .from("events")
      .select("name, date")
      .eq("id", assignment.event_id)
      .single();

    if (eventError || !event) {
      console.error("Failed to fetch event details:", eventError);
      return new Response(JSON.stringify({ error: "Event details not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify target user exists
    console.log("Verifying target user:", targetUserId);
    const { data: targetProfile } = await supabaseAdmin
      .from("profiles")
      .select("user_id, name")
      .eq("user_id", targetUserId)
      .maybeSingle();

    if (!targetProfile) {
      console.error("Target user profile not found");
      return new Response(JSON.stringify({ error: "Target user not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify target user has the required role in their preferences
    console.log("Checking role preferences for target user:", targetUserId, "role:", assignment.role);
    const { data: rolePrefs } = await supabaseAdmin
      .from("role_preferences")
      .select("role")
      .eq("user_id", targetUserId)
      .eq("role", assignment.role)
      .maybeSingle();

    if (!rolePrefs) {
      console.error("Target user does not have required role preference");
      return new Response(
        JSON.stringify({ error: `${targetProfile.name} does not have this role in their preferences` }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Update the assignment
    const { error: updateAssignmentError } = await supabaseAdmin
      .from("event_assignments")
      .update({ volunteer_id: targetUserId })
      .eq("id", assignment.id);

    if (updateAssignmentError) {
      console.error("Failed to update assignment:", updateAssignmentError);
      return new Response(JSON.stringify({ error: "Failed to update assignment" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update the swap request
    const nowIso = new Date().toISOString();
    const { error: updateSwapError } = await supabaseAdmin
      .from("swap_requests")
      .update({
        status: "approved",
        to_user_id: targetUserId,
        approved_at: nowIso,
        approved_by: user.id, // Admin who approved
      })
      .eq("id", swapRequestId);

    if (updateSwapError) {
      console.error("Failed to update swap request:", updateSwapError);
      return new Response(JSON.stringify({ error: "Failed to update swap request" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Send notifications
    if (baseUrl) {
      console.log("Triggering notifications for swap approval...");

      // Notify original volunteer of removal
      const removalPromise = fetch(`${supabaseUrl}/functions/v1/send-assignment-removal-notification`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${serviceRoleKey}`,
        },
        body: JSON.stringify({
          volunteerId: swapRequest.from_user_id,
          eventName: event.name,
          eventDate: event.date,
          role: assignment.role,
          reason: "An administrator has re-assigned this service to another volunteer.",
          baseUrl
        }),
      }).catch(err => console.error("Error triggering removal notification:", err));

      // Notify new volunteer of assignment
      const assignmentPromise = fetch(`${supabaseUrl}/functions/v1/send-event-notification`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${serviceRoleKey}`,
        },
        body: JSON.stringify({
          eventIds: [assignment.event_id],
          userIds: [targetUserId],
          baseUrl
        }),
      }).catch(err => console.error("Error triggering assignment notification:", err));

      // Await notifications to ensure function doesn't terminate early
      console.log("Waiting for notifications to complete...");
      const [removalResponse, assignmentResponse] = await Promise.all([removalPromise, assignmentPromise]);
      console.log("Removal notification status:", removalResponse?.status);
      console.log("Assignment notification status:", assignmentResponse?.status);
      console.log("Swap approval notifications processed.");
    }

    return new Response(
      JSON.stringify({
        success: true,
        eventAssignmentId: assignment.id,
        eventId: assignment.event_id,
        newVolunteerId: targetUserId,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("admin-accept-swap error:", error);
    return new Response(JSON.stringify({ error: error?.message ?? "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
