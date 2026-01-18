import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { addDays, addWeeks, format, getDay, nextDay, parseISO, isBefore, isAfter } from 'date-fns';
import type { Database } from '@/integrations/supabase/types';

type ServiceRole = Database['public']['Enums']['service_role'];

// Types
export interface EventTemplate {
  id: string;
  name: string;
  description: string | null;
  day_of_week: number;
  start_time: string;
  is_recurring: boolean;
  recurrence_end_type: 'indefinite' | 'date' | 'count' | null;
  recurrence_end_date: string | null;
  recurrence_count: number | null;
  active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface EventTemplateRole {
  id: string;
  template_id: string;
  role: string;
  quantity: number;
  created_at: string;
}

export interface Event {
  id: string;
  template_id: string | null;
  name: string;
  date: string;
  start_time: string;
  status: 'draft' | 'published' | 'cancelled';
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface EventRole {
  id: string;
  event_id: string;
  role: string;
  quantity: number;
  created_at: string;
}

export interface EventAssignment {
  id: string;
  event_id: string;
  role: string;
  volunteer_id: string;
  created_at: string;
  updated_at: string;
}

export interface EventWithDetails extends Event {
  roles: EventRole[];
  assignments: (EventAssignment & { volunteer_name?: string; volunteer_email?: string })[];
}

export interface EventTemplateWithRoles extends EventTemplate {
  roles: EventTemplateRole[];
}

// Day of week helpers
export const DAYS_OF_WEEK = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
];

// Hook: Fetch all event templates with their roles
export function useEventTemplates() {
  return useQuery({
    queryKey: ['event-templates'],
    queryFn: async () => {
      const { data: templates, error: templatesError } = await supabase
        .from('event_templates')
        .select('*')
        .order('day_of_week', { ascending: true })
        .order('start_time', { ascending: true });

      if (templatesError) throw templatesError;

      const { data: roles, error: rolesError } = await supabase
        .from('event_template_roles')
        .select('*');

      if (rolesError) throw rolesError;

      const templatesWithRoles: EventTemplateWithRoles[] = (templates || []).map(template => ({
        ...template,
        recurrence_end_type: template.recurrence_end_type as EventTemplate['recurrence_end_type'],
        roles: (roles || []).filter(role => role.template_id === template.id),
      }));

      return templatesWithRoles;
    },
  });
}

// Hook: Create event template
export function useCreateEventTemplate() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (data: {
      name: string;
      description?: string;
      day_of_week: number;
      start_time: string;
      is_recurring: boolean;
      recurrence_end_type?: 'indefinite' | 'date' | 'count';
      recurrence_end_date?: string;
      recurrence_count?: number;
      roles: { role: string; quantity: number }[];
    }) => {
      const { roles, ...templateData } = data;

      const { data: template, error: templateError } = await supabase
        .from('event_templates')
        .insert({
          ...templateData,
          created_by: user?.id,
        })
        .select()
        .single();

      if (templateError) throw templateError;

      if (roles.length > 0) {
        const { error: rolesError } = await supabase
          .from('event_template_roles')
          .insert(
            roles.map(role => ({
              template_id: template.id,
              role: role.role as ServiceRole,
              quantity: role.quantity,
            }))
          );

        if (rolesError) throw rolesError;
      }

      return template;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event-templates'] });
    },
  });
}

