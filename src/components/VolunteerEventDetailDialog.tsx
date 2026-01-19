import { useState } from 'react';
import {
    Calendar,
    Clock,
    Users,
    Star,
    ArrowLeftRight,
    Loader2,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { EventWithDetails } from '@/hooks/useEventScheduler';
import { ROLE_LABELS, Role } from '@/types';
import { cn } from '@/lib/utils';
import { useCreateSwapRequest, useExistingSwapRequest } from '@/hooks/useSwapRequests';

interface VolunteerEventDetailDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    event: EventWithDetails | null;
    currentUserId?: string;
}

export function VolunteerEventDetailDialog({
    open,
    onOpenChange,
    event,
    currentUserId,
}: VolunteerEventDetailDialogProps) {
    const [swapDialogOpen, setSwapDialogOpen] = useState(false);
    const [swapNotes, setSwapNotes] = useState('');
    const [selectedAssignmentForSwap, setSelectedAssignmentForSwap] = useState<{
        id: string;
        role: string;
    } | null>(null);

    const createSwapRequest = useCreateSwapRequest();
    const { data: existingSwapRequest } = useExistingSwapRequest(selectedAssignmentForSwap?.id);

    if (!event) return null;

    const formatTime = (time: string) => {
        const [hours, minutes] = time.split(':');
        const hour = parseInt(hours, 10);
        const ampm = hour >= 12 ? 'PM' : 'AM';
        const displayHour = hour % 12 || 12;
        return `${displayHour}:${minutes} ${ampm}`;
    };

    const isUserAssigned = event.assignments.some((a) => a.volunteer_id === currentUserId);

    const getUserAssignments = () => {
        return event.assignments.filter((a) => a.volunteer_id === currentUserId);
    };

    const getUserRoles = () => {
        return event.assignments
            .filter((a) => a.volunteer_id === currentUserId)
            .map((a) => ROLE_LABELS[a.role as keyof typeof ROLE_LABELS] || a.role);
    };

    const handleRequestSwap = (assignment: { id: string; role: string }) => {
        setSelectedAssignmentForSwap(assignment);
        setSwapNotes('');
        setSwapDialogOpen(true);
    };

    const handleSubmitSwapRequest = async () => {
        if (!selectedAssignmentForSwap) return;

        try {
            await createSwapRequest.mutateAsync({
                eventAssignmentId: selectedAssignmentForSwap.id,
                notes: swapNotes.trim() || undefined,
            });
            setSwapDialogOpen(false);
            onOpenChange(false);
        } catch (error) {
            // Error handled by the hook
        }
    };

    return (
        <>
            <Dialog open={open && !swapDialogOpen} onOpenChange={onOpenChange}>
                <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                    <DialogHeader className="space-y-3">
                        <div className="flex items-center gap-3">
                            <DialogTitle className="text-2xl">
                                {event.name}
                            </DialogTitle>
                            {isUserAssigned && (
                                <Badge variant="default" className="shrink-0 gap-1">
                                    <Star className="h-3 w-3 fill-current" />
                                    Assigned
                                </Badge>
                            )}
                        </div>
                        {event.subheading && (
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
                        {event.reading && (
                            <div className="text-sm text-foreground/80">
                                <span className="font-medium">Reading:</span> {event.reading}
                            </div>
                        )}
                    </DialogHeader>

                    {isUserAssigned && (
                        <>
                            <Separator />

                            <div className="bg-primary/5 rounded-lg border border-primary/10 p-3">
                                <div className="flex items-start gap-2 mb-3">
                                    <Star className="h-4 w-4 text-primary fill-primary mt-0.5" />
                                    <div className="flex-1">
                                        <p className="font-medium text-sm leading-none mb-1">Your Assignment</p>
                                        <p className="text-xs text-muted-foreground">
                                            {getUserRoles().join(', ')}
                                        </p>
                                    </div>
                                </div>

                                {/* Request Swap Buttons */}
                                <div className="flex flex-wrap gap-2">
                                    {getUserAssignments().map((assignment) => (
                                        <Button
                                            key={assignment.id}
                                            variant="outline"
                                            size="sm"
                                            className="h-7 text-xs gap-1"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleRequestSwap({ id: assignment.id, role: assignment.role });
                                            }}
                                        >
                                            <ArrowLeftRight className="h-3 w-3" />
                                            Swap {ROLE_LABELS[assignment.role as Role] || assignment.role}
                                        </Button>
                                    ))}
                                </div>
                            </div>
                        </>
                    )}

                    <Separator />

                    {/* Volunteer Assignments */}
                    <div className="space-y-3">
                        <h4 className="font-semibold flex items-center gap-2 text-base">
                            <Users className="h-4 w-4" />
                            Volunteers
                        </h4>

                        {event.roles.length === 0 ? (
                            <p className="text-sm text-muted-foreground text-center py-4 border rounded-lg">
                                No roles defined for this event
                            </p>
                        ) : (
                            event.roles.map((role) => {
                                const assignments = event.assignments.filter((a) => a.role === role.role);
                                const isFilled = assignments.length >= role.quantity;

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
                                                {assignments.length}/{role.quantity}
                                            </Badge>
                                        </div>

                                        <div className="space-y-1">
                                            {assignments.map((assignment) => {
                                                const isMe = assignment.volunteer_id === currentUserId;
                                                return (
                                                    <div
                                                        key={assignment.id}
                                                        className={cn(
                                                            'flex items-center text-sm bg-background rounded px-2 py-1.5',
                                                            isMe && 'ring-1 ring-primary bg-primary/10'
                                                        )}
                                                    >
                                                        <div className="flex items-center gap-2">
                                                            {isMe && <Star className="h-3 w-3 text-primary fill-primary" />}
                                                            <span className={cn(isMe && 'font-medium text-primary')}>
                                                                {assignment.volunteer_name || 'Unknown'}
                                                            </span>
                                                            {isMe && (
                                                                <span className="text-[10px] text-primary/70">(You)</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                            {assignments.length < role.quantity && (
                                                <div className="text-[10px] text-muted-foreground italic px-2">
                                                    {role.quantity - assignments.length} available
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>

                    <div className="flex justify-end pt-2">
                        <Button variant="outline" onClick={() => onOpenChange(false)}>
                            Close
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Swap Request Dialog */}
            <Dialog open={swapDialogOpen} onOpenChange={setSwapDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="font-serif">Request a Swap</DialogTitle>
                        <DialogDescription>
                            {event && selectedAssignmentForSwap && (
                                <>
                                    Request someone to take over your{' '}
                                    <strong>
                                        {ROLE_LABELS[selectedAssignmentForSwap.role as Role] || selectedAssignmentForSwap.role}
                                    </strong>{' '}
                                    assignment for <strong>{event.name}</strong> on{' '}
                                    <strong>{format(parseISO(event.date), 'MMMM d, yyyy')}</strong>.
                                </>
                            )}
                        </DialogDescription>
                    </DialogHeader>

                    {existingSwapRequest ? (
                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                            <p className="text-sm text-amber-800">
                                You already have a pending swap request for this assignment. Check the Swap Requests page to view its
                                status.
                            </p>
                        </div>
                    ) : (
                        <>
                            <div className="space-y-4 py-4">
                                <div className="space-y-2">
                                    <Label htmlFor="swap-notes">Add a note (optional)</Label>
                                    <Textarea
                                        id="swap-notes"
                                        placeholder="e.g., I have a family commitment that day..."
                                        value={swapNotes}
                                        onChange={(e) => setSwapNotes(e.target.value)}
                                        rows={3}
                                    />
                                    <p className="text-xs text-muted-foreground">
                                        This note will be included in the notification email sent to other volunteers.
                                    </p>
                                </div>
                            </div>

                            <div className="flex justify-end gap-2">
                                <Button variant="outline" onClick={() => setSwapDialogOpen(false)}>
                                    Cancel
                                </Button>
                                <Button
                                    onClick={handleSubmitSwapRequest}
                                    disabled={createSwapRequest.isPending}
                                    className="gap-1"
                                >
                                    {createSwapRequest.isPending ? (
                                        <>
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                            Submitting...
                                        </>
                                    ) : (
                                        <>
                                            <ArrowLeftRight className="h-4 w-4" />
                                            Submit Request
                                        </>
                                    )}
                                </Button>
                            </div>
                        </>
                    )}
                </DialogContent>
            </Dialog>
        </>
    );
}
