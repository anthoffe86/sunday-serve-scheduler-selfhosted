import { useState, useEffect, useMemo } from 'react';
import { Loader2, Save, Key, Mail, CalendarHeart, CalendarX, Plus, MoreVertical } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { 
  Profile, 
  useAdminUpdateProfile, 
  useUserRolePreferences,
  useFamilyGroups,
  useUserAvailability,
  useAdminToggleAvailability,
  useAdminDeleteAvailability,
} from '@/hooks/useVolunteerData';
import { ROLE_LABELS } from '@/types';
import type { Database } from '@/integrations/supabase/types';
import { format, parseISO, differenceInDays, addDays } from 'date-fns';
import { AddUnavailableDatesDialog } from '@/components/AddUnavailableDatesDialog';
import { EditUnavailableDateDialog } from '@/components/EditUnavailableDateDialog';

type ServiceRole = Database['public']['Enums']['service_role'];

const ALL_ROLES: ServiceRole[] = [
  'sidesman-standard',
  'sidesman-sound',
  'sidesman-welcome',
  'reader',
  'intercessions',
  'collection',
];

interface EditVolunteerDialogProps {
  volunteer: Profile | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function EditVolunteerDialog({ 
  volunteer, 
  open, 
  onOpenChange, 
  onSuccess 
}: EditVolunteerDialogProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [selectedRoles, setSelectedRoles] = useState<ServiceRole[]>([]);
  const [selectedFamilyGroup, setSelectedFamilyGroup] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resetLinkCopied, setResetLinkCopied] = useState(false);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingRange, setEditingRange] = useState<{ startDate: string; notes?: string | null } | null>(null);
  

  const updateProfile = useAdminUpdateProfile();
  const { data: rolePrefs, refetch: refetchRolePrefs } = useUserRolePreferences(volunteer?.user_id);
  const { data: familyGroups } = useFamilyGroups();
  const { data: availability, refetch: refetchAvailability } = useUserAvailability(volunteer?.user_id);
  const toggleAvailability = useAdminToggleAvailability();
  const deleteAvailability = useAdminDeleteAvailability();

  useEffect(() => {
    if (volunteer && open) {
      setName(volunteer.name);
      setEmail(volunteer.email);
      setSelectedFamilyGroup(volunteer.family_group_id);
    }
  }, [volunteer, open]);

  useEffect(() => {
    if (rolePrefs) {
      setSelectedRoles(rolePrefs.map(p => p.role));
    }
  }, [rolePrefs]);

  const handleRoleToggle = (role: ServiceRole) => {
    setSelectedRoles(prev => 
      prev.includes(role) 
        ? prev.filter(r => r !== role)
        : [...prev, role]
    );
  };

  const handleSaveProfile = async () => {
    if (!volunteer) return;

    setIsSubmitting(true);
    try {
      // Update profile name and family group
      await updateProfile.mutateAsync({
        userId: volunteer.user_id,
        updates: { 
          name: name.trim(),
          family_group_id: selectedFamilyGroup,
        },
      });

      // Update email if changed
      if (email.trim().toLowerCase() !== volunteer.email.toLowerCase()) {
        const response = await supabase.functions.invoke('admin-user-management', {
          body: {
            action: 'update-email',
            userId: volunteer.user_id,
            data: { email: email.trim().toLowerCase() },
          },
        });

        if (response.error) {
          throw new Error(response.error.message);
        }
      }

      // Update role preferences
      const response = await supabase.functions.invoke('admin-user-management', {
        body: {
          action: 'update-role-preferences',
          userId: volunteer.user_id,
          data: { roles: selectedRoles },
        },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      toast.success('Volunteer updated successfully');
      refetchRolePrefs();
      onSuccess?.();
      onOpenChange(false);
    } catch (err: any) {
      console.error('Failed to update volunteer:', err);
      toast.error(err.message || 'Failed to update volunteer');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetPassword = async () => {
    if (!volunteer) return;

    setIsSubmitting(true);
    try {
      const response = await supabase.functions.invoke('admin-user-management', {
        body: {
          action: 'reset-password',
          userId: volunteer.user_id,
          data: { email: volunteer.email },
        },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      const resetLink = response.data?.resetLink;
      
      if (resetLink) {
        await navigator.clipboard.writeText(resetLink);
        setResetLinkCopied(true);
        toast.success('Password reset link copied to clipboard!');
        setTimeout(() => setResetLinkCopied(false), 3000);
      } else {
        toast.success('Password reset email sent to volunteer');
      }
    } catch (err: any) {
      console.error('Failed to reset password:', err);
      toast.error(err.message || 'Failed to generate password reset');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Get unavailable dates as grouped ranges (similar to volunteer's view)
  const unavailableRanges = useMemo(() => {
    if (!availability) return [];
    
    // Filter to only unavailable dates and sort
    const unavailableDates = availability
      .filter(a => a.available === false)
      .sort((a, b) => a.date.localeCompare(b.date));
    
    if (unavailableDates.length === 0) return [];
    
    // Group consecutive dates with the same notes
    const ranges: { startDate: string; endDate: string; notes?: string | null }[] = [];
    let currentRange: { startDate: string; endDate: string; notes?: string | null } | null = null;
    
    for (const item of unavailableDates) {
      if (!currentRange) {
        currentRange = { startDate: item.date, endDate: item.date, notes: item.notes };
      } else {
        const prevDate = parseISO(currentRange.endDate);
        const currDate = parseISO(item.date);
        const dayDiff = differenceInDays(currDate, prevDate);
        
        if (dayDiff === 1 && currentRange.notes === item.notes) {
          currentRange.endDate = item.date;
        } else {
          ranges.push(currentRange);
          currentRange = { startDate: item.date, endDate: item.date, notes: item.notes };
        }
      }
    }
    
    if (currentRange) {
      ranges.push(currentRange);
    }
    
    return ranges;
  }, [availability]);

  const existingDates = useMemo(() => {
    return availability?.filter(a => a.available === false).map(a => a.date) || [];
  }, [availability]);

  const handleAddUnavailableDates = async (dates: string[], notes?: string) => {
    if (!volunteer) return;
    
    // Insert each date as unavailable
    const records = dates.map(date => ({
      user_id: volunteer.user_id,
      date,
      available: false,
      notes: notes || null,
    }));
    
    const { error } = await supabase
      .from('availability')
      .upsert(records, { onConflict: 'user_id,date' });
    
    if (error) {
      toast.error('Failed to add unavailable dates');
      throw error;
    }
    
    toast.success('Unavailable dates added');
    refetchAvailability();
  };

  const handleRemoveRange = async (startDate: string, endDate: string) => {
    if (!volunteer) return;
    
    // Get all dates in the range
    const start = parseISO(startDate);
    const end = parseISO(endDate);
    const dates: string[] = [];
    let current = start;
    while (current <= end) {
      dates.push(format(current, 'yyyy-MM-dd'));
      current = addDays(current, 1);
    }
    
    // Delete all dates in the range
    const { error } = await supabase
      .from('availability')
      .delete()
      .eq('user_id', volunteer.user_id)
      .in('date', dates);
    
    if (error) {
      toast.error('Failed to remove dates');
      return;
    }
    
    toast.success('Dates removed');
    refetchAvailability();
  };

  const handleUpdateNotes = async (startDate: string, endDate: string, notes?: string) => {
    if (!volunteer) return;
    
    // Get all dates in the range
    const start = parseISO(startDate);
    const end = parseISO(endDate);
    const dates: string[] = [];
    let current = start;
    while (current <= end) {
      dates.push(format(current, 'yyyy-MM-dd'));
      current = addDays(current, 1);
    }
    
    // Update notes for all dates in the range
    const { error } = await supabase
      .from('availability')
      .update({ notes: notes || null })
      .eq('user_id', volunteer.user_id)
      .in('date', dates);
    
    if (error) {
      toast.error('Failed to update notes');
      throw error;
    }
    
    toast.success('Notes updated');
    refetchAvailability();
  };

  const handleClose = () => {
    setName('');
    setEmail('');
    setSelectedRoles([]);
    setSelectedFamilyGroup(null);
    setResetLinkCopied(false);
    setEditingRange(null);
    onOpenChange(false);
  };

  if (!volunteer) return null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Volunteer</DialogTitle>
          <DialogDescription>
            Update {volunteer.name}'s profile, role preferences, availability, and account settings.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="profile" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="profile">Profile</TabsTrigger>
            <TabsTrigger value="roles">Roles</TabsTrigger>
            <TabsTrigger value="availability">Availability</TabsTrigger>
            <TabsTrigger value="account">Account</TabsTrigger>
          </TabsList>

          <TabsContent value="profile" className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter email"
              />
              {email.toLowerCase() !== volunteer.email.toLowerCase() && (
                <p className="text-xs text-amber-600">
                  Changing email will update the login credentials
                </p>
              )}
            </div>

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
          </TabsContent>

          <TabsContent value="roles" className="space-y-4 pt-4">
            <p className="text-sm text-muted-foreground">
              Select the roles this volunteer is willing to perform.
            </p>
            <div className="space-y-3">
              {ALL_ROLES.map((role) => (
                <div key={role} className="flex items-center space-x-3">
                  <Checkbox
                    id={role}
                    checked={selectedRoles.includes(role)}
                    onCheckedChange={() => handleRoleToggle(role)}
                  />
                  <Label 
                    htmlFor={role} 
                    className="cursor-pointer font-normal"
                  >
                    {ROLE_LABELS[role]}
                  </Label>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="availability" className="space-y-4 pt-4">
            {/* Default Available Banner */}
            <div className="flex items-center gap-3 rounded-lg border border-primary/20 bg-primary/5 p-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
                <CalendarHeart className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">Available by default</p>
                <p className="text-xs text-muted-foreground">Add dates they can't serve</p>
              </div>
              <Button size="sm" onClick={() => setIsAddDialogOpen(true)} className="gap-1.5 shrink-0">
                <Plus className="h-3.5 w-3.5" />
                Add
              </Button>
            </div>

            {/* Unavailable Dates List */}
            {unavailableRanges.length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                No unavailable dates recorded
              </div>
            ) : (
              <div className="space-y-2">
                {unavailableRanges.map((range) => {
                  const startDate = parseISO(range.startDate);
                  const endDate = parseISO(range.endDate);
                  const isRange = range.startDate !== range.endDate;
                  
                  const label = isRange
                    ? `${format(startDate, 'MMM d')} – ${format(endDate, 'MMM d, yyyy')}`
                    : format(startDate, 'MMM d, yyyy');

                  return (
                    <div
                      key={`${range.startDate}-${range.endDate}`}
                      className="group flex items-center justify-between rounded-lg border bg-card p-3"
                    >
                      <div className="flex items-start gap-2 min-w-0">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-destructive/10">
                          <CalendarX className="h-3.5 w-3.5 text-destructive" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium">{label}</p>
                          {range.notes && (
                            <p className="text-xs text-muted-foreground line-clamp-1">{range.notes}</p>
                          )}
                        </div>
                      </div>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setEditingRange({ startDate: range.startDate, notes: range.notes })}>
                            Edit notes
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            className="text-destructive"
                            onClick={() => handleRemoveRange(range.startDate, range.endDate)}
                          >
                            Remove
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Add Unavailable Dates Dialog */}
            <AddUnavailableDatesDialog
              open={isAddDialogOpen}
              onOpenChange={setIsAddDialogOpen}
              onSave={handleAddUnavailableDates}
              existingDates={existingDates}
            />

            {/* Edit Notes Dialog */}
            <EditUnavailableDateDialog
              open={!!editingRange}
              onOpenChange={(open) => !open && setEditingRange(null)}
              currentNotes={editingRange?.notes}
              onSave={async (notes) => {
                if (editingRange) {
                  const range = unavailableRanges.find(r => r.startDate === editingRange.startDate);
                  if (range) {
                    await handleUpdateNotes(range.startDate, range.endDate, notes);
                  }
                }
              }}
            />
          </TabsContent>

          <TabsContent value="account" className="space-y-4 pt-4">
            <div className="rounded-lg border p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Key className="h-4 w-4 text-muted-foreground" />
                <h4 className="font-medium">Password Reset</h4>
              </div>
              <p className="text-sm text-muted-foreground">
                Generate a password reset link for this volunteer. The link will be copied to your clipboard.
              </p>
              <Button 
                variant="outline" 
                onClick={handleResetPassword}
                disabled={isSubmitting}
                className="w-full"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : resetLinkCopied ? (
                  'Link Copied!'
                ) : (
                  'Generate Reset Link'
                )}
              </Button>
            </div>

            <div className="rounded-lg border p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <h4 className="font-medium">Account Status</h4>
              </div>
              <p className="text-sm text-muted-foreground">
                This volunteer's account is <strong>{volunteer.active ? 'active' : 'inactive'}</strong>.
                Use the dropdown menu on the volunteer card to change this.
              </p>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button onClick={handleSaveProfile} disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Save Changes
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
