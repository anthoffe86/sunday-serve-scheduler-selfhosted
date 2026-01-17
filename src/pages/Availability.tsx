import { CalendarCheck, Info } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AvailabilityCalendar } from '@/components/AvailabilityCalendar';

const Availability = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-3xl font-bold">My Availability</h1>
        <p className="text-muted-foreground">
          Mark the Sundays you're available or unavailable to serve
        </p>
      </div>

      <Alert className="border-primary/30 bg-primary/5">
        <Info className="h-4 w-4 text-primary" />
        <AlertDescription className="text-sm">
          By default, you're marked as <strong>available</strong> for all Sundays.
          Click any date to change your availability. Assigned dates cannot be changed—request a swap instead.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-serif">
            <CalendarCheck className="h-5 w-5 text-primary" />
            Upcoming Sundays
          </CardTitle>
        </CardHeader>
        <CardContent>
          <AvailabilityCalendar />
        </CardContent>
      </Card>
    </div>
  );
};

export default Availability;
