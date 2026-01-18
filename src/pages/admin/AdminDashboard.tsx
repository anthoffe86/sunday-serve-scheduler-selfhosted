import { Users, CalendarDays, AlertCircle, CheckCircle, Clock, TrendingUp, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/StatCard";
import { useProfiles, useSundayServices } from "@/hooks/useVolunteerData";
import { useAuth } from "@/hooks/useAuth";
import { Link, Navigate } from "react-router-dom";

const AdminDashboard = () => {
  const { isAdmin, isLoading: authLoading } = useAuth();
  const { data: profiles, isLoading: profilesLoading } = useProfiles();
  const { data: services, isLoading: servicesLoading } = useSundayServices();

  if (authLoading || profilesLoading || servicesLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  const activeVolunteers = profiles?.filter((v) => v.active) || [];
  const draftSchedules = services?.filter((s) => s.status === "draft") || [];
  const publishedSchedules = services?.filter((s) => s.status === "published") || [];

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-serif text-3xl font-bold">Admin Dashboard</h1>
          <p className="text-muted-foreground">Manage volunteers, schedules, and swap requests</p>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Active Volunteers"
          value={activeVolunteers.length}
          icon={Users}
          description={`${profiles?.length || 0} total registered`}
        />
        <StatCard label="Published Schedules" value={publishedSchedules.length} icon={CheckCircle} />
        <StatCard
          label="Draft Schedules"
          value={draftSchedules.length}
          icon={Clock}
          description="Awaiting publication"
        />
        <StatCard label="Total Services" value={services?.length || 0} icon={AlertCircle} />
      </div>

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
            <p className="text-sm text-muted-foreground">Add, edit, or deactivate volunteers. Manage family groups.</p>
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
            <p className="text-sm text-muted-foreground">Review and edit generated schedules.</p>
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
            <p className="text-sm text-muted-foreground">Export schedules to Excel.</p>
            <Button variant="outline" className="w-full">
              Export to Excel
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Active Volunteers */}
      <Card>
        <CardHeader>
          <CardTitle className="font-serif">Active Volunteers</CardTitle>
        </CardHeader>
        <CardContent>
          {activeVolunteers.length > 0 ? (
            <div className="space-y-3">
              {activeVolunteers.slice(0, 5).map((volunteer) => (
                <div key={volunteer.id} className="flex items-center justify-between rounded-lg border px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-sm font-medium text-primary">
                      {volunteer.name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")
                        .slice(0, 2)}
                    </div>
                    <div>
                      <p className="font-medium">{volunteer.name}</p>
                      <p className="text-sm text-muted-foreground">{volunteer.email}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-4">No volunteers yet</p>
          )}
          <Button variant="ghost" asChild className="mt-4 w-full">
            <Link to="/admin/volunteers">View All Volunteers →</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminDashboard;
