import { Link } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { 
  CalendarDays, 
  CalendarCheck, 
  ArrowRight, 
  Users,
  Clock,
  TrendingUp,
  Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatCard } from '@/components/StatCard';
import { RoleBadge } from '@/components/RoleBadge';
import { useAuth } from '@/hooks/useAuth';
import { 
  useProfile, 
  useScheduleWithAssignments, 
  useRolePreferences,
  useSwapRequests,
  useServiceHistory
} from '@/hooks/useVolunteerData';
import { ROLE_LABELS } from '@/types';

const Dashboard = () => {
  const { user } = useAuth();
  const { data: profile, isLoading: profileLoading } = useProfile();
  const { data: schedule, isLoading: scheduleLoading } = useScheduleWithAssignments();
  const { data: preferences } = useRolePreferences();
  const { data: swapRequests } = useSwapRequests();
  const { data: serviceHistory } = useServiceHistory(user?.id);

  const isLoading = profileLoading || scheduleLoading;

  // Get upcoming assignments for current user
  const myUpcomingServices = schedule?.filter((service) =>
    service.assignments.some((a) => a.volunteer_id === user?.id)
  ).slice(0, 3) || [];

  const nextAssignment = myUpcomingServices[0]?.assignments.find(
    (a) => a.volunteer_id === user?.id
  );

  const pendingSwaps = swapRequests?.filter((s) => s.status === 'pending') || [];

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
          Welcome back, {profile?.name?.split(' ')[0] || 'Volunteer'}
        </h1>
        <p className="text-muted-foreground">
          Here's your upcoming service schedule and what's happening this month.
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Next Service"
          value={
            myUpcomingServices[0]
              ? format(parseISO(myUpcomingServices[0].date), 'MMM d')
              : 'None'
          }
          icon={CalendarDays}
          description={nextAssignment ? ROLE_LABELS[nextAssignment.role as keyof typeof ROLE_LABELS] : undefined}
        />
        <StatCard
          label="Times Served"
          value={serviceHistory?.length || 0}
          icon={Clock}
          description="This year"
        />
        <StatCard
          label="Pending Swaps"
          value={pendingSwaps.length}
          icon={Users}
        />
        <StatCard
          label="Preferred Roles"
          value={preferences?.length || 0}
          icon={TrendingUp}
        />
      </div>

      {/* Upcoming Assignments */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-serif text-xl font-semibold">
            Your Upcoming Assignments
          </h2>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/schedule" className="gap-1">
              View Full Schedule
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>

        {myUpcomingServices.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {myUpcomingServices.map((service) => {
              const myAssignment = service.assignments.find(
                (a) => a.volunteer_id === user?.id
              );
              if (!myAssignment) return null;
              
              return (
                <Card key={service.id} className="transition-all hover:shadow-md">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
                          <CalendarDays className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <div>
                          <CardTitle className="text-base font-serif">
                            {format(parseISO(service.date), 'EEEE, MMMM d')}
                          </CardTitle>
                          <p className="text-xs text-muted-foreground">
                            {format(parseISO(service.date), 'yyyy')}
                          </p>
                        </div>
                      </div>
                      {service.status === 'draft' && (
                        <span className="rounded-full bg-accent/20 px-2 py-0.5 text-xs font-medium text-accent-foreground">
                          Draft
                        </span>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <p className="text-sm text-muted-foreground">Your Role</p>
                      <RoleBadge role={myAssignment.role as any} className="mt-1" />
                    </div>
                    <div className="border-t pt-3">
                      <p className="mb-2 text-xs font-medium text-muted-foreground">
                        Also serving this Sunday
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {service.assignments
                          .filter((a) => a.volunteer_id !== user?.id)
                          .slice(0, 4)
                          .map((a) => (
                            <span
                              key={a.id}
                              className="rounded-full bg-secondary px-2 py-0.5 text-xs"
                            >
                              {a.volunteerName?.split(' ')[0]}
                            </span>
                          ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <CalendarCheck className="mb-4 h-12 w-12 text-muted-foreground/50" />
              <p className="text-muted-foreground">
                No upcoming assignments. Check back soon!
              </p>
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
              Let us know which Sundays you're available to serve. This helps us
              create fair schedules.
            </p>
            <Button asChild>
              <Link to="/availability">Update Availability</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-serif text-lg">
              <TrendingUp className="h-5 w-5 text-primary" />
              Your Role Preferences
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {preferences && preferences.length > 0 ? (
                preferences.map((pref, index) => (
                  <div key={pref.id} className="flex items-center gap-1.5">
                    <span className="text-xs text-muted-foreground">
                      {index + 1}.
                    </span>
                    <RoleBadge role={pref.role as any} />
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">No preferences set yet</p>
              )}
            </div>
            <Button variant="outline" asChild>
              <Link to="/profile">Edit Preferences</Link>
            </Button>
          </CardContent>
        </Card>
      </section>
    </div>
  );
};

export default Dashboard;
