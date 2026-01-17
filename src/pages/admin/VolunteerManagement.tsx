import { useState } from 'react';
import { Plus, Search, MoreHorizontal, Users } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { mockVolunteers } from '@/data/mockData';
import { RoleBadge } from '@/components/RoleBadge';

const VolunteerManagement = () => {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredVolunteers = mockVolunteers.filter(
    (v) =>
      v.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-serif text-3xl font-bold">Volunteers</h1>
          <p className="text-muted-foreground">
            Manage volunteer profiles, preferences, and family groups
          </p>
        </div>
        <Button className="gap-2 self-start">
          <Plus className="h-4 w-4" />
          Add Volunteer
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

      {/* Volunteer List */}
      <div className="grid gap-4">
        {filteredVolunteers.map((volunteer) => (
          <Card key={volunteer.id} className="hover:shadow-md transition-shadow">
            <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-lg font-medium text-primary">
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
                    {volunteer.familyGroupId && (
                      <Badge variant="outline" className="gap-1 text-xs">
                        <Users className="h-3 w-3" />
                        Family
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
                    {volunteer.rolePreferences.slice(0, 3).map((role) => (
                      <RoleBadge key={role} role={role} />
                    ))}
                    {volunteer.rolePreferences.length > 3 && (
                      <span className="text-xs text-muted-foreground">
                        +{volunteer.rolePreferences.length - 3}
                      </span>
                    )}
                  </div>
                </div>

                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Times Served</p>
                  <p className="font-semibold">{volunteer.serviceHistory.length}</p>
                </div>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem>Edit Profile</DropdownMenuItem>
                    <DropdownMenuItem>View History</DropdownMenuItem>
                    <DropdownMenuItem>Manage Family Group</DropdownMenuItem>
                    <DropdownMenuItem className="text-destructive">
                      {volunteer.active ? 'Deactivate' : 'Activate'}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default VolunteerManagement;
