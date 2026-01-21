import { useState, useMemo } from 'react';
import { Loader2, Mail, CheckCircle, XCircle, Calendar } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/hooks/useAuth';
import { useEvents, useRespondToInvitation } from '@/hooks/useEventScheduler';
import { ROLE_LABELS } from '@/types';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
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

const Invitations = () => {
  const { user, isLoading: authLoading } = useAuth();
  const { data: events, isLoading: eventsLoading } = useEvents();
  const respondMutation = useRespondToInvitation();
  
  const [declineDialog, setDeclineDialog] = useState<{
    open: boolean;
    assignmentId: string;
    token: string;
    eventName: string;
    date: string;
    role: string;
  } | null>(null);
  const [declineReason, setDeclineReason] = useState('');

  // Get pending invitations for the current user
  const pendingInvitations = useMemo(() => {
    if (!events || !user) return [];
    
    type InvitationItem = {
      assignment: typeof events[0]['assignments'][0];
      event: typeof events[0];
    };
    
    const pending: InvitationItem[] = [];
    
    for (const event of events) {
      for (const assignment of event.assignments) {
        if (assignment.volunteer_id === user.id && assignment.status === 'invited') {
          pending.push({ assignment, event });
        }
      }
    }
    
    // Sort by date
    pending.sort((a, b) => a.event.date.localeCompare(b.event.date));
    
    return pending;
  }, [events, user]);

  const handleAccept = async (assignment: typeof pendingInvitations[0]['assignment']) => {
    if (!assignment.invitation_token) {
      toast.error('No invitation token found');
      return;
    }
    
    try {
      await respondMutation.mutateAsync({
        token: assignment.invitation_token,
        action: 'accept',
      });
      toast.success('Invitation accepted!');
    } catch (error) {
      toast.error('Failed to accept invitation');
    }
  };

  const handleDecline = async () => {
    if (!declineDialog) return;
    
    try {
      await respondMutation.mutateAsync({
        token: declineDialog.token,
        action: 'decline',
        declineReason: declineReason || undefined,
      });
      toast.success('Invitation declined');
      setDeclineDialog(null);
      setDeclineReason('');
    } catch (error) {
      toast.error('Failed to decline invitation');
    }
  };

  const openDeclineDialog = (
    assignment: typeof pendingInvitations[0]['assignment'],
    event: typeof pendingInvitations[0]['event']
  ) => {
    if (!assignment.invitation_token) {
      toast.error('No invitation token found');
      return;
    }
    
    setDeclineDialog({
      open: true,
      assignmentId: assignment.id,
      token: assignment.invitation_token,
      eventName: event.name,
      date: event.date,
      role: assignment.role,
    });
  };

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  if (authLoading || eventsLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const hasPendingInvitations = pendingInvitations.length > 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-3xl font-bold">Invitations</h1>
        <p className="text-muted-foreground">
          Respond to service invitations
        </p>
      </div>

      {/* Pending Invitations */}
      <Card className={cn(hasPendingInvitations && "border-amber-200 bg-amber-50/50")}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Pending Invitations
            {hasPendingInvitations && (
              <Badge variant="secondary" className="ml-2">
                {pendingInvitations.length}
              </Badge>
            )}
          </CardTitle>
          <CardDescription>
            {hasPendingInvitations 
              ? "Please respond to these invitations"
              : "No pending invitations"}
          </CardDescription>
        </CardHeader>
        {hasPendingInvitations && (
          <CardContent>
            <div className="space-y-3">
              {pendingInvitations.map(({ assignment, event }) => (
                <div
                  key={assignment.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-background rounded-lg border"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">
                        {format(parseISO(event.date), 'EEEE, MMMM d, yyyy')}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                      <span>{event.name}</span>
                      <span>•</span>
                      <span>{formatTime(event.start_time)}</span>
                      <span>•</span>
                      <Badge variant="outline">
                        {ROLE_LABELS[assignment.role as keyof typeof ROLE_LABELS] || assignment.role}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => handleAccept(assignment)}
                      disabled={respondMutation.isPending}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      <CheckCircle className="h-4 w-4 mr-1" />
                      Accept
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => openDeclineDialog(assignment, event)}
                      disabled={respondMutation.isPending}
                    >
                      <XCircle className="h-4 w-4 mr-1" />
                      Decline
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        )}
      </Card>

      {/* Decline Dialog */}
      <AlertDialog open={!!declineDialog} onOpenChange={(open) => !open && setDeclineDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Decline Invitation</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to decline this invitation?
              {declineDialog && (
                <div className="mt-2 p-3 bg-muted rounded-md text-sm">
                  <p><strong>{declineDialog.eventName}</strong></p>
                  <p>{format(parseISO(declineDialog.date), 'EEEE, MMMM d, yyyy')}</p>
                  <p>{ROLE_LABELS[declineDialog.role as keyof typeof ROLE_LABELS] || declineDialog.role}</p>
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-2">
            <Textarea
              placeholder="Reason for declining (optional)..."
              value={declineReason}
              onChange={(e) => setDeclineReason(e.target.value)}
              rows={3}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDecline}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Decline Invitation
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Invitations;