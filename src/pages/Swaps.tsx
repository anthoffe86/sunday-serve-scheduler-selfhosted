import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { ArrowLeftRight, Check, X, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { mockSwapRequests, currentUser } from '@/data/mockData';
import { RoleBadge } from '@/components/RoleBadge';
import { cn } from '@/lib/utils';

const Swaps = () => {
  const mySwapRequests = mockSwapRequests.filter(
    (s) => s.fromVolunteerId === currentUser.id || s.toVolunteerId === currentUser.id
  );

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-3xl font-bold">Swap Requests</h1>
        <p className="text-muted-foreground">
          Request to swap your assigned role with another volunteer
        </p>
      </div>

      <div className="grid gap-4">
        {mySwapRequests.length > 0 ? (
          mySwapRequests.map((swap) => {
            const isFromMe = swap.fromVolunteerId === currentUser.id;
            return (
              <Card key={swap.id} className="overflow-hidden">
                <CardContent className="p-5">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <RoleBadge role={swap.role} />
                        <span className="text-sm text-muted-foreground">
                          on {format(parseISO(swap.date), 'MMMM d, yyyy')}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <span className={cn(isFromMe && 'font-medium text-primary')}>
                          {isFromMe ? 'You' : swap.fromVolunteerName}
                        </span>
                        <ArrowLeftRight className="h-4 w-4 text-muted-foreground" />
                        <span className={cn(!isFromMe && 'font-medium text-primary')}>
                          {swap.toVolunteerName || 'Anyone available'}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {getStatusBadge(swap.status)}
                      {swap.status === 'pending' && isFromMe && (
                        <Button variant="outline" size="sm" className="text-destructive">
                          Cancel
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        ) : (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <ArrowLeftRight className="mb-4 h-12 w-12 text-muted-foreground/50" />
              <h3 className="mb-1 font-serif text-lg font-semibold">No Swap Requests</h3>
              <p className="text-sm text-muted-foreground">
                You can request a swap from your assignments on the Dashboard.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default Swaps;
