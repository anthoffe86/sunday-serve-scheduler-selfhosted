import { 
  Users, 
  CalendarDays, 
  AlertCircle, 
  CheckCircle,
  Clock,
  TrendingUp
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatCard } from '@/components/StatCard';
import { mockVolunteers, mockSchedule, upcomingSundays } from '@/data/mockData';
import { Link } from 'react-router-dom';

const AdminDashboard = () => {
  const activeVolunteers = mockVolunteers.filter((v) => v.active);
  const draftSchedules = mockSchedule.filter((s) => s.status === 'draft');
  const publishedSchedules = mockSchedule.filter((s) => s.status === 'published');

  // Check for upcoming Sundays without schedules
  const scheduledDates = mockSchedule.map((s) => s.date);
  const unscheduledSundays = upcomingSundays.filter(
    (date) => !scheduledDates.includes(date)
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-serif text-3xl font-bold">Admin Dashboard</h1>
          <p className="text-muted-foreground">
            Manage volunteers, schedules, and swap requests
          </p>
        </div>
        <Button className="gap-2 self-start">
          <CalendarDays className="h-4 w-4" />
          Generate New Schedule
        </Button>
      </div>

      {/* Stats Overview */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Active Volunteers"
          value={activeVolunteers.length}
          icon={Users}
          description={`${mockVolunteers.length} total registered`}
        />
        <StatCard
          label="Published Schedules"
          value={publishedSchedules.length}
          icon={CheckCircle}
        />
        <StatCard
          label="Draft Schedules"
          value={draftSchedules.length}
          icon={Clock}
          description="Awaiting publication"
        />
        <StatCard
          label="Unscheduled Sundays"
          value={unscheduledSundays.length}
          icon={AlertCircle}
          description="Need attention"
        />
      </div>

      {/* Alerts */}
      {unscheduledSundays.length > 0 && (
        <Card className="border-accent/50 bg-accent/10">
          <CardContent className="flex items-center gap-4 p-4">
            <div className="rounded-full bg-accent p-2">
              <AlertCircle className="h-5 w-5 text-accent-foreground" />
            </div>
            <div className="flex-1">
              <p className="font-medium">
                {unscheduledSundays.length} upcoming Sunday{unscheduledSundays.length > 1 ? 's' : ''} without a schedule
              </p>
              <p className="text-sm text-muted-foreground">
                Click "Generate New Schedule" to automatically assign volunteers
              </p>
            </div>
            <Button variant="outline" size="sm">
              View Dates
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Quick Links */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-serif text-lg">
              <Users className="h-5 w-5 text-primary" />
              Volunteer Management
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Add, edit, or deactivate volunteers. Manage family groups and role assignments.
            </p>
            <Button variant="outline" asChild className="w-full">
              <Link to="/admin/volunteers">Manage Volunteers</Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-serif text-lg">
              <CalendarDays className="h-5 w-5 text-primary" />
              Schedule Editor
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Review and edit generated schedules. Override assignments when needed.
            </p>
            <Button variant="outline" asChild className="w-full">
              <Link to="/schedule">Edit Schedules</Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-serif text-lg">
              <TrendingUp className="h-5 w-5 text-primary" />
              Export & Reports
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Export schedules to Excel. Generate service history reports.
            </p>
            <Button variant="outline" className="w-full">
              Export to Excel
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Recent Volunteers */}
      <Card>
        <CardHeader>
          <CardTitle className="font-serif">Active Volunteers</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {activeVolunteers.slice(0, 5).map((volunteer) => (
              <div
                key={volunteer.id}
                className="flex items-center justify-between rounded-lg border px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-sm font-medium text-primary">
                    {volunteer.name
                      .split(' ')
                      .map((n) => n[0])
                      .join('')}
                  </div>
                  <div>
                    <p className="font-medium">{volunteer.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {volunteer.email}
                    </p>
                  </div>
                </div>
                <div className="text-right text-sm">
                  <p className="text-muted-foreground">
                    {volunteer.serviceHistory.length} services
                  </p>
                  {volunteer.familyGroupId && (
                    <p className="text-xs text-primary">Family group</p>
                  )}
                </div>
              </div>
            ))}
          </div>
          <Button variant="ghost" asChild className="mt-4 w-full">
            <Link to="/admin/volunteers">View All Volunteers →</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminDashboard;
