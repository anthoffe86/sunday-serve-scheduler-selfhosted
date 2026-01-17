import { format, parseISO } from 'date-fns';
import { useAuth } from '@/hooks/useAuth';
import { ROLE_LABELS, Role } from '@/types';
import { cn } from '@/lib/utils';

interface ScheduleService {
  id: string;
  date: string;
  status: 'draft' | 'published';
  assignments: {
    id: string;
    role: string;
    volunteer_id: string;
    volunteerName?: string;
  }[];
}

interface ScheduleTableProps {
  services: ScheduleService[];
}

export function ScheduleTable({ services }: ScheduleTableProps) {
  const { user } = useAuth();

  const uniqueRoles = [
    'sidesman-standard',
    'sidesman-sound',
    'sidesman-welcome',
    'reader',
    'intercessions',
    'collection',
  ] as const;

  return (
    <div className="overflow-x-auto rounded-xl border bg-card">
      <table className="w-full min-w-[640px]">
        <thead>
          <tr className="border-b bg-muted/50">
            <th className="sticky left-0 bg-muted/50 px-4 py-3 text-left text-sm font-semibold">
              Date
            </th>
            {uniqueRoles.map((role) => (
              <th
                key={role}
                className="px-4 py-3 text-left text-sm font-semibold"
              >
                {ROLE_LABELS[role as Role]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y">
          {services.map((service) => {
            const dateObj = parseISO(service.date);
            const getVolunteersForRole = (role: string) =>
              service.assignments.filter((a) => a.role === role);

            return (
              <tr key={service.id} className="hover:bg-muted/30">
                <td className="sticky left-0 bg-card px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div>
                      <p className="font-serif font-semibold">
                        {format(dateObj, 'MMM d')}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {format(dateObj, 'EEEE')}
                      </p>
                    </div>
                    {service.status === 'draft' && (
                      <span className="rounded bg-accent/20 px-1.5 py-0.5 text-[10px] font-medium">
                        Draft
                      </span>
                    )}
                  </div>
                </td>
                {uniqueRoles.map((role) => {
                  const volunteers = getVolunteersForRole(role);
                  return (
                    <td key={role} className="px-4 py-3">
                      <div className="flex flex-col gap-1">
                        {volunteers.length > 0 ? (
                          volunteers.map((v) => (
                            <span
                              key={v.id}
                              className={cn(
                                'inline-block rounded-md px-2 py-1 text-sm',
                                v.volunteer_id === user?.id
                                  ? 'bg-primary/10 font-medium text-primary'
                                  : 'bg-secondary'
                              )}
                            >
                              {v.volunteerName?.split(' ')[0] || 'Unknown'}
                              {v.volunteer_id === user?.id && (
                                <span className="ml-1 text-xs">(You)</span>
                              )}
                            </span>
                          ))
                        ) : (
                          <span className="text-sm text-muted-foreground">—</span>
                        )}
                      </div>
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
