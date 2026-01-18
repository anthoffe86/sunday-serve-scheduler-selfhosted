import { useState, useMemo } from 'react';
import { 
  Calendar as CalendarIcon,
  Clock,
  Users,
  Loader2,
  Plus,
  List,
  LayoutGrid,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { 
  format, 
  parseISO, 
  startOfMonth, 
  endOfMonth, 
  addMonths, 
  subMonths,
  eachDayOfInterval,
  startOfWeek,
  endOfWeek,
  isSameMonth,
  isSameDay,
  isToday
} from 'date-fns';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import { Navigate } from 'react-router-dom';
import { useEvents, EventWithDetails } from '@/hooks/useEventScheduler';
import { cn } from '@/lib/utils';
import { CreateEventDialog } from '@/components/admin/CreateEventDialog';
import { EditEventDialog } from '@/components/admin/EditEventDialog';
import {
  ToggleGroup,
  ToggleGroupItem,
} from '@/components/ui/toggle-group';

const AdminSchedule = () => {
  const { isAdmin, isLoading: authLoading } = useAuth();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editEventId, setEditEventId] = useState<string | null>(null);

  // Fetch events for a wider range to support calendar navigation
  const startDate = format(subMonths(startOfMonth(currentMonth), 1), 'yyyy-MM-dd');
  const endDate = format(addMonths(endOfMonth(currentMonth), 2), 'yyyy-MM-dd');

  const { data: events, isLoading } = useEvents({ startDate, endDate });

  // Get the current event from fresh data (so it updates after mutations)
  const editEvent = useMemo(() => {
    if (!editEventId || !events) return null;
    return events.find(e => e.id === editEventId) || null;
  }, [editEventId, events]);

  // Calendar grid generation
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const calendarStart = startOfWeek(monthStart);
    const calendarEnd = endOfWeek(monthEnd);
    
    return eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  }, [currentMonth]);

  // Group events by date for calendar view
  const eventsByDate = useMemo(() => {
    if (!events) return new Map<string, EventWithDetails[]>();
    
    const map = new Map<string, EventWithDetails[]>();
    for (const event of events) {
      const dateKey = event.date;
      if (!map.has(dateKey)) {
        map.set(dateKey, []);
      }
      map.get(dateKey)!.push(event);
    }
    return map;
  }, [events]);

  // Filter events for current month in list view
  const currentMonthEvents = useMemo(() => {
    if (!events) return [];
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    
    return events.filter(event => {
      const eventDate = parseISO(event.date);
      return eventDate >= monthStart && eventDate <= monthEnd;
    }).sort((a, b) => {
      const dateCompare = a.date.localeCompare(b.date);
      if (dateCompare !== 0) return dateCompare;
      return a.start_time.localeCompare(b.start_time);
    });
  }, [events, currentMonth]);

  if (authLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  const getFilledCount = (event: EventWithDetails) => {
    const totalRequired = event.roles.reduce((sum, r) => sum + r.quantity, 0);
    const totalFilled = event.assignments.length;
    return { filled: totalFilled, required: totalRequired };
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-serif text-3xl font-bold">Schedule</h1>
          <p className="text-muted-foreground">
            Manage events and volunteer assignments
          </p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)} className="gap-2 self-start">
          <Plus className="h-4 w-4" />
          Create Event
        </Button>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setCurrentMonth(prev => subMonths(prev, 1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="font-medium min-w-[160px] text-center">
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

        <ToggleGroup 
          type="single" 
          value={viewMode} 
          onValueChange={(v) => v && setViewMode(v as 'calendar' | 'list')}
          className="ml-auto"
        >
          <ToggleGroupItem value="calendar" aria-label="Calendar view">
            <LayoutGrid className="h-4 w-4" />
          </ToggleGroupItem>
          <ToggleGroupItem value="list" aria-label="List view">
            <List className="h-4 w-4" />
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : viewMode === 'calendar' ? (
        /* Calendar View */
        <Card>
          <CardContent className="p-4">
            {/* Day headers */}
            <div className="grid grid-cols-7 gap-1 mb-2">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                <div key={day} className="text-center text-sm font-medium text-muted-foreground py-2">
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar grid */}
            <div className="grid grid-cols-7 gap-1">
              {calendarDays.map((day) => {
                const dateKey = format(day, 'yyyy-MM-dd');
                const dayEvents = eventsByDate.get(dateKey) || [];
                const isCurrentMonth = isSameMonth(day, currentMonth);
                
                return (
                  <div
                    key={dateKey}
                    className={cn(
                      'min-h-[100px] p-1 border rounded-lg',
                      !isCurrentMonth && 'bg-muted/30',
                      isToday(day) && 'border-primary'
                    )}
                  >
                    <div className={cn(
                      'text-sm font-medium mb-1 px-1',
                      !isCurrentMonth && 'text-muted-foreground',
                      isToday(day) && 'text-primary'
                    )}>
                      {format(day, 'd')}
                    </div>
                    <div className="space-y-1">
                      {dayEvents.slice(0, 3).map((event) => (
                        <button
                          key={event.id}
                          onClick={() => setEditEventId(event.id)}
                          className={cn(
                            'w-full text-left text-xs p-1 rounded truncate',
                            'hover:opacity-80 transition-opacity',
                            event.status === 'cancelled' 
                              ? 'bg-muted text-muted-foreground line-through' 
                              : 'bg-primary/10 text-primary'
                          )}
                        >
                          <span className="font-medium">{formatTime(event.start_time)}</span>
                          <span className="ml-1 hidden sm:inline">{event.name}</span>
                        </button>
                      ))}
                      {dayEvents.length > 3 && (
                        <div className="text-xs text-muted-foreground px-1">
                          +{dayEvents.length - 3} more
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      ) : (
        /* List View */
        <div className="space-y-3">
          {currentMonthEvents.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <CalendarIcon className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <h3 className="font-medium text-lg mb-2">No Events</h3>
                <p className="text-muted-foreground text-center mb-4">
                  No events scheduled for {format(currentMonth, 'MMMM yyyy')}.
                </p>
                <Button onClick={() => setCreateDialogOpen(true)} className="gap-2">
                  <Plus className="h-4 w-4" />
                  Create Event
                </Button>
              </CardContent>
            </Card>
          ) : (
            currentMonthEvents.map((event, index) => {
              const { filled, required } = getFilledCount(event);
              const eventDate = parseISO(event.date);
              const isNextEvent = index === 0 && event.status !== 'cancelled';
              
              // Get volunteer initials for display
              const volunteerInitials = event.assignments.slice(0, 4).map(a => {
                const name = a.volunteer_name || 'Unknown';
                return name.split(' ').map(n => n[0]).join('').slice(0, 1).toUpperCase();
              });
              const remainingCount = event.assignments.length - 4;
              
              return (
                <Card 
                  key={event.id} 
                  className={cn(
                    'cursor-pointer hover:shadow-md transition-all overflow-hidden',
                    event.status === 'cancelled' && 'opacity-60',
                    isNextEvent && 'ring-1 ring-primary/30'
                  )}
                  onClick={() => setEditEventId(event.id)}
                >
                  <CardContent className="p-0">
                    <div className="flex">
                      {/* Date Block */}
                      <div className={cn(
                        'flex flex-col items-center justify-center px-4 py-4 min-w-[72px]',
                        event.status === 'published' ? 'bg-primary text-primary-foreground' : 
                        event.status === 'cancelled' ? 'bg-muted text-muted-foreground' : 
                        'bg-secondary text-secondary-foreground'
                      )}>
                        <span className="text-xs font-semibold uppercase tracking-wide">
                          {format(eventDate, 'EEE')}
                        </span>
                        <span className="text-2xl font-bold">
                          {format(eventDate, 'd')}
                        </span>
                      </div>
                      
                      {/* Content */}
                      <div className="flex-1 p-4">
                        {/* Next Service Badge */}
                        {isNextEvent && (
                          <Badge variant="default" className="mb-2 text-xs">
                            Next Service
                          </Badge>
                        )}
                        
                        <h3 className={cn(
                          'font-serif text-lg font-semibold mb-1',
                          event.status === 'cancelled' && 'line-through'
                        )}>
                          {event.name}
                        </h3>
                        
                        <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground mb-3">
                          <span className="flex items-center gap-1.5">
                            <Clock className="h-4 w-4" />
                            {formatTime(event.start_time)}
                          </span>
                          <Badge 
                            variant={event.status === 'published' ? 'outline' : event.status === 'cancelled' ? 'destructive' : 'secondary'}
                            className="text-xs"
                          >
                            {event.status}
                          </Badge>
                        </div>
                        
                        {/* Volunteer Avatars */}
                        {required > 0 && (
                          <div className="flex items-center gap-2">
                            <Users className="h-4 w-4 text-muted-foreground" />
                            <div className="flex items-center -space-x-1">
                              {volunteerInitials.map((initial, i) => (
                                <div 
                                  key={i}
                                  className="flex h-7 w-7 items-center justify-center rounded-full bg-secondary border-2 border-background text-xs font-medium"
                                >
                                  {initial}
                                </div>
                              ))}
                              {remainingCount > 0 && (
                                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-muted border-2 border-background text-xs font-medium text-muted-foreground">
                                  +{remainingCount}
                                </div>
                              )}
                            </div>
                            <span className="text-sm text-muted-foreground">
                              {filled} serving
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      )}

      {/* Create Event Dialog */}
      <CreateEventDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
      />

      {/* Edit Event Dialog */}
      <EditEventDialog
        open={!!editEventId}
        onOpenChange={(open) => !open && setEditEventId(null)}
        event={editEvent}
      />
    </div>
  );
};

export default AdminSchedule;
