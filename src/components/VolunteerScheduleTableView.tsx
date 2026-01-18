import { format, parseISO } from "date-fns";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EventWithDetails } from "@/hooks/useEventScheduler";
import { Badge } from "@/components/ui/badge";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface VolunteerScheduleTableViewProps {
  events: EventWithDetails[];
  onEventClick: (event: EventWithDetails) => void;
  currentUserId?: string;
}

const SIDESMAN_ROLES = ['sidesman-standard', 'sidesman-sound', 'sidesman-welcome'];

export function VolunteerScheduleTableView({ 
  events, 
  onEventClick, 
  currentUserId 
}: VolunteerScheduleTableViewProps) {
  
  // Check if user is assigned to an event
  const isUserAssigned = (event: EventWithDetails) => {
    return event.assignments.some((a) => a.volunteer_id === currentUserId);
  };

  // Check if user is assigned to a specific role
  const isUserAssignedToRole = (event: EventWithDetails, roles: string[]) => {
    return event.assignments.some(
      (a) => a.volunteer_id === currentUserId && roles.includes(a.role)
    );
  };

  // Get volunteers for a specific role from an event
  const getVolunteersForRole = (event: EventWithDetails, role: string) => {
    return event.assignments
      .filter(a => a.role === role)
      .map(a => ({
        name: a.volunteer_name || 'Unknown',
        isCurrentUser: a.volunteer_id === currentUserId
      }));
  };

  // Get all sidesman volunteers with their type indicator
  const getSidesmenDisplay = (event: EventWithDetails) => {
    const sidesmen: { name: string; type: string; isCurrentUser: boolean }[] = [];
    
    event.assignments
      .filter(a => SIDESMAN_ROLES.includes(a.role))
      .forEach(a => {
        const type = a.role === 'sidesman-standard' ? 'S' 
          : a.role === 'sidesman-sound' ? 'Sound' 
          : 'W';
        sidesmen.push({ 
          name: a.volunteer_name || 'Unknown', 
          type,
          isCurrentUser: a.volunteer_id === currentUserId
        });
      });
    
    return sidesmen;
  };

  // Get subheading from the event
  const getSubheading = (event: EventWithDetails) => {
    return event.subheading || null;
  };

  // Get reading from the event
  const getReading = (event: EventWithDetails) => {
    return event.reading || null;
  };

  const formatDate = (date: string) => {
    const d = parseISO(date);
    return {
      day: format(d, "d"),
      month: format(d, "MMM"),
    };
  };

  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <p>No events to display</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-card overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead className="w-[100px] font-semibold">Date</TableHead>
            <TableHead className="min-w-[120px] md:min-w-[180px] font-semibold">Sidesmen</TableHead>
            <TableHead className="min-w-[100px] md:min-w-[120px] font-semibold">Reader</TableHead>
            <TableHead className="hidden md:table-cell min-w-[140px] font-semibold">Reading</TableHead>
            <TableHead className="hidden lg:table-cell min-w-[120px] font-semibold">Intercessions</TableHead>
            <TableHead className="hidden lg:table-cell min-w-[140px] font-semibold">Collection Count</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {events.map((event) => {
            const { day, month } = formatDate(event.date);
            const subheading = getSubheading(event);
            const reading = getReading(event);
            const sidesmen = getSidesmenDisplay(event);
            const readers = getVolunteersForRole(event, 'reader');
            const intercessions = getVolunteersForRole(event, 'intercessions');
            const collection = getVolunteersForRole(event, 'collection');
            const userAssigned = isUserAssigned(event);

            return (
              <TableRow
                key={event.id}
                className={cn(
                  "cursor-pointer transition-colors",
                  userAssigned 
                    ? "bg-primary/10 hover:bg-primary/20 border-l-4 border-l-primary" 
                    : "hover:bg-muted/50"
                )}
                onClick={() => onEventClick(event)}
              >
                {/* Date Column */}
                <TableCell className="py-3">
                  <div className="flex items-center gap-2">
                    {userAssigned && (
                      <Star className="h-4 w-4 text-primary fill-primary flex-shrink-0" />
                    )}
                    <div>
                      <div className="font-medium">
                        {day} {month}
                      </div>
                      {subheading && (
                        <div className="text-xs text-muted-foreground italic">
                          {subheading}
                        </div>
                      )}
                    </div>
                  </div>
                </TableCell>

                {/* Sidesmen Column */}
                <TableCell className="py-3">
                  <div className="space-y-1">
                    {sidesmen.length > 0 ? (
                      sidesmen.map((s, i) => (
                        <div key={i} className="flex items-center gap-1.5">
                          <span className={cn(
                            s.isCurrentUser && "font-semibold text-primary"
                          )}>
                            {s.name}
                            {s.isCurrentUser && " (You)"}
                          </span>
                          <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">
                            {s.type}
                          </Badge>
                        </div>
                      ))
                    ) : (
                      <span className="text-muted-foreground text-sm">-</span>
                    )}
                  </div>
                </TableCell>

                {/* Reader Column */}
                <TableCell className="py-3">
                  <div className="space-y-1">
                    {readers.length > 0 ? (
                      readers.map((r, i) => (
                        <div key={i} className={cn(
                          r.isCurrentUser && "font-semibold text-primary"
                        )}>
                          {r.name}
                          {r.isCurrentUser && " (You)"}
                        </div>
                      ))
                    ) : (
                      <span className="text-muted-foreground text-sm">-</span>
                    )}
                  </div>
                </TableCell>

                {/* Reading Column - Hidden on mobile */}
                <TableCell className="py-3 hidden md:table-cell">
                  {reading ? (
                    <span className="text-sm">{reading}</span>
                  ) : (
                    <span className="text-muted-foreground text-sm italic">-</span>
                  )}
                </TableCell>

                {/* Intercessions Column - Hidden on mobile/tablet */}
                <TableCell className="py-3 hidden lg:table-cell">
                  <div className="space-y-1">
                    {intercessions.length > 0 ? (
                      intercessions.map((r, i) => (
                        <div key={i} className={cn(
                          r.isCurrentUser && "font-semibold text-primary"
                        )}>
                          {r.name}
                          {r.isCurrentUser && " (You)"}
                        </div>
                      ))
                    ) : (
                      <span className="text-muted-foreground text-sm">-</span>
                    )}
                  </div>
                </TableCell>

                {/* Collection Count Column - Hidden on mobile/tablet */}
                <TableCell className="py-3 hidden lg:table-cell">
                  <div className="space-y-1">
                    {collection.length > 0 ? (
                      collection.map((r, i) => (
                        <div key={i} className={cn(
                          r.isCurrentUser && "font-semibold text-primary"
                        )}>
                          {r.name}
                          {r.isCurrentUser && " (You)"}
                        </div>
                      ))
                    ) : (
                      <span className="text-muted-foreground text-sm">-</span>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
