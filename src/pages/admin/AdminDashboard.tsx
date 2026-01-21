import { Users, CalendarDays, AlertCircle, ArrowLeftRight, Loader2, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { StatCard } from "@/components/StatCard";
import { useProfiles } from "@/hooks/useVolunteerData";
import { useEvents, useEventTemplates, calculateScheduleConfidence } from "@/hooks/useEventScheduler";
import { useSwapRequests } from "@/hooks/useSwapRequests";
import { useAuth } from "@/hooks/useAuth";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useMemo, useState } from "react";
import { format, parseISO, isAfter, startOfToday } from "date-fns";
import { cn } from "@/lib/utils";

const AdminDashboard = () => {
  const { isAdmin, isLoading: authLoading } = useAuth();
  const { data: profiles, isLoading: profilesLoading } = useProfiles();
  const { data: events, isLoading: eventsLoading } = useEvents();
  const { data: templates, isLoading: templatesLoading } = useEventTemplates();
  const { data: swapRequests, isLoading: swapsLoading } = useSwapRequests();
  const navigate = useNavigate();

  const [understaffedDialogOpen, setUnderstaffedDialogOpen] = useState(false);

  const activeVolunteers = useMemo(() => profiles?.filter((v) => v.active) || [], [profiles]);

  const pendingSwaps = useMemo(() =>
    swapRequests?.filter((sr) => sr.status === "pending") || [],
    [swapRequests]
  );

  const understaffedEvents = useMemo(() => {
    if (!events) return [];
    return events.filter((event) => {
      const totalRequired = event.roles.reduce((sum, r) => sum + r.quantity, 0);
      const totalFilled = event.assignments.length;
      return totalRequired > 0 && totalFilled < totalRequired && event.status !== 'cancelled';
    }).sort((a, b) => a.date.localeCompare(b.date));
  }, [events]);

  // Calculate schedule confidence per template
  const templateConfidence = useMemo(() => {
    if (!events || !templates) return [];
    
    const today = startOfToday();
    
    return templates.map(template => {
      // Get future events for this template
      const templateEvents = events.filter(e => 
        e.template_id === template.id && 
        isAfter(parseISO(e.date), today) &&
        e.status !== 'cancelled'
      );
      
      // Aggregate all assignments from these events
      const allAssignments = templateEvents.flatMap(e => e.assignments);
      const confidence = calculateScheduleConfidence(allAssignments);
      
      return {
        template,
        eventCount: templateEvents.length,
        ...confidence,
      };
    }).filter(t => t.eventCount > 0);
  }, [events, templates]);

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  if (authLoading || profilesLoading || eventsLoading || swapsLoading || templatesLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  const handleEventClick = (eventId: string) => {
    setUnderstaffedDialogOpen(false);
    // Navigate to admin schedule with event ID to open edit dialog
    navigate('/admin/schedule', { state: { openEventId: eventId } });
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-serif text-2xl sm:text-3xl font-bold">Admin Dashboard</h1>
          <p className="text-sm sm:text-base text-muted-foreground">Manage volunteers, schedules, and swap requests</p>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
        <div onClick={() => understaffedEvents.length > 0 && setUnderstaffedDialogOpen(true)}>
          <StatCard
            label="Understaffed Events"
            value={understaffedEvents.length}
            icon={AlertCircle}
            description="Need more volunteers"
            className={understaffedEvents.length > 0 ? "cursor-pointer hover:shadow-md transition-shadow" : ""}
          />
        </div>
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

      {/* Schedule Confidence per Event Type */}
      {templateConfidence.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-serif text-lg sm:text-xl">
              <TrendingUp className="h-5 w-5 text-primary" />
              Schedule Confidence
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {templateConfidence.map(({ template, eventCount, total, confirmed, invited, proposed, declined, confidencePercent }) => (
                <Link 
                  key={template.id} 
                  to={`/admin/events/${template.id}`}
                  className="block"
                >
                  <div className="rounded-lg border p-4 hover:shadow-md transition-shadow cursor-pointer">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h3 className="font-semibold">{template.name}</h3>
                        <p className="text-sm text-muted-foreground">
                          {eventCount} upcoming {eventCount === 1 ? 'event' : 'events'}
                        </p>
                      </div>
                      <div className="text-right">
                        <div className={cn(
                          "text-2xl font-bold",
                          confidencePercent >= 80 ? "text-green-600" :
                          confidencePercent >= 50 ? "text-amber-600" : "text-red-600"
                        )}>
                          {confidencePercent}%
                        </div>
                        <p className="text-xs text-muted-foreground">confirmed</p>
                      </div>
                    </div>
                    
                    <Progress 
                      value={confidencePercent} 
                      className={cn(
                        "h-2 mb-3",
                        confidencePercent >= 80 ? "[&>div]:bg-green-600" :
                        confidencePercent >= 50 ? "[&>div]:bg-amber-500" : "[&>div]:bg-red-500"
                      )}
                    />
                    
                    <div className="flex flex-wrap gap-2 text-xs">
                      {confirmed > 0 && (
                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                          {confirmed} confirmed
                        </Badge>
                      )}
                      {invited > 0 && (
                        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                          {invited} invited
                        </Badge>
                      )}
                      {proposed > 0 && (
                        <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200">
                          {proposed} proposed
                        </Badge>
                      )}
                      {declined > 0 && (
                        <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                          {declined} declined
                        </Badge>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

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

      {/* Understaffed Events Dialog */}
      <Dialog open={understaffedDialogOpen} onOpenChange={setUnderstaffedDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-serif text-xl">Understaffed Events</DialogTitle>
            <DialogDescription>
              These events need more volunteers. Click on an event to add volunteers.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 mt-4">
            {understaffedEvents.map((event) => {
              const totalRequired = event.roles.reduce((sum, r) => sum + r.quantity, 0);
              const totalFilled = event.assignments.length;
              const needed = totalRequired - totalFilled;
              const eventDate = parseISO(event.date);

              return (
                <Card
                  key={event.id}
                  className="cursor-pointer hover:shadow-md transition-all"
                  onClick={() => handleEventClick(event.id)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-base truncate">{event.name}</h3>
                          <Badge variant={event.status === 'published' ? 'default' : 'secondary'} className="text-xs shrink-0">
                            {event.status}
                          </Badge>
                        </div>
                        {event.subheading && (
                          <p className="text-sm text-muted-foreground italic mb-2">{event.subheading}</p>
                        )}
                        <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <CalendarDays className="h-3.5 w-3.5" />
                            {format(eventDate, 'EEE, MMM d, yyyy')}
                          </span>
                          <span className="flex items-center gap-1">
                            <Users className="h-3.5 w-3.5" />
                            {formatTime(event.start_time)}
                          </span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className={cn(
                          "text-lg font-bold",
                          needed > 2 ? "text-red-600" : "text-amber-600"
                        )}>
                          {needed}
                        </div>
                        <div className="text-xs text-muted-foreground">needed</div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {totalFilled}/{totalRequired}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminDashboard;
