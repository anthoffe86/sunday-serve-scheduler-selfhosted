import { Link } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { 
  CalendarDays, 
  CalendarCheck, 
  ArrowRight, 
  Users,
  Clock,
  TrendingUp
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatCard } from '@/components/StatCard';
import { AssignmentCard } from '@/components/AssignmentCard';
import { RoleBadge } from '@/components/RoleBadge';
import { mockSchedule, currentUser, mockSwapRequests } from '@/data/mockData';
import { ROLE_LABELS } from '@/types';

const Dashboard = () => {
  // Get upcoming assignments for current user
  const myUpcomingServices = mockSchedule
    .filter((service) =>
      service.assignments.some((a) => a.volunteerId === currentUser.id)
    )
    .slice(0, 3);

  const nextAssignment = myUpcomingServices[0]?.assignments.find(
    (a) => a.volunteerId === currentUser.id
  );

  const pendingSwaps = mockSwapRequests.filter(
    (s) => s.fromVolunteerId === currentUser.id && s.status === 'pending'
  );

  return (
    <div className="space-y-8">
      {/* Welcome Section */}
      <div className="space-y-2">
        <h1 className="font-serif text-3xl font-bold">
          Welcome back, {currentUser.name.split(' ')[0]}
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
          description={nextAssignment ? ROLE_LABELS[nextAssignment.role] : undefined}
        />
        <StatCard
          label="Times Served"
          value={currentUser.serviceHistory.length}
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
          value={currentUser.rolePreferences.length}
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
            {myUpcomingServices.map((service) => (
              <AssignmentCard key={service.date} service={service} />
            ))}
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
              {currentUser.rolePreferences.map((role, index) => (
                <div key={role} className="flex items-center gap-1.5">
                  <span className="text-xs text-muted-foreground">
                    {index + 1}.
                  </span>
                  <RoleBadge role={role} />
                </div>
              ))}
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
