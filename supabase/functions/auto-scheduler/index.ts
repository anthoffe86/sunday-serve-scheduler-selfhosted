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

    // Verify which profiles have valid auth.users entries
    const { data: validUsers, error: usersError } = await supabase
      .from('auth.users')
      .select('id');
    
    let validProfileUserIds: Set<string>;
    
    if (usersError || !validUsers) {
      console.log('Cannot query auth.users directly, using alternative validation');
      
      const { data: existingUserIds } = await supabase
        .from('event_assignments')
        .select('volunteer_id');
      
      const validFromAssignments = new Set((existingUserIds || []).map(e => e.volunteer_id));
      validFromAssignments.add(user.id);
      
      const { data: userRoles } = await supabase
        .from('user_roles')
        .select('user_id');
      
      (userRoles || []).forEach(ur => validFromAssignments.add(ur.user_id));
      
      validProfileUserIds = validFromAssignments;
    } else {
      validProfileUserIds = new Set((validUsers || []).map((u: { id: string }) => u.id));
    }
    
    const validProfiles = (profiles || []).filter(p => validProfileUserIds.has(p.user_id));
    console.log(`Filtered to ${validProfiles.length} profiles with valid auth.users entries (from ${profiles?.length || 0} total)`);

    // Get all role preferences
    const { data: rolePreferences, error: prefsError } = await supabase
      .from('role_preferences')
      .select('user_id, role, preference_order')
      .order('preference_order', { ascending: true });

    if (prefsError) throw prefsError;

    console.log(`Loaded ${validProfiles.length} valid active profiles, ${rolePreferences?.length || 0} preferences`);

    // Build lookup maps
    const profileMap = new Map<string, Profile>();
    validProfiles.forEach(p => profileMap.set(p.user_id, p));

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

    // Track GLOBAL assignment counts for fair distribution (across ALL events being scheduled)
    const globalAssignmentCounts = new Map<string, number>();
    // Initialize all valid volunteers with 0
    validProfiles.forEach(p => globalAssignmentCounts.set(p.user_id, 0));
    // Add existing assignments
    (existingAssignments || []).forEach(ea => {
      globalAssignmentCounts.set(ea.volunteer_id, (globalAssignmentCounts.get(ea.volunteer_id) || 0) + 1);
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
    validProfiles.forEach(p => {
      if (p.family_group_id) {
        if (!familyGroups.has(p.family_group_id)) {
          familyGroups.set(p.family_group_id, []);
        }
        familyGroups.get(p.family_group_id)!.push(p.user_id);
      }
    });

    // Track GLOBAL family assignment counts (to avoid over-assigning one family)
    // For volunteers without a family group, we treat them as a solo family.
    const getFamilyKey = (userId: string): string => {
      const fg = profileMap.get(userId)?.family_group_id;
      return fg ? fg : `__solo__:${userId}`;
    };

    const getFamilySize = (userId: string): number => {
      const fg = profileMap.get(userId)?.family_group_id;
      return fg ? (familyGroups.get(fg)?.length || 1) : 1;
    };

    const familyAssignmentCounts = new Map<string, number>();
    // init
    validProfiles.forEach(p => familyAssignmentCounts.set(getFamilyKey(p.user_id), 0));
    // add existing
    (existingAssignments || []).forEach(ea => {
      const key = getFamilyKey(ea.volunteer_id);
      familyAssignmentCounts.set(key, (familyAssignmentCounts.get(key) || 0) + 1);
    });

    const newAssignments: AssignmentResult[] = [];
    const assignmentsToInsert: { event_id: string; volunteer_id: string; role: string }[] = [];

    // Helper: Check if volunteer is available on a date
    const isAvailable = (userId: string, date: string): boolean => {
      const dateAvail = availabilityMap.get(date);
      if (!dateAvail) return true; // No one set availability for this date, assume all available
      const userAvail = dateAvail.get(userId);
      // If user hasn't set availability for this date, assume available
      // If user explicitly set unavailable, respect that
      return userAvail !== false;
    };

    // Helper: Get volunteer's preference score for a role (lower is better)
    const getRolePreferenceScore = (userId: string, role: string): number => {
      const prefs = rolePrefsMap.get(userId);
      if (!prefs || prefs.length === 0) return 50; // No preferences = neutral priority
      const pref = prefs.find(p => p.role === role);
      return pref ? pref.preference_order : 100; // Has preferences but not this role = low priority
    };

    // Helper: Get family members for a user
    const getFamilyMembers = (userId: string): string[] => {
      const profile = profileMap.get(userId);
      if (!profile?.family_group_id) return [];
      return (familyGroups.get(profile.family_group_id) || []).filter(id => id !== userId);
    };

    // Helper: Count how many family members are AVAILABLE on a specific date
    const getAvailableFamilyCount = (userId: string, date: string): number => {
      const familyMembers = getFamilyMembers(userId);
      return familyMembers.filter(fm => isAvailable(fm, date) && profileMap.get(fm)?.active).length;
    };

    // Calculate total slots needed
    let totalSlotsNeeded = 0;
    for (const event of events) {
      const eventRolesForEvent = (eventRoles || []).filter(r => r.event_id === event.id);
      for (const role of eventRolesForEvent) {
        const existingForRole = existingAssignmentsMap.get(event.id)?.get(role.role)?.size || 0;
        totalSlotsNeeded += Math.max(0, role.quantity - existingForRole);
      }
    }

    const totalVolunteers = validProfiles.length;
    const minAssignmentsPerVolunteer = Math.floor(totalSlotsNeeded / totalVolunteers);
    const extraSlots = totalSlotsNeeded % totalVolunteers;

    console.log(`Fair distribution: ${totalSlotsNeeded} slots, ${totalVolunteers} volunteers`);
    console.log(`Each volunteer should get ~${minAssignmentsPerVolunteer} assignments, ${extraSlots} extra slots`);

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
        const eligibleVolunteers: { 
          userId: string; 
          assignmentCount: number;
          preferenceScore: number; 
          hasFamilyOnDate: boolean;
          availableFamilyCount: number;
          familyGroupId: string | null;
          familyKey: string;
          familyLoad: number; // normalized: assignments per family member
          hasExplicitlyUnavailableFamilyMember: boolean;
        }[] = [];

        for (const [userId, profile] of profileMap.entries()) {
          // Skip if not active
          if (!profile.active) continue;

          // Skip if already assigned to this event (any role)
          const isAlreadyAssigned = Array.from(currentEventAssignments.values())
            .some(assignedSet => assignedSet.has(userId));
          if (isAlreadyAssigned) continue;

          // STRICT: Skip if marked unavailable
          if (!isAvailable(userId, event.date)) {
            console.log(`    ${profile.name} is unavailable on ${event.date}`);
            continue;
          }

          const assignmentCount = globalAssignmentCounts.get(userId) || 0;
          const preferenceScore = getRolePreferenceScore(userId, role.role);

          // Check if any family member is already assigned to this date
          const familyMembers = getFamilyMembers(userId);
          const hasFamilyOnDate = familyMembers.some(fm => dateVolunteers.has(fm));

          // Count how many family members are AVAILABLE on this date (proactive grouping)
          const availableFamilyCount = getAvailableFamilyCount(userId, event.date);

          // If a family member explicitly marked unavailable for this date, treat assigning this
          // person as a "family split" risk and only do it as a last resort.
          const dateAvail = availabilityMap.get(event.date);
          const hasExplicitlyUnavailableFamilyMember = familyMembers.some(
            (fm) => dateAvail?.get(fm) === false
          );

          const familyKey = getFamilyKey(userId);
          const familySize = getFamilySize(userId);
          const familyLoad = (familyAssignmentCounts.get(familyKey) || 0) / familySize;

          eligibleVolunteers.push({ 
            userId, 
            assignmentCount,
            preferenceScore, 
            hasFamilyOnDate,
            availableFamilyCount,
            familyGroupId: profile.family_group_id,
            familyKey,
            familyLoad,
            hasExplicitlyUnavailableFamilyMember,
          });
        }

        console.log(`    Found ${eligibleVolunteers.length} eligible volunteers`);

        if (eligibleVolunteers.length > 0) {
          const top3Preview = eligibleVolunteers
            .slice()
            .sort((a, b) => (a.assignmentCount - b.assignmentCount) || (a.familyLoad - b.familyLoad))
            .slice(0, 3)
            .map(v => {
              const name = profileMap.get(v.userId)?.name || 'Unknown';
              const splitRisk = !v.hasFamilyOnDate && !!v.familyGroupId && v.hasExplicitlyUnavailableFamilyMember;
              return `${name}(cnt=${v.assignmentCount}, famLoad=${v.familyLoad.toFixed(2)}, onDate=${v.hasFamilyOnDate}, availFam=${v.availableFamilyCount}, splitRisk=${splitRisk})`;
            });
          console.log(`    Sample candidates: ${top3Preview.join(', ')}`);
        }

        // Assignment strategy:
        // - HARD fairness gate: always assign volunteers with the lowest current assignmentCount first
        //   (so everyone gets at least 1 when possible)
        // - Within that fairness tier, prefer family grouping
        // - Also avoid over-assigning any one family by preferring lower familyLoad
        let remaining = eligibleVolunteers.slice();

        for (let pickIndex = 0; pickIndex < neededCount; pickIndex++) {
          if (remaining.length === 0) break;

          // Refresh dynamic fields from current global maps (because we update counts each pick)
          remaining = remaining.map(v => {
            const familySize = getFamilySize(v.userId);
            const familyLoad = (familyAssignmentCounts.get(v.familyKey) || 0) / familySize;
            return {
              ...v,
              assignmentCount: globalAssignmentCounts.get(v.userId) || 0,
              familyLoad,
            };
          });

          const minCount = Math.min(...remaining.map(v => v.assignmentCount));
          const tier = remaining.filter(v => v.assignmentCount === minCount);

          // Sort within tier by family grouping first, then avoid splits, then familyLoad, then role preference
          tier.sort((a, b) => {
            const familyScoreA = (a.hasFamilyOnDate ? 100 : 0) + a.availableFamilyCount;
            const familyScoreB = (b.hasFamilyOnDate ? 100 : 0) + b.availableFamilyCount;
            if (familyScoreA !== familyScoreB) return familyScoreB - familyScoreA;

            const splitRiskA = !a.hasFamilyOnDate && !!a.familyGroupId && a.hasExplicitlyUnavailableFamilyMember;
            const splitRiskB = !b.hasFamilyOnDate && !!b.familyGroupId && b.hasExplicitlyUnavailableFamilyMember;
            if (splitRiskA !== splitRiskB) return splitRiskA ? 1 : -1;

            // Prevent families from soaking up disproportionate assignments
            if (a.familyLoad !== b.familyLoad) return a.familyLoad - b.familyLoad;

            if (a.preferenceScore !== b.preferenceScore) return a.preferenceScore - b.preferenceScore;

            return 0;
          });

          const volunteer = tier[0];
          const profile = profileMap.get(volunteer.userId)!;

          // Remove chosen volunteer from remaining for this role
          remaining = remaining.filter(v => v.userId !== volunteer.userId);

          // Update tracking
          if (!currentEventAssignments.has(role.role)) {
            currentEventAssignments.set(role.role, new Set());
          }
          currentEventAssignments.get(role.role)!.add(volunteer.userId);
          dateVolunteers.add(volunteer.userId);

          // Update global assignment count
          globalAssignmentCounts.set(volunteer.userId, (globalAssignmentCounts.get(volunteer.userId) || 0) + 1);

          // Update family assignment count
          familyAssignmentCounts.set(volunteer.familyKey, (familyAssignmentCounts.get(volunteer.familyKey) || 0) + 1);

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

          console.log(
            `    Assigned ${profile.name} to ${role.role} ` +
              `(cnt=${globalAssignmentCounts.get(volunteer.userId)}, famLoad=${((familyAssignmentCounts.get(volunteer.familyKey) || 0) / getFamilySize(volunteer.userId)).toFixed(2)})`
          );
        }
      }
    }

    // Log final distribution for debugging
    console.log('=== Final Assignment Distribution ===');
    const distribution: { name: string; count: number }[] = [];
    for (const [userId, count] of globalAssignmentCounts.entries()) {
      const profile = profileMap.get(userId);
      if (profile) {
        distribution.push({ name: profile.name, count });
      }
    }
    distribution.sort((a, b) => b.count - a.count);
    distribution.forEach(d => console.log(`  ${d.name}: ${d.count} assignments`));

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
        distribution: distribution,
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
