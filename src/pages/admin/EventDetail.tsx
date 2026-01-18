import { useState, useMemo } from 'react';
import { useParams, Navigate, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft,
  Loader2, 
  Calendar,
  Clock,
  Users,
  CheckCircle2,
  AlertCircle,
  Edit2,
  Trash2,
  Check,
  X,
  UserPlus,
  Wand2
} from 'lucide-react';
import { format, parseISO, isAfter, isBefore } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useAuth } from '@/hooks/useAuth';
import { 
  useEventTemplates, 
  useEvents,
  useUpdateEventTemplate,
  useDeleteEventTemplate,
  useBulkUpdateEventStatus,
  useAutoSchedule,
  EventWithDetails,
  EventTemplateWithRoles
} from '@/hooks/useEventScheduler';
import { cn } from '@/lib/utils';
import { ROLE_LABELS } from '@/types';
import { DAYS_OF_WEEK } from '@/hooks/useEventScheduler';
import { EditEventDialog } from '@/components/admin/EditEventDialog';
import { EditEventTemplateDialog } from '@/components/admin/EditEventTemplateDialog';
import { toast } from 'sonner';

const AdminEventDetail = () => {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const { isAdmin, isLoading: authLoading } = useAuth();
  
  const [editTemplateOpen, setEditTemplateOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  
  const { data: templates, isLoading: templatesLoading } = useEventTemplates();
  const { data: allEvents, isLoading: eventsLoading } = useEvents();
  
  const updateTemplate = useUpdateEventTemplate();
  const deleteTemplate = useDeleteEventTemplate();
  const bulkUpdateStatus = useBulkUpdateEventStatus();
  const autoSchedule = useAutoSchedule();

  // Find the template
  const template = useMemo(() => {
    return templates?.find(t => t.id === eventId) || null;
  }, [templates, eventId]);

  // Get events for this template
  const templateEvents = useMemo(() => {
    if (!allEvents || !eventId) return [];
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    return allEvents
      .filter(e => e.template_id === eventId)
      .filter(e => {
        const eventDate = parseISO(e.date);
        return isAfter(eventDate, today) || format(eventDate, 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd');
      })
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [allEvents, eventId]);

  // Selected event for editing
  const selectedEvent = useMemo(() => {
    if (!selectedEventId) return null;
    return allEvents?.find(e => e.id === selectedEventId) || null;
  }, [selectedEventId, allEvents]);

  // Calculate validation status for each event
  const getEventValidation = (event: EventWithDetails) => {
    const totalRequired = event.roles.reduce((sum, r) => sum + r.quantity, 0);
    const totalFilled = event.assignments.length;
    
    if (totalRequired === 0) {
      return { isValid: false, message: 'No roles defined', type: 'warning' as const };
    }
    
    if (totalFilled < totalRequired) {
      return { 
        isValid: false, 
        message: `${totalRequired - totalFilled} volunteer${totalRequired - totalFilled !== 1 ? 's' : ''} needed`, 
        type: 'error' as const 
      };
    }
    
    return { isValid: true, message: 'Fully staffed', type: 'success' as const };
  };

  // Check if all draft events are valid (can publish all)
  const publishValidation = useMemo(() => {
    const draftEvents = templateEvents.filter(e => e.status === 'draft');
    const invalidEvents = draftEvents.filter(e => !getEventValidation(e).isValid);
    
    return {
      canPublishAll: draftEvents.length > 0 && invalidEvents.length === 0,
      draftCount: draftEvents.length,
      invalidCount: invalidEvents.length,
      readyCount: draftEvents.length - invalidEvents.length
    };
  }, [templateEvents]);

  const handlePublishAll = async () => {
    const draftEventIds = templateEvents
      .filter(e => e.status === 'draft' && getEventValidation(e).isValid)
      .map(e => e.id);
    
    if (draftEventIds.length === 0) {
      toast.error('No events ready to publish');
      return;
    }

    try {
      await bulkUpdateStatus.mutateAsync({ eventIds: draftEventIds, status: 'published' });
      toast.success(`Published ${draftEventIds.length} event${draftEventIds.length !== 1 ? 's' : ''}`);
    } catch (error) {
      toast.error('Failed to publish events');
    }
  };

  const handleDeleteTemplate = async () => {
    if (!template) return;
    
    try {
      await deleteTemplate.mutateAsync(template.id);
      toast.success('Event deleted');
      navigate('/admin/events');
    } catch (error) {
      toast.error('Failed to delete event');
    }
  };

  const handleAutoSchedule = async () => {
    if (!template) return;
    
    try {
      const result = await autoSchedule.mutateAsync({ templateId: template.id });
      if (result.totalAssignments === 0) {
        toast.info('No volunteers could be assigned. Check availability and role preferences.');
      } else {
        toast.success(`Assigned ${result.totalAssignments} volunteers across ${result.totalEvents} events`);
      }
    } catch (error) {
      console.error('Auto-schedule error:', error);
      toast.error('Failed to auto-schedule volunteers');
    }
  };

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  if (authLoading || templatesLoading || eventsLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  if (!template) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => navigate('/admin/events')} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Back to Events
        </Button>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <AlertCircle className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="font-medium text-lg mb-2">Event Not Found</h3>
            <p className="text-muted-foreground">This event may have been deleted.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const dayLabel = DAYS_OF_WEEK.find(d => d.value === template.day_of_week)?.label || 'Unknown';

  return (
    <div className="space-y-6">
      {/* Back button */}
      <Button variant="ghost" onClick={() => navigate('/admin/events')} className="gap-2 -ml-2">
        <ArrowLeft className="h-4 w-4" />
        Back to Events
      </Button>

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="font-serif text-3xl font-bold">{template.name}</h1>
            {!template.active && (
              <Badge variant="secondary">Inactive</Badge>
            )}
          </div>
          {template.description && (
            <p className="text-muted-foreground mb-2">{template.description}</p>
          )}
          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Calendar className="h-4 w-4" />
              Every {dayLabel}
            </span>
            <span className="flex items-center gap-1.5">
              <Clock className="h-4 w-4" />
              {formatTime(template.start_time)}
            </span>
          </div>
        </div>
        
        <div className="flex flex-wrap gap-2 self-start">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleAutoSchedule}
            disabled={autoSchedule.isPending || publishValidation.draftCount === 0}
            className="gap-1.5"
          >
            {autoSchedule.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Wand2 className="h-4 w-4" />
            )}
            Auto Assign
          </Button>
          <Button variant="outline" size="sm" onClick={() => setEditTemplateOpen(true)} className="gap-1.5">
            <Edit2 className="h-4 w-4" />
            Edit
          </Button>
          <Button 
            variant="destructive" 
            size="sm" 
            onClick={() => setDeleteConfirmOpen(true)}
            className="gap-1.5"
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </Button>
        </div>
      </div>

      {/* Roles Card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4" />
            Required Roles
          </CardTitle>
        </CardHeader>
        <CardContent>
          {template.roles.length === 0 ? (
            <p className="text-sm text-muted-foreground">No roles defined for this event.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {template.roles.map((role) => (
                <Badge key={role.id} variant="outline" className="text-sm py-1 px-3">
                  {ROLE_LABELS[role.role as keyof typeof ROLE_LABELS] || role.role}
                  <span className="ml-1.5 text-muted-foreground">×{role.quantity}</span>
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Publishing Status */}
      <Card className={cn(
        publishValidation.canPublishAll 
          ? "border-green-200 bg-green-50/50" 
          : publishValidation.draftCount > 0 
            ? "border-amber-200 bg-amber-50/50"
            : ""
      )}>
        <CardContent className="py-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              {publishValidation.canPublishAll ? (
                <div className="flex items-center gap-2 text-green-700">
                  <CheckCircle2 className="h-5 w-5" />
                  <span className="font-medium">
                    All {publishValidation.draftCount} draft events are ready to publish
                  </span>
                </div>
              ) : publishValidation.draftCount > 0 ? (
                <div className="flex items-center gap-2 text-amber-700">
                  <AlertCircle className="h-5 w-5" />
                  <span className="font-medium">
                    {publishValidation.invalidCount} of {publishValidation.draftCount} draft events need volunteers assigned
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <CheckCircle2 className="h-5 w-5" />
                  <span className="font-medium">All events are published</span>
                </div>
              )}
            </div>
            
            {publishValidation.draftCount > 0 && (
              <Button 
                onClick={handlePublishAll}
                disabled={!publishValidation.canPublishAll || bulkUpdateStatus.isPending}
                className="gap-2 shrink-0"
              >
                {bulkUpdateStatus.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                <Check className="h-4 w-4" />
                Publish All ({publishValidation.readyCount})
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Events List */}
      <div>
        <h2 className="font-semibold text-lg mb-4">Upcoming Dates ({templateEvents.length})</h2>
        
        {templateEvents.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Calendar className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <h3 className="font-medium text-lg mb-2">No Upcoming Events</h3>
              <p className="text-muted-foreground">All scheduled dates have passed.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {templateEvents.map((event) => {
              const validation = getEventValidation(event);
              const eventDate = parseISO(event.date);
              const filledCount = event.assignments.length;
              const requiredCount = event.roles.reduce((sum, r) => sum + r.quantity, 0);

              return (
                <Card 
                  key={event.id}
                  className={cn(
                    "cursor-pointer hover:shadow-md transition-all",
                    event.status === 'cancelled' && "opacity-60"
                  )}
                  onClick={() => setSelectedEventId(event.id)}
                >
                  <CardContent className="py-3 px-4">
                    <div className="flex items-center gap-4">
                      {/* Date */}
                      <div className={cn(
                        "flex flex-col items-center justify-center rounded-lg px-3 py-2 min-w-[60px]",
                        event.status === 'published' 
                          ? "bg-primary/10 text-primary"
                          : event.status === 'cancelled'
                            ? "bg-muted text-muted-foreground"
                            : "bg-secondary text-secondary-foreground"
                      )}>
                        <span className="text-xs font-medium uppercase">
                          {format(eventDate, 'EEE')}
                        </span>
                        <span className="text-xl font-bold">
                          {format(eventDate, 'd')}
                        </span>
                        <span className="text-xs">
                          {format(eventDate, 'MMM')}
                        </span>
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge 
                            variant={
                              event.status === 'published' 
                                ? 'default' 
                                : event.status === 'cancelled' 
                                  ? 'destructive' 
                                  : 'secondary'
                            }
                            className="text-xs"
                          >
                            {event.status}
                          </Badge>
                          <span className="text-sm text-muted-foreground">
                            {formatTime(event.start_time)}
                          </span>
                        </div>
                        
                        {/* Volunteer count */}
                        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                          <Users className="h-4 w-4" />
                          <span>{filledCount}/{requiredCount} volunteers</span>
                        </div>
                      </div>

                      {/* Validation status */}
                      <div className={cn(
                        "flex items-center gap-1.5 text-sm shrink-0",
                        validation.type === 'success' && "text-green-600",
                        validation.type === 'error' && "text-amber-600",
                        validation.type === 'warning' && "text-muted-foreground"
                      )}>
                        {validation.type === 'success' ? (
                          <CheckCircle2 className="h-4 w-4" />
                        ) : (
                          <AlertCircle className="h-4 w-4" />
                        )}
                        <span className="hidden sm:inline">{validation.message}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Edit Template Dialog */}
      {template && (
        <EditEventTemplateDialog
          open={editTemplateOpen}
          onOpenChange={setEditTemplateOpen}
          template={template}
        />
      )}

      {/* Edit Event Dialog */}
      <EditEventDialog
        open={!!selectedEventId}
        onOpenChange={(open) => !open && setSelectedEventId(null)}
        event={selectedEvent}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Event Template?</AlertDialogTitle>
            <AlertDialogDescription>
              This will delete the event template. Note that existing event instances will not be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteTemplate}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteTemplate.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminEventDetail;
