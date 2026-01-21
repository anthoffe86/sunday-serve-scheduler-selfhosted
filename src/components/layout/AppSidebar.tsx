import { NavLink, useLocation } from 'react-router-dom';
import {
  CalendarDays,
  Home,
  CalendarCheck,
  ArrowLeftRight,
  Settings,
  Users,
  LayoutDashboard,
  CalendarPlus,
  X,
  Shield,
  Mail
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';

interface AppSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

const volunteerNav = [
  { to: '/', icon: Home, label: 'Dashboard' },
  { to: '/schedule', icon: CalendarDays, label: 'Schedule' },
  { to: '/invitations', icon: Mail, label: 'Invitations' },
  { to: '/availability', icon: CalendarCheck, label: 'My Availability' },
  { to: '/swaps', icon: ArrowLeftRight, label: 'Swap Requests' },
  { to: '/profile', icon: Settings, label: 'Preferences' },
];

const adminNav = [
  { to: '/admin', icon: LayoutDashboard, label: 'Admin Dashboard' },
  { to: '/admin/events', icon: CalendarPlus, label: 'Events' },
  { to: '/admin/schedule', icon: CalendarDays, label: 'Schedule' },
  { to: '/admin/volunteers', icon: Users, label: 'Volunteers' },
  { to: '/admin/swaps', icon: ArrowLeftRight, label: 'Swap Requests' },
  { to: '/admin/settings', icon: Settings, label: 'Settings' },
];

function NavItem({ to, icon: Icon, label, onClick }: { to: string; icon: typeof Home; label: string; onClick?: () => void }) {
  const location = useLocation();
  const isActive = location.pathname === to;

  return (
    <NavLink
      to={to}
      onClick={onClick}
      className={cn(
        'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
        isActive
          ? 'bg-primary text-primary-foreground'
          : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
      )}
    >
      <Icon className="h-4 w-4" />
      {label}
    </NavLink>
  );
}

export function AppSidebar({ isOpen, onClose }: AppSidebarProps) {
  const { isAdmin } = useAuth();

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-foreground/20 backdrop-blur-sm md:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed left-0 top-0 z-50 h-full w-64 transform border-r bg-sidebar transition-transform duration-200 ease-in-out md:relative md:translate-x-0',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex h-16 items-center justify-between border-b px-4 md:hidden">
          <span className="font-serif text-lg font-semibold">Menu</span>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        <nav className="flex flex-col gap-1 p-4">
          <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Volunteer
          </p>
          {volunteerNav.map((item) => (
            <NavItem key={item.to} {...item} onClick={onClose} />
          ))}

          {isAdmin && (
            <>
              <div className="my-4 border-t" />
              <p className="mb-2 flex items-center gap-1.5 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <Shield className="h-3 w-3" />
                Admin
              </p>
              {adminNav.map((item) => (
                <NavItem key={item.to} {...item} onClick={onClose} />
              ))}
            </>
          )}
        </nav>
      </aside>
    </>
  );
}
