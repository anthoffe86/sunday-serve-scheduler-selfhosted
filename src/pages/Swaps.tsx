import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { ArrowLeftRight, Check, X, Clock, Loader2, Calendar, User, ArrowRight, Gift } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RoleBadge } from '@/components/RoleBadge';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import {
  useSwapRequests,
  useCancelSwapRequest,
  useOfferSwap,
  useConfirmSwap,
  useUserAssignmentsForSwap,
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ROLE_LABELS, Role } from '@/types';

const Swaps = () => {
  const { user } = useAuth();
  const { data: swapRequests, isLoading } = useSwapRequests();
  const { data: userAssignments, isLoading: assignmentsLoading } = useUserAssignmentsForSwap();
  const cancelSwap = useCancelSwapRequest();
  const offerSwap = useOfferSwap();
  const confirmSwap = useConfirmSwap();

  const [offerDialogOpen, setOfferDialogOpen] = useState(false);
  const [selectedSwapRequest, setSelectedSwapRequest] = useState<SwapRequestWithDetails | null>(null);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string>('');

  // Separate requests by type
  const myRequests = swapRequests?.filter((s) => s.from_user_id === user?.id) || [];
  const myRequestsWithOffers = myRequests.filter((s) => s.offered_assignment && s.status === 'pending');
  const myRequestsPending = myRequests.filter((s) => !s.offered_assignment || s.status !== 'pending');
  
  // Swaps where I made an offer (to_user_id is me, and there's an offered_assignment)
  const myOfferedSwaps = swapRequests?.filter(
    (s) => s.to_user_id === user?.id && s.offered_assignment && s.status === 'pending'
  ) || [];
  
  const incomingRequests = swapRequests?.filter(
    (s) => s.from_user_id !== user?.id && s.status === 'pending' && !s.to_user_id
  ) || [];

  const getStatusBadge = (status: string, hasOffer?: boolean) => {
    if (hasOffer && status === 'pending') {
      return (
        <Badge variant="outline" className="gap-1 border-amber-500 text-amber-600">
          <Gift className="h-3 w-3" />
          Offer Pending
        </Badge>
      );
    }
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

  const handleOpenOfferDialog = (swap: SwapRequestWithDetails) => {
    setSelectedSwapRequest(swap);
    setSelectedAssignmentId('');
    setOfferDialogOpen(true);
  };

  const handleSubmitOffer = () => {
    if (!selectedSwapRequest || !selectedAssignmentId) return;
    
    offerSwap.mutate({
      swapRequestId: selectedSwapRequest.id,
      offeredAssignmentId: selectedAssignmentId,
    }, {
      onSuccess: () => {
        setOfferDialogOpen(false);
        setSelectedSwapRequest(null);
        setSelectedAssignmentId('');
      },
    });
  };

  const handleConfirmSwap = (swap: SwapRequestWithDetails, accept: boolean) => {
    confirmSwap.mutate({
      swapRequestId: swap.id,
      accept,
    });
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
    showOfferDetails = false,
  }: {
    swap: SwapRequestWithDetails;
    isMyRequest: boolean;
    showOfferDetails?: boolean;
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
              {getStatusBadge(swap.status, !!swap.offered_assignment)}
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

            {/* Show offer details for my requests with pending offers */}
            {showOfferDetails && swap.offered_assignment && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-3">
                <p className="text-sm font-medium text-amber-800 mb-2 flex items-center gap-1">
                  <Gift className="h-4 w-4" />
                  {swap.to_user_name} has offered to swap:
                </p>
                <div className="bg-white rounded p-2 text-sm">
                  <div className="flex items-center gap-2 mb-1">
                    <RoleBadge role={swap.offered_assignment.role as Role} />
                  </div>
                  <p className="font-medium">{swap.offered_assignment.event_name}</p>
                  <p className="text-muted-foreground">
                    {format(parseISO(swap.offered_assignment.event_date), 'EEE, MMM d, yyyy')} at{' '}
                    {formatTime(swap.offered_assignment.event_start_time)}
                  </p>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-2 mt-2">
              {isMyRequest ? (
                swap.offered_assignment && swap.status === 'pending' ? (
                  // Show accept/reject offer buttons
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
                            <p className="mb-4">
                              You will swap assignments with {swap.to_user_name}:
                            </p>
                            <div className="space-y-2 text-left">
                              <div className="flex items-center gap-2 p-2 bg-red-50 rounded">
                                <span className="text-red-600 font-medium">You give:</span>
                                <span>{swap.event_name} ({ROLE_LABELS[swap.role as Role]})</span>
                              </div>
                              <div className="flex justify-center">
                                <ArrowLeftRight className="h-4 w-4 text-muted-foreground" />
                              </div>
                              <div className="flex items-center gap-2 p-2 bg-green-50 rounded">
                                <span className="text-green-600 font-medium">You receive:</span>
                                <span>
                                  {swap.offered_assignment?.event_name} (
                                  {ROLE_LABELS[swap.offered_assignment?.role as Role]})
                                </span>
                              </div>
                            </div>
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleConfirmSwap(swap, true)}
                            disabled={confirmSwap.isPending}
                          >
                            {confirmSwap.isPending ? 'Processing...' : 'Confirm Swap'}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleConfirmSwap(swap, false)}
                      disabled={confirmSwap.isPending}
                    >
                      <X className="h-4 w-4 mr-1" />
                      Decline Offer
                    </Button>
                  </>
                ) : swap.status === 'pending' ? (
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
                ) : null
              ) : (
                <Button size="sm" className="gap-1" onClick={() => handleOpenOfferDialog(swap)}>
                  <ArrowLeftRight className="h-4 w-4" />
                  Offer to Swap
                </Button>
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

      {/* Pending Offers to Review */}
      {myRequestsWithOffers.length > 0 && (
        <div className="space-y-4">
          <h2 className="font-serif text-xl font-semibold flex items-center gap-2">
            <Gift className="h-5 w-5 text-amber-500" />
            Swap Offers to Review
          </h2>
          <p className="text-sm text-muted-foreground">
            Another volunteer has offered to swap with you - review and accept or decline
          </p>
          <div className="grid gap-4">
            {myRequestsWithOffers.map((swap) => (
              <SwapCard key={swap.id} swap={swap} isMyRequest={true} showOfferDetails={true} />
            ))}
          </div>
        </div>
      )}

      {/* Incoming Requests */}
      {incomingRequests.length > 0 && (
        <div className="space-y-4">
          <h2 className="font-serif text-xl font-semibold flex items-center gap-2">
            <ArrowLeftRight className="h-5 w-5 text-primary" />
            Available Swaps
          </h2>
          <p className="text-sm text-muted-foreground">
            Other volunteers are looking for someone to swap with - offer one of your assignments
          </p>
          <div className="grid gap-4">
            {incomingRequests.map((swap) => (
              <SwapCard key={swap.id} swap={swap} isMyRequest={false} />
            ))}
          </div>
        </div>
      )}

      {/* My Offered Swaps - swaps where I've made an offer and waiting for response */}
      {myOfferedSwaps.length > 0 && (
        <div className="space-y-4">
          <h2 className="font-serif text-xl font-semibold flex items-center gap-2">
            <Gift className="h-5 w-5 text-blue-500" />
            My Pending Offers
          </h2>
          <p className="text-sm text-muted-foreground">
            You've offered to swap - waiting for the other volunteer to respond
          </p>
          <div className="grid gap-4">
            {myOfferedSwaps.map((swap) => (
              <Card key={swap.id} className="overflow-hidden">
                <CardContent className="p-0">
                  <div className="flex">
                    {/* Date Block */}
                    <div className="flex flex-col items-center justify-center px-4 py-4 min-w-[72px] bg-blue-50">
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
                        <Badge variant="outline" className="gap-1 border-blue-500 text-blue-600">
                          <Clock className="h-3 w-3" />
                          Offer Sent
                        </Badge>
                      </div>

                      <h3 className="font-serif text-lg font-semibold mb-1">{swap.event_name}</h3>

                      <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground mb-3">
                        <span className="flex items-center gap-1.5">
                          <Clock className="h-4 w-4" />
                          {formatTime(swap.event_start_time)}
                        </span>
                        <span className="flex items-center gap-1.5">
                          <User className="h-4 w-4" />
                          Requested by <span className="font-medium text-foreground">{swap.from_user_name}</span>
                        </span>
                      </div>

                      {/* Show what I offered */}
                      {swap.offered_assignment && (
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                          <p className="text-sm font-medium text-blue-800 mb-2">You offered:</p>
                          <div className="bg-white rounded p-2 text-sm">
                            <div className="flex items-center gap-2 mb-1">
                              <RoleBadge role={swap.offered_assignment.role as Role} />
                            </div>
                            <p className="font-medium">{swap.offered_assignment.event_name}</p>
                            <p className="text-muted-foreground">
                              {format(parseISO(swap.offered_assignment.event_date), 'EEE, MMM d, yyyy')} at{' '}
                              {formatTime(swap.offered_assignment.event_start_time)}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* My Requests */}
      <div className="space-y-4">
        <h2 className="font-serif text-xl font-semibold">My Swap Requests</h2>
        <div className="grid gap-4">
          {myRequestsPending.length > 0 ? (
            myRequestsPending.map((swap) => <SwapCard key={swap.id} swap={swap} isMyRequest={true} />)
          ) : myRequestsWithOffers.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <ArrowLeftRight className="mb-4 h-12 w-12 text-muted-foreground/50" />
                <h3 className="mb-1 font-serif text-lg font-semibold">No Swap Requests</h3>
                <p className="text-sm text-muted-foreground">
                  You can request a swap from your assignments on the Schedule page.
                </p>
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>

      {/* Offer Assignment Dialog */}
      <Dialog open={offerDialogOpen} onOpenChange={setOfferDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Offer to Swap</DialogTitle>
            <DialogDescription>
              Select one of your assignments to offer in exchange for {selectedSwapRequest?.from_user_name}'s assignment.
            </DialogDescription>
          </DialogHeader>

          {selectedSwapRequest && (
            <div className="space-y-4">
              <div className="bg-muted/50 rounded-lg p-3">
                <p className="text-sm font-medium mb-1">You will receive:</p>
                <div className="flex items-center gap-2">
                  <RoleBadge role={selectedSwapRequest.role as Role} />
                  <span>{selectedSwapRequest.event_name}</span>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  {format(parseISO(selectedSwapRequest.event_date), 'EEE, MMM d, yyyy')} at{' '}
                  {formatTime(selectedSwapRequest.event_start_time)}
                </p>
              </div>

              <div className="flex items-center justify-center">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <ArrowRight className="h-4 w-4" />
                  <ArrowLeftRight className="h-5 w-5" />
                  <ArrowRight className="h-4 w-4 rotate-180" />
                </div>
              </div>

              <div>
                <p className="text-sm font-medium mb-2">Select assignment to offer:</p>
                {assignmentsLoading ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="h-5 w-5 animate-spin" />
                  </div>
                ) : userAssignments && userAssignments.length > 0 ? (
                  <Select value={selectedAssignmentId} onValueChange={setSelectedAssignmentId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose an assignment..." />
                    </SelectTrigger>
                    <SelectContent>
                      {userAssignments.map((assignment) => (
                        <SelectItem key={assignment!.id} value={assignment!.id}>
                          <div className="flex flex-col">
                            <span className="font-medium">
                              {ROLE_LABELS[assignment!.role as Role] || assignment!.role} - {assignment!.event_name}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {format(parseISO(assignment!.event_date), 'EEE, MMM d')} at{' '}
                              {formatTime(assignment!.event_start_time)}
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <p className="text-sm text-muted-foreground py-4 text-center">
                    You don't have any upcoming assignments to offer.
                  </p>
                )}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setOfferDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmitOffer}
              disabled={!selectedAssignmentId || offerSwap.isPending}
            >
              {offerSwap.isPending ? 'Submitting...' : 'Submit Offer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Swaps;
