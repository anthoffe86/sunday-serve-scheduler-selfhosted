import { format, parseISO } from 'date-fns';
import { ArrowLeftRight, Calendar } from 'lucide-react';
import { SundayService, ROLE_LABELS } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RoleBadge } from './RoleBadge';
import { currentUser } from '@/data/mockData';

interface AssignmentCardProps {
  service: SundayService;
  showSwapButton?: boolean;
}

export function AssignmentCard({ service, showSwapButton = true }: AssignmentCardProps) {
  const myAssignment = service.assignments.find(
    (a) => a.volunteerId === currentUser.id
  );

  const dateObj = parseISO(service.date);
  const isThisWeek = new Date().getTime() - dateObj.getTime() < 7 * 24 * 60 * 60 * 1000 && dateObj > new Date();

  if (!myAssignment) return null;

  return (
    <Card className={cn(
      'transition-all hover:shadow-md',
      isThisWeek && 'ring-2 ring-primary/20 bg-primary/5'
    )}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
              <Calendar className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <CardTitle className="text-base font-serif">
                {format(dateObj, 'EEEE, MMMM d')}
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                {isThisWeek ? 'This Sunday' : format(dateObj, 'yyyy')}
              </p>
            </div>
          </div>
          {service.status === 'draft' && (
            <span className="rounded-full bg-accent/20 px-2 py-0.5 text-xs font-medium text-accent-foreground">
              Draft
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Your Role</p>
            <RoleBadge role={myAssignment.role} className="mt-1" />
          </div>
          {showSwapButton && (
            <Button variant="outline" size="sm" className="gap-1.5">
              <ArrowLeftRight className="h-3.5 w-3.5" />
              Request Swap
            </Button>
          )}
        </div>

        <div className="border-t pt-3">
          <p className="mb-2 text-xs font-medium text-muted-foreground">
            Also serving this Sunday
          </p>
          <div className="flex flex-wrap gap-1.5">
            {service.assignments
              .filter((a) => a.volunteerId !== currentUser.id)
              .slice(0, 4)
              .map((a) => (
                <span
                  key={a.volunteerId}
                  className="rounded-full bg-secondary px-2 py-0.5 text-xs"
                >
                  {a.volunteerName.split(' ')[0]}
                </span>
              ))}
            {service.assignments.length > 5 && (
              <span className="rounded-full bg-secondary px-2 py-0.5 text-xs">
                +{service.assignments.length - 5} more
              </span>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}
