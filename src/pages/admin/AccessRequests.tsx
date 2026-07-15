import { Navigate } from 'react-router-dom';
import { Loader2, ClipboardList, Trash2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
import { useAuth } from '@/hooks/useAuth';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { useState } from 'react';

interface AccessRequest {
  id: string;
  name: string;
  organisation_name: string;
  email: string;
  notes: string | null;
  status: string;
  created_at: string;
}

const AccessRequests = () => {
  const { isAdmin, isLoading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const [deleteTarget, setDeleteTarget] = useState<AccessRequest | null>(null);

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

  const deleteRequest = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('access_requests')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['access-requests'] });
      toast.success('Enquiry deleted');
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to delete enquiry');
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

  const sorted = requests ?? [];

  const handleDelete = () => {
    if (!deleteTarget) return;
    deleteRequest.mutate(deleteTarget.id, {
      onSuccess: () => {
        setDeleteTarget(null);
      },
    });
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-serif text-2xl sm:text-3xl font-bold">Info & Demo Enquiries</h1>
        <p className="text-sm sm:text-base text-muted-foreground">
          Organisations that want more information and a demo. Review what was submitted and remove enquiries once they are no longer needed.
        </p>
      </div>

      {sorted.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <ClipboardList className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="font-medium">No info/demo enquiries yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              Enquiries submitted from the landing page will appear here.
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
                  <div className="flex items-center gap-2 self-start">
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => setDeleteTarget(req)}
                      aria-label={`Delete enquiry from ${req.organisation_name}`}
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      Delete
                    </Button>
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

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete enquiry?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the enquiry from {deleteTarget?.organisation_name}.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteRequest.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleteRequest.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteRequest.isPending ? 'Deleting...' : 'Delete enquiry'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AccessRequests;
