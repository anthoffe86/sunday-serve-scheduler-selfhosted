import { format, parseISO } from 'date-fns';
import { Calendar, List, Download, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScheduleTable } from '@/components/ScheduleTable';
import { useScheduleWithAssignments } from '@/hooks/useVolunteerData';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';

const Schedule = () => {
  const { data: schedule, isLoading } = useScheduleWithAssignments();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const services = schedule || [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-serif text-3xl font-bold">Full Schedule</h1>
          <p className="text-muted-foreground">
            View all upcoming Sunday service assignments
          </p>
        </div>
        <Button variant="outline" className="gap-2 self-start">
          <Download className="h-4 w-4" />
          Export Schedule
        </Button>
      </div>

      {services.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Calendar className="mb-4 h-12 w-12 text-muted-foreground/50" />
            <h3 className="mb-1 font-serif text-lg font-semibold">No Schedules Yet</h3>
            <p className="text-sm text-muted-foreground">
              Schedules will appear here once an admin generates them.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Tabs defaultValue="table" className="space-y-4">
          <TabsList>
            <TabsTrigger value="table" className="gap-2">
              <List className="h-4 w-4" />
              Table View
            </TabsTrigger>
            <TabsTrigger value="calendar" className="gap-2">
              <Calendar className="h-4 w-4" />
              Calendar View
            </TabsTrigger>
          </TabsList>

          <TabsContent value="table" className="animate-fade-in">
            <ScheduleTable services={services} />
          </TabsContent>

          <TabsContent value="calendar" className="animate-fade-in">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {services.map((service) => {
                const dateObj = parseISO(service.date);
                return (
                  <div
                    key={service.id}
                    className="rounded-xl border bg-card p-5 transition-shadow hover:shadow-md"
                  >
                    <div className="mb-4 flex items-center justify-between">
                      <div>
                        <p className="font-serif text-xl font-bold">
                          {format(dateObj, 'd')}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {format(dateObj, 'MMMM yyyy')}
                        </p>
                      </div>
                      {service.status === 'draft' && (
                        <span className="rounded-full bg-accent/20 px-2 py-0.5 text-xs font-medium">
                          Draft
                        </span>
                      )}
                    </div>
                    <div className="space-y-2">
                      {service.assignments.map((assignment) => (
                        <div
                          key={assignment.id}
                          className="flex items-center justify-between text-sm"
                        >
                          <span className="text-muted-foreground">
                            {assignment.role
                              .replace(/-/g, ' ')
                              .replace(/\b\w/g, (c) => c.toUpperCase())}
                          </span>
                          <span className="font-medium">
                            {assignment.volunteerName?.split(' ')[0] || 'Unassigned'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
};

export default Schedule;
