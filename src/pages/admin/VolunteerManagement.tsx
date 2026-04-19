import { useState, useMemo } from 'react';
import { Plus, Search, MoreHorizontal, Users, Loader2, UserX, UserCheck, UserPlus, Pencil } from 'lucide-react';
import { InviteVolunteerDialog } from '@/components/admin/InviteVolunteerDialog';
import { EditVolunteerDialog } from '@/components/admin/EditVolunteerDialog';
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
import { useQueryClient } from '@tanstack/react-query';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  PaginationEllipsis,
} from '@/components/ui/pagination';

const VOLUNTEERS_PER_PAGE = 10;

const VolunteerManagement = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [editingVolunteer, setEditingVolunteer] = useState<Profile | null>(null);
  const [editingFamilyVolunteer, setEditingFamilyVolunteer] = useState<Profile | null>(null);
  const [showFamilyDialog, setShowFamilyDialog] = useState(false);
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [newFamilyName, setNewFamilyName] = useState('');
  const [selectedFamilyGroup, setSelectedFamilyGroup] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  
  const queryClient = useQueryClient();
  const { data: volunteers, isLoading } = useAllProfiles();
  const { data: familyGroups } = useFamilyGroups();
  const updateProfile = useAdminUpdateProfile();
  const createFamilyGroup = useCreateFamilyGroup();

  const filteredVolunteers = useMemo(() => {
    return volunteers?.filter(
      (v) =>
        v.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        v.email.toLowerCase().includes(searchQuery.toLowerCase())
    ) || [];
  }, [volunteers, searchQuery]);

  // Reset to page 1 when search changes
  useMemo(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  // Pagination logic
  const totalPages = Math.ceil(filteredVolunteers.length / VOLUNTEERS_PER_PAGE);
  const paginatedVolunteers = useMemo(() => {
    const startIndex = (currentPage - 1) * VOLUNTEERS_PER_PAGE;
    return filteredVolunteers.slice(startIndex, startIndex + VOLUNTEERS_PER_PAGE);
  }, [filteredVolunteers, currentPage]);

  const getPageNumbers = (): (number | 'ellipsis')[] => {
    const pages: (number | 'ellipsis')[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      if (currentPage <= 4) {
        for (let i = 1; i <= 5; i++) pages.push(i);
        pages.push('ellipsis');
        pages.push(totalPages);
      } else if (currentPage >= totalPages - 3) {
        pages.push(1);
        pages.push('ellipsis');
        for (let i = totalPages - 4; i <= totalPages; i++) pages.push(i);
      } else {
        pages.push(1);
        pages.push('ellipsis');
        for (let i = currentPage - 1; i <= currentPage + 1; i++) pages.push(i);
        pages.push('ellipsis');
        pages.push(totalPages);
      }
    }
    return pages;
  };

  const handleToggleActive = async (volunteer: Profile) => {
    await updateProfile.mutateAsync({
      userId: volunteer.user_id,
      updates: { active: !volunteer.active },
    });
  };

  const handleUpdateFamilyGroup = async () => {
    if (!editingFamilyVolunteer) return;
    
    await updateProfile.mutateAsync({
      userId: editingFamilyVolunteer.user_id,
      updates: { family_group_id: selectedFamilyGroup },
    });
    setEditingFamilyVolunteer(null);
    setSelectedFamilyGroup(null);
  };

  const handleCreateFamilyGroup = async () => {
    if (!newFamilyName.trim()) return;
    
    await createFamilyGroup.mutateAsync(newFamilyName);
    setNewFamilyName('');
    setShowFamilyDialog(false);
  };

  const openEditFamily = (volunteer: Profile) => {
    setEditingFamilyVolunteer(volunteer);
    setSelectedFamilyGroup(volunteer.family_group_id);
  };

  const openEditVolunteer = (volunteer: Profile) => {
    setEditingVolunteer(volunteer);
  };

  const handleEditSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ['profiles'] });
    queryClient.invalidateQueries({ queryKey: ['role-preferences'] });
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
          <h1 className="font-serif text-2xl font-bold sm:text-3xl">Volunteers</h1>
          <p className="text-muted-foreground">
            Manage volunteer profiles and family groups
          </p>
        </div>
        <div className="flex gap-2 self-start">
          <Button className="gap-2" onClick={() => setShowInviteDialog(true)}>
            <UserPlus className="h-4 w-4" />
            Invite Volunteer
          </Button>
          <Button variant="outline" className="gap-2" onClick={() => setShowFamilyDialog(true)}>
            <Plus className="h-4 w-4" />
            New Family Group
          </Button>
        </div>
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
      <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
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
        {paginatedVolunteers.map((volunteer) => (
          <VolunteerCard
            key={volunteer.id}
            volunteer={volunteer}
            familyGroups={familyGroups || []}
            onToggleActive={handleToggleActive}
            onEditFamily={openEditFamily}
            onEdit={openEditVolunteer}
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

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex flex-col items-center gap-2">
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious 
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                />
              </PaginationItem>
              
              {getPageNumbers().map((page, index) => (
                <PaginationItem key={index}>
                  {page === 'ellipsis' ? (
                    <PaginationEllipsis />
                  ) : (
                    <PaginationLink
                      onClick={() => setCurrentPage(page)}
                      isActive={currentPage === page}
                      className="cursor-pointer"
                    >
                      {page}
                    </PaginationLink>
                  )}
                </PaginationItem>
              ))}
              
              <PaginationItem>
                <PaginationNext 
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  className={currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
          <p className="text-sm text-muted-foreground">
            Showing {((currentPage - 1) * VOLUNTEERS_PER_PAGE) + 1} to {Math.min(currentPage * VOLUNTEERS_PER_PAGE, filteredVolunteers.length)} of {filteredVolunteers.length} volunteers
          </p>
        </div>
      )}

      {/* Edit Volunteer Dialog */}
      <EditVolunteerDialog
        volunteer={editingVolunteer}
        open={!!editingVolunteer}
        onOpenChange={(open) => !open && setEditingVolunteer(null)}
        onSuccess={handleEditSuccess}
      />

      {/* Edit Family Group Dialog */}
      <Dialog open={!!editingFamilyVolunteer} onOpenChange={(open) => !open && setEditingFamilyVolunteer(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Family Group</DialogTitle>
            <DialogDescription>
              Assign {editingFamilyVolunteer?.name} to a family group. Family members won't be scheduled on the same Sunday.
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
            <Button variant="outline" onClick={() => setEditingFamilyVolunteer(null)}>
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

      {/* Invite Volunteer Dialog */}
      <InviteVolunteerDialog 
        open={showInviteDialog} 
        onOpenChange={setShowInviteDialog}
      />
    </div>
  );
};

interface VolunteerCardProps {
  volunteer: Profile;
  familyGroups: { id: string; name: string }[];
  onToggleActive: (volunteer: Profile) => void;
  onEditFamily: (volunteer: Profile) => void;
  onEdit: (volunteer: Profile) => void;
}

function VolunteerCard({ volunteer, familyGroups, onToggleActive, onEditFamily, onEdit }: VolunteerCardProps) {
  const { data: rolePrefs } = useUserRolePreferences(volunteer.user_id);
  const { data: serviceHistory } = useServiceHistory(volunteer.user_id);
  
  const familyGroup = familyGroups.find(g => g.id === volunteer.family_group_id);

  return (
    <Card className={`transition-shadow hover:shadow-md ${!volunteer.active ? 'opacity-60' : ''}`}>
      <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4 min-w-0">
          <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-lg font-medium ${
            volunteer.active ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
          }`}>
            {volunteer.name
              .split(' ')
              .map((n) => n[0])
              .join('')}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
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
            <p className="text-sm text-muted-foreground break-all">{volunteer.email}</p>
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
              <DropdownMenuItem onClick={() => onEdit(volunteer)}>
                <Pencil className="mr-2 h-4 w-4" />
                Edit Volunteer
              </DropdownMenuItem>
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
