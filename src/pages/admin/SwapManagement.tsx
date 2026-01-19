import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import {
  ArrowLeftRight,
  Check,
  X,
  Clock,
  Loader2,
  Calendar,
  User,
  Search,
  UserCheck,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { RoleBadge } from '@/components/RoleBadge';
import {
  useAdminSwapRequests,
  useAdminAcceptSwapRequest,
  useAdminCancelSwapRequest,
  AdminSwapRequestWithDetails,
  EligibleVolunteer,
} from '@/hooks/useAdminSwapRequests';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { ROLE_LABELS, Role } from '@/types';

const SwapManagement = () => {
  const { data: swapRequests, isLoading } = useAdminSwapRequests();
  const acceptSwap = useAdminAcceptSwapRequest();
  const cancelSwap = useAdminCancelSwapRequest();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('pending');
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [selectedSwap, setSelectedSwap] = useState<AdminSwapRequestWithDetails | null>(null);
  const [selectedVolunteer, setSelectedVolunteer] = useState<string>('');

  const filteredRequests = swapRequests?.filter((swap) => {
    const matchesStatus = statusFilter === 'all' || swap.status === statusFilter;
    const matchesSearch =
      searchQuery === '' ||
      swap.from_user_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      swap.event_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (swap.to_user_name?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false);
    return matchesStatus && matchesSearch;
  }) || [];

  const pendingCount = swapRequests?.filter((s) => s.status === 'pending').length || 0;

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

  const handleOpenAssignDialog = (swap: AdminSwapRequestWithDetails) => {
    setSelectedSwap(swap);
    setSelectedVolunteer('');
    setAssignDialogOpen(true);
  };

  const handleAcceptSwap = () => {
    if (selectedSwap && selectedVolunteer) {
      acceptSwap.mutate(
        { swapRequestId: selectedSwap.id, targetUserId: selectedVolunteer },
        {
          onSuccess: () => {
            setAssignDialogOpen(false);
            setSelectedSwap(null);
            setSelectedVolunteer('');
          },
        }
      );
    }
  };

  const handleCancelSwap = (swapId: string) => {
    cancelSwap.mutate(swapId);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-3xl font-bold">Swap Requests</h1>
        <p className="text-muted-foreground">
          Manage swap requests and assign volunteers on their behalf
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-4 sm:flex-row">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name or event..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Requests</SelectItem>
            <SelectItem value="pending">
              Pending {pendingCount > 0 && `(${pendingCount})`}
            </SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="denied">Denied</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Stats */}
      <div className="flex gap-4 text-sm">
        <span className="text-muted-foreground">
          Total: <strong className="text-foreground">{swapRequests?.length || 0}</strong>
        </span>
        <span className="text-muted-foreground">
          Pending: <strong className="text-status-pending">{pendingCount}</strong>
        </span>
        <span className="text-muted-foreground">
          Approved:{' '}
          <strong className="text-status-available">
            {swapRequests?.filter((s) => s.status === 'approved').length || 0}
          </strong>
        </span>
      </div>

      {/* Swap Request List */}
      <div className="grid gap-4">
        {filteredRequests.map((swap) => (
          <SwapRequestCard
            key={swap.id}
            swap={swap}
            getStatusBadge={getStatusBadge}
            formatTime={formatTime}
            onAssign={handleOpenAssignDialog}
            onCancel={handleCancelSwap}
          />
        ))}

        {filteredRequests.length === 0 && (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <ArrowLeftRight className="mb-4 h-12 w-12 text-muted-foreground/50" />
              <h3 className="mb-1 font-serif text-lg font-semibold">No Swap Requests</h3>
              <p className="text-sm text-muted-foreground">
                {searchQuery || statusFilter !== 'pending'
                  ? 'No requests match your filters.'
                  : 'There are no pending swap requests.'}
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Assign Volunteer Dialog */}
      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Swap to Volunteer</DialogTitle>
            <DialogDescription>
              Select a volunteer to take over this assignment from {selectedSwap?.from_user_name}.
            </DialogDescription>
          </DialogHeader>

          {selectedSwap && (
            <div className="space-y-4 py-4">
              <div className="rounded-lg bg-muted/50 p-3">
                <p className="text-sm">
                  <strong>Event:</strong> {selectedSwap.event_name}
                </p>
                <p className="text-sm">
                  <strong>Date:</strong>{' '}
                  {format(parseISO(selectedSwap.event_date), 'EEEE, MMMM d, yyyy')}
                </p>
                <p className="text-sm">
                  <strong>Role:</strong>{' '}
                  {ROLE_LABELS[selectedSwap.role as Role] || selectedSwap.role}
                </p>
              </div>

              <div className="space-y-2">
                <Label>Select Volunteer</Label>
                <Select value={selectedVolunteer} onValueChange={setSelectedVolunteer}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a volunteer..." />
                  </SelectTrigger>
                  <SelectContent>
                    {selectedSwap.eligible_volunteers.length > 0 ? (
                      selectedSwap.eligible_volunteers.map((vol) => (
                        <SelectItem key={vol.user_id} value={vol.user_id}>
                          {vol.name} ({vol.email})
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="" disabled>
                        No eligible volunteers found
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Only volunteers with the required role preference are shown.
                </p>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleAcceptSwap}
              disabled={!selectedVolunteer || acceptSwap.isPending}
            >
              {acceptSwap.isPending ? 'Assigning...' : 'Assign Volunteer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

interface SwapRequestCardProps {
  swap: AdminSwapRequestWithDetails;
  getStatusBadge: (status: string) => React.ReactNode;
  formatTime: (time: string) => string;
  onAssign: (swap: AdminSwapRequestWithDetails) => void;
  onCancel: (swapId: string) => void;
}

function SwapRequestCard({
  swap,
  getStatusBadge,
  formatTime,
  onAssign,
  onCancel,
}: SwapRequestCardProps) {
  const isPending = swap.status === 'pending';

  return (
    <Card>
      <CardContent className="p-0">
        <div className="flex">
          {/* Date Block */}
          <div className="flex flex-col items-center justify-center px-4 py-4 min-w-[72px] bg-secondary">
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

            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground mb-2">
              <span className="flex items-center gap-1.5">
                <Clock className="h-4 w-4" />
                {formatTime(swap.event_start_time)}
              </span>
              <span className="flex items-center gap-1.5">
                <User className="h-4 w-4" />
                Requested by{' '}
                <span className="font-medium text-foreground">{swap.from_user_name}</span>
              </span>
            </div>

            {swap.to_user_name && (
              <div className="text-sm text-muted-foreground mb-2">
                <span className="flex items-center gap-1.5">
                  <UserCheck className="h-4 w-4 text-status-available" />
                  Assigned to{' '}
                  <span className="font-medium text-foreground">{swap.to_user_name}</span>
                </span>
              </div>
            )}

            {swap.notes && (
              <p className="text-sm text-muted-foreground bg-muted/50 rounded-md p-2 mb-3">
                "{swap.notes}"
              </p>
            )}

            {/* Eligible Volunteers Info */}
            {isPending && (
              <div className="text-xs text-muted-foreground mb-3">
                {swap.eligible_volunteers.length} eligible volunteer
                {swap.eligible_volunteers.length !== 1 && 's'} available
              </div>
            )}

            {/* Actions */}
            {isPending && (
              <div className="flex items-center gap-2 mt-2">
                <Button
                  size="sm"
                  className="gap-1"
                  onClick={() => onAssign(swap)}
                  disabled={swap.eligible_volunteers.length === 0}
                >
                  <UserCheck className="h-4 w-4" />
                  Assign Volunteer
                </Button>

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                    >
                      <X className="h-4 w-4 mr-1" />
                      Cancel
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Cancel Swap Request?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will delete the swap request from {swap.from_user_name} for{' '}
                        {swap.event_name} on {format(parseISO(swap.event_date), 'MMMM d, yyyy')}.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Keep Request</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => onCancel(swap.id)}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Cancel Request
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default SwapManagement;
