import { useState, useMemo } from 'react';
import { 
  Calendar,
  Clock,
  Users,
  Loader2,
  Check,
  X,
  MoreHorizontal,
  ChevronLeft,
  ChevronRight,
  Filter,
  UserPlus,
  Trash2
} from 'lucide-react';
import { format, parseISO, startOfMonth, endOfMonth, addMonths, subMonths } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import { Navigate, Link } from 'react-router-dom';
import { 
  useEvents, 
  useUpdateEvent,
  useBulkUpdateEventStatus,
  useDeleteEvent,
  EventWithDetails
} from '@/hooks/useEventScheduler';
import { useProfiles } from '@/hooks/useVolunteerData';
import { ROLE_LABELS } from '@/types';
import { toast } from 'sonner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { AssignVolunteerDialog } from '@/components/admin/AssignVolunteerDialog';

const EventScheduler = () => {
  const { isAdmin, isLoading: authLoading } = useAuth();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedEvents, setSelectedEvents] = useState<Set<string>>(new Set());
  const [deleteEventId, setDeleteEventId] = useState<string | null>(null);
  const [assignDialogEvent, setAssignDialogEvent] = useState<{ eventId: string; role: string } | null>(null);

  const startDate = format(startOfMonth(currentMonth), 'yyyy-MM-dd');
  const endDate = format(endOfMonth(currentMonth), 'yyyy-MM-dd');

  const { data: events, isLoading } = useEvents({ 
    startDate, 
    endDate,
    status: statusFilter !== 'all' ? statusFilter : undefined
  });
  const { data: profiles } = useProfiles();
  const updateEvent = useUpdateEvent();
  const bulkUpdateStatus = useBulkUpdateEventStatus();
  const deleteEvent = useDeleteEvent();

  const filteredEvents = useMemo(() => {
    if (!events) return [];
    return events;
  }, [events]);

  if (authLoading || isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  const handleStatusChange = async (eventId: string, status: 'draft' | 'published' | 'cancelled') => {
    try {
      await updateEvent.mutateAsync({ id: eventId, status });
      toast.success(`Event ${status === 'published' ? 'published' : status === 'cancelled' ? 'cancelled' : 'set to draft'}`);
    } catch (error) {
      toast.error('Failed to update event status');
    }
  };

  const handleBulkStatusChange = async (status: 'draft' | 'published' | 'cancelled') => {
    if (selectedEvents.size === 0) return;
    
    try {
      await bulkUpdateStatus.mutateAsync({ 
        eventIds: Array.from(selectedEvents), 
        status 
      });
      toast.success(`${selectedEvents.size} events updated`);
      setSelectedEvents(new Set());
    } catch (error) {
      toast.error('Failed to update events');
    }
  };

  const handleDelete = async () => {
    if (!deleteEventId) return;
    
    try {
      await deleteEvent.mutateAsync(deleteEventId);
      toast.success('Event deleted');
      setDeleteEventId(null);
    } catch (error) {
      toast.error('Failed to delete event');
    }
  };

  const toggleEventSelection = (eventId: string) => {
    setSelectedEvents(prev => {
      const next = new Set(prev);
      if (next.has(eventId)) {
        next.delete(eventId);
      } else {
        next.add(eventId);
      }
      return next;
    });
  };

  const selectAll = () => {
    if (filteredEvents.length === selectedEvents.size) {
      setSelectedEvents(new Set());
    } else {
      setSelectedEvents(new Set(filteredEvents.map(e => e.id)));
    }
  };

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'published':
        return <Badge className="bg-green-500/10 text-green-600 hover:bg-green-500/20">Published</Badge>;
      case 'cancelled':
        return <Badge variant="destructive">Cancelled</Badge>;
      default:
        return <Badge variant="secondary">Draft</Badge>;
    }
  };

  const getFilledRolesCount = (event: EventWithDetails, role: string) => {
    const required = event.roles.find(r => r.role === role)?.quantity || 0;
    const filled = event.assignments.filter(a => a.role === role).length;
    return { filled, required };
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-serif text-3xl font-bold">Event Scheduler</h1>
          <p className="text-muted-foreground">
            Manage events and volunteer assignments
          </p>
        </div>
        <Button asChild className="gap-2 self-start">
          <Link to="/admin/templates">
            <Calendar className="h-4 w-4" />
            Manage Templates
          </Link>
        </Button>
      </div>

      {/* Filters and Navigation */}
      <Card>
        <CardContent className="flex flex-wrap items-center gap-4 py-4">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setCurrentMonth(prev => subMonths(prev, 1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="font-medium min-w-[140px] text-center">
              {format(currentMonth, 'MMMM yyyy')}
            </span>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setCurrentMonth(prev => addMonths(prev, 1))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="published">Published</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {selectedEvents.size > 0 && (
            <div className="flex items-center gap-2 ml-auto">
              <span className="text-sm text-muted-foreground">
                {selectedEvents.size} selected
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleBulkStatusChange('published')}
              >
                Publish All
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleBulkStatusChange('draft')}
              >
                Set to Draft
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Events List */}
      {!filteredEvents || filteredEvents.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Calendar className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="font-medium text-lg mb-2">No Events</h3>
            <p className="text-muted-foreground text-center mb-4">
              No events found for {format(currentMonth, 'MMMM yyyy')}.
              <br />
              Create event templates and generate events to get started.
            </p>
            <Button asChild>
              <Link to="/admin/templates">Go to Templates</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-2 px-2">
            <input
              type="checkbox"
              checked={filteredEvents.length > 0 && selectedEvents.size === filteredEvents.length}
              onChange={selectAll}
              className="h-4 w-4 rounded border-muted-foreground/30"
            />
            <span className="text-sm text-muted-foreground">Select all</span>
          </div>

          {filteredEvents.map((event) => (
            <Card key={event.id} className={selectedEvents.has(event.id) ? 'ring-2 ring-primary' : ''}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={selectedEvents.has(event.id)}
                      onChange={() => toggleEventSelection(event.id)}
                      className="mt-1 h-4 w-4 rounded border-muted-foreground/30"
                    />
                    <div>
                      <div className="flex items-center gap-3">
                        <CardTitle className="font-serif text-lg">{event.name}</CardTitle>
                        {getStatusBadge(event.status)}
                      </div>
                      <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1.5">
                          <Calendar className="h-4 w-4" />
                          {format(parseISO(event.date), 'EEEE, MMMM d, yyyy')}
                        </span>
                        <span className="flex items-center gap-1.5">
                          <Clock className="h-4 w-4" />
                          {formatTime(event.start_time)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {event.status !== 'published' && (
                        <DropdownMenuItem onClick={() => handleStatusChange(event.id, 'published')}>
                          <Check className="h-4 w-4 mr-2" />
                          Publish
                        </DropdownMenuItem>
                      )}
                      {event.status !== 'draft' && (
                        <DropdownMenuItem onClick={() => handleStatusChange(event.id, 'draft')}>
                          Set to Draft
                        </DropdownMenuItem>
                      )}
                      {event.status !== 'cancelled' && (
                        <DropdownMenuItem onClick={() => handleStatusChange(event.id, 'cancelled')}>
                          <X className="h-4 w-4 mr-2" />
                          Cancel
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem 
                        onClick={() => setDeleteEventId(event.id)}
                        className="text-destructive"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>

              <CardContent>
                <h4 className="text-sm font-medium mb-3 flex items-center gap-1.5">
                  <Users className="h-4 w-4" />
                  Volunteer Assignments
                </h4>

                {event.roles.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No roles defined for this event</p>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {event.roles.map((role) => {
                      const { filled, required } = getFilledRolesCount(event, role.role);
                      const isFilled = filled >= required;
                      const assignments = event.assignments.filter(a => a.role === role.role);

                      return (
                        <div 
                          key={role.id} 
                          className={`rounded-lg border p-3 ${isFilled ? 'border-green-200 bg-green-50/50' : 'border-amber-200 bg-amber-50/50'}`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-medium text-sm">
                              {ROLE_LABELS[role.role as keyof typeof ROLE_LABELS] || role.role}
                            </span>
                            <Badge variant={isFilled ? 'default' : 'secondary'} className="text-xs">
                              {filled}/{required}
                            </Badge>
                          </div>

                          <div className="space-y-1">
                            {assignments.map((assignment) => (
                              <div 
                                key={assignment.id} 
                                className="flex items-center justify-between text-sm bg-background rounded px-2 py-1"
                              >
                                <span>{assignment.volunteer_name || 'Unknown'}</span>
                              </div>
                            ))}

                            {filled < required && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="w-full h-7 text-xs gap-1"
                                onClick={() => setAssignDialogEvent({ eventId: event.id, role: role.role })}
                              >
                                <UserPlus className="h-3 w-3" />
                                Assign Volunteer
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Assign Volunteer Dialog */}
      <AssignVolunteerDialog
        open={!!assignDialogEvent}
        onOpenChange={(open) => !open && setAssignDialogEvent(null)}
        eventId={assignDialogEvent?.eventId || ''}
        role={assignDialogEvent?.role || ''}
        profiles={profiles || []}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteEventId} onOpenChange={(open) => !open && setDeleteEventId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Event?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this event and all its assignments. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default EventScheduler;
