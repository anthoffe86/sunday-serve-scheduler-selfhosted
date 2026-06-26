import { Navigate } from 'react-router-dom';
import { Loader2, ClipboardList } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/hooks/useAuth';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';

type AccessRequestStatus = 'pending' | 'contacted' | 'approved' | 'rejected';

interface AccessRequest {
  id: string;
  name: string;
  organisation_name: string;
  email: string;
  notes: string | null;
  status: AccessRequestStatus;
  created_at: string;
}

const STATUS_BADGE: Record<AccessRequestStatus, string> = {
  pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  contacted: 'bg-blue-100 text-blue-800 border-blue-200',
  approved: 'bg-green-100 text-green-800 border-green-200',
  rejected: 'bg-red-100 text-red-800 border-red-200',
};

const AccessRequests = () => {
  const { isAdmin, isLoading: authLoading } = useAuth();
  const queryClient = useQueryClient();

  const { data: requests, isLoading } = useQuery({
    queryKey: ['access-requests'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('access_requests')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as AccessRequest[];
    },
    enabled: !!isAdmin,
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: AccessRequestStatus }) => {
      const { error } = await supabase
        .from('access_requests')
        .update({ status })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['access-requests'] });
      toast.success('Status updated');
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to update status');
    },
  });

  if (authLoading || isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  const pending = requests?.filter((r) => r.status === 'pending') ?? [];
  const others = requests?.filter((r) => r.status !== 'pending') ?? [];
  const sorted = [...pending, ...others];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-serif text-2xl sm:text-3xl font-bold">Access Requests</h1>
        <p className="text-sm sm:text-base text-muted-foreground">
          Organisations that have requested access to ServeTogether. Onboard them manually after reviewing.
        </p>
      </div>

      {sorted.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <ClipboardList className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="font-medium">No access requests yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              Requests submitted from the landing page will appear here.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {sorted.map((req) => (
            <Card key={req.id} className="overflow-hidden">
              <CardHeader className="pb-3">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                  <div>
                    <CardTitle className="font-serif text-lg">{req.organisation_name}</CardTitle>
                    <CardDescription className="mt-1">
                      {req.name} · <a href={`mailto:${req.email}`} className="hover:underline text-primary">{req.email}</a>
                    </CardDescription>
                    <p className="text-xs text-muted-foreground mt-1">
                      {format(new Date(req.created_at), 'd MMM yyyy, HH:mm')}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="outline"
                      className={`capitalize ${STATUS_BADGE[req.status]}`}
                    >
                      {req.status}
                    </Badge>
                    <Select
                      value={req.status}
                      onValueChange={(val) =>
                        updateStatus.mutate({ id: req.id, status: val as AccessRequestStatus })
                      }
                      disabled={updateStatus.isPending}
                    >
                      <SelectTrigger className="w-36 h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="contacted">Contacted</SelectItem>
                        <SelectItem value="approved">Approved</SelectItem>
                        <SelectItem value="rejected">Rejected</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              {req.notes && (
                <CardContent className="pt-0">
                  <p className="text-sm text-muted-foreground italic border-l-2 border-muted pl-3">
                    {req.notes}
                  </p>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default AccessRequests;
