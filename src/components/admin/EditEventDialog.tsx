import { useState } from 'react';
import { 
  Calendar, 
  Clock, 
  Users, 
  UserPlus, 
  Trash2,
  Check,
  X,
  Loader2
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
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
import { 
  useUpdateEvent, 
  useDeleteEvent, 
  useRemoveAssignment,
  EventWithDetails 
} from '@/hooks/useEventScheduler';
import { useProfiles } from '@/hooks/useVolunteerData';
import { ROLE_LABELS } from '@/types';
import { AssignVolunteerDialog } from './AssignVolunteerDialog';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface EditEventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event: EventWithDetails | null;
}

export function EditEventDialog({ open, onOpenChange, event }: EditEventDialogProps) {
  const [assignRole, setAssignRole] = useState<string | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  
  const { data: profiles } = useProfiles();
  const updateEvent = useUpdateEvent();
  const deleteEvent = useDeleteEvent();
  const removeAssignment = useRemoveAssignment();

  if (!event) return null;

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  const handleStatusChange = async (status: 'draft' | 'published' | 'cancelled') => {
    try {
      await updateEvent.mutateAsync({ id: event.id, status });
      toast.success(`Event ${status === 'published' ? 'published' : status === 'cancelled' ? 'cancelled' : 'set to draft'}`);
    } catch (error) {
      toast.error('Failed to update status');
    }
  };

  const handleDelete = async () => {
    try {
      await deleteEvent.mutateAsync(event.id);
      toast.success('Event deleted');
      setDeleteConfirmOpen(false);
      onOpenChange(false);
    } catch (error) {
      toast.error('Failed to delete event');
    }
  };

  const handleRemoveAssignment = async (assignmentId: string) => {
    try {
      await removeAssignment.mutateAsync(assignmentId);
      toast.success('Volunteer removed');
    } catch (error) {
      toast.error('Failed to remove volunteer');
    }
  };

  const getFilledRolesCount = (role: string) => {
    const required = event.roles.find(r => r.role === role)?.quantity || 0;
    const filled = event.assignments.filter(a => a.role === role).length;
    return { filled, required };
  };

  const isPending = updateEvent.isPending || deleteEvent.isPending;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-serif flex items-center gap-2">
              {event.name}
              <Badge 
                variant={event.status === 'published' ? 'default' : event.status === 'cancelled' ? 'destructive' : 'secondary'}
              >
                {event.status}
              </Badge>
            </DialogTitle>
            <DialogDescription className="flex flex-wrap items-center gap-4 pt-2">
              <span className="flex items-center gap-1.5">
                <Calendar className="h-4 w-4" />
                {format(parseISO(event.date), 'EEEE, MMMM d, yyyy')}
              </span>
              <span className="flex items-center gap-1.5">
                <Clock className="h-4 w-4" />
                {formatTime(event.start_time)}
              </span>
            </DialogDescription>
          </DialogHeader>

          <Separator />

          {/* Volunteer Assignments */}
          <div className="space-y-4">
            <h4 className="font-medium flex items-center gap-2">
              <Users className="h-4 w-4" />
              Volunteer Assignments
            </h4>

            {event.roles.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4 border rounded-lg">
                No roles defined for this event
              </p>
            ) : (
              <div className="space-y-3">
                {event.roles.map((role) => {
                  const { filled, required } = getFilledRolesCount(role.role);
                  const isFilled = filled >= required;
                  const assignments = event.assignments.filter(a => a.role === role.role);

                  return (
                    <div 
                      key={role.id} 
                      className={cn(
                        'rounded-lg border p-3',
                        isFilled ? 'border-green-200 bg-green-50/50' : 'border-amber-200 bg-amber-50/50'
                      )}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-sm">
                          {ROLE_LABELS[role.role as keyof typeof ROLE_LABELS] || role.role}
                        </span>
                        <Badge variant={isFilled ? 'default' : 'secondary'} className="text-xs">
                          {filled}/{required}
                        </Badge>
                      </div>

                      <div className="space-y-1">
                        {assignments.map((assignment) => (
                          <div 
                            key={assignment.id} 
                            className="flex items-center justify-between text-sm bg-background rounded px-2 py-1.5"
                          >
                            <span>{assignment.volunteer_name || 'Unknown'}</span>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-muted-foreground hover:text-destructive"
                              onClick={() => handleRemoveAssignment(assignment.id)}
                              disabled={removeAssignment.isPending}
                            >
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        ))}

                        {filled < required && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="w-full h-8 text-xs gap-1 border-dashed border"
                            onClick={() => setAssignRole(role.role)}
                          >
                            <UserPlus className="h-3.5 w-3.5" />
                            Assign Volunteer
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <Separator />

          {/* Status Actions */}
          <div className="flex flex-wrap gap-2">
            {event.status !== 'published' && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleStatusChange('published')}
                disabled={isPending}
                className="gap-1.5"
              >
                <Check className="h-4 w-4" />
                Publish
              </Button>
            )}
            {event.status !== 'draft' && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleStatusChange('draft')}
                disabled={isPending}
              >
                Set to Draft
              </Button>
            )}
            {event.status !== 'cancelled' && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleStatusChange('cancelled')}
                disabled={isPending}
                className="gap-1.5"
              >
                <X className="h-4 w-4" />
                Cancel
              </Button>
            )}
          </div>

          <DialogFooter className="flex-row justify-between sm:justify-between">
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setDeleteConfirmOpen(true)}
              disabled={isPending}
              className="gap-1.5"
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </Button>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign Volunteer Dialog */}
      <AssignVolunteerDialog
        open={!!assignRole}
        onOpenChange={(open) => !open && setAssignRole(null)}
        eventId={event.id}
        eventDate={event.date}
        role={assignRole || ''}
        profiles={profiles || []}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Event?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this event and all its assignments. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete} 
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteEvent.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
