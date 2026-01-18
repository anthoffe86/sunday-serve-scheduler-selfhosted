import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface EventRole {
  id: string;
  event_id: string;
  role: string;
  quantity: number;
}

interface Event {
  id: string;
  date: string;
  name: string;
  status: string;
}

interface Availability {
  user_id: string;
  date: string;
  available: boolean;
}

interface RolePreference {
  user_id: string;
  role: string;
  preference_order: number;
}

interface Profile {
  user_id: string;
  name: string;
  active: boolean;
  family_group_id: string | null;
}

interface ExistingAssignment {
  event_id: string;
  volunteer_id: string;
  role: string;
}

interface AssignmentResult {
  event_id: string;
  event_date: string;
  role: string;
  volunteer_id: string;
  volunteer_name: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // Get auth token from request
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create client with user's auth token to verify they're an admin
    const supabaseUser = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } }
    });
    
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authentication' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user is admin
    const { data: isAdminResult } = await supabaseUser.rpc('is_admin', { _user_id: user.id });
    if (!isAdminResult) {
      return new Response(
        JSON.stringify({ error: 'Only admins can auto-schedule' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use service role client for data operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { templateId, eventIds } = await req.json();

    if (!templateId && (!eventIds || eventIds.length === 0)) {
      return new Response(
        JSON.stringify({ error: 'templateId or eventIds required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Auto-scheduling for template: ${templateId}, eventIds: ${eventIds?.join(', ')}`);

    // Get events to schedule
    let eventsQuery = supabase
      .from('events')
      .select('id, date, name, status')
      .eq('status', 'draft')
      .order('date', { ascending: true });

    if (templateId) {
      eventsQuery = eventsQuery.eq('template_id', templateId);
    } else if (eventIds) {
      eventsQuery = eventsQuery.in('id', eventIds);
    }

    const { data: events, error: eventsError } = await eventsQuery;
    if (eventsError) throw eventsError;

    if (!events || events.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No draft events to schedule', assignments: [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${events.length} draft events to schedule`);

    // Get all event roles for these events
    const eventIds_list = events.map(e => e.id);
    const { data: eventRoles, error: rolesError } = await supabase
      .from('event_roles')
      .select('*')
      .in('event_id', eventIds_list);

    if (rolesError) throw rolesError;

    // Get all existing assignments for these events
    const { data: existingAssignments, error: existingError } = await supabase
      .from('event_assignments')
      .select('event_id, volunteer_id, role')
      .in('event_id', eventIds_list);

    if (existingError) throw existingError;

    // Get all dates we need availability for
    const eventDates = [...new Set(events.map(e => e.date))];

    // Get all availability for these dates
    const { data: availability, error: availError } = await supabase
      .from('availability')
      .select('user_id, date, available')
      .in('date', eventDates);

    if (availError) throw availError;

    // Get all active profiles with family groups
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('user_id, name, active, family_group_id')
      .eq('active', true);

    if (profilesError) throw profilesError;

    // Get all role preferences
    const { data: rolePreferences, error: prefsError } = await supabase
      .from('role_preferences')
      .select('user_id, role, preference_order')
      .order('preference_order', { ascending: true });

    if (prefsError) throw prefsError;

    console.log(`Loaded ${profiles?.length || 0} active profiles, ${rolePreferences?.length || 0} preferences`);

    // Build lookup maps
    const profileMap = new Map<string, Profile>();
    (profiles || []).forEach(p => profileMap.set(p.user_id, p));

    const rolePrefsMap = new Map<string, RolePreference[]>();
    (rolePreferences || []).forEach(rp => {
      if (!rolePrefsMap.has(rp.user_id)) {
        rolePrefsMap.set(rp.user_id, []);
      }
      rolePrefsMap.get(rp.user_id)!.push(rp);
    });

    // Build availability map: date -> user_id -> available
    const availabilityMap = new Map<string, Map<string, boolean>>();
    (availability || []).forEach(a => {
      if (!availabilityMap.has(a.date)) {
        availabilityMap.set(a.date, new Map());
      }
      availabilityMap.get(a.date)!.set(a.user_id, a.available);
    });

    // Build existing assignments map: event_id -> role -> volunteer_ids
    const existingAssignmentsMap = new Map<string, Map<string, Set<string>>>();
    (existingAssignments || []).forEach(ea => {
      if (!existingAssignmentsMap.has(ea.event_id)) {
        existingAssignmentsMap.set(ea.event_id, new Map());
      }
      const eventAssignments = existingAssignmentsMap.get(ea.event_id)!;
      if (!eventAssignments.has(ea.role)) {
        eventAssignments.set(ea.role, new Set());
      }
      eventAssignments.get(ea.role)!.add(ea.volunteer_id);
    });

    // Track assignment counts globally for fair distribution
    const assignmentCounts = new Map<string, number>();
    (existingAssignments || []).forEach(ea => {
      assignmentCounts.set(ea.volunteer_id, (assignmentCounts.get(ea.volunteer_id) || 0) + 1);
    });

    // Track which volunteers are assigned to which dates (for family grouping)
    const dateAssignments = new Map<string, Set<string>>();
    events.forEach(e => dateAssignments.set(e.date, new Set()));
    (existingAssignments || []).forEach(ea => {
      const event = events.find(e => e.id === ea.event_id);
      if (event) {
        dateAssignments.get(event.date)!.add(ea.volunteer_id);
      }
    });

    // Build family groups map
    const familyGroups = new Map<string, string[]>();
    (profiles || []).forEach(p => {
      if (p.family_group_id) {
        if (!familyGroups.has(p.family_group_id)) {
          familyGroups.set(p.family_group_id, []);
        }
        familyGroups.get(p.family_group_id)!.push(p.user_id);
      }
    });

    const newAssignments: AssignmentResult[] = [];
    const assignmentsToInsert: { event_id: string; volunteer_id: string; role: string }[] = [];

    // Helper: Check if volunteer is available on a date (default true if not specified)
    const isAvailable = (userId: string, date: string): boolean => {
      const dateAvail = availabilityMap.get(date);
      if (!dateAvail) return true; // Default available if no records
      const userAvail = dateAvail.get(userId);
      return userAvail === undefined ? true : userAvail;
    };

    // Helper: Get volunteer's preference score for a role (lower is better, -1 if no preference)
    const getRolePreferenceScore = (userId: string, role: string): number => {
      const prefs = rolePrefsMap.get(userId);
      if (!prefs) return 100; // No preferences, low priority
      const pref = prefs.find(p => p.role === role);
      return pref ? pref.preference_order : 100;
    };

    // Helper: Get family members for a user
    const getFamilyMembers = (userId: string): string[] => {
      const profile = profileMap.get(userId);
      if (!profile?.family_group_id) return [];
      return (familyGroups.get(profile.family_group_id) || []).filter(id => id !== userId);
    };

    // Process each event
    for (const event of events) {
      const eventRolesForEvent = (eventRoles || []).filter(r => r.event_id === event.id);
      const currentEventAssignments = existingAssignmentsMap.get(event.id) || new Map();
      const dateVolunteers = dateAssignments.get(event.date)!;

      console.log(`Processing event ${event.name} on ${event.date}: ${eventRolesForEvent.length} roles`);

      // For each role in this event
      for (const role of eventRolesForEvent) {
        const existingForRole = currentEventAssignments.get(role.role) || new Set();
        const neededCount = role.quantity - existingForRole.size;

        if (neededCount <= 0) {
          console.log(`  Role ${role.role}: Already filled`);
          continue;
        }

        console.log(`  Role ${role.role}: Need ${neededCount} volunteers`);

        // Get eligible volunteers for this role
        const eligibleVolunteers: { userId: string; score: number; familyBonus: boolean }[] = [];

        for (const [userId, profile] of profileMap.entries()) {
          // Skip if not active
          if (!profile.active) continue;

          // Skip if already assigned to this event (any role)
          const isAlreadyAssigned = Array.from(currentEventAssignments.values())
            .some(assignedSet => assignedSet.has(userId));
          if (isAlreadyAssigned) continue;

          // Skip if marked unavailable
          if (!isAvailable(userId, event.date)) continue;

          // Get preference score for this role
          const prefScore = getRolePreferenceScore(userId, role.role);

          // Check if family member is already assigned to this date (bonus for family grouping)
          const familyMembers = getFamilyMembers(userId);
          const familyBonus = familyMembers.some(fm => dateVolunteers.has(fm));

          eligibleVolunteers.push({ userId, score: prefScore, familyBonus });
        }

        // Sort volunteers by:
        // 1. Family bonus (prefer to group families together)
        // 2. Role preference score (lower is better)
        // 3. Total assignment count (fewer assignments = higher priority for fairness)
        eligibleVolunteers.sort((a, b) => {
          // Family bonus first
          if (a.familyBonus !== b.familyBonus) {
            return b.familyBonus ? 1 : -1;
          }
          // Then by preference score
          if (a.score !== b.score) {
            return a.score - b.score;
          }
          // Then by assignment count (fewer is better)
          const countA = assignmentCounts.get(a.userId) || 0;
          const countB = assignmentCounts.get(b.userId) || 0;
          return countA - countB;
        });

        console.log(`    Found ${eligibleVolunteers.length} eligible volunteers`);

        // Assign top N volunteers
        for (let i = 0; i < Math.min(neededCount, eligibleVolunteers.length); i++) {
          const volunteer = eligibleVolunteers[i];
          const profile = profileMap.get(volunteer.userId)!;

          // Update tracking
          if (!currentEventAssignments.has(role.role)) {
            currentEventAssignments.set(role.role, new Set());
          }
          currentEventAssignments.get(role.role)!.add(volunteer.userId);
          dateVolunteers.add(volunteer.userId);
          assignmentCounts.set(volunteer.userId, (assignmentCounts.get(volunteer.userId) || 0) + 1);

          assignmentsToInsert.push({
            event_id: event.id,
            volunteer_id: volunteer.userId,
            role: role.role,
          });

          newAssignments.push({
            event_id: event.id,
            event_date: event.date,
            role: role.role,
            volunteer_id: volunteer.userId,
            volunteer_name: profile.name,
          });

          console.log(`    Assigned ${profile.name} to ${role.role}`);
        }
      }
    }

    // Insert all new assignments
    if (assignmentsToInsert.length > 0) {
      const { error: insertError } = await supabase
        .from('event_assignments')
        .insert(assignmentsToInsert);

      if (insertError) throw insertError;
    }

    console.log(`Created ${assignmentsToInsert.length} new assignments`);

    return new Response(
      JSON.stringify({
        message: `Created ${assignmentsToInsert.length} assignments across ${events.length} events`,
        assignments: newAssignments,
        totalEvents: events.length,
        totalAssignments: assignmentsToInsert.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Auto-scheduler error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
