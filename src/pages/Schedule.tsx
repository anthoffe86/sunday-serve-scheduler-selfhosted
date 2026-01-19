import { useState, useMemo } from "react";
import {
  Calendar as CalendarIcon,
  Clock,
  Users,
  Loader2,
  List,
  LayoutGrid,
  ChevronLeft,
  ChevronRight,
  Star,
  Table2,
} from "lucide-react";
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
  isToday,
} from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { useEvents, EventWithDetails } from "@/hooks/useEventScheduler";
import { cn } from "@/lib/utils";
import { ROLE_LABELS, Role } from "@/types";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { VolunteerScheduleTableView } from "@/components/VolunteerScheduleTableView";
import { VolunteerEventDetailDialog } from "@/components/VolunteerEventDetailDialog";
import { toast } from "sonner";

const Schedule = () => {
  const { user } = useAuth();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [viewMode, setViewMode] = useState<"calendar" | "list" | "table">("table");
  const [selectedEvent, setSelectedEvent] = useState<EventWithDetails | null>(null);

  // Fetch only published events
  const startDate = format(subMonths(startOfMonth(currentMonth), 1), "yyyy-MM-dd");
  const endDate = format(addMonths(endOfMonth(currentMonth), 2), "yyyy-MM-dd");

  const { data: allEvents, isLoading } = useEvents({ startDate, endDate });

  // Filter to only show published events for volunteers
  const events = useMemo(() => {
    if (!allEvents) return [];
    return allEvents.filter((e) => e.status === "published");
  }, [allEvents]);

  // Check if user is assigned to an event
  const isUserAssigned = (event: EventWithDetails) => {
    return event.assignments.some((a) => a.volunteer_id === user?.id);
  };

  // Get user's assignments in an event
  const getUserAssignments = (event: EventWithDetails) => {
    return event.assignments.filter((a) => a.volunteer_id === user?.id);
  };

  // Get user's roles in an event
  const getUserRoles = (event: EventWithDetails) => {
    return event.assignments
      .filter((a) => a.volunteer_id === user?.id)
      .map((a) => ROLE_LABELS[a.role as keyof typeof ROLE_LABELS] || a.role);
  };

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
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);

    return events
      .filter((event) => {
        const eventDate = parseISO(event.date);
        return eventDate >= monthStart && eventDate <= monthEnd;
      })
      .sort((a, b) => {
        const dateCompare = a.date.localeCompare(b.date);
        if (dateCompare !== 0) return dateCompare;
        return a.start_time.localeCompare(b.start_time);
      });
  }, [events, currentMonth]);

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(":");
    const hour = parseInt(hours, 10);
    const ampm = hour >= 12 ? "PM" : "AM";
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  const getFilledCount = (event: EventWithDetails) => {
    const totalRequired = event.roles.reduce((sum, r) => sum + r.quantity, 0);
    const totalFilled = event.assignments.length;
    return { filled: totalFilled, required: totalRequired };
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-serif text-3xl font-bold">Schedule</h1>
          <p className="text-muted-foreground">View upcoming events and your assignments</p>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setCurrentMonth((prev) => subMonths(prev, 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="font-medium min-w-[160px] text-center">{format(currentMonth, "MMMM yyyy")}</span>
          <Button variant="outline" size="icon" onClick={() => setCurrentMonth((prev) => addMonths(prev, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <ToggleGroup
          type="single"
          value={viewMode}
          onValueChange={(v) => v && setViewMode(v as "calendar" | "list" | "table")}
          className="ml-auto hidden md:flex"
        >
          <ToggleGroupItem value="table" aria-label="Table view">
            <Table2 className="h-4 w-4" />
          </ToggleGroupItem>
          <ToggleGroupItem value="calendar" aria-label="Calendar view">
            <LayoutGrid className="h-4 w-4" />
          </ToggleGroupItem>
          <ToggleGroupItem value="list" aria-label="List view">
            <List className="h-4 w-4" />
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      {viewMode === "table" ? (
        /* Table View - Hidden on mobile */
        <div className="hidden md:block">
          <VolunteerScheduleTableView
            events={currentMonthEvents}
            onEventClick={(event) => setSelectedEvent(event)}
            currentUserId={user?.id}
          />
        </div>
      ) : viewMode === "calendar" ? (
        /* Calendar View - Hidden on mobile */
        <div className="hidden md:block">
          <Card>
            <CardContent className="p-4">
              {/* Day headers */}
              <div className="grid grid-cols-7 gap-1 mb-2">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                  <div key={day} className="text-center text-sm font-medium text-muted-foreground py-2">
                    {day}
                  </div>
                ))}
              </div>

              {/* Calendar grid */}
              <div className="grid grid-cols-7 gap-1">
                {calendarDays.map((day) => {
                  const dateKey = format(day, "yyyy-MM-dd");
                  const dayEvents = eventsByDate.get(dateKey) || [];
                  const isCurrentMonth = isSameMonth(day, currentMonth);

                  return (
                    <div
                      key={dateKey}
                      className={cn(
                        "min-h-[100px] p-1 border rounded-lg",
                        !isCurrentMonth && "bg-muted/30",
                        isToday(day) && "border-primary",
                      )}
                    >
                      <div
                        className={cn(
                          "text-sm font-medium mb-1 px-1",
                          !isCurrentMonth && "text-muted-foreground",
                          isToday(day) && "text-primary",
                        )}
                      >
                        {format(day, "d")}
                      </div>
                      <div className="space-y-1">
                        {dayEvents.slice(0, 3).map((event) => {
                          const assigned = isUserAssigned(event);
                          return (
                            <button
                              key={event.id}
                              onClick={() => setSelectedEvent(event)}
                              className={cn(
                                "w-full text-left text-xs p-1 rounded truncate",
                                "hover:opacity-80 transition-opacity",
                                assigned
                                  ? "bg-primary text-primary-foreground font-medium"
                                  : "bg-primary/10 text-primary",
                              )}
                            >
                              {assigned && <Star className="h-3 w-3 inline mr-0.5" />}
                              <span className="font-medium">{formatTime(event.start_time)}</span>
                              <span className="ml-1 hidden sm:inline">{event.name}</span>
                            </button>
                          );
                        })}
                        {dayEvents.length > 3 && (
                          <div className="text-xs text-muted-foreground px-1">+{dayEvents.length - 3} more</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {/* List View - Always visible on mobile, conditionally on desktop */}
      <div className={cn("space-y-3", viewMode !== "list" && "md:hidden")}>
        {currentMonthEvents.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <CalendarIcon className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <h3 className="font-medium text-lg mb-2">No Events</h3>
              <p className="text-muted-foreground text-center">
                No published events for {format(currentMonth, "MMMM yyyy")}.
              </p>
            </CardContent>
          </Card>
        ) : (
          currentMonthEvents.map((event, index) => {
            const { filled, required } = getFilledCount(event);
            const assigned = isUserAssigned(event);
            const userRoles = getUserRoles(event);
            const eventDate = parseISO(event.date);
            const isNextEvent = index === 0;

            // Get volunteer initials for display
            const volunteerInitials = event.assignments.slice(0, 4).map((a) => {
              const name = a.volunteer_name || "Unknown";
              return name
                .split(" ")
                .map((n) => n[0])
                .join("")
                .slice(0, 1)
                .toUpperCase();
            });
            const remainingCount = event.assignments.length - 4;

            return (
              <Card
                key={event.id}
                className={cn(
                  "cursor-pointer hover:shadow-md transition-all overflow-hidden",
                  assigned && "ring-2 ring-primary",
                  isNextEvent && !assigned && "ring-1 ring-primary/30",
                )}
                onClick={() => setSelectedEvent(event)}
              >
                <CardContent className="p-0">
                  <div className="flex">
                    {/* Date Block */}
                    <div
                      className={cn(
                        "flex flex-col items-center justify-center px-4 py-4 min-w-[72px]",
                        assigned ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground",
                      )}
                    >
                      <span className="text-xs font-semibold uppercase tracking-wide">
                        {format(eventDate, "EEE")}
                      </span>
                      <span className="text-2xl font-bold">{format(eventDate, "d")}</span>
                    </div>

                    {/* Content */}
                    <div className="flex-1 p-4">
                      {/* Badges */}
                      <div className="flex flex-wrap gap-2 mb-2">
                        {assigned && (
                          <Badge variant="outline" className="text-xs gap-1 border-primary text-primary">
                            <Star className="h-3 w-3 fill-primary" />
                            You're Serving
                          </Badge>
                        )}
                      </div>

                      <h3 className="font-serif text-lg font-semibold mb-1">{event.name}</h3>

                      <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground mb-3">
                        <span className="flex items-center gap-1.5">
                          <Clock className="h-4 w-4" />
                          {formatTime(event.start_time)}
                        </span>
                        {assigned && userRoles.length > 0 && (
                          <span className="font-medium text-foreground">{userRoles.join(", ")}</span>
                        )}
                      </div>

                      {/* Event Subheading */}
                      {event.subheading && (
                        <p className="text-sm text-muted-foreground italic mt-1">
                          {event.subheading}
                        </p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* Event Details Dialog */}
      <VolunteerEventDetailDialog
        open={!!selectedEvent}
        onOpenChange={(open) => !open && setSelectedEvent(null)}
        event={selectedEvent}
        currentUserId={user?.id}
      />
    </div>
  );
};

export default Schedule;
