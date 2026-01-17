import { useState } from 'react';
import { Save, User, Heart } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { currentUser } from '@/data/mockData';
import { Role, ROLE_LABELS, ROLES_PER_SUNDAY } from '@/types';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const Profile = () => {
  const [name, setName] = useState(currentUser.name);
  const [email, setEmail] = useState(currentUser.email);
  const [preferences, setPreferences] = useState<Role[]>(currentUser.rolePreferences);

  const allRoles: Role[] = [...new Set(ROLES_PER_SUNDAY.map((r) => r.role))];

  const toggleRole = (role: Role) => {
    setPreferences((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
    );
  };

  const moveRole = (role: Role, direction: 'up' | 'down') => {
    const index = preferences.indexOf(role);
    if (index === -1) return;
    
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= preferences.length) return;
    
    const newPrefs = [...preferences];
    [newPrefs[index], newPrefs[newIndex]] = [newPrefs[newIndex], newPrefs[index]];
    setPreferences(newPrefs);
  };

  const handleSave = () => {
    toast.success('Profile saved successfully!');
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-3xl font-bold">My Preferences</h1>
        <p className="text-muted-foreground">
          Update your profile and role preferences
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Personal Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-serif">
              <User className="h-5 w-5 text-primary" />
              Personal Information
            </CardTitle>
            <CardDescription>
              Your contact details for scheduling notifications
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Role Preferences */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-serif">
              <Heart className="h-5 w-5 text-primary" />
              Role Preferences
            </CardTitle>
            <CardDescription>
              Select and rank the roles you prefer. Higher = more preferred.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Selected preferences (ordered) */}
            {preferences.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">
                  Your preferences (drag to reorder):
                </p>
                <div className="space-y-2">
                  {preferences.map((role, index) => (
                    <div
                      key={role}
                      className="flex items-center justify-between rounded-lg border bg-secondary/50 px-3 py-2"
                    >
                      <div className="flex items-center gap-2">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">
                          {index + 1}
                        </span>
                        <span className="text-sm font-medium">
                          {ROLE_LABELS[role]}
                        </span>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          onClick={() => moveRole(role, 'up')}
                          disabled={index === 0}
                        >
                          ↑
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          onClick={() => moveRole(role, 'down')}
                          disabled={index === preferences.length - 1}
                        >
                          ↓
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-destructive"
                          onClick={() => toggleRole(role)}
                        >
                          ×
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Available roles to add */}
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">
                Add roles to your preferences:
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {allRoles
                  .filter((role) => !preferences.includes(role))
                  .map((role) => (
                    <button
                      key={role}
                      onClick={() => toggleRole(role)}
                      className="flex items-center gap-2 rounded-lg border border-dashed px-3 py-2 text-left text-sm transition-colors hover:border-primary hover:bg-primary/5"
                    >
                      <span className="text-muted-foreground">+</span>
                      {ROLE_LABELS[role]}
                    </button>
                  ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} className="gap-2">
          <Save className="h-4 w-4" />
          Save Changes
        </Button>
      </div>
    </div>
  );
};

export default Profile;
