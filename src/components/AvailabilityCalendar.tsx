import { useState } from 'react';
import { format, parseISO, isSameMonth, startOfMonth, addMonths, subMonths } from 'date-fns';
import { ChevronLeft, ChevronRight, Check, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { useAvailability, useToggleAvailability, useScheduleWithAssignments } from '@/hooks/useVolunteerData';
import { toast } from 'sonner';

// Generate upcoming Sundays
const getUpcomingSundays = (count: number): string[] => {
  const sundays: string[] = [];
  const today = new Date();
  let date = new Date(today);
  
  const dayOfWeek = date.getDay();
  const daysUntilSunday = dayOfWeek === 0 ? 0 : 7 - dayOfWeek;
  date.setDate(date.getDate() + daysUntilSunday);
  
  for (let i = 0; i < count; i++) {
    sundays.push(date.toISOString().split('T')[0]);
    date.setDate(date.getDate() + 7);
  }
  
  return sundays;
};

const upcomingSundays = getUpcomingSundays(16);

export function AvailabilityCalendar() {
  const { user } = useAuth();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const { data: availability, isLoading: availabilityLoading } = useAvailability();
  const { data: schedule } = useScheduleWithAssignments();
  const toggleAvailability = useToggleAvailability();

  const sundaysInView = upcomingSundays.filter((date) =>
    isSameMonth(parseISO(date), currentMonth)
  );

  const getAssignment = (date: string) => {
    const service = schedule?.find((s) => s.date === date);
    return service?.assignments.find((a) => a.volunteer_id === user?.id);
  };

  const handleToggleAvailability = (date: string) => {
    const currentAvailability = availability?.find(a => a.date === date);
    const newAvailable = currentAvailability?.available === false ? true : false;
    
    toggleAvailability.mutate(
      { date, available: newAvailable },
      {
        onSuccess: () => {
          toast.success(
            newAvailable 
              ? 'Marked as available' 
              : 'Marked as unavailable',
            { duration: 2000 }
          );
        }
      }
    );
  };

  const isAvailable = (date: string) => {
    const record = availability?.find(a => a.date === date);
    return record?.available !== false;
  };

  if (availabilityLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Month Navigation */}
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <h3 className="font-serif text-lg font-semibold">
          {format(currentMonth, 'MMMM yyyy')}
        </h3>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-sm">
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full bg-status-available" />
          <span>Available</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full bg-status-unavailable" />
          <span>Unavailable</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full bg-primary" />
          <span>Assigned</span>
        </div>
      </div>

      {/* Sundays Grid */}
      <div className="grid gap-3 sm:grid-cols-2">
        {sundaysInView.length === 0 ? (
          <p className="col-span-2 py-8 text-center text-muted-foreground">
            No Sundays in this month. Navigate to see more.
          </p>
        ) : (
          sundaysInView.map((date) => {
            const assignment = getAssignment(date);
            const available = isAvailable(date);
            const dateObj = parseISO(date);

            return (
              <div
                key={date}
                className={cn(
                  'group relative rounded-xl border-2 p-4 transition-all',
                  assignment
                    ? 'border-primary/30 bg-primary/5'
                    : available
                    ? 'border-status-available/30 bg-status-available/5 hover:border-status-available/50'
                    : 'border-status-unavailable/30 bg-status-unavailable/5 hover:border-status-unavailable/50'
                )}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-serif text-lg font-semibold">
                      {format(dateObj, 'd')}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {format(dateObj, 'MMMM')}
                    </p>
                  </div>

                  {assignment ? (
                    <div className="rounded-full bg-primary px-2.5 py-0.5 text-xs font-medium text-primary-foreground">
                      Assigned
                    </div>
                  ) : (
                    <Button
                      variant={available ? 'outline' : 'secondary'}
                      size="sm"
                      onClick={() => handleToggleAvailability(date)}
                      disabled={toggleAvailability.isPending}
                      className={cn(
                        'gap-1.5',
                        available
                          ? 'border-status-available text-status-available hover:bg-status-available hover:text-white'
                          : 'border-status-unavailable text-status-unavailable hover:bg-status-unavailable hover:text-white'
                      )}
                    >
                      {available ? (
                        <>
                          <Check className="h-3.5 w-3.5" />
                          Available
                        </>
                      ) : (
                        <>
                          <X className="h-3.5 w-3.5" />
                          Unavailable
                        </>
                      )}
                    </Button>
                  )}
                </div>

                {assignment && (
                  <p className="mt-2 text-sm">
                    <span className="text-muted-foreground">Role: </span>
                    <span className="font-medium">
                      {assignment.role.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                    </span>
                  </p>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
