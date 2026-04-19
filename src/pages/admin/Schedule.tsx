import { useState, useMemo, useEffect } from "react";
import {
  Calendar as CalendarIcon,
  Clock,
  Users,
  Loader2,
  Plus,
  List,
  LayoutGrid,
  ChevronLeft,
  ChevronRight,
  Trash2,
  X,
  CheckSquare,
  Square,
  Table2,
} from "lucide-react";
import { ScheduleExport } from "@/components/admin/ScheduleExport";
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
  isSameDay,
  isToday,
} from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/hooks/useAuth";
import { Navigate, useLocation } from "react-router-dom";
import { useEvents, useBulkDeleteEvents, EventWithDetails } from "@/hooks/useEventScheduler";
import { cn } from "@/lib/utils";
import { EditEventDialog } from "@/components/admin/EditEventDialog";
import { ScheduleTableView } from "@/components/admin/ScheduleTableView";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const AdminSchedule = () => {
  const { isAdmin, isLoading: authLoading } = useAuth();
  const location = useLocation();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [viewMode, setViewMode] = useState<"calendar" | "list" | "table">("table");
  const [editEventId, setEditEventId] = useState<string | null>(null);
  const [selectedEvents, setSelectedEvents] = useState<Set<string>>(new Set());
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const bulkDeleteMutation = useBulkDeleteEvents();

  // Fetch events for a wider range to support calendar navigation
  const startDate = format(subMonths(startOfMonth(currentMonth), 1), "yyyy-MM-dd");
  const endDate = format(addMonths(endOfMonth(currentMonth), 2), "yyyy-MM-dd");

  const { data: events, isLoading } = useEvents({ startDate, endDate });

  // Handle opening event from navigation state (e.g., from dashboard)
  useEffect(() => {
    const state = location.state as { openEventId?: string } | null;
    if (state?.openEventId) {
      setEditEventId(state.openEventId);
      // Clear the state to prevent reopening on refresh
      window.history.replaceState({}, document.title);
    }
  }, [location]);

  // Get the current event from fresh data (so it updates after mutations)
  const editEvent = useMemo(() => {
    if (!editEventId || !events) return null;
    return events.find((e) => e.id === editEventId) || null;
  }, [editEventId, events]);

  // Calendar grid generation
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const calendarStart = startOfWeek(monthStart);
    const calendarEnd = endOfWeek(monthEnd);

    return eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  }, [currentMonth]);

  // Group events by date for calendar view (exclude draft events)
  const eventsByDate = useMemo(() => {
    if (!events) return new Map<string, EventWithDetails[]>();

    const map = new Map<string, EventWithDetails[]>();
    for (const event of events) {
      // Exclude draft events from calendar view
      if (event.status === 'draft') continue;
      const dateKey = event.date;
      if (!map.has(dateKey)) {
        map.set(dateKey, []);
      }
      map.get(dateKey)!.push(event);
    }
    return map;
  }, [events]);

  // Filter events for current month in list view (exclude draft events)
  const currentMonthEvents = useMemo(() => {
    if (!events) return [];
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);

    return events
      .filter((event) => {
        const eventDate = parseISO(event.date);
        // Exclude draft events from admin schedule view
        if (event.status === 'draft') return false;
        return eventDate >= monthStart && eventDate <= monthEnd;
      })
      .sort((a, b) => {
        const dateCompare = a.date.localeCompare(b.date);
        if (dateCompare !== 0) return dateCompare;
        return a.start_time.localeCompare(b.start_time);
      });
  }, [events, currentMonth]);

  if (authLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

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

  const toggleEventSelection = (eventId: string, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
    }
    setSelectedEvents((prev) => {
      const next = new Set(prev);
      if (next.has(eventId)) {
        next.delete(eventId);
      } else {
        next.add(eventId);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedEvents.size === currentMonthEvents.length) {
      setSelectedEvents(new Set());
    } else {
      setSelectedEvents(new Set(currentMonthEvents.map((e) => e.id)));
    }
  };

  const handleBulkDelete = async () => {
    const ids = Array.from(selectedEvents);
    try {
      await bulkDeleteMutation.mutateAsync(ids);
      toast.success(`Deleted ${ids.length} event${ids.length > 1 ? "s" : ""}`);
      setSelectedEvents(new Set());
      setShowDeleteConfirm(false);
    } catch (error) {
      toast.error("Failed to delete events");
    }
  };

  const clearSelection = () => {
    setSelectedEvents(new Set());
  };

  const isSelectionMode = selectedEvents.size > 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-serif text-2xl font-bold sm:text-3xl">Schedule</h1>
          <p className="text-muted-foreground">View and manage volunteer assignments</p>
        </div>
        <div className="flex flex-wrap gap-2 self-start">
          <ScheduleExport
            events={currentMonthEvents}
            monthLabel={format(currentMonth, "MMMM yyyy")}
          />
          <Button asChild variant="outline" className="flex-1 sm:flex-initial gap-2">
            <Link to="/admin/events">
              <Plus className="h-4 w-4" />
              Manage Events
            </Link>
          </Button>
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

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : viewMode === "table" ? (
        /* Table View - Hidden on mobile */
        <div className="hidden md:block">
          <ScheduleTableView
            events={currentMonthEvents}
            onEventClick={(id) => setEditEventId(id)}
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
                        {dayEvents.slice(0, 3).map((event) => (
                          <button
                            key={event.id}
                            onClick={() => setEditEventId(event.id)}
                            className={cn(
                              "w-full text-left text-xs p-1 rounded truncate",
                              "hover:opacity-80 transition-opacity",
                              event.status === "cancelled"
                                ? "bg-muted text-muted-foreground line-through"
                                : "bg-primary/10 text-primary",
                            )}
                          >
                            <span className="font-medium">{formatTime(event.start_time)}</span>
                            <span className="ml-1 hidden sm:inline">{event.name}</span>
                          </button>
                        ))}
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
              <p className="text-muted-foreground text-center mb-4">
                No events scheduled for {format(currentMonth, "MMMM yyyy")}.
              </p>
              <Button asChild className="gap-2">
                <Link to="/admin/events">
                  <Plus className="h-4 w-4" />
                  Create Event
                </Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Bulk Actions Bar */}
            <div className="flex flex-wrap items-center gap-3 p-3 bg-muted/50 rounded-lg">
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleSelectAll}
                className="gap-2"
              >
                {selectedEvents.size === currentMonthEvents.length ? (
                  <CheckSquare className="h-4 w-4" />
                ) : (
                  <Square className="h-4 w-4" />
                )}
                {selectedEvents.size === currentMonthEvents.length ? "Deselect All" : "Select All"}
              </Button>

              {isSelectionMode && (
                <>
                  <span className="text-sm text-muted-foreground">
                    {selectedEvents.size} selected
                  </span>
                  <div className="flex-1" />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearSelection}
                    className="gap-2"
                  >
                    <X className="h-4 w-4" />
                    Clear
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setShowDeleteConfirm(true)}
                    className="gap-2"
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete {selectedEvents.size}
                  </Button>
                </>
              )}
            </div>

            {currentMonthEvents.map((event, index) => {
              const { filled, required } = getFilledCount(event);
              const eventDate = parseISO(event.date);
              const isNextEvent = index === 0 && event.status !== "cancelled";
              const isSelected = selectedEvents.has(event.id);

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
                    event.status === "cancelled" && "opacity-60",
                    isNextEvent && "ring-1 ring-primary/30",
                    isSelected && "ring-2 ring-primary bg-primary/5",
                  )}
                  onClick={() => setEditEventId(event.id)}
                >
                  <CardContent className="p-0">
                    <div className="flex">
                      {/* Checkbox */}
                      <div
                        className="flex items-center justify-center px-3"
                        onClick={(e) => toggleEventSelection(event.id, e)}
                      >
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleEventSelection(event.id)}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </div>

                      {/* Date Block */}
                      <div
                        className={cn(
                          "flex flex-col items-center justify-center px-3 py-4 min-w-[64px] sm:px-4 sm:min-w-[72px]",
                          event.status === "published"
                            ? "bg-primary text-primary-foreground"
                            : event.status === "cancelled"
                              ? "bg-muted text-muted-foreground"
                              : "bg-secondary text-secondary-foreground",
                        )}
                      >
                        <span className="text-xs font-semibold uppercase tracking-wide">
                          {format(eventDate, "EEE")}
                        </span>
                        <span className="text-2xl font-bold">{format(eventDate, "d")}</span>
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0 p-3 sm:p-4">
                        <h3
                          className={cn(
                            "font-serif text-lg font-semibold mb-1",
                            event.status === "cancelled" && "line-through",
                          )}
                        >
                          {event.name}
                        </h3>

                        <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground mb-3">
                          <span className="flex items-center gap-1.5">
                            <Clock className="h-4 w-4" />
                            {formatTime(event.start_time)}
                          </span>
                          <Badge
                            variant={
                              event.status === "published"
                                ? "outline"
                                : event.status === "cancelled"
                                  ? "destructive"
                                  : "secondary"
                            }
                            className="text-xs"
                          >
                            {event.status}
                          </Badge>
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
            })}
          </>
        )}
      </div>

      {/* Edit Event Dialog */}
      <EditEventDialog open={!!editEventId} onOpenChange={(open) => !open && setEditEventId(null)} event={editEvent} />

      {/* Bulk Delete Confirmation */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedEvents.size} event{selectedEvents.size > 1 ? "s" : ""}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the selected events and all their volunteer assignments. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {bulkDeleteMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminSchedule;
