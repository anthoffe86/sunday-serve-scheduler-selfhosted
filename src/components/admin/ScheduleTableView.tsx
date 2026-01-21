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
import { cn } from "@/lib/utils";

interface ScheduleTableViewProps {
  events: EventWithDetails[];
  onEventClick: (eventId: string) => void;
}

// Short role labels for table display
const SHORT_ROLE_LABELS: Record<string, string> = {
  'sidesman-standard': 'S',
  'sidesman-sound': 'Sound',
  'sidesman-welcome': 'W',
  'reader': 'Reader',
  'intercessions': 'Intercessions',
  'collection': 'Collection',
};

const SIDESMAN_ROLES = ['sidesman-standard', 'sidesman-sound', 'sidesman-welcome'];

export function ScheduleTableView({ events, onEventClick }: ScheduleTableViewProps) {
  // Get volunteers for a specific role from an event (exclude declined)
  const getVolunteersForRole = (event: EventWithDetails, role: string) => {
    return event.assignments
      .filter(a => a.role === role && a.status !== 'declined')
      .map(a => a.volunteer_name || 'Unknown');
  };

  // Get all sidesman volunteers with their type indicator (exclude declined)
  const getSidesmenDisplay = (event: EventWithDetails) => {
    const sidesmen: { name: string; type: string }[] = [];
    
    event.assignments
      .filter(a => SIDESMAN_ROLES.includes(a.role) && a.status !== 'declined')
      .forEach(a => {
        const type = a.role === 'sidesman-standard' ? 'S' 
          : a.role === 'sidesman-sound' ? 'Sound' 
          : 'W';
        sidesmen.push({ 
          name: a.volunteer_name || 'Unknown', 
          type 
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

  // Get required count for a role
  const getRoleCount = (event: EventWithDetails, role: string) => {
    const roleConfig = event.roles.find(r => r.role === role);
    return roleConfig?.quantity || 0;
  };

  // Get total sidesman count required
  const getTotalSidesmenRequired = (event: EventWithDetails) => {
    return SIDESMAN_ROLES.reduce((sum, role) => sum + getRoleCount(event, role), 0);
  };

  const formatDate = (date: string) => {
    const d = parseISO(date);
    return {
      day: format(d, "d"),
      month: format(d, "MMM"),
      weekday: format(d, "EEE"),
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

            const sidesmenRequired = getTotalSidesmenRequired(event);
            const sidesmenFilled = sidesmen.length;
            const readerRequired = getRoleCount(event, 'reader');
            const intercessionsRequired = getRoleCount(event, 'intercessions');
            const collectionRequired = getRoleCount(event, 'collection');

            return (
              <TableRow
                key={event.id}
                className={cn(
                  "cursor-pointer hover:bg-muted/50 transition-colors",
                  event.status === "cancelled" && "opacity-60"
                )}
                onClick={() => onEventClick(event.id)}
              >
                {/* Date Column */}
                <TableCell className="py-3">
                  <div className="font-medium">
                    {day} {month}
                  </div>
                  {subheading && (
                    <div className="text-xs text-muted-foreground italic">
                      {subheading}
                    </div>
                  )}
                </TableCell>

                {/* Sidesmen Column */}
                <TableCell className="py-3">
                  <div className="space-y-1">
                    {sidesmen.length > 0 ? (
                      sidesmen.map((s, i) => (
                        <div key={i} className="flex items-center gap-1.5">
                          <span>{s.name}</span>
                          <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">
                            {s.type}
                          </Badge>
                        </div>
                      ))
                    ) : (
                      <span className="text-muted-foreground text-sm">
                        {sidesmenRequired > 0 ? `0/${sidesmenRequired} assigned` : '-'}
                      </span>
                    )}
                    {sidesmenRequired > 0 && sidesmenFilled < sidesmenRequired && sidesmenFilled > 0 && (
                      <div className="text-xs text-amber-600">
                        +{sidesmenRequired - sidesmenFilled} needed
                      </div>
                    )}
                  </div>
                </TableCell>

                {/* Reader Column */}
                <TableCell className="py-3">
                  <div className="space-y-1">
                    {readers.length > 0 ? (
                      readers.map((name, i) => (
                        <div key={i}>{name}</div>
                      ))
                    ) : (
                      <span className="text-muted-foreground text-sm">
                        {readerRequired > 0 ? `0/${readerRequired} assigned` : '-'}
                      </span>
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
                      intercessions.map((name, i) => (
                        <div key={i}>{name}</div>
                      ))
                    ) : (
                      <span className="text-muted-foreground text-sm">
                        {intercessionsRequired > 0 ? `0/${intercessionsRequired} assigned` : '-'}
                      </span>
                    )}
                  </div>
                </TableCell>

                {/* Collection Count Column - Hidden on mobile/tablet */}
                <TableCell className="py-3 hidden lg:table-cell">
                  <div className="space-y-1">
                    {collection.length > 0 ? (
                      collection.map((name, i) => (
                        <div key={i}>{name}</div>
                      ))
                    ) : (
                      <span className="text-muted-foreground text-sm">
                        {collectionRequired > 0 ? `0/${collectionRequired} assigned` : '-'}
                      </span>
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
