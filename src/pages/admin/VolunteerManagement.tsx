import { useState } from 'react';
import { Plus, Search, MoreHorizontal, Users, Loader2, UserX, UserCheck } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import { Label } from '@/components/ui/label';
import { RoleBadge } from '@/components/RoleBadge';
import { 
  useAllProfiles, 
  useAdminUpdateProfile, 
  useFamilyGroups,
  useCreateFamilyGroup,
  useUserRolePreferences,
  Profile 
} from '@/hooks/useVolunteerData';
import { useServiceHistory } from '@/hooks/useVolunteerData';

const VolunteerManagement = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [editingVolunteer, setEditingVolunteer] = useState<Profile | null>(null);
  const [showFamilyDialog, setShowFamilyDialog] = useState(false);
  const [newFamilyName, setNewFamilyName] = useState('');
  const [selectedFamilyGroup, setSelectedFamilyGroup] = useState<string | null>(null);
  
  const { data: volunteers, isLoading } = useAllProfiles();
  const { data: familyGroups } = useFamilyGroups();
  const updateProfile = useAdminUpdateProfile();
  const createFamilyGroup = useCreateFamilyGroup();

  const filteredVolunteers = volunteers?.filter(
    (v) =>
      v.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.email.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  const handleToggleActive = async (volunteer: Profile) => {
    await updateProfile.mutateAsync({
      userId: volunteer.user_id,
      updates: { active: !volunteer.active },
    });
  };

  const handleUpdateFamilyGroup = async () => {
    if (!editingVolunteer) return;
    
    await updateProfile.mutateAsync({
      userId: editingVolunteer.user_id,
      updates: { family_group_id: selectedFamilyGroup },
    });
    setEditingVolunteer(null);
    setSelectedFamilyGroup(null);
  };

  const handleCreateFamilyGroup = async () => {
    if (!newFamilyName.trim()) return;
    
    await createFamilyGroup.mutateAsync(newFamilyName);
    setNewFamilyName('');
    setShowFamilyDialog(false);
  };

  const openEditFamily = (volunteer: Profile) => {
    setEditingVolunteer(volunteer);
    setSelectedFamilyGroup(volunteer.family_group_id);
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
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-serif text-3xl font-bold">Volunteers</h1>
          <p className="text-muted-foreground">
            Manage volunteer profiles and family groups
          </p>
        </div>
        <Button className="gap-2 self-start" onClick={() => setShowFamilyDialog(true)}>
          <Plus className="h-4 w-4" />
          New Family Group
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search volunteers..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Stats */}
      <div className="flex gap-4 text-sm">
        <span className="text-muted-foreground">
          Total: <strong className="text-foreground">{volunteers?.length || 0}</strong>
        </span>
        <span className="text-muted-foreground">
          Active: <strong className="text-foreground">{volunteers?.filter(v => v.active).length || 0}</strong>
        </span>
        <span className="text-muted-foreground">
          Inactive: <strong className="text-foreground">{volunteers?.filter(v => !v.active).length || 0}</strong>
        </span>
      </div>

      {/* Volunteer List */}
      <div className="grid gap-4">
        {filteredVolunteers.map((volunteer) => (
          <VolunteerCard
            key={volunteer.id}
            volunteer={volunteer}
            familyGroups={familyGroups || []}
            onToggleActive={handleToggleActive}
            onEditFamily={openEditFamily}
          />
        ))}
        
        {filteredVolunteers.length === 0 && (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <Users className="mb-4 h-12 w-12 text-muted-foreground/50" />
              <p className="text-muted-foreground">
                {searchQuery ? 'No volunteers match your search.' : 'No volunteers yet.'}
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Edit Family Group Dialog */}
      <Dialog open={!!editingVolunteer} onOpenChange={(open) => !open && setEditingVolunteer(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Family Group</DialogTitle>
            <DialogDescription>
              Assign {editingVolunteer?.name} to a family group. Family members won't be scheduled on the same Sunday.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Family Group</Label>
              <Select
                value={selectedFamilyGroup || 'none'}
                onValueChange={(value) => setSelectedFamilyGroup(value === 'none' ? null : value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a family group" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No family group</SelectItem>
                  {familyGroups?.map((group) => (
                    <SelectItem key={group.id} value={group.id}>
                      {group.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingVolunteer(null)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateFamilyGroup} disabled={updateProfile.isPending}>
              {updateProfile.isPending ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Family Group Dialog */}
      <Dialog open={showFamilyDialog} onOpenChange={setShowFamilyDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Family Group</DialogTitle>
            <DialogDescription>
              Create a new family group. Volunteers in the same family group won't be scheduled together.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="family-name">Family Name</Label>
              <Input
                id="family-name"
                placeholder="e.g., The Smiths"
                value={newFamilyName}
                onChange={(e) => setNewFamilyName(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowFamilyDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleCreateFamilyGroup} 
              disabled={!newFamilyName.trim() || createFamilyGroup.isPending}
            >
              {createFamilyGroup.isPending ? 'Creating...' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

interface VolunteerCardProps {
  volunteer: Profile;
  familyGroups: { id: string; name: string }[];
  onToggleActive: (volunteer: Profile) => void;
  onEditFamily: (volunteer: Profile) => void;
}

function VolunteerCard({ volunteer, familyGroups, onToggleActive, onEditFamily }: VolunteerCardProps) {
  const { data: rolePrefs } = useUserRolePreferences(volunteer.user_id);
  const { data: serviceHistory } = useServiceHistory(volunteer.user_id);
  
  const familyGroup = familyGroups.find(g => g.id === volunteer.family_group_id);

  return (
    <Card className={`transition-shadow hover:shadow-md ${!volunteer.active ? 'opacity-60' : ''}`}>
      <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <div className={`flex h-12 w-12 items-center justify-center rounded-full text-lg font-medium ${
            volunteer.active ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
          }`}>
            {volunteer.name
              .split(' ')
              .map((n) => n[0])
              .join('')}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-serif font-semibold">{volunteer.name}</h3>
              {!volunteer.active && (
                <Badge variant="secondary" className="text-xs">
                  Inactive
                </Badge>
              )}
              {familyGroup && (
                <Badge variant="outline" className="gap-1 text-xs">
                  <Users className="h-3 w-3" />
                  {familyGroup.name}
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">{volunteer.email}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-4">
          <div className="flex-1 sm:text-right">
            <p className="text-sm text-muted-foreground">Preferred Roles</p>
            <div className="mt-1 flex flex-wrap gap-1">
              {rolePrefs && rolePrefs.length > 0 ? (
                <>
                  {rolePrefs.slice(0, 3).map((pref) => (
                    <RoleBadge key={pref.id} role={pref.role} />
                  ))}
                  {rolePrefs.length > 3 && (
                    <span className="text-xs text-muted-foreground">
                      +{rolePrefs.length - 3}
                    </span>
                  )}
                </>
              ) : (
                <span className="text-xs text-muted-foreground">None set</span>
              )}
            </div>
          </div>

          <div className="text-right min-w-[80px]">
            <p className="text-sm text-muted-foreground">Times Served</p>
            <p className="font-semibold">{serviceHistory?.length || 0}</p>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onEditFamily(volunteer)}>
                <Users className="mr-2 h-4 w-4" />
                Manage Family Group
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                onClick={() => onToggleActive(volunteer)}
                className={volunteer.active ? 'text-destructive' : 'text-primary'}
              >
                {volunteer.active ? (
                  <>
                    <UserX className="mr-2 h-4 w-4" />
                    Deactivate
                  </>
                ) : (
                  <>
                    <UserCheck className="mr-2 h-4 w-4" />
                    Activate
                  </>
                )}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardContent>
    </Card>
  );
}

export default VolunteerManagement;
