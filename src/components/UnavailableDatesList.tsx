import { useState } from 'react';
import { format, parseISO, isAfter, startOfDay } from 'date-fns';
import { CalendarX, Pencil, Trash2, MoreVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { EditUnavailableDateDialog } from './EditUnavailableDateDialog';
import { cn } from '@/lib/utils';

interface UnavailableDate {
  id: string;
  date: string;
  notes?: string | null;
}

interface UnavailableDatesListProps {
  dates: UnavailableDate[];
  onRemove: (date: string) => Promise<void>;
  onUpdate: (date: string, notes: string | undefined) => Promise<void>;
  isRemoving?: boolean;
}

// Group consecutive dates with the same notes into ranges
function groupDatesIntoRanges(dates: UnavailableDate[]): Array<{
  startDate: string;
  endDate: string;
  notes?: string | null;
  dates: string[];
}> {
  if (dates.length === 0) return [];

  // Sort by date
  const sorted = [...dates].sort((a, b) => a.date.localeCompare(b.date));
  
  const ranges: Array<{
    startDate: string;
    endDate: string;
    notes?: string | null;
    dates: string[];
  }> = [];

  let currentRange = {
    startDate: sorted[0].date,
    endDate: sorted[0].date,
    notes: sorted[0].notes,
    dates: [sorted[0].date],
  };

  for (let i = 1; i < sorted.length; i++) {
    const current = sorted[i];
    const prevDate = parseISO(currentRange.endDate);
    const currDate = parseISO(current.date);
    
    // Check if consecutive day and same notes
    const diffDays = Math.round((currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24));
    const sameNotes = (currentRange.notes || '') === (current.notes || '');

    if (diffDays === 1 && sameNotes) {
      // Extend current range
      currentRange.endDate = current.date;
      currentRange.dates.push(current.date);
    } else {
      // Start new range
      ranges.push(currentRange);
      currentRange = {
        startDate: current.date,
        endDate: current.date,
        notes: current.notes,
        dates: [current.date],
      };
    }
  }
  
  ranges.push(currentRange);
  return ranges;
}

export function UnavailableDatesList({
  dates,
  onRemove,
  onUpdate,
  isRemoving,
}: UnavailableDatesListProps) {
  const [deleteTarget, setDeleteTarget] = useState<{ dates: string[]; label: string } | null>(null);
  const [editTarget, setEditTarget] = useState<{ dates: string[]; notes?: string | null } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const today = startOfDay(new Date());
  
  // Filter to only show future dates
  const futureDates = dates.filter(d => isAfter(parseISO(d.date), today) || format(parseISO(d.date), 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd'));
  
  // Group into ranges
  const ranges = groupDatesIntoRanges(futureDates);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    
    setIsDeleting(true);
    try {
      for (const date of deleteTarget.dates) {
        await onRemove(date);
      }
    } finally {
      setIsDeleting(false);
      setDeleteTarget(null);
    }
  };

  const handleUpdate = async (notes: string | undefined) => {
    if (!editTarget) return;
    
    for (const date of editTarget.dates) {
      await onUpdate(date, notes);
    }
    setEditTarget(null);
  };

  if (ranges.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-muted-foreground/30 p-8 text-center">
        <CalendarX className="mx-auto h-10 w-10 text-muted-foreground/50" />
        <p className="mt-3 text-sm text-muted-foreground">
          No unavailable dates set. You're available for all upcoming dates!
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-2">
        {ranges.map((range, index) => {
          const isRange = range.startDate !== range.endDate;
          const startDate = parseISO(range.startDate);
          const endDate = parseISO(range.endDate);
          
          const label = isRange
            ? `${format(startDate, 'EEE, MMM d')} – ${format(endDate, 'EEE, MMM d, yyyy')}`
            : format(startDate, 'EEEE, MMMM d, yyyy');

          // Format label differently for mobile
          const mobileLabel = isRange
            ? `${format(startDate, 'MMM d')} – ${format(endDate, 'MMM d, yyyy')}`
            : format(startDate, 'MMM d, yyyy');

          return (
            <div
              key={`${range.startDate}-${range.endDate}`}
              className={cn(
                "group flex items-center justify-between rounded-lg border bg-card p-3 transition-colors hover:bg-muted/50 sm:p-4"
              )}
            >
              <div className="flex items-start gap-2 sm:gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-destructive/10 sm:h-10 sm:w-10">
                  <CalendarX className="h-4 w-4 text-destructive sm:h-5 sm:w-5" />
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-sm sm:text-base">
                    <span className="sm:hidden">{mobileLabel}</span>
                    <span className="hidden sm:inline">{label}</span>
                  </p>
                  {range.notes && (
                    <p className="mt-0.5 text-xs text-muted-foreground sm:text-sm line-clamp-1">{range.notes}</p>
                  )}
                  {isRange && (
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {range.dates.length} days
                    </p>
                  )}
                </div>
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="shrink-0 opacity-100 sm:opacity-0 sm:group-hover:opacity-100">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setEditTarget({ dates: range.dates, notes: range.notes })}>
                    <Pencil className="mr-2 h-4 w-4" />
                    Edit Note
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={() => setDeleteTarget({ dates: range.dates, label })}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Remove
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        })}
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Unavailable Date{deleteTarget?.dates.length !== 1 ? 's' : ''}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will restore your availability for {deleteTarget?.label}. You can add it back anytime.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={isDeleting}>
              {isDeleting ? 'Removing...' : 'Remove'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Note Dialog */}
      <EditUnavailableDateDialog
        open={!!editTarget}
        onOpenChange={(open) => !open && setEditTarget(null)}
        currentNotes={editTarget?.notes ?? undefined}
        onSave={handleUpdate}
      />
    </>
  );
}