// Hook: Update event template
export function useUpdateEventTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      id: string;
      name?: string;
      description?: string;
      day_of_week?: number;
      start_time?: string;
      is_recurring?: boolean;
      recurrence_end_type?: 'indefinite' | 'date' | 'count' | null;
      recurrence_end_date?: string | null;
      recurrence_count?: number | null;
      active?: boolean;
      roles?: { role: string; quantity: number }[];
      syncToEvents?: boolean; // Whether to sync changes to existing draft events
    }) => {
      const { id, roles, syncToEvents = true, ...updateData } = data;

      // Update template
      const { error: templateError } = await supabase
        .from('event_templates')
        .update(updateData)
        .eq('id', id);

      if (templateError) throw templateError;

      // Update template roles
      if (roles !== undefined) {
        // Delete existing template roles
        const { error: deleteError } = await supabase
          .from('event_template_roles')
          .delete()
          .eq('template_id', id);

        if (deleteError) throw deleteError;

        // Insert new template roles
        if (roles.length > 0) {
          const { error: insertError } = await supabase
            .from('event_template_roles')
            .insert(
              roles.map(role => ({
                template_id: id,
                role: role.role as ServiceRole,
                quantity: role.quantity,
              }))
            );

          if (insertError) throw insertError;
        }

        // Sync roles to existing draft events
        if (syncToEvents) {
          // Get all draft events for this template
          const today = format(new Date(), 'yyyy-MM-dd');
          const { data: draftEvents, error: eventsError } = await supabase
            .from('events')
            .select('id')
            .eq('template_id', id)
            .eq('status', 'draft')
            .gte('date', today);

          if (eventsError) throw eventsError;

          if (draftEvents && draftEvents.length > 0) {
            const eventIds = draftEvents.map(e => e.id);

            // Delete existing event roles for these events
            const { error: deleteEventRolesError } = await supabase
              .from('event_roles')
              .delete()
              .in('event_id', eventIds);

            if (deleteEventRolesError) throw deleteEventRolesError;

            // Insert new event roles for each event
            if (roles.length > 0) {
              const eventRolesToInsert = eventIds.flatMap(eventId =>
                roles.map(role => ({
                  event_id: eventId,
                  role: role.role as ServiceRole,
                  quantity: role.quantity,
                }))
              );

              const { error: insertEventRolesError } = await supabase
                .from('event_roles')
                .insert(eventRolesToInsert);

              if (insertEventRolesError) throw insertEventRolesError;
            }

            // Also remove any assignments that no longer match valid roles
            const validRoles = roles.map(r => r.role);
            if (validRoles.length > 0) {
              const { error: cleanupError } = await supabase
                .from('event_assignments')
                .delete()
                .in('event_id', eventIds)
                .not('role', 'in', `(${validRoles.join(',')})`);

              // Ignore cleanup errors - assignments for removed roles will just be orphaned
              if (cleanupError) {
                console.warn('Failed to cleanup orphaned assignments:', cleanupError);
              }
            } else {
              // No roles defined, remove all assignments
              const { error: cleanupError } = await supabase
                .from('event_assignments')
                .delete()
                .in('event_id', eventIds);

              if (cleanupError) {
                console.warn('Failed to cleanup assignments:', cleanupError);
              }
            }
          }
        }
      }

      return { id };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event-templates'] });
      queryClient.invalidateQueries({ queryKey: ['events'] });
    },
  });
}

// Hook: Delete event template
export function useDeleteEventTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('event_templates')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return { id };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event-templates'] });
    },
  });
}

// Hook: Fetch all events with details
export function useEvents(options?: { startDate?: string; endDate?: string; status?: string }) {
  return useQuery({
    queryKey: ['events', options],
    queryFn: async () => {
      let query = supabase
        .from('events')
        .select('*')
        .order('date', { ascending: true })
        .order('start_time', { ascending: true });

      if (options?.startDate) {
        query = query.gte('date', options.startDate);
      }
      if (options?.endDate) {
        query = query.lte('date', options.endDate);
      }
      if (options?.status) {
        query = query.eq('status', options.status);
      }

      const { data: events, error: eventsError } = await query;
      if (eventsError) throw eventsError;

      // Return empty array early if no events
      if (!events || events.length === 0) {
        return [] as EventWithDetails[];
      }

      const eventIds = events.map(e => e.id);

      const [rolesResult, assignmentsResult, profilesResult] = await Promise.all([
        supabase.from('event_roles').select('*').in('event_id', eventIds),
        supabase.from('event_assignments').select('*').in('event_id', eventIds),
        supabase.from('profiles').select('user_id, name, email'),
      ]);

      if (rolesResult.error) throw rolesResult.error;
      if (assignmentsResult.error) throw assignmentsResult.error;
      if (profilesResult.error) throw profilesResult.error;

      const profilesMap = new Map(
        (profilesResult.data || []).map(p => [p.user_id, { name: p.name, email: p.email }])
      );

      const eventsWithDetails: EventWithDetails[] = events.map(event => ({
        ...event,
        status: event.status as Event['status'],
        roles: (rolesResult.data || []).filter(r => r.event_id === event.id),
        assignments: (assignmentsResult.data || [])
          .filter(a => a.event_id === event.id)
          .map(a => ({
            ...a,
            volunteer_name: profilesMap.get(a.volunteer_id)?.name,
            volunteer_email: profilesMap.get(a.volunteer_id)?.email,
          })),
      }));

      return eventsWithDetails;
    },
  });
}

