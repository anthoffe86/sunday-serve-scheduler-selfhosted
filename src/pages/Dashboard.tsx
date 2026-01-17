import { Link } from 'react-router-dom';
import { format, parseISO, isSameDay, startOfWeek, addWeeks, addDays } from 'date-fns';
import { 
  CalendarDays, 
  CalendarCheck, 
  Check,
  Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RoleBadge } from '@/components/RoleBadge';
import { useAuth } from '@/hooks/useAuth';
import { 
  useProfile, 
  useScheduleWithAssignments, 
} from '@/hooks/useVolunteerData';
import { ROLE_LABELS } from '@/types';
import { cn } from '@/lib/utils';

// Generate upcoming Sundays (next 8 weeks)
const getUpcomingSundays = (count: number): Date[] => {
  const sundays: Date[] = [];
  const today = new Date();
  let date = new Date(today);
  
  const dayOfWeek = date.getDay();
  const daysUntilSunday = dayOfWeek === 0 ? 0 : 7 - dayOfWeek;
  date.setDate(date.getDate() + daysUntilSunday);
  
  for (let i = 0; i < count; i++) {
    sundays.push(new Date(date));
    date.setDate(date.getDate() + 7);
  }
  
  return sundays;
};

const Dashboard = () => {
  const { user } = useAuth();
  const { data: profile, isLoading: profileLoading } = useProfile();
  const { data: schedule, isLoading: scheduleLoading } = useScheduleWithAssignments();

  const isLoading = profileLoading || scheduleLoading;
  const upcomingSundays = getUpcomingSundays(8);

  // Get next assignment for current user
  const myNextService = schedule?.find((service) =>
    service.assignments.some((a) => a.volunteer_id === user?.id)
  );
  const myNextAssignment = myNextService?.assignments.find(
    (a) => a.volunteer_id === user?.id
  );

  // Map services to check if user is scheduled on each Sunday
  const sundaySchedule = upcomingSundays.map(sunday => {
    const service = schedule?.find(s => 
      isSameDay(parseISO(s.date), sunday)
    );
    const myAssignment = service?.assignments.find(a => a.volunteer_id === user?.id);
    
    return {
      date: sunday,
      service,
      myAssignment,
      isScheduled: !!myAssignment,
    };
  });

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
          Here's your service schedule at a glance.
        </p>
      </div>

      {/* Next Assignment Card */}
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg font-serif">
            <CalendarDays className="h-5 w-5 text-primary" />
            Your Next Assignment
          </CardTitle>
        </CardHeader>
        <CardContent>
          {myNextAssignment && myNextService ? (
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-2xl font-bold font-serif">
                  {format(parseISO(myNextService.date), 'EEEE, MMMM d')}
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-muted-foreground">Role:</span>
                  <RoleBadge role={myNextAssignment.role as any} />
                </div>
              </div>
              <Button variant="outline" asChild>
                <Link to="/schedule">View Full Schedule</Link>
              </Button>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-6 text-center">
              <CalendarCheck className="mb-3 h-10 w-10 text-muted-foreground/50" />
              <p className="text-muted-foreground">
                No upcoming assignments scheduled.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Upcoming Sundays Grid */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-serif text-xl font-semibold">Upcoming Sundays</h2>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/availability">Update Availability</Link>
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
          {sundaySchedule.map(({ date, myAssignment, isScheduled }) => (
            <Card 
              key={date.toISOString()} 
              className={cn(
                "relative transition-all hover:shadow-md cursor-default",
                isScheduled && "border-primary bg-primary/5 ring-1 ring-primary/20"
              )}
            >
              <CardContent className="p-4 text-center">
                <p className="text-xs font-medium text-muted-foreground uppercase">
                  {format(date, 'MMM')}
                </p>
                <p className="text-2xl font-bold font-serif">
                  {format(date, 'd')}
                </p>
                {isScheduled ? (
                  <div className="mt-2">
                    <div className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-primary text-primary-foreground">
                      <Check className="h-4 w-4" />
                    </div>
                    <p className="mt-1 text-[10px] font-medium text-primary truncate">
                      {ROLE_LABELS[myAssignment!.role as keyof typeof ROLE_LABELS]}
                    </p>
                  </div>
                ) : (
                  <div className="mt-2 h-6 flex items-center justify-center">
                    <span className="text-xs text-muted-foreground">—</span>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
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
