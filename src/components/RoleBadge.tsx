import { Role, ROLE_LABELS } from '@/types';
import { cn } from '@/lib/utils';

interface RoleBadgeProps {
  role: Role;
  className?: string;
}

const roleColorMap: Record<Role, string> = {
  'sidesman-standard': 'bg-[hsl(200,60%,50%)]',
  'sidesman-sound': 'bg-[hsl(200,45%,45%)]',
  'sidesman-welcome': 'bg-[hsl(200,50%,55%)]',
  'reader': 'bg-[hsl(280,50%,55%)]',
  'intercessions': 'bg-[hsl(330,55%,55%)]',
  'collection': 'bg-[hsl(45,80%,45%)]',
};

export function RoleBadge({ role, className }: RoleBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium text-white',
        roleColorMap[role],
        className
      )}
    >
      {ROLE_LABELS[role]}
    </span>
  );
}
