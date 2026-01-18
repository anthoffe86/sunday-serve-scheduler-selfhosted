import { Link } from 'react-router-dom';
import { format, parseISO, isThisWeek, addMonths } from 'date-fns';
import { 
  CalendarDays, 
  CalendarCheck, 
  Loader2,
  Users
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { RoleBadge } from '@/components/RoleBadge';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useVolunteerData';
import { useEvents } from '@/hooks/useEventScheduler';
import { ROLE_LABELS } from '@/types';
import { cn } from '@/lib/utils';

const Dashboard = () => {
  const { user } = useAuth();
  const { data: profile, isLoading: profileLoading } = useProfile();
  
  // Fetch published events for the next 3 months
  const startDate = format(new Date(), 'yyyy-MM-dd');
  const endDate = format(addMonths(new Date(), 3), 'yyyy-MM-dd');
  const { data: allEvents, isLoading: eventsLoading } = useEvents({ startDate, endDate, status: 'published' });

  const isLoading = profileLoading || eventsLoading;

  // Get next 3 events the user is assigned to
  const myUpcomingEvents = allEvents
    ?.filter((event) =>
      event.assignments.some((a) => a.volunteer_id === user?.id)
    )
    .slice(0, 3) || [];

  // Get initials from name
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
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
        <h1 className="font-serif text-3xl font-bold">
          Welcome, {profile?.name?.split(' ')[0] || 'Volunteer'}
        </h1>
        <p className="text-muted-foreground">
          Here's your upcoming service schedule.
        </p>
      </div>

      {/* Upcoming Events Section */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-serif text-xl font-semibold flex items-center gap-2">
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
              const otherAssignments = event.assignments.filter(a => a.volunteer_id !== user?.id);
              const isNextEvent = index === 0;
              const isThisWeekEvent = isThisWeek(eventDate, { weekStartsOn: 0 });

              return (
                <Card 
                  key={event.id} 
                  className={cn(
                    "overflow-hidden transition-all hover:shadow-md",
                    isNextEvent && "ring-2 ring-primary/20"
                  )}
                >
                  <CardContent className="p-0">
                    <div className="flex">
                      {/* Date Block */}
                      <div className={cn(
                        'flex flex-col items-center justify-center px-4 py-4 min-w-[80px]',
                        isNextEvent 
                          ? 'bg-primary text-primary-foreground' 
                          : 'bg-muted text-muted-foreground'
                      )}>
                        <span className="text-xs font-semibold uppercase tracking-wide">
                          {format(eventDate, 'EEE')}
                        </span>
                        <span className="text-2xl font-bold font-serif">
                          {format(eventDate, 'd')}
                        </span>
                        <span className="text-xs font-medium">
                          {format(eventDate, 'MMM')}
                        </span>
                      </div>

                      {/* Content */}
                      <div className="flex-1 p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
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
                            <h3 className="font-serif text-lg font-semibold mb-1">
                              {event.name} — {format(eventDate, 'EEEE, MMMM d')}
                            </h3>

                            {/* My Role */}
                            {myAssignment && (
                              <div className="flex items-center gap-2 mb-3">
                                <span className="text-sm text-muted-foreground">Your role:</span>
                                <RoleBadge role={myAssignment.role as any} />
                              </div>
                            )}

                            {/* Other Volunteers */}
                            {otherAssignments.length > 0 && (
                              <div className="space-y-2">
                                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                                  <Users className="h-4 w-4" />
                                  <span>Also serving:</span>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  {otherAssignments.map((assignment) => (
                                    <div 
                                      key={assignment.id}
                                      className="flex items-center gap-2 bg-muted/50 rounded-full pl-1 pr-3 py-1"
                                    >
                                      <div className="h-6 w-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-medium">
                                        {getInitials(assignment.volunteer_name || 'V')}
                                      </div>
                                      <span className="text-sm">
                                        {assignment.volunteer_name?.split(' ')[0]}
                                      </span>
                                      <span className="text-xs text-muted-foreground">
                                        · {ROLE_LABELS[assignment.role as keyof typeof ROLE_LABELS]}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
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
            <CardTitle className="flex items-center gap-2 font-serif text-lg">
              <CalendarCheck className="h-5 w-5 text-primary" />
              Mark Your Availability
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Let us know which Sundays you're available to serve.
            </p>
            <Button asChild>
              <Link to="/availability">Update Availability</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-serif text-lg">
              <CalendarDays className="h-5 w-5 text-primary" />
              Need to Swap?
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Can't make your scheduled date? Request a swap with another volunteer.
            </p>
            <Button variant="outline" asChild>
              <Link to="/swaps">Request Swap</Link>
            </Button>
          </CardContent>
        </Card>
      </section>
    </div>
  );
};

export default Dashboard;
