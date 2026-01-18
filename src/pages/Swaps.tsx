import { format, parseISO } from 'date-fns';
import { ArrowLeftRight, Check, X, Clock, Loader2, Calendar, User } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RoleBadge } from '@/components/RoleBadge';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import {
  useSwapRequests,
  useAcceptSwapRequest,
  useCancelSwapRequest,
  SwapRequestWithDetails,
} from '@/hooks/useSwapRequests';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { ROLE_LABELS, Role } from '@/types';

const Swaps = () => {
  const { user } = useAuth();
  const { data: swapRequests, isLoading } = useSwapRequests();
  const acceptSwap = useAcceptSwapRequest();
  const cancelSwap = useCancelSwapRequest();

  // Separate my requests from incoming requests
  const myRequests = swapRequests?.filter((s) => s.from_user_id === user?.id) || [];
  const incomingRequests =
    swapRequests?.filter(
      (s) => s.from_user_id !== user?.id && s.status === 'pending'
    ) || [];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return (
          <Badge variant="outline" className="gap-1 border-status-pending text-status-pending">
            <Clock className="h-3 w-3" />
            Pending
          </Badge>
        );
      case 'approved':
        return (
          <Badge variant="outline" className="gap-1 border-status-available text-status-available">
            <Check className="h-3 w-3" />
            Approved
          </Badge>
        );
      case 'denied':
        return (
          <Badge variant="outline" className="gap-1 border-status-unavailable text-status-unavailable">
            <X className="h-3 w-3" />
            Denied
          </Badge>
        );
      default:
        return null;
    }
  };

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  const handleAccept = (swapRequest: SwapRequestWithDetails) => {
    acceptSwap.mutate(swapRequest.id);
  };

  const handleCancel = (swapRequest: SwapRequestWithDetails) => {
    cancelSwap.mutate(swapRequest.id);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const SwapCard = ({
    swap,
    isMyRequest,
  }: {
    swap: SwapRequestWithDetails;
    isMyRequest: boolean;
  }) => (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        <div className="flex">
          {/* Date Block */}
          <div
            className={cn(
              'flex flex-col items-center justify-center px-4 py-4 min-w-[72px]',
              isMyRequest ? 'bg-primary/10' : 'bg-secondary'
            )}
          >
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {format(parseISO(swap.event_date), 'EEE')}
            </span>
            <span className="text-2xl font-bold">{format(parseISO(swap.event_date), 'd')}</span>
            <span className="text-xs text-muted-foreground">
              {format(parseISO(swap.event_date), 'MMM')}
            </span>
          </div>

          {/* Content */}
          <div className="flex-1 p-4">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <RoleBadge role={swap.role as Role} />
              {getStatusBadge(swap.status)}
            </div>

            <h3 className="font-serif text-lg font-semibold mb-1">{swap.event_name}</h3>

            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground mb-3">
              <span className="flex items-center gap-1.5">
                <Clock className="h-4 w-4" />
                {formatTime(swap.event_start_time)}
              </span>
              <span className="flex items-center gap-1.5">
                <User className="h-4 w-4" />
                {isMyRequest ? (
                  <>Requested by you</>
                ) : (
                  <>
                    From <span className="font-medium text-foreground">{swap.from_user_name}</span>
                  </>
                )}
              </span>
            </div>

            {swap.notes && (
              <p className="text-sm text-muted-foreground bg-muted/50 rounded-md p-2 mb-3">
                "{swap.notes}"
              </p>
            )}

            {/* Actions */}
            <div className="flex items-center gap-2 mt-2">
              {isMyRequest ? (
                swap.status === 'pending' && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                      >
                        Cancel Request
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Cancel Swap Request?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will cancel your swap request for {swap.event_name} on{' '}
                          {format(parseISO(swap.event_date), 'MMMM d, yyyy')}.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Keep Request</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => handleCancel(swap)}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Cancel Request
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )
              ) : (
                <>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="sm" className="gap-1">
                        <Check className="h-4 w-4" />
                        Accept Swap
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Accept This Swap?</AlertDialogTitle>
                        <AlertDialogDescription>
                          You will take over {swap.from_user_name}'s assignment as{' '}
                          {ROLE_LABELS[swap.role as Role] || swap.role} for {swap.event_name} on{' '}
                          {format(parseISO(swap.event_date), 'MMMM d, yyyy')} at{' '}
                          {formatTime(swap.event_start_time)}.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => handleAccept(swap)}
                          disabled={acceptSwap.isPending}
                        >
                          {acceptSwap.isPending ? 'Accepting...' : 'Accept Swap'}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-serif text-3xl font-bold">Swap Requests</h1>
        <p className="text-muted-foreground">
          Request to swap your assigned role with another volunteer
        </p>
      </div>

      {/* Incoming Requests */}
      {incomingRequests.length > 0 && (
        <div className="space-y-4">
          <h2 className="font-serif text-xl font-semibold flex items-center gap-2">
            <ArrowLeftRight className="h-5 w-5 text-primary" />
            Available Swaps
          </h2>
          <p className="text-sm text-muted-foreground">
            Other volunteers are looking for someone to cover these assignments
          </p>
          <div className="grid gap-4">
            {incomingRequests.map((swap) => (
              <SwapCard key={swap.id} swap={swap} isMyRequest={false} />
            ))}
          </div>
        </div>
      )}

      {/* My Requests */}
      <div className="space-y-4">
        <h2 className="font-serif text-xl font-semibold">My Swap Requests</h2>
        <div className="grid gap-4">
          {myRequests.length > 0 ? (
            myRequests.map((swap) => <SwapCard key={swap.id} swap={swap} isMyRequest={true} />)
          ) : (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <ArrowLeftRight className="mb-4 h-12 w-12 text-muted-foreground/50" />
                <h3 className="mb-1 font-serif text-lg font-semibold">No Swap Requests</h3>
                <p className="text-sm text-muted-foreground">
                  You can request a swap from your assignments on the Schedule page.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default Swaps;
