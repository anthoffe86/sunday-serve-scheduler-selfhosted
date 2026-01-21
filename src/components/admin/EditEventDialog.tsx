import { useState, useEffect } from 'react';
import {
  Calendar,
  Clock,
  Users,
  UserPlus,
  Trash2,
  Check,
  X,
  Loader2,
  Pencil,
  Plus,
  Minus,
  BookOpen
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  useUpdateEventRoles,
  useAssignVolunteer,
  useBatchUpdateAssignments,
  EventWithDetails
} from '@/hooks/useEventScheduler';
import { ROLE_LABELS, Role } from '@/types';
import { AssignVolunteerDialog } from './AssignVolunteerDialog';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';

interface EditEventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event: EventWithDetails | null;
}

const ALL_ROLES: Role[] = [
  'sidesman-standard',
  'sidesman-sound',
  'sidesman-welcome',
  'reader',
  'intercessions',
  'collection',
];

export function EditEventDialog({ open, onOpenChange, event }: EditEventDialogProps) {
  const [assignRole, setAssignRole] = useState<string | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [isEditingDetails, setIsEditingDetails] = useState(false);
  const [isEditingRoles, setIsEditingRoles] = useState(false);

  // Editable fields
  const [subheading, setSubheading] = useState('');
  const [reading, setReading] = useState('');
  const [editedRoles, setEditedRoles] = useState<{ role: string; quantity: number }[]>([]);

  // Batch Assignment State
  const [localAssignments, setLocalAssignments] = useState<any[]>([]);
  const [isAssignmentsDirty, setIsAssignmentsDirty] = useState(false);

  const updateEvent = useUpdateEvent();
  const deleteEvent = useDeleteEvent();
  const removeAssignment = useRemoveAssignment();
  const updateEventRoles = useUpdateEventRoles();
  const assignVolunteer = useAssignVolunteer();
  const batchUpdateAssignments = useBatchUpdateAssignments();

  // Reset form when event changes
  useEffect(() => {
    if (event) {
      setSubheading(event.subheading || '');
      setReading(event.reading || '');
      setEditedRoles(event.roles.map(r => ({ role: r.role, quantity: r.quantity })));
      setLocalAssignments(event.assignments.map(a => ({ ...a })));
      setIsAssignmentsDirty(false);
      setIsEditingDetails(false);
      setIsEditingRoles(false);
    }
  }, [event]);

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
      // If saving assignments and publishing at the same time, save first
      if (status === 'published' && isAssignmentsDirty) {
        await handleSaveAssignments();
      }

      await updateEvent.mutateAsync({ id: event.id, status });

      if (status === 'published') {
        const { data, error: notificationError } = await supabase.functions.invoke('send-event-notification', {
          body: {
            eventIds: [event.id],
            baseUrl: window.location.origin,
          },
        });

        if (notificationError) {
          console.error('Failed to send notifications:', notificationError);
          toast.success('Event published (but notification emails failed)');
        } else {
          const sent = data?.emailsSent || 0;
          toast.success(`Event published and ${sent} volunteer${sent !== 1 ? 's' : ''} notified`);
        }
      } else {
        toast.success(`Event ${status === 'cancelled' ? 'cancelled' : 'set to draft'}`);
      }
    } catch (error) {
      toast.error('Failed to update status');
    }
  };

  const handleSaveDetails = async () => {
    try {
      await updateEvent.mutateAsync({
        id: event.id,
        subheading: subheading.trim() || null,
        reading: reading.trim() || null,
      });
      toast.success('Event details updated');
      setIsEditingDetails(false);
    } catch (error) {
      toast.error('Failed to update event');
    }
  };

  const handleSaveRoles = async () => {
    try {
      await updateEventRoles.mutateAsync({
        eventId: event.id,
        roles: editedRoles.filter(r => r.quantity > 0),
      });
      toast.success('Roles updated');
      setIsEditingRoles(false);
    } catch (error) {
      toast.error('Failed to update roles');
    }
  };

  const handleCancelRolesEdit = () => {
    setEditedRoles(event.roles.map(r => ({ role: r.role, quantity: r.quantity })));
    setIsEditingRoles(false);
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

  // --- Batch Assignment Logic ---

  const handleLocalRemoveAssignment = (assignmentId: string) => {
    setLocalAssignments(prev => prev.filter(a => a.id !== assignmentId && a.tempId !== assignmentId));
    setIsAssignmentsDirty(true);
  };

  const handleLocalAssignVolunteer = (volunteer: any) => {
    if (!assignRole) return;

    // Check if volunteer is already assigned to THIS SPECIFIC ROLE (prevent duplicate role assignment)
    const isAlreadyAssignedToRole = localAssignments.some(
      a => a.volunteer_id === volunteer.user_id && a.role === assignRole
    );
    if (isAlreadyAssignedToRole) {
      toast.error('Volunteer already assigned to this role');
      return;
    }

    // Note: We allow the same volunteer to be assigned to multiple different roles

    const newAssignment = {
      id: `temp-${Date.now()}`, // Temporary ID
      tempId: `temp-${Date.now()}`,
      volunteer_id: volunteer.user_id,
      volunteer_name: volunteer.name,
      role: assignRole,
      event_id: event.id,
      isNew: true
    };

    setLocalAssignments(prev => [...prev, newAssignment]);
    setIsAssignmentsDirty(true);
  };

  const handleSaveAssignments = async () => {
    if (!isAssignmentsDirty) return;

    const currentAssignments = localAssignments;

    // Identify removals: present in original but not in current
    const toRemove = event.assignments.filter(orig => !currentAssignments.some(curr => (curr.id === orig.id)));
    const toRemoveIds = toRemove.map(a => a.id);

    // Identify additions: marked as isNew
    const toAdd = currentAssignments.filter(a => a.isNew);
    const toAddPayload = toAdd.map(a => ({ role: a.role, volunteer_id: a.volunteer_id }));

    if (toRemoveIds.length === 0 && toAddPayload.length === 0) {
      setIsAssignmentsDirty(false);
      return;
    }

    try {
      // Perform Batch DB Update
      await batchUpdateAssignments.mutateAsync({
        eventId: event.id,
        toAdd: toAddPayload,
        toRemove: toRemoveIds
      });

      // For PUBLISHED events only: send notifications immediately
      // Draft events use the invitation workflow instead
      if (event.status === 'published') {
        // Send removal notifications
        for (const assignment of toRemove) {
          await supabase.functions.invoke('send-assignment-removal-notification', {
            body: {
              volunteerId: assignment.volunteer_id,
              eventName: event.name,
              eventDate: event.date,
              role: assignment.role,
              reason: "Schedule change by administrator",
              baseUrl: window.location.origin,
            },
          });
        }

        // Send confirmation emails to newly added volunteers
        const addedUserIds = toAdd.map(a => a.volunteer_id);
        if (addedUserIds.length > 0) {
          await supabase.functions.invoke('send-event-notification', {
            body: {
              eventIds: [event.id],
              baseUrl: window.location.origin,
              userIds: addedUserIds,
            },
          });
        }

        const notifications = [];
        if (toRemove.length > 0) notifications.push(`${toRemove.length} removed & notified`);
        if (toAdd.length > 0) notifications.push(`${toAdd.length} added & notified`);
        toast.success(`Saved: ${notifications.join(', ')}`);
      } else {
        toast.success(`Saved: ${toAdd.length} added, ${toRemove.length} removed`);
      }

      setIsAssignmentsDirty(false);

    } catch (error) {
      console.error(error);
      toast.error('Failed to save changes');
    }
  };

  const handleCancelAssignments = () => {
    setLocalAssignments(event.assignments.map(a => ({ ...a })));
    setIsAssignmentsDirty(false);
    toast.info('Changes discarded');
  };

  const updateRoleQuantity = (role: string, delta: number) => {
    setEditedRoles(prev => {
      const existing = prev.find(r => r.role === role);
      if (existing) {
        const newQuantity = Math.max(0, existing.quantity + delta);
        if (newQuantity === 0) {
          return prev.filter(r => r.role !== role);
        }
        return prev.map(r => r.role === role ? { ...r, quantity: newQuantity } : r);
      } else if (delta > 0) {
        return [...prev, { role, quantity: delta }];
      }
      return prev;
    });
  };

  const getRoleQuantity = (role: string) => {
    return editedRoles.find(r => r.role === role)?.quantity || 0;
  };

  const getFilledRolesCount = (role: string) => {
    const required = event.roles.find(r => r.role === role)?.quantity || 0;
    const filled = localAssignments.filter(a => a.role === role).length;
    return { filled, required };
  };

  const isPending = updateEvent.isPending || deleteEvent.isPending || updateEventRoles.isPending || batchUpdateAssignments.isPending;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader className="space-y-3">
            <div className="flex items-center gap-3">
              <DialogTitle className="text-2xl">
                {event.name}
              </DialogTitle>
              <Badge
                variant={event.status === 'published' ? 'default' : event.status === 'cancelled' ? 'destructive' : 'secondary'}
                className="shrink-0"
              >
                {event.status}
              </Badge>
            </div>
            {event.subheading && !isEditingDetails && (
              <p className="text-sm text-muted-foreground italic">{event.subheading}</p>
            )}
            <DialogDescription className="flex flex-wrap items-center gap-4">
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

          {/* Event Details (Subheading & Reading) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold flex items-center gap-2 text-base">
                <Pencil className="h-4 w-4" />
                Event Details
              </h4>
              {!isEditingDetails ? (
                <Button variant="ghost" size="sm" onClick={() => setIsEditingDetails(true)}>
                  Edit
                </Button>
              ) : (
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSubheading(event.subheading || '');
                      setReading(event.reading || '');
                      setIsEditingDetails(false);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleSaveDetails}
                    disabled={updateEvent.isPending}
                  >
                    {updateEvent.isPending && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
                    Save
                  </Button>
                </div>
              )}
            </div>

            {isEditingDetails ? (
              <div className="space-y-3 p-3 border rounded-lg bg-muted/30">
                <div className="space-y-1.5">
                  <Label htmlFor="subheading" className="text-sm">Subheading</Label>
                  <Input
                    id="subheading"
                    placeholder="e.g. Epiphany, Candlemas, Baptism of Christ"
                    value={subheading}
                    onChange={(e) => setSubheading(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    A special name or occasion for this service
                  </p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="reading" className="text-sm">Reading</Label>
                  <Input
                    id="reading"
                    placeholder="e.g. Acts 10: 34-43"
                    value={reading}
                    onChange={(e) => setReading(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    The bible passage for the reader
                  </p>
                </div>
              </div>
            ) : (
              <div className="p-3 border rounded-lg bg-muted/30 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subheading:</span>
                  <span className={cn(!event.subheading && "text-muted-foreground italic")}>
                    {event.subheading || 'Not set'}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <BookOpen className="h-3 w-3" />
                    Reading:
                  </span>
                  <span className={cn(!event.reading && "text-muted-foreground italic")}>
                    {event.reading || 'Not set'}
                  </span>
                </div>
              </div>
            )}
          </div>

          <Separator />

          {/* Roles Configuration */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold flex items-center gap-2 text-base">
                <Users className="h-4 w-4" />
                Roles Required
              </h4>
              {!isEditingRoles ? (
                <Button variant="ghost" size="sm" onClick={() => setIsEditingRoles(true)}>
                  Edit Roles
                </Button>
              ) : (
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" onClick={handleCancelRolesEdit}>
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleSaveRoles}
                    disabled={updateEventRoles.isPending}
                  >
                    {updateEventRoles.isPending && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
                    Save
                  </Button>
                </div>
              )}
            </div>

            {isEditingRoles ? (
              <div className="space-y-2 p-3 border rounded-lg bg-muted/30">
                <p className="text-xs text-muted-foreground mb-3">
                  Set the number of volunteers needed for each role. Set to 0 to remove a role.
                </p>
                {ALL_ROLES.map((role) => {
                  const quantity = getRoleQuantity(role);
                  const currentAssignments = event.assignments.filter(a => a.role === role);
                  const willRemoveVolunteers = quantity < currentAssignments.length;
                  const isRoleRemoved = quantity === 0 && currentAssignments.length > 0;

                  return (
                    <div
                      key={role}
                      className={cn(
                        "flex flex-col gap-1 p-2 rounded-md transition-colors",
                        isRoleRemoved && "bg-destructive/10 border border-destructive/30",
                        quantity > 0 && "bg-background"
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <span className={cn(
                            "text-sm",
                            quantity === 0 && "text-muted-foreground"
                          )}>
                            {ROLE_LABELS[role] || role}
                          </span>
                          {currentAssignments.length > 0 && (
                            <span className="text-xs text-muted-foreground ml-2">
                              ({currentAssignments.length} assigned)
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => updateRoleQuantity(role, -1)}
                            disabled={quantity === 0}
                          >
                            <Minus className="h-3 w-3" />
                          </Button>
                          <span className={cn(
                            "w-6 text-center font-medium",
                            quantity === 0 && "text-muted-foreground"
                          )}>
                            {quantity}
                          </span>
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => updateRoleQuantity(role, 1)}
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                      {willRemoveVolunteers && (
                        <p className="text-xs text-amber-600">
                          ⚠️ {currentAssignments.length - quantity} volunteer(s) will be unassigned
                        </p>
                      )}
                      {isRoleRemoved && (
                        <p className="text-xs text-destructive">
                          This role will be removed. {currentAssignments.map(a => a.volunteer_name).join(', ')} will be freed up.
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              /* Volunteer Assignments */
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold flex items-center gap-2 text-base">
                    <Users className="h-4 w-4" />
                    Assignments
                  </h4>
                </div>

                {event.roles.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4 border rounded-lg">
                    No roles defined for this event
                  </p>
                ) : (
                  event.roles.map((role) => {
                    const { filled, required } = getFilledRolesCount(role.role);
                    const isFilled = filled >= required;
                    const assignments = localAssignments.filter(a => a.role === role.role);

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
                          {assignments.map((assignment) => {
                            const statusColors = {
                              confirmed: 'bg-green-100 border-green-300 text-green-800',
                              invited: 'bg-blue-100 border-blue-300 text-blue-800',
                              proposed: 'bg-gray-100 border-gray-300 text-gray-600',
                              declined: 'bg-red-100 border-red-300 text-red-800',
                            };
                            const statusLabels = {
                              confirmed: '✓ Confirmed',
                              invited: 'Invited',
                              proposed: 'Proposed',
                              declined: '✗ Declined',
                            };
                            const status = assignment.status as keyof typeof statusColors;
                            
                            return (
                              <div
                                key={assignment.id}
                                className={cn(
                                  "flex items-center justify-between text-sm rounded px-2 py-1.5",
                                  assignment.isNew && "ring-1 ring-green-500 bg-green-50",
                                  !assignment.isNew && status === 'confirmed' && "bg-green-50",
                                  !assignment.isNew && status === 'declined' && "bg-red-50 opacity-60",
                                  !assignment.isNew && status !== 'confirmed' && status !== 'declined' && "bg-background"
                                )}
                              >
                                <div className="flex items-center gap-2">
                                  <span className={cn(
                                    status === 'declined' && "line-through text-muted-foreground"
                                  )}>
                                    {assignment.volunteer_name || 'Unknown'}
                                  </span>
                                  {assignment.isNew ? (
                                    <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 border-green-500 text-green-700 bg-green-50">
                                      New
                                    </Badge>
                                  ) : (
                                    <Badge 
                                      variant="outline" 
                                      className={cn("text-[10px] px-1.5 py-0 h-4", statusColors[status])}
                                    >
                                      {statusLabels[status]}
                                    </Badge>
                                  )}
                                </div>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 text-muted-foreground hover:text-destructive"
                                  onClick={() => handleLocalRemoveAssignment(assignment.id)}
                                >
                                  <X className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            );
                          })}

                          <Button
                            variant="ghost"
                            size="sm"
                            className={cn(
                              "w-full h-8 text-xs gap-1 border-dashed border",
                              filled >= required && "text-muted-foreground"
                            )}
                            onClick={() => setAssignRole(role.role)}
                          >
                            <UserPlus className="h-3.5 w-3.5" />
                            {filled >= required ? 'Add Another' : 'Assign Volunteer'}
                          </Button>
                        </div>
                      </div>
                    );
                  })
                )}
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
            <div className="flex gap-2">
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
              {isAssignmentsDirty && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleCancelAssignments}
                >
                  Discard Changes
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Close
              </Button>
              {isAssignmentsDirty && (
                <Button
                  size="sm"
                  onClick={handleSaveAssignments}
                  disabled={isPending}
                  className="gap-1"
                >
                  {isPending && <Loader2 className="h-3 w-3 animate-spin" />}
                  Save Changes
                </Button>
              )}
            </div>
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
        existingAssignmentIds={localAssignments.filter(a => a.role === assignRole).map(a => a.volunteer_id)}
        allEventAssignmentIds={localAssignments.map(a => a.volunteer_id)}
        onAssigned={handleLocalAssignVolunteer}
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