// Hook: Generate events from templates
export function useGenerateEvents() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      templateId: string;
      startDate: string;
      endDate?: string;
      count?: number;
    }) => {
      // Fetch template with roles
      const { data: template, error: templateError } = await supabase
        .from('event_templates')
        .select('*')
        .eq('id', data.templateId)
        .single();

      if (templateError) throw templateError;

      const { data: templateRoles, error: rolesError } = await supabase
        .from('event_template_roles')
        .select('*')
        .eq('template_id', data.templateId);

      if (rolesError) throw rolesError;

      // Generate event dates
      const dates: Date[] = [];
      let currentDate = parseISO(data.startDate);
      
      // Find next occurrence of the target day
      const targetDay = template.day_of_week;
      if (getDay(currentDate) !== targetDay) {
        currentDate = nextDay(currentDate, targetDay as 0 | 1 | 2 | 3 | 4 | 5 | 6);
      }

      const endDate = data.endDate ? parseISO(data.endDate) : addWeeks(currentDate, 52);
      const maxCount = data.count || 52;

      while (dates.length < maxCount && !isAfter(currentDate, endDate)) {
        dates.push(currentDate);
        currentDate = addWeeks(currentDate, 1);
      }

      // Create events
      const eventsToCreate = dates.map(date => ({
        template_id: template.id,
        name: template.name,
        date: format(date, 'yyyy-MM-dd'),
        start_time: template.start_time,
        status: 'draft' as const,
      }));

      const { data: createdEvents, error: createError } = await supabase
        .from('events')
        .insert(eventsToCreate)
        .select();

      if (createError) throw createError;

      // Create event roles for each event
      if (templateRoles && templateRoles.length > 0 && createdEvents) {
        const eventRolesToCreate = createdEvents.flatMap(event =>
          templateRoles.map(role => ({
            event_id: event.id,
            role: role.role,
            quantity: role.quantity,
          }))
        );

        const { error: eventRolesError } = await supabase
          .from('event_roles')
          .insert(eventRolesToCreate);

        if (eventRolesError) throw eventRolesError;
      }

      return createdEvents;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
    },
  });
}

// Hook: Update event
export function useUpdateEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      id: string;
      name?: string;
      date?: string;
      start_time?: string;
      status?: 'draft' | 'published' | 'cancelled';
      notes?: string;
    }) => {
      const { id, ...updateData } = data;

      const { error } = await supabase
        .from('events')
        .update(updateData)
        .eq('id', id);

      if (error) throw error;
      return { id };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
    },
  });
}

// Hook: Delete event
export function useDeleteEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('events')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return { id };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
    },
  });
}

// Hook: Bulk delete events
export function useBulkDeleteEvents() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase
        .from('events')
        .delete()
        .in('id', ids);

      if (error) throw error;
      return { ids };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
    },
  });
}

// Hook: Assign volunteer to event
export function useAssignVolunteer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      event_id: string;
      role: string;
      volunteer_id: string;
    }) => {
      const { data: assignment, error } = await supabase
        .from('event_assignments')
        .insert({
          event_id: data.event_id,
          role: data.role as ServiceRole,
          volunteer_id: data.volunteer_id,
        })
        .select()
        .single();

      if (error) throw error;
      return assignment;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
    },
  });
}

// Hook: Remove volunteer assignment
export function useRemoveAssignment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('event_assignments')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return { id };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
    },
  });
}

// Hook: Bulk update event status
export function useBulkUpdateEventStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { eventIds: string[]; status: 'draft' | 'published' | 'cancelled' }) => {
      const { error } = await supabase
        .from('events')
        .update({ status: data.status })
        .in('id', data.eventIds);

      if (error) throw error;
      return { count: data.eventIds.length };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
    },
  });
}

// Hook: Auto-schedule volunteers for events
export function useAutoSchedule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { templateId?: string; eventIds?: string[] }) => {
      const { data: result, error } = await supabase.functions.invoke('auto-scheduler', {
        body: data,
      });

      if (error) throw error;
      if (result.error) throw new Error(result.error);
      
      return result as {
        message: string;
        assignments: Array<{
          event_id: string;
          event_date: string;
          role: string;
          volunteer_id: string;
          volunteer_name: string;
        }>;
        totalEvents: number;
        totalAssignments: number;
      };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
    },
  });
}
