import { Bell, Menu, User, LogOut, Shield } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useVolunteerData';
import { usePublicOrgSettings } from '@/hooks/usePublicOrgSettings';
interface AppHeaderProps {
  onMenuClick: () => void;
}
export function AppHeader({
  onMenuClick
}: AppHeaderProps) {
  const {
    user,
    signOut,
    isAdmin
  } = useAuth();
  const {
    data: profile
  } = useProfile();
  const { data: orgSettings } = usePublicOrgSettings();
  const navigate = useNavigate();
  const orgName = orgSettings.organisationName;
  const orgShortName = orgSettings.organisationShortName;
  const displayName = profile?.name || user?.email?.split('@')[0] || 'User';
  const initials = displayName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };
  return <header className="sticky top-0 z-50 w-full border-b bg-card/80 backdrop-blur-sm">
      <div className="flex h-16 items-center gap-4 px-4 md:px-6">
        <Button variant="ghost" size="icon" className="md:hidden" onClick={onMenuClick}>
          <Menu className="h-5 w-5" />
        </Button>

        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <span className="font-serif text-lg font-bold">{orgShortName}</span>
          </div>
          <div className="hidden md:block">
            <h1 className="font-serif text-lg font-semibold">{orgName}</h1>
            <p className="text-xs text-muted-foreground">Volunteer Scheduling</p>
          </div>
        </div>

        <div className="flex-1" />

        {isAdmin && <div className="hidden items-center gap-1 rounded-full bg-accent/20 px-2 py-0.5 text-xs font-medium text-accent-foreground md:flex">
            <Shield className="h-3 w-3" />
            Admin
          </div>}

        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="gap-2 pl-2 pr-3">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-primary/10 text-primary text-sm">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <span className="hidden text-sm font-medium md:block">
                {displayName.split(' ')[0]}
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div className="flex flex-col">
                <span>{displayName}</span>
                <span className="text-xs font-normal text-muted-foreground">
                  {user?.email}
                </span>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate('/profile')}>
              <User className="mr-2 h-4 w-4" />
              My Profile
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut} className="text-destructive">
              <LogOut className="mr-2 h-4 w-4" />
              Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>;
}