import { useState, useMemo } from 'react';
import { 
  Plus, 
  Loader2, 
  Calendar,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  Clock,
  HourglassIcon
} from 'lucide-react';
import { format, parseISO, isAfter } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import { Navigate, useNavigate } from 'react-router-dom';
import { 
  useEventTemplates, 
  useEvents,
  EventTemplateWithRoles,
  EventWithDetails 
} from '@/hooks/useEventScheduler';
import { cn } from '@/lib/utils';
import { CreateEventDialog } from '@/components/admin/CreateEventDialog';
import { ROLE_LABELS } from '@/types';

const AdminEvents = () => {
  const { isAdmin, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  const { data: templates, isLoading: templatesLoading } = useEventTemplates();
  const { data: allEvents, isLoading: eventsLoading } = useEvents();

  // Group events by template
  const eventsByTemplate = useMemo(() => {
    if (!allEvents) return new Map<string, EventWithDetails[]>();
    
    const map = new Map<string, EventWithDetails[]>();
    const today = new Date();
    
    for (const event of allEvents) {
      if (!event.template_id) continue;
      if (!map.has(event.template_id)) {
        map.set(event.template_id, []);
      }
      // Only include future events
      const eventDate = parseISO(event.date);
      if (isAfter(eventDate, today) || format(eventDate, 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd')) {
        map.get(event.template_id)!.push(event);
      }
    }
    
    return map;
  }, [allEvents]);

  // Calculate template stats
  const getTemplateStats = (template: EventTemplateWithRoles) => {
    const events = eventsByTemplate.get(template.id) || [];
    const futureEvents = events.filter(e => e.status !== 'cancelled');
    
    let readyToPublish = 0;
    let needsVolunteers = 0;
    let published = 0;
    let draft = 0;
    let awaitingConfirmation = 0; // Count of events with pending invitations

    for (const event of futureEvents) {
      const totalRequired = event.roles.reduce((sum, r) => sum + r.quantity, 0);
      // Only count non-declined assignments as filled
      const activeAssignments = event.assignments.filter(a => a.status !== 'declined');
      const totalFilled = activeAssignments.length;
      const confirmedCount = event.assignments.filter(a => a.status === 'confirmed').length;
      const invitedCount = event.assignments.filter(a => a.status === 'invited').length;
      const isFullyStaffed = totalFilled >= totalRequired && totalRequired > 0;
      const isFullyConfirmed = confirmedCount >= totalRequired && totalRequired > 0;
      
      if (event.status === 'published') {
        published++;
      } else if (event.status === 'draft') {
        draft++;
        if (isFullyConfirmed) {
          readyToPublish++;
        } else if (invitedCount > 0) {
          // Event has invitations pending response
          awaitingConfirmation++;
        } else if (!isFullyStaffed) {
          needsVolunteers++;
        }
      }
    }

    return { 
      totalEvents: futureEvents.length, 
      readyToPublish, 
      needsVolunteers, 
      published,
      draft,
      awaitingConfirmation
    };
  };

  if (authLoading || templatesLoading || eventsLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-serif text-2xl font-bold sm:text-3xl">Events</h1>
          <p className="text-muted-foreground">
            Create and manage recurring events with volunteer assignments
          </p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)} className="gap-2 self-start">
          <Plus className="h-4 w-4" />
          Create Event
        </Button>
      </div>

      {/* Event Templates List */}
      {!templates || templates.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Calendar className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="font-medium text-lg mb-2">No Events Yet</h3>
            <p className="text-muted-foreground text-center mb-4">
              Create your first recurring event to get started.
            </p>
            <Button onClick={() => setCreateDialogOpen(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              Create Event
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {templates.map((template) => {
            const stats = getTemplateStats(template);
            const nextEvent = (eventsByTemplate.get(template.id) || [])
              .filter(e => e.status !== 'cancelled')
              .sort((a, b) => a.date.localeCompare(b.date))[0];

            return (
              <Card 
                key={template.id} 
                className={cn(
                  "cursor-pointer hover:shadow-md transition-all",
                  !template.active && "opacity-60"
                )}
                onClick={() => navigate(`/admin/events/${template.id}`)}
              >
                <CardContent className="p-0">
                  <div className="flex items-stretch">
                    {/* Status indicator */}
                    <div className={cn(
                      "w-2 rounded-l-lg",
                      stats.needsVolunteers > 0 
                        ? "bg-amber-500" 
                        : stats.awaitingConfirmation > 0
                          ? "bg-blue-500"
                          : stats.readyToPublish > 0 
                            ? "bg-green-500" 
                            : "bg-primary"
                    )} />
                    
                    <div className="flex-1 p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-serif text-lg font-semibold truncate">
                              {template.name}
                            </h3>
                            {!template.active && (
                              <Badge variant="secondary" className="text-xs shrink-0">
                                Inactive
                              </Badge>
                            )}
                          </div>
                          
                          {template.description && (
                            <p className="text-sm text-muted-foreground line-clamp-1 mb-2">
                              {template.description}
                            </p>
                          )}
                          
                          {/* Roles */}
                          <div className="flex flex-wrap gap-1.5 mb-3">
                            {template.roles.map((role) => (
                              <Badge key={role.id} variant="outline" className="text-xs">
                                {ROLE_LABELS[role.role as keyof typeof ROLE_LABELS] || role.role}
                                {role.quantity > 1 && ` ×${role.quantity}`}
                              </Badge>
                            ))}
                            {template.roles.length === 0 && (
                              <span className="text-xs text-muted-foreground">No roles defined</span>
                            )}
                          </div>

                          {/* Stats */}
                          <div className="flex flex-wrap items-center gap-4 text-sm">
                            <span className="flex items-center gap-1.5 text-muted-foreground">
                              <Clock className="h-4 w-4" />
                              {stats.totalEvents} upcoming
                            </span>
                            
                            {stats.published > 0 && (
                              <span className="flex items-center gap-1.5 text-green-600">
                                <CheckCircle2 className="h-4 w-4" />
                                {stats.published} published
                              </span>
                            )}
                            
                            {stats.needsVolunteers > 0 && (
                              <span className="flex items-center gap-1.5 text-amber-600">
                                <AlertCircle className="h-4 w-4" />
                                {stats.needsVolunteers} need volunteers
                              </span>
                            )}
                            
                            {stats.awaitingConfirmation > 0 && (
                              <span className="flex items-center gap-1.5 text-blue-600">
                                <HourglassIcon className="h-4 w-4" />
                                {stats.awaitingConfirmation} awaiting confirmation
                              </span>
                            )}
                            
                            {stats.readyToPublish > 0 && (
                              <span className="flex items-center gap-1.5 text-green-600">
                                <CheckCircle2 className="h-4 w-4" />
                                {stats.readyToPublish} ready to publish
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Next event preview */}
                        <div className="hidden sm:flex flex-col items-end gap-2 shrink-0">
                          {nextEvent && (
                            <div className="text-right">
                              <p className="text-xs text-muted-foreground mb-0.5">Next</p>
                              <p className="font-medium text-sm">
                                {format(parseISO(nextEvent.date), 'MMM d, yyyy')}
                              </p>
                            </div>
                          )}
                          <ChevronRight className="h-5 w-5 text-muted-foreground" />
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create Event Dialog */}
      <CreateEventDialog 
        open={createDialogOpen} 
        onOpenChange={setCreateDialogOpen} 
      />
    </div>
  );
};

export default AdminEvents;
