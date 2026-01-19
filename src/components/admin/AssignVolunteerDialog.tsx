import { useState, useMemo } from 'react';
import { Search, AlertCircle, CheckCircle2, XCircle, Users } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { useAssignVolunteer } from '@/hooks/useEventScheduler';
import { useAvailabilityForDate, useProfiles } from '@/hooks/useVolunteerData';
import { ROLE_LABELS } from '@/types';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';

interface Profile {
  id: string;
  user_id: string;
  name: string;
  email: string;
  active: boolean;
}

interface AssignVolunteerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventId: string;
  eventDate: string;
  role: string;
  existingAssignmentIds: string[]; // user_ids already assigned to this event
  onAssigned?: () => void; // callback after successful assignment
}

// Hook to get volunteers with a specific role preference
function useVolunteersWithRolePreference(role: string) {
  return useQuery({
    queryKey: ['volunteers-with-role', role],
    queryFn: async () => {
      if (!role) return [];
      
      // Get role preferences for this role
      const { data: rolePrefs, error: prefsError } = await supabase
        .from('role_preferences')
        .select('user_id')
        .eq('role', role as any); // Cast to any to handle dynamic role values

      if (prefsError) throw prefsError;

      const userIds = rolePrefs?.map((p) => p.user_id) || [];
      if (userIds.length === 0) return [];

      // Get profiles for these users
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .in('user_id', userIds)
        .eq('active', true)
        .order('name');

      if (profilesError) throw profilesError;
      return profiles as Profile[];
    },
    enabled: !!role,
  });
}

export function AssignVolunteerDialog({
  open,
  onOpenChange,
  eventId,
  eventDate,
  role,
  existingAssignmentIds = [],
  onAssigned,
}: AssignVolunteerDialogProps) {
  const [search, setSearch] = useState('');
  const assignVolunteer = useAssignVolunteer();

  // Get volunteers who have this role in their preferences
  const { data: eligibleProfiles, isLoading: profilesLoading } = useVolunteersWithRolePreference(role);
  const { data: availabilityData, isLoading: availabilityLoading } = useAvailabilityForDate(eventDate);

  const isLoading = profilesLoading || availabilityLoading;

  // Build a map of user_id -> availability status (undefined = available, false = unavailable)
  const unavailableUserIds = new Set(
    (availabilityData || []).filter((a) => a.available === false).map((a) => a.user_id)
  );

  // Filter out already assigned volunteers and apply search
  const filteredProfiles = useMemo(() => {
    if (!eligibleProfiles) return [];

    return eligibleProfiles
      .filter(
        (p) =>
          !existingAssignmentIds.includes(p.user_id) &&
          (p.name.toLowerCase().includes(search.toLowerCase()) ||
            p.email.toLowerCase().includes(search.toLowerCase()))
      )
      .sort((a, b) => {
        // Available volunteers first
        const aUnavailable = unavailableUserIds.has(a.user_id);
        const bUnavailable = unavailableUserIds.has(b.user_id);
        if (aUnavailable !== bUnavailable) return aUnavailable ? 1 : -1;
        return a.name.localeCompare(b.name);
      });
  }, [eligibleProfiles, existingAssignmentIds, search, unavailableUserIds]);

  const availableProfiles = filteredProfiles.filter((p) => !unavailableUserIds.has(p.user_id));
  const unavailableProfiles = filteredProfiles.filter((p) => unavailableUserIds.has(p.user_id));

  const handleAssign = async (volunteerId: string) => {
    try {
      await assignVolunteer.mutateAsync({
        event_id: eventId,
        role,
        volunteer_id: volunteerId,
      });
      toast.success('Volunteer assigned');
      setSearch('');
      onAssigned?.();
      onOpenChange(false);
    } catch (error: any) {
      if (error?.code === '23505') {
        toast.error('Volunteer already assigned to this role');
      } else {
        toast.error('Failed to assign volunteer');
      }
    }
  };

  const totalEligible = eligibleProfiles?.length || 0;
  const alreadyAssigned = existingAssignmentIds.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-serif">Assign Volunteer</DialogTitle>
          <DialogDescription>
            Select a volunteer to assign as {ROLE_LABELS[role as keyof typeof ROLE_LABELS] || role}
          </DialogDescription>
        </DialogHeader>

        {/* Info bar */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-md p-2">
          <Users className="h-3.5 w-3.5" />
          <span>
            Showing volunteers with <strong>{ROLE_LABELS[role as keyof typeof ROLE_LABELS] || role}</strong> in their preferences
          </span>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search volunteers..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <ScrollArea className="h-[300px] -mx-6 px-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
            </div>
          ) : filteredProfiles.length === 0 ? (
            <div className="text-center py-8">
              <Users className="mx-auto h-10 w-10 text-muted-foreground/50 mb-3" />
              <p className="text-sm text-muted-foreground">
                {totalEligible === 0
                  ? 'No volunteers have this role in their preferences'
                  : search
                    ? 'No volunteers match your search'
                    : 'All eligible volunteers are already assigned'}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {availableProfiles.length > 0 && (
                <>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-3.5 w-3.5 text-status-available" />
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Available ({availableProfiles.length})
                    </p>
                  </div>
                  {availableProfiles.map((profile) => (
                    <button
                      key={profile.id}
                      onClick={() => handleAssign(profile.user_id)}
                      disabled={assignVolunteer.isPending}
                      className="w-full flex items-center gap-3 p-3 rounded-lg border hover:bg-accent transition-colors text-left"
                    >
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-sm font-medium text-primary">
                        {profile.name
                          .split(' ')
                          .map((n) => n[0])
                          .join('')
                          .slice(0, 2)
                          .toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{profile.name}</p>
                        <p className="text-sm text-muted-foreground truncate">{profile.email}</p>
                      </div>
                    </button>
                  ))}
                </>
              )}

              {unavailableProfiles.length > 0 && (
                <>
                  <div className="flex items-center gap-2 pt-3">
                    <XCircle className="h-3.5 w-3.5 text-status-unavailable" />
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Marked Unavailable ({unavailableProfiles.length})
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground mb-2">
                    These volunteers marked themselves unavailable on this date
                  </p>
                  {unavailableProfiles.map((profile) => (
                    <button
                      key={profile.id}
                      onClick={() => handleAssign(profile.user_id)}
                      disabled={assignVolunteer.isPending}
                      className="w-full flex items-center gap-3 p-3 rounded-lg border bg-muted/30 hover:bg-accent transition-colors text-left opacity-70"
                    >
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-sm font-medium text-muted-foreground">
                        {profile.name
                          .split(' ')
                          .map((n) => n[0])
                          .join('')
                          .slice(0, 2)
                          .toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{profile.name}</p>
                        <p className="text-sm text-muted-foreground truncate">{profile.email}</p>
                      </div>
                      <Badge variant="secondary" className="text-xs shrink-0">
                        Unavailable
                      </Badge>
                    </button>
                  ))}
                </>
              )}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
