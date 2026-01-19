import { Link } from 'react-router-dom';
import { useState } from 'react';
import { format, parseISO, isThisWeek, addMonths } from 'date-fns';
import {
  CalendarDays,
  CalendarCheck,
  Loader2,
  Clock,
  Download
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { RoleBadge } from '@/components/RoleBadge';
import { VolunteerEventDetailDialog } from '@/components/VolunteerEventDetailDialog';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useVolunteerData';
import { useEvents } from '@/hooks/useEventScheduler';
import { cn } from '@/lib/utils';
import { generateICSFile, downloadICSFile } from '@/lib/calendarExport';
import { toast } from 'sonner';

const Dashboard = () => {
  const { user } = useAuth();
  const { data: profile, isLoading: profileLoading } = useProfile();
  const [selectedEvent, setSelectedEvent] = useState<any>(null);

  // Fetch published events for the next 3 months
  const startDate = format(new Date(), 'yyyy-MM-dd');
  const endDate = format(addMonths(new Date(), 3), 'yyyy-MM-dd');
  const { data: allEvents, isLoading: eventsLoading } = useEvents({ startDate, endDate, status: 'published' });

  const isLoading = profileLoading || eventsLoading;

  // Get all events the user is assigned to (not just next 3)
  const myAllEvents = allEvents
    ?.filter((event) =>
      event.assignments.some((a) => a.volunteer_id === user?.id)
    ) || [];

  // Get next 3 events for display
  const myUpcomingEvents = myAllEvents.slice(0, 3);

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  const handleExportToCalendar = () => {
    if (myAllEvents.length === 0) {
      toast.error('No events to export');
      return;
    }

    try {
      // Get user's role for each event
      const eventsWithRoles = myAllEvents.map(event => {
        const assignment = event.assignments.find(a => a.volunteer_id === user?.id);
        return {
          ...event,
          userRole: assignment?.role
        };
      });

      const icsContent = generateICSFile(eventsWithRoles); // Pass eventsWithRoles to include userRole
      downloadICSFile(icsContent, 'st-matthews-service-rota.ics');
      toast.success(`Exported ${myAllEvents.length} event${myAllEvents.length !== 1 ? 's' : ''} to calendar`);
    } catch (error) {
      console.error('Error exporting calendar:', error);
      toast.error('Failed to export calendar');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Welcome Section */}
      <div className="space-y-2">
        <h1 className="font-serif text-2xl sm:text-3xl font-bold">
          Welcome, {profile?.name?.split(' ')[0] || 'Volunteer'}
        </h1>
        <p className="text-sm sm:text-base text-muted-foreground">
          Here's your upcoming service schedule.
        </p>
      </div>

      {/* Upcoming Events Section */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-serif text-lg sm:text-xl font-semibold flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-primary" />
            Your Upcoming Services
          </h2>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/schedule">View All</Link>
          </Button>
        </div>

        {myUpcomingEvents.length > 0 ? (
          <div className="space-y-3">
            {myUpcomingEvents.map((event, index) => {
              const eventDate = parseISO(event.date);
              const myAssignment = event.assignments.find(a => a.volunteer_id === user?.id);
              const isNextEvent = index === 0;
              const isThisWeekEvent = isThisWeek(eventDate, { weekStartsOn: 0 });

              return (
                <Card
                  key={event.id}
                  className={cn(
                    "overflow-hidden transition-all hover:shadow-md cursor-pointer",
                    isNextEvent && "ring-2 ring-primary/20"
                  )}
                  onClick={() => setSelectedEvent(event)}
                >
                  <CardContent className="p-0">
                    <div className="flex">
                      {/* Date Block */}
                      <div className={cn(
                        'flex flex-col items-center justify-center px-3 sm:px-4 py-4 min-w-[72px] sm:min-w-[80px]',
                        isNextEvent
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted text-muted-foreground'
                      )}>
                        <span className="text-xs font-semibold uppercase tracking-wide">
                          {format(eventDate, 'EEE')}
                        </span>
                        <span className="text-xl sm:text-2xl font-bold font-serif">
                          {format(eventDate, 'd')}
                        </span>
                        <span className="text-xs font-medium">
                          {format(eventDate, 'MMM')}
                        </span>
                      </div>

                      {/* Content */}
                      <div className="flex-1 p-3 sm:p-4">
                        {/* Badges */}
                        <div className="flex items-center gap-2 mb-2">
                          {isNextEvent && (
                            <Badge variant="default" className="text-xs">
                              Next Service
                            </Badge>
                          )}
                          {isThisWeekEvent && !isNextEvent && (
                            <Badge variant="secondary" className="text-xs">
                              This Week
                            </Badge>
                          )}
                        </div>

                        {/* Event Name */}
                        <h3 className="font-serif text-base sm:text-lg font-semibold mb-1">
                          {event.name}
                        </h3>

                        {/* Subheading */}
                        {event.subheading && (
                          <p className="text-sm text-muted-foreground italic mb-2">
                            {event.subheading}
                          </p>
                        )}

                        {/* Time and Role */}
                        <div className="flex flex-wrap items-center gap-3 text-sm">
                          <span className="flex items-center gap-1.5 text-muted-foreground">
                            <Clock className="h-4 w-4" />
                            {formatTime(event.start_time)}
                          </span>
                          {myAssignment && (
                            <>
                              <span className="text-muted-foreground">·</span>
                              <RoleBadge role={myAssignment.role as any} />
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <CalendarCheck className="mb-3 h-12 w-12 text-muted-foreground/50" />
              <p className="text-lg font-medium text-muted-foreground mb-2">
                No upcoming assignments
              </p>
              <p className="text-sm text-muted-foreground mb-4">
                Check back soon or update your availability.
              </p>
              <Button asChild>
                <Link to="/availability">Update Availability</Link>
              </Button>
            </CardContent>
          </Card>
        )}
      </section>

      {/* Quick Actions */}
      <section className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-serif text-base sm:text-lg">
              <CalendarCheck className="h-5 w-5 text-primary" />
              Mark Your Availability
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-xs sm:text-sm text-muted-foreground">
              Let us know which Sundays you're available to serve.
            </p>
            <Button asChild>
              <Link to="/availability">Update Availability</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-serif text-base sm:text-lg">
              <Download className="h-5 w-5 text-primary" />
              Export to Calendar
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-xs sm:text-sm text-muted-foreground">
              Download a calendar file with all your upcoming services. On mobile, tap the file to add events to your calendar.
            </p>
            <Button
              variant="outline"
              onClick={handleExportToCalendar}
              disabled={myAllEvents.length === 0}
            >
              <Download className="h-4 w-4 mr-2" />
              Download Calendar
            </Button>
          </CardContent>
        </Card>
      </section>

      {/* Event Detail Dialog */}
      <VolunteerEventDetailDialog
        open={!!selectedEvent}
        onOpenChange={(open) => !open && setSelectedEvent(null)}
        event={selectedEvent}
        currentUserId={user?.id}
      />
    </div>
  );
};

export default Dashboard;
