import { useState, useMemo } from 'react';
import { Search, CheckCircle2, XCircle, Users, AlertTriangle, UserCheck } from 'lucide-react';
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
  existingAssignmentIds: string[]; // user_ids already assigned to this role
  allEventAssignmentIds?: string[]; // user_ids assigned to ANY role on this event
  onAssigned?: (volunteer: Profile) => void; // callback after successful assignment
}

// Hook to get all active volunteers with their role preferences
function useAllVolunteersWithPreferences(role: string) {
  return useQuery({
    queryKey: ['all-volunteers-with-preferences', role],
    queryFn: async () => {
      // Get all active profiles
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .eq('active', true)
        .order('name');

      if (profilesError) throw profilesError;

      // Get role preferences for this specific role
      const { data: rolePrefs, error: prefsError } = await supabase
        .from('role_preferences')
        .select('user_id')
        .eq('role', role as any);

      if (prefsError) throw prefsError;

      const usersWithPreference = new Set(rolePrefs?.map((p) => p.user_id) || []);

      return {
        profiles: profiles as Profile[],
        usersWithPreference,
      };
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
  allEventAssignmentIds = [],
  onAssigned,
}: AssignVolunteerDialogProps) {
  const [search, setSearch] = useState('');
  const assignVolunteer = useAssignVolunteer();

  // Get all volunteers with their preferences
  const { data: volunteerData, isLoading: profilesLoading } = useAllVolunteersWithPreferences(role);
  const { data: availabilityData, isLoading: availabilityLoading } = useAvailabilityForDate(eventDate);

  const isLoading = profilesLoading || availabilityLoading;

  // Build a map of user_id -> availability status (undefined = available, false = unavailable)
  const unavailableUserIds = new Set(
    (availabilityData || []).filter((a) => a.available === false).map((a) => a.user_id)
  );

  // Filter and categorize volunteers
  const categorizedProfiles = useMemo(() => {
    if (!volunteerData?.profiles) return { preferred: [], other: [] };

    const { profiles, usersWithPreference } = volunteerData;

    // Filter out volunteers already assigned to THIS ROLE and apply search
    const filtered = profiles.filter(
      (p) =>
        !existingAssignmentIds.includes(p.user_id) &&
        (p.name.toLowerCase().includes(search.toLowerCase()) ||
          p.email.toLowerCase().includes(search.toLowerCase()))
    );

    // Separate into preferred (has role preference) and other
    const preferred = filtered.filter((p) => usersWithPreference.has(p.user_id));
    const other = filtered.filter((p) => !usersWithPreference.has(p.user_id));

    // Sort each group: available first, then by name
    const sortFn = (a: Profile, b: Profile) => {
      const aUnavailable = unavailableUserIds.has(a.user_id);
      const bUnavailable = unavailableUserIds.has(b.user_id);
      if (aUnavailable !== bUnavailable) return aUnavailable ? 1 : -1;
      return a.name.localeCompare(b.name);
    };

    return {
      preferred: preferred.sort(sortFn),
      other: other.sort(sortFn),
    };
  }, [volunteerData, existingAssignmentIds, search, unavailableUserIds]);

  const handleAssign = async (volunteerId: string, volunteerProfile?: Profile) => {
    // If onAssigned callback is provided, use it (batch mode)
    if (onAssigned) {
      if (volunteerProfile) {
        onAssigned(volunteerProfile);
      }
      onOpenChange(false);
      return;
    }

    try {
      await assignVolunteer.mutateAsync({
        event_id: eventId,
        role,
        volunteer_id: volunteerId,
      });
      toast.success('Volunteer assigned');
      setSearch('');
      onOpenChange(false);
    } catch (error: any) {
      if (error?.code === '23505') {
        toast.error('Volunteer already assigned to this role');
      } else {
        toast.error('Failed to assign volunteer');
      }
    }
  };

  const totalProfiles = volunteerData?.profiles?.length || 0;
  const allAssignmentSet = new Set(allEventAssignmentIds);

  const renderVolunteerButton = (profile: Profile, hasPreference: boolean) => {
    const isUnavailable = unavailableUserIds.has(profile.user_id);
    const isAssignedElsewhere = allAssignmentSet.has(profile.user_id) && !existingAssignmentIds.includes(profile.user_id);

    return (
      <button
        key={profile.id}
        onClick={() => handleAssign(profile.user_id, profile)}
        disabled={assignVolunteer.isPending}
        className={cn(
          "w-full flex items-center gap-3 p-3 rounded-lg border hover:bg-accent transition-colors text-left",
          isUnavailable && "bg-muted/30 opacity-70"
        )}
      >
        <div className={cn(
          "flex h-9 w-9 items-center justify-center rounded-full text-sm font-medium",
          hasPreference ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
        )}>
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
        <div className="flex flex-col items-end gap-1 shrink-0">
          {isAssignedElsewhere && (
            <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200">
              Assigned
            </Badge>
          )}
          {isUnavailable && (
            <Badge variant="secondary" className="text-xs">
              Unavailable
            </Badge>
          )}
        </div>
      </button>
    );
  };

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
            Showing all active volunteers. Those with this role preference are listed first.
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

        <ScrollArea className="h-[350px] -mx-6 px-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
            </div>
          ) : (categorizedProfiles.preferred.length === 0 && categorizedProfiles.other.length === 0) ? (
            <div className="text-center py-8">
              <Users className="mx-auto h-10 w-10 text-muted-foreground/50 mb-3" />
              <p className="text-sm text-muted-foreground">
                {totalProfiles === 0
                  ? 'No active volunteers found'
                  : search
                    ? 'No volunteers match your search'
                    : 'All volunteers are already assigned to this role'}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {/* Preferred volunteers (have this role preference) */}
              {categorizedProfiles.preferred.length > 0 && (
                <>
                  <div className="flex items-center gap-2">
                    <UserCheck className="h-3.5 w-3.5 text-primary" />
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Preferred for this role ({categorizedProfiles.preferred.length})
                    </p>
                  </div>
                  {categorizedProfiles.preferred.map((profile) => renderVolunteerButton(profile, true))}
                </>
              )}

              {/* Other volunteers (don't have this role preference) */}
              {categorizedProfiles.other.length > 0 && (
                <>
                  <div className="flex items-center gap-2 pt-3">
                    <Users className="h-3.5 w-3.5 text-muted-foreground" />
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Other volunteers ({categorizedProfiles.other.length})
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground mb-2">
                    These volunteers don't have this role in their preferences
                  </p>
                  {categorizedProfiles.other.map((profile) => renderVolunteerButton(profile, false))}
                </>
              )}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
