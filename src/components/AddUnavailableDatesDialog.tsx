import { useState } from 'react';
import { format, eachDayOfInterval, isBefore, startOfDay } from 'date-fns';
import { CalendarOff, Calendar as CalendarIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Calendar } from '@/components/ui/calendar';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

interface AddUnavailableDatesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (dates: string[], notes?: string) => Promise<void>;
  existingDates?: string[];
}

export function AddUnavailableDatesDialog({
  open,
  onOpenChange,
  onSave,
  existingDates = [],
}: AddUnavailableDatesDialogProps) {
  const [mode, setMode] = useState<'single' | 'range'>('single');
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
    from: undefined,
    to: undefined,
  });
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const today = startOfDay(new Date());

  const handleSave = async () => {
    let dates: string[] = [];

    if (mode === 'single' && selectedDate) {
      dates = [format(selectedDate, 'yyyy-MM-dd')];
    } else if (mode === 'range' && dateRange.from && dateRange.to) {
      const allDates = eachDayOfInterval({ start: dateRange.from, end: dateRange.to });
      dates = allDates.map(d => format(d, 'yyyy-MM-dd'));
    }

    if (dates.length === 0) return;

    // Filter out dates that already exist
    const newDates = dates.filter(d => !existingDates.includes(d));
    
    if (newDates.length === 0) {
      onOpenChange(false);
      return;
    }

    setIsSaving(true);
    try {
      await onSave(newDates, notes.trim() || undefined);
      // Reset form
      setSelectedDate(undefined);
      setDateRange({ from: undefined, to: undefined });
      setNotes('');
      onOpenChange(false);
    } finally {
      setIsSaving(false);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      // Reset form when closing
      setSelectedDate(undefined);
      setDateRange({ from: undefined, to: undefined });
      setNotes('');
      setMode('single');
    }
    onOpenChange(newOpen);
  };

  const isValid = mode === 'single' 
    ? !!selectedDate 
    : !!(dateRange.from && dateRange.to);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-serif">
            <CalendarOff className="h-5 w-5 text-destructive" />
            Add Unavailable Dates
          </DialogTitle>
          <DialogDescription>
            Select the dates when you won't be available to serve.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <Tabs value={mode} onValueChange={(v) => setMode(v as 'single' | 'range')}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="single">Single Date</TabsTrigger>
              <TabsTrigger value="range">Date Range</TabsTrigger>
            </TabsList>

            <TabsContent value="single" className="mt-4">
              <div className="flex justify-center">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={setSelectedDate}
                  disabled={(date) => isBefore(date, today)}
                  className={cn("rounded-md border pointer-events-auto")}
                />
              </div>
              {selectedDate && (
                <p className="mt-3 text-center text-sm text-muted-foreground">
                  Selected: <span className="font-medium text-foreground">{format(selectedDate, 'EEEE, MMMM d, yyyy')}</span>
                </p>
              )}
            </TabsContent>

            <TabsContent value="range" className="mt-4">
              <div className="flex justify-center">
                <Calendar
                  mode="range"
                  selected={dateRange.from ? { from: dateRange.from, to: dateRange.to } : undefined}
                  onSelect={(range) => setDateRange({ from: range?.from, to: range?.to })}
                  disabled={(date) => isBefore(date, today)}
                  numberOfMonths={1}
                  className={cn("rounded-md border pointer-events-auto")}
                />
              </div>
              {dateRange.from && dateRange.to && (
                <p className="mt-3 text-center text-sm text-muted-foreground">
                  Selected: <span className="font-medium text-foreground">
                    {format(dateRange.from, 'MMM d')} – {format(dateRange.to, 'MMM d, yyyy')}
                  </span>
                </p>
              )}
            </TabsContent>
          </Tabs>

          <div className="space-y-2">
            <Label htmlFor="notes">Reason (optional)</Label>
            <Textarea
              id="notes"
              placeholder="e.g., Holiday, work trip, exams..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!isValid || isSaving}>
            {isSaving ? 'Saving...' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
