import { useState } from 'react';
import { Search, User } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAssignVolunteer } from '@/hooks/useEventScheduler';
import { ROLE_LABELS } from '@/types';
import { toast } from 'sonner';

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
  role: string;
  profiles: Profile[];
}

export function AssignVolunteerDialog({ 
  open, 
  onOpenChange, 
  eventId, 
  role,
  profiles 
}: AssignVolunteerDialogProps) {
  const [search, setSearch] = useState('');
  const assignVolunteer = useAssignVolunteer();

  const filteredProfiles = profiles.filter(
    p => p.active && (
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.email.toLowerCase().includes(search.toLowerCase())
    )
  );

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
              {filteredProfiles.map((profile) => (
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
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
