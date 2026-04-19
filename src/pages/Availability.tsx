import { useState } from 'react';
import { CalendarCheck, Plus, Loader2, CalendarHeart } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAvailability } from '@/hooks/useVolunteerData';
import { useAddUnavailableDates, useRemoveUnavailableDate, useUpdateUnavailableDate } from '@/hooks/useUnavailability';
import { AddUnavailableDatesDialog } from '@/components/AddUnavailableDatesDialog';
import { UnavailableDatesList } from '@/components/UnavailableDatesList';

const Availability = () => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  
  const { data: availability, isLoading } = useAvailability();
  const addUnavailable = useAddUnavailableDates();
  const removeUnavailable = useRemoveUnavailableDate();
  const updateUnavailable = useUpdateUnavailableDate();

  // Filter to only unavailable dates
  const unavailableDates = (availability ?? [])
    .filter(a => a.available === false)
    .map(a => ({
      id: a.id,
      date: a.date,
      notes: a.notes,
    }));

  const existingDates = unavailableDates.map(d => d.date);

  const handleSaveUnavailable = async (dates: string[], notes?: string) => {
    await addUnavailable.mutateAsync({ dates, notes });
  };

  const handleRemove = async (date: string) => {
    await removeUnavailable.mutateAsync(date);
  };

  const handleUpdate = async (date: string, notes: string | undefined) => {
    await updateUnavailable.mutateAsync({ date, notes });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-2xl font-bold sm:text-3xl">My Availability</h1>
        <p className="text-muted-foreground">
          Manage when you're available to serve
        </p>
      </div>

      {/* Default Available Banner */}
      <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-primary/10">
        <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:p-6">
          <div className="flex items-center gap-3 sm:block">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 sm:h-12 sm:w-12">
              <CalendarHeart className="h-5 w-5 text-primary sm:h-6 sm:w-6" />
            </div>
            <div className="sm:hidden">
              <h3 className="font-serif text-base font-semibold">You're available by default</h3>
              <p className="text-sm text-muted-foreground">
                Add dates you can't serve below.
              </p>
            </div>
          </div>
          <div className="hidden flex-1 sm:block">
            <h3 className="font-serif text-lg font-semibold">You're available by default</h3>
            <p className="text-sm text-muted-foreground">
              You'll be considered for scheduling unless you add dates you can't serve.
            </p>
          </div>
          <Button onClick={() => setIsDialogOpen(true)} className="w-full gap-2 sm:w-auto">
            <Plus className="h-4 w-4" />
            Add dates I can't serve
          </Button>
        </CardContent>
      </Card>

      {/* Unavailable Dates List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-serif">
            <CalendarCheck className="h-5 w-5 text-primary" />
            Unavailable Dates
          </CardTitle>
        </CardHeader>
        <CardContent>
          <UnavailableDatesList
            dates={unavailableDates}
            onRemove={handleRemove}
            onUpdate={handleUpdate}
            isRemoving={removeUnavailable.isPending}
          />
        </CardContent>
      </Card>

      {/* Add Unavailable Dates Dialog */}
      <AddUnavailableDatesDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        onSave={handleSaveUnavailable}
        existingDates={existingDates}
      />
    </div>
  );
};

export default Availability;
