import { Users, CalendarDays, ArrowLeftRight, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/StatCard";
import { useProfiles } from "@/hooks/useVolunteerData";
import { useEvents } from "@/hooks/useEventScheduler";
import { useSwapRequests } from "@/hooks/useSwapRequests";
import { useAuth } from "@/hooks/useAuth";
import { Link, Navigate } from "react-router-dom";
import { useMemo } from "react";

const AdminDashboard = () => {
  const { isAdmin, isLoading: authLoading } = useAuth();
  const { data: profiles, isLoading: profilesLoading } = useProfiles();
  const { isLoading: eventsLoading } = useEvents();
  const { data: swapRequests, isLoading: swapsLoading } = useSwapRequests();

  const activeVolunteers = useMemo(() => profiles?.filter((v) => v.active) || [], [profiles]);

  const pendingSwaps = useMemo(() =>
    swapRequests?.filter((sr) => sr.status === "pending") || [],
    [swapRequests]
  );

  if (authLoading || profilesLoading || eventsLoading || swapsLoading) {
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
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-serif text-2xl sm:text-3xl font-bold">Admin Dashboard</h1>
          <p className="text-sm sm:text-base text-muted-foreground">Manage volunteers, schedules, and swap requests</p>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard
          label="Active Volunteers"
          value={activeVolunteers.length}
          icon={Users}
          description={`${profiles?.length || 0} total registered`}
        />
        <StatCard
          label="Pending Swap Requests"
          value={pendingSwaps.length}
          icon={ArrowLeftRight}
          description="Awaiting review"
        />
      </div>

      {/* Quick Links */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-serif text-base sm:text-lg">
              <Users className="h-5 w-5 text-primary" />
              Volunteer Management
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-xs sm:text-sm text-muted-foreground">Manage Volunteers.</p>
            <Button variant="outline" asChild className="w-full">
              <Link to="/admin/volunteers">Manage Volunteers</Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-serif text-base sm:text-lg">
              <CalendarDays className="h-5 w-5 text-primary" />
              Schedule Editor
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-xs sm:text-sm text-muted-foreground">Review and edit generated schedules.</p>
            <Button variant="outline" asChild className="w-full">
              <Link to="/admin/schedule">Edit Schedules</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Active Volunteers */}
      <Card>
        <CardHeader>
          <CardTitle className="font-serif text-lg sm:text-xl">Active Volunteers</CardTitle>
        </CardHeader>
        <CardContent>
          {activeVolunteers.length > 0 ? (
            <div className="space-y-3">
              {activeVolunteers.slice(0, 5).map((volunteer) => (
                <div key={volunteer.id} className="flex items-center justify-between rounded-lg border px-3 sm:px-4 py-3">
                  <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                    <div className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-full bg-primary/10 text-xs sm:text-sm font-medium text-primary shrink-0">
                      {volunteer.name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")
                        .slice(0, 2)}
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-sm sm:text-base truncate">{volunteer.name}</p>
                      <p className="text-xs sm:text-sm text-muted-foreground truncate">{volunteer.email}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-4 text-sm">No volunteers yet</p>
          )}
          <Button variant="ghost" asChild className="mt-4 w-full text-sm">
            <Link to="/admin/volunteers">View All Volunteers →</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminDashboard;
