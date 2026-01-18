import { useState } from 'react';
import { Search, AlertCircle } from 'lucide-react';
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
import { useAvailabilityForDate } from '@/hooks/useVolunteerData';
import { ROLE_LABELS } from '@/types';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

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
  profiles: Profile[];
}

export function AssignVolunteerDialog({ 
  open, 
  onOpenChange, 
  eventId,
  eventDate,
  role,
  profiles 
}: AssignVolunteerDialogProps) {
  const [search, setSearch] = useState('');
  const assignVolunteer = useAssignVolunteer();
  const { data: availabilityData } = useAvailabilityForDate(eventDate);

  // Build a map of user_id -> availability status (undefined = available, false = unavailable)
  const unavailableUserIds = new Set(
    (availabilityData || [])
      .filter(a => a.available === false)
      .map(a => a.user_id)
  );

  const filteredProfiles = profiles
    .filter(p => p.active && (
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.email.toLowerCase().includes(search.toLowerCase())
    ))
    .sort((a, b) => {
      // Available volunteers first
      const aUnavailable = unavailableUserIds.has(a.user_id);
      const bUnavailable = unavailableUserIds.has(b.user_id);
      if (aUnavailable !== bUnavailable) return aUnavailable ? 1 : -1;
      return a.name.localeCompare(b.name);
    });

  const availableProfiles = filteredProfiles.filter(p => !unavailableUserIds.has(p.user_id));
  const unavailableProfiles = filteredProfiles.filter(p => unavailableUserIds.has(p.user_id));

  const handleAssign = async (volunteerId: string) => {
    try {
      await assignVolunteer.mutateAsync({
        event_id: eventId,
        role,
        volunteer_id: volunteerId,
      });
      toast.success('Volunteer assigned');
      onOpenChange(false);
      setSearch('');
    } catch (error: any) {
      if (error?.code === '23505') {
        toast.error('Volunteer already assigned to this role');
      } else {
        toast.error('Failed to assign volunteer');
      }
    }
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
          {filteredProfiles.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No volunteers found
            </p>
          ) : (
            <div className="space-y-2">
              {availableProfiles.length > 0 && (
                <>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Available ({availableProfiles.length})
                  </p>
                  {availableProfiles.map((profile) => (
                    <button
                      key={profile.id}
                      onClick={() => handleAssign(profile.user_id)}
                      disabled={assignVolunteer.isPending}
                      className="w-full flex items-center gap-3 p-3 rounded-lg border hover:bg-accent transition-colors text-left"
                    >
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-sm font-medium text-primary">
                        {profile.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
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
                    <AlertCircle className="h-3.5 w-3.5 text-muted-foreground" />
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Unavailable ({unavailableProfiles.length})
                    </p>
                  </div>
                  {unavailableProfiles.map((profile) => (
                    <div
                      key={profile.id}
                      className="w-full flex items-center gap-3 p-3 rounded-lg border bg-muted/50 text-left opacity-60 cursor-not-allowed"
                    >
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-sm font-medium text-muted-foreground">
                        {profile.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{profile.name}</p>
                        <p className="text-sm text-muted-foreground truncate">{profile.email}</p>
                      </div>
                      <Badge variant="secondary" className="text-xs">
                        Unavailable
                      </Badge>
                    </div>
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
