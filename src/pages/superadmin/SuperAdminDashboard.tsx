import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Shield, UserPlus, RefreshCcw, UserX, Mail } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

type Organisation = {
  id: string;
  name: string;
  slug: string;
  active: boolean;
};

type UserRow = {
  user_id: string;
  name: string;
  email: string;
  active: boolean;
  org_id: string;
};

type FunctionInvokeResult = {
  data: unknown;
  error: { message?: string } | null;
};

type AddUserResult = {
  userId?: string;
};

type SupportDataResult = {
  organisations?: Organisation[];
  users?: UserRow[];
  superAdminUserIds?: string[];
};

const getErrorMessage = (error: unknown, fallback: string) => {
  if (error instanceof Error) {
    return error.message;
  }
  return fallback;
};

const sortUsersByName = (rows: UserRow[]) => {
  return [...rows].sort((left, right) => left.name.localeCompare(right.name, undefined, { sensitivity: 'base' }));
};

const USER_PAGE_SIZE = 25;

const SuperAdminDashboard = () => {
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [organisations, setOrganisations] = useState<Organisation[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [superAdminUserIds, setSuperAdminUserIds] = useState<string[]>([]);
  const [search, setSearch] = useState('');

  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserOrgId, setNewUserOrgId] = useState('');
  const [newUserRole, setNewUserRole] = useState<'volunteer' | 'admin'>('volunteer');

  const invokeSupportAction = useCallback(async (payload: Record<string, unknown>) => {
    const response = (await supabase.functions.invoke('admin-user-management', {
      body: payload,
    })) as FunctionInvokeResult;

    if (response.error) {
      throw new Error(response.error.message ?? 'Support action failed');
    }

    return response.data;
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const supportData = (await invokeSupportAction({
        action: 'list-support-data',
      })) as SupportDataResult | null;

      const loadedOrgs = supportData?.organisations ?? [];
      setOrganisations(loadedOrgs);
      setUsers(sortUsersByName(supportData?.users ?? []));
      setSuperAdminUserIds(supportData?.superAdminUserIds ?? []);
      if (!newUserOrgId && loadedOrgs.length) {
        setNewUserOrgId(loadedOrgs[0].id);
      }
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, 'Failed to load super admin data'));
    } finally {
      setLoading(false);
    }
  }, [invokeSupportAction, newUserOrgId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const orgLookup = useMemo(() => {
    return new Map(organisations.map((org) => [org.id, org]));
  }, [organisations]);

  const filteredUsers = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) {
      return users.slice(0, USER_PAGE_SIZE);
    }

    return users
      .filter((user) => !superAdminUserIds.includes(user.user_id))
      .filter((user) => {
        const orgName = orgLookup.get(user.org_id)?.name?.toLowerCase() ?? '';
        return (
          user.name.toLowerCase().includes(term) ||
          user.email.toLowerCase().includes(term) ||
          orgName.includes(term)
        );
      })
      .slice(0, USER_PAGE_SIZE);
  }, [users, search, orgLookup, superAdminUserIds]);

  const runSupportAction = async (payload: Record<string, unknown>) => {
    setWorking(true);
    try {
      return await invokeSupportAction(payload);
    } finally {
      setWorking(false);
    }
  };

  const handleAddUser = async () => {
    if (!newUserName.trim() || !newUserEmail.trim() || !newUserOrgId) {
      toast.error('Name, email, and organisation are required');
      return;
    }

    const pendingName = newUserName.trim();
    const pendingEmail = newUserEmail.trim().toLowerCase();
    const pendingOrgId = newUserOrgId;

    try {
      const data = await runSupportAction({
        action: 'add-user',
        data: {
          name: pendingName,
          email: pendingEmail,
          orgId: pendingOrgId,
          role: newUserRole,
        },
      });

      toast.success('User added successfully');
      setNewUserName('');
      setNewUserEmail('');
      await fetchData();
      setUsers((currentUsers) => {
        const addedUserId = (data as AddUserResult | null)?.userId;
        if (!addedUserId) {
          return currentUsers;
        }

        const alreadyPresent = currentUsers.some((user) => user.user_id === addedUserId);
        if (alreadyPresent) {
          return currentUsers;
        }

        return sortUsersByName([
          ...currentUsers,
          {
            user_id: addedUserId,
            name: pendingName,
            email: pendingEmail,
            active: true,
            org_id: pendingOrgId,
          },
        ]);
      });
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, 'Failed to add user'));
    }
  };

  const handleResetPassword = async (email: string) => {
    try {
      const data = await runSupportAction({
        action: 'reset-password',
        data: { email },
      });
      const resetLink = (data as { resetLink?: string } | null)?.resetLink;
      if (resetLink) {
        await navigator.clipboard.writeText(resetLink);
        toast.success('Password reset link copied to clipboard');
      } else {
        toast.success('Password reset action completed');
      }
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, 'Failed to reset password'));
    }
  };

  const handleUpdateEmail = async (userId: string, currentEmail: string) => {
    const nextEmail = window.prompt('Enter the new email address', currentEmail);
    if (!nextEmail || nextEmail.trim().toLowerCase() === currentEmail.toLowerCase()) {
      return;
    }

    try {
      await runSupportAction({
        action: 'update-email',
        userId,
        data: { email: nextEmail.trim().toLowerCase() },
      });
      toast.success('Email updated');
      await fetchData();
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, 'Failed to update email'));
    }
  };

  const handleRemoveUser = async (userId: string) => {
    const confirmed = window.confirm('Remove this user from their organisation and deactivate the profile?');
    if (!confirmed) {
      return;
    }

    try {
      await runSupportAction({
        action: 'remove-user',
        userId,
      });
      toast.success('User removed from organisation');
      await fetchData();
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, 'Failed to remove user'));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-2xl font-bold sm:text-3xl">Super Admin</h1>
        <p className="text-sm text-muted-foreground sm:text-base">
          Cross-organisation support tools for user administration. Schedule editing is intentionally excluded.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Organisations</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{organisations.length}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Users Indexed</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{users.length}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Support Scope</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Password reset, email update, add user, remove user
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="h-4 w-4" />
            Add User To Organisation
          </CardTitle>
          <CardDescription>Create a new auth user, profile, and role in one action.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="new-user-name">Name</Label>
            <Input
              id="new-user-name"
              value={newUserName}
              onChange={(event) => setNewUserName(event.target.value)}
              placeholder="Jane Doe"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="new-user-email">Email</Label>
            <Input
              id="new-user-email"
              type="email"
              value={newUserEmail}
              onChange={(event) => setNewUserEmail(event.target.value)}
              placeholder="jane@example.com"
            />
          </div>

          <div className="space-y-2">
            <Label>Organisation</Label>
            <Select value={newUserOrgId} onValueChange={setNewUserOrgId}>
              <SelectTrigger>
                <SelectValue placeholder="Select organisation" />
              </SelectTrigger>
              <SelectContent>
                {organisations.map((org) => (
                  <SelectItem key={org.id} value={org.id}>
                    {org.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Role</Label>
            <Select value={newUserRole} onValueChange={(value: 'volunteer' | 'admin') => setNewUserRole(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="volunteer">Volunteer</SelectItem>
                <SelectItem value="admin">Organisation Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="md:col-span-2">
            <Button onClick={handleAddUser} disabled={working}>
              {working ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />}
              Add User
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Support User Actions
          </CardTitle>
          <CardDescription>Search users and run support operations.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by user name, email, or organisation"
          />

          <div className="space-y-2">
            {filteredUsers.map((user) => {
              const org = orgLookup.get(user.org_id);
              return (
                <div key={user.user_id} className="rounded-lg border p-3">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="font-medium">{user.name}</p>
                      <p className="text-sm text-muted-foreground">{user.email}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <Badge variant="secondary">{org?.name ?? 'Unknown org'}</Badge>
                        <Badge variant={user.active ? 'outline' : 'destructive'}>
                          {user.active ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={working}
                        onClick={() => handleResetPassword(user.email)}
                      >
                        <RefreshCcw className="mr-1 h-3.5 w-3.5" />
                        Reset Password
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={working}
                        onClick={() => handleUpdateEmail(user.user_id, user.email)}
                      >
                        <Mail className="mr-1 h-3.5 w-3.5" />
                        Change Email
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={working}
                        onClick={() => handleRemoveUser(user.user_id)}
                      >
                        <UserX className="mr-1 h-3.5 w-3.5" />
                        Remove User
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}

            {filteredUsers.length === 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground">No users found.</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SuperAdminDashboard;
