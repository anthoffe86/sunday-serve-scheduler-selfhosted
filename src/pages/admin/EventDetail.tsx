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
  Wand2,
  Mail,
  Send,
  HourglassIcon,
  Lock
} from 'lucide-react';
import { format, parseISO, isAfter, isBefore } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
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
  useSendInvitations,
  calculateScheduleConfidence,
  EventWithDetails,
  EventTemplateWithRoles
} from '@/hooks/useEventScheduler';
import { useProfiles } from '@/hooks/useVolunteerData';
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
  const [publishConfirmOpen, setPublishConfirmOpen] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  
  const { data: templates, isLoading: templatesLoading } = useEventTemplates();
  const { data: allEvents, isLoading: eventsLoading } = useEvents();
  const { data: allProfiles, isLoading: profilesLoading } = useProfiles();
  
  const updateTemplate = useUpdateEventTemplate();
  const deleteTemplate = useDeleteEventTemplate();
  const bulkUpdateStatus = useBulkUpdateEventStatus();
  const autoSchedule = useAutoSchedule();
  const sendInvitations = useSendInvitations();

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
    const confirmedCount = event.assignments.filter(a => a.status === 'confirmed').length;
    const invitedCount = event.assignments.filter(a => a.status === 'invited').length;
    const proposedCount = event.assignments.filter(a => a.status === 'proposed').length;
    
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
    
    // Fully staffed - now check confirmation status
    if (confirmedCount >= totalRequired) {
      return { isValid: true, message: 'Fully confirmed', type: 'success' as const };
    }
    
    if (confirmedCount > 0) {
      return { 
        isValid: false, 
        message: `${confirmedCount}/${totalRequired} confirmed`, 
        type: 'pending' as const 
      };
    }
    
    if (invitedCount > 0) {
      return { 
        isValid: false, 
        message: `${invitedCount} awaiting response`, 
        type: 'pending' as const 
      };
    }
    
    // All proposed
    return { 
      isValid: false, 
      message: 'Assigned, not invited', 
      type: 'warning' as const 
    };
  };

  // Check if all draft events are valid (can send invitations)
  const invitationValidation = useMemo(() => {
    const draftEvents = templateEvents.filter(e => e.status === 'draft');
    const proposedEvents = draftEvents.filter(e => 
      e.assignments.some(a => a.status === 'proposed')
    );
    const invalidEvents = draftEvents.filter(e => !getEventValidation(e).isValid);
    
    return {
      canSendInvitations: proposedEvents.length > 0 && invalidEvents.length === 0,
      draftCount: draftEvents.length,
      invalidCount: invalidEvents.length,
      readyCount: draftEvents.length - invalidEvents.length,
      proposedCount: proposedEvents.reduce((sum, e) => 
        sum + e.assignments.filter(a => a.status === 'proposed').length, 0
      )
    };
  }, [templateEvents]);

  // Calculate schedule confidence across all events
  const scheduleConfidence = useMemo(() => {
    const allAssignments = templateEvents.flatMap(e => e.assignments);
    if (allAssignments.length === 0) return null;
    
    const proposed = allAssignments.filter(a => a.status === 'proposed').length;
    const invited = allAssignments.filter(a => a.status === 'invited').length;
    const confirmed = allAssignments.filter(a => a.status === 'confirmed').length;
    const declined = allAssignments.filter(a => a.status === 'declined').length;
    const total = allAssignments.length;
    
    return {
      proposed,
      invited,
      confirmed,
      declined,
      total,
      confirmedPercent: Math.round((confirmed / total) * 100),
      pendingPercent: Math.round(((proposed + invited) / total) * 100),
      declinedPercent: Math.round((declined / total) * 100)
    };
  }, [templateEvents]);

  // Check if events are ready to publish (have confirmed assignments)
  const publishValidation = useMemo(() => {
    const draftEvents = templateEvents.filter(e => e.status === 'draft');
    // Events that can be published: have at least one confirmed assignment
    const publishableEvents = draftEvents.filter(e => 
      e.assignments.some(a => a.status === 'confirmed')
    );
    // Events fully confirmed: all assignments are confirmed
    const fullyConfirmedEvents = draftEvents.filter(e => 
      e.assignments.length > 0 && 
      e.assignments.every(a => a.status === 'confirmed' || a.status === 'declined')
    );
    
    return {
      canPublish: publishableEvents.length > 0,
      publishableCount: publishableEvents.length,
      fullyConfirmedCount: fullyConfirmedEvents.length,
      publishableEventIds: publishableEvents.map(e => e.id),
      draftCount: draftEvents.length
    };
  }, [templateEvents]);
  // Also track who is NOT assigned
  const { draftAssignmentCounts, publishedAssignmentCounts, draftUnassigned, publishedUnassigned } = useMemo(() => {
    const draftEvents = templateEvents.filter(e => e.status === 'draft');
    const publishedEvents = templateEvents.filter(e => e.status === 'published');
    
    // Get all active volunteers
    const activeVolunteers = (allProfiles || []).filter(p => p.active);
    
    const countAssignments = (events: typeof templateEvents) => {
      const counts = new Map<string, { name: string; count: number }>();
      for (const event of events) {
        for (const assignment of event.assignments) {
          const key = assignment.volunteer_id;
          const existing = counts.get(key);
          if (existing) {
            existing.count++;
          } else {
            counts.set(key, { name: assignment.volunteer_name || 'Unknown', count: 1 });
          }
        }
      }
      return {
        assigned: Array.from(counts.entries())
          .map(([id, data]) => ({ volunteerId: id, name: data.name, count: data.count }))
          .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
        assignedIds: counts,
      };
    };

    const draftResult = countAssignments(draftEvents);
    const publishedResult = countAssignments(publishedEvents);

    // Find unassigned volunteers
    const draftUnassignedList = activeVolunteers
      .filter(p => !draftResult.assignedIds.has(p.user_id))
      .map(p => ({ volunteerId: p.user_id, name: p.name }))
      .sort((a, b) => a.name.localeCompare(b.name));

    const publishedUnassignedList = activeVolunteers
      .filter(p => !publishedResult.assignedIds.has(p.user_id))
      .map(p => ({ volunteerId: p.user_id, name: p.name }))
      .sort((a, b) => a.name.localeCompare(b.name));

    return {
      draftAssignmentCounts: draftResult.assigned,
      publishedAssignmentCounts: publishedResult.assigned,
      draftUnassigned: draftUnassignedList,
      publishedUnassigned: publishedUnassignedList,
    };
  }, [templateEvents, allProfiles]);

  const publishedEventCount = useMemo(() => 
    templateEvents.filter(e => e.status === 'published').length
  , [templateEvents]);

  const handleSendInvitations = async () => {
    const draftEventIds = templateEvents
      .filter(e => e.status === 'draft' && getEventValidation(e).isValid)
      .map(e => e.id);
    
    if (draftEventIds.length === 0) {
      toast.error('No events ready for invitations');
      return;
    }

    try {
      const result = await sendInvitations.mutateAsync({ eventIds: draftEventIds });
      
      if (result.emailsSent > 0) {
        toast.success(`Sent ${result.emailsSent} invitation${result.emailsSent !== 1 ? 's' : ''} to ${result.totalVolunteers} volunteer${result.totalVolunteers !== 1 ? 's' : ''}`);
      } else {
        toast.info('No new invitations to send');
      }
    } catch (error) {
      toast.error('Failed to send invitations');
    }
  };

  const handleBulkPublish = async () => {
    if (publishValidation.publishableEventIds.length === 0) {
      toast.error('No events ready to publish');
      return;
    }

    try {
      const result = await bulkUpdateStatus.mutateAsync({
        eventIds: publishValidation.publishableEventIds,
        status: 'published',
        sendNotifications: false
      });
      
      toast.success(`Published ${result.count} event${result.count !== 1 ? 's' : ''}`);
      setPublishConfirmOpen(false);
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

  if (authLoading || templatesLoading || eventsLoading || profilesLoading) {
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
            disabled={autoSchedule.isPending || invitationValidation.draftCount === 0}
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

      {/* Schedule Confidence */}
      {scheduleConfidence && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" />
              Schedule Confidence
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">
                    {scheduleConfidence.confirmedPercent}% Confirmed
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {scheduleConfidence.confirmed}/{scheduleConfidence.total} assignments
                  </span>
                </div>
                <Progress value={scheduleConfidence.confirmedPercent} className="h-2" />
              </div>
            </div>
            <div className="flex flex-wrap gap-4 text-sm">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="bg-green-100 border-green-300 text-green-800">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  {scheduleConfidence.confirmed} Confirmed
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="bg-amber-100 border-amber-300 text-amber-800">
                  <HourglassIcon className="h-3 w-3 mr-1" />
                  {scheduleConfidence.invited} Awaiting Response
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="bg-blue-100 border-blue-300 text-blue-800">
                  <Mail className="h-3 w-3 mr-1" />
                  {scheduleConfidence.proposed} Proposed
                </Badge>
              </div>
              {scheduleConfidence.declined > 0 && (
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="bg-red-100 border-red-300 text-red-800">
                    <X className="h-3 w-3 mr-1" />
                    {scheduleConfidence.declined} Declined
                  </Badge>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Invitation Status */}
      <Card className={cn(
        invitationValidation.canSendInvitations 
          ? "border-primary/50 bg-primary/5" 
          : invitationValidation.draftCount > 0 
            ? "border-amber-200 bg-amber-50/50"
            : ""
      )}>
        <CardContent className="py-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              {invitationValidation.canSendInvitations ? (
                <div className="flex items-center gap-2 text-primary">
                  <Mail className="h-5 w-5" />
                  <span className="font-medium">
                    {invitationValidation.proposedCount} proposed assignment{invitationValidation.proposedCount !== 1 ? 's' : ''} ready to invite
                  </span>
                </div>
              ) : invitationValidation.invalidCount > 0 ? (
                <div className="flex items-center gap-2 text-amber-700">
                  <AlertCircle className="h-5 w-5" />
                  <span className="font-medium">
                    {invitationValidation.invalidCount} of {invitationValidation.draftCount} events need volunteers assigned
                  </span>
                </div>
              ) : invitationValidation.draftCount > 0 ? (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <CheckCircle2 className="h-5 w-5" />
                  <span className="font-medium">All assignments have been invited</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <CheckCircle2 className="h-5 w-5" />
                  <span className="font-medium">No draft events</span>
                </div>
              )}
            </div>
            
            {invitationValidation.canSendInvitations && (
              <Button 
                onClick={handleSendInvitations}
                disabled={sendInvitations.isPending}
                className="gap-2 shrink-0"
              >
                {sendInvitations.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                <Send className="h-4 w-4" />
                Send Invitations
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Publish Events Card */}
      {publishValidation.canPublish && (
        <Card className="border-green-200 bg-green-50/50">
          <CardContent className="py-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-green-700">
                  <Lock className="h-5 w-5" />
                  <span className="font-medium">
                    {publishValidation.publishableCount} event{publishValidation.publishableCount !== 1 ? 's' : ''} ready to publish
                  </span>
                </div>
                <p className="text-sm text-green-600 mt-1">
                  {publishValidation.fullyConfirmedCount > 0 
                    ? `${publishValidation.fullyConfirmedCount} fully confirmed`
                    : 'Some assignments still awaiting responses'}
                </p>
              </div>
              
              <Button 
                onClick={() => setPublishConfirmOpen(true)}
                disabled={bulkUpdateStatus.isPending}
                className="gap-2 shrink-0 bg-green-600 hover:bg-green-700"
              >
                {bulkUpdateStatus.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                <Lock className="h-4 w-4" />
                Publish All
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Volunteer Assignment Summary (for draft events) */}
      {(draftAssignmentCounts.length > 0 || draftUnassigned.length > 0) && invitationValidation.draftCount > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4" />
              Volunteer Assignment Summary (Draft Events)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {draftAssignmentCounts.length > 0 && (
              <div>
                <p className="text-sm text-muted-foreground mb-3">
                  How many times each volunteer is assigned across {invitationValidation.draftCount} draft event{invitationValidation.draftCount !== 1 ? 's' : ''}:
                </p>
                <div className="flex flex-wrap gap-2">
                  {draftAssignmentCounts.map((v) => (
                    <Badge 
                      key={v.volunteerId} 
                      variant="outline" 
                      className={cn(
                        "text-sm py-1.5 px-3",
                        v.count >= 3 && "border-amber-400 bg-amber-50 text-amber-800",
                        v.count >= 4 && "border-red-400 bg-red-50 text-red-800"
                      )}
                    >
                      {v.name}
                      <span className="ml-1.5 font-bold">×{v.count}</span>
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            {draftUnassigned.length > 0 && (
              <div>
                <p className="text-sm text-muted-foreground mb-3">
                  <span className="text-amber-600 font-medium">{draftUnassigned.length}</span> active volunteer{draftUnassigned.length !== 1 ? 's are' : ' is'} not assigned to any draft event:
                </p>
                <div className="flex flex-wrap gap-2">
                  {draftUnassigned.map((v) => (
                    <Badge 
                      key={v.volunteerId} 
                      variant="outline" 
                      className="text-sm py-1.5 px-3 border-muted-foreground/30 text-muted-foreground"
                    >
                      {v.name}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Volunteer Assignment Summary (for published events) */}
      {(publishedAssignmentCounts.length > 0 || publishedUnassigned.length > 0) && publishedEventCount > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4" />
              Volunteer Assignment Summary (Published Events)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {publishedAssignmentCounts.length > 0 && (
              <div>
                <p className="text-sm text-muted-foreground mb-3">
                  How many times each volunteer is assigned across {publishedEventCount} published event{publishedEventCount !== 1 ? 's' : ''}:
                </p>
                <div className="flex flex-wrap gap-2">
                  {publishedAssignmentCounts.map((v) => (
                    <Badge 
                      key={v.volunteerId} 
                      variant="outline" 
                      className={cn(
                        "text-sm py-1.5 px-3",
                        v.count >= 3 && "border-amber-400 bg-amber-50 text-amber-800",
                        v.count >= 4 && "border-red-400 bg-red-50 text-red-800"
                      )}
                    >
                      {v.name}
                      <span className="ml-1.5 font-bold">×{v.count}</span>
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            {publishedUnassigned.length > 0 && (
              <div>
                <p className="text-sm text-muted-foreground mb-3">
                  <span className="text-amber-600 font-medium">{publishedUnassigned.length}</span> active volunteer{publishedUnassigned.length !== 1 ? 's are' : ' is'} not assigned to any published event:
                </p>
                <div className="flex flex-wrap gap-2">
                  {publishedUnassigned.map((v) => (
                    <Badge 
                      key={v.volunteerId} 
                      variant="outline" 
                      className="text-sm py-1.5 px-3 border-muted-foreground/30 text-muted-foreground"
                    >
                      {v.name}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

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
                          <span className="text-xs text-muted-foreground">
                            ({filledCount}/{requiredCount})
                          </span>
                        </div>
                        
                        {/* Volunteer assignments by role */}
                        {event.assignments.length > 0 ? (
                          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                            {event.roles.map((role) => {
                              const roleAssignments = event.assignments.filter(a => a.role === role.role);
                              if (roleAssignments.length === 0) return null;
                              return (
                                <div key={role.id} className="flex items-center gap-1">
                                  <span className="text-muted-foreground text-xs">
                                    {ROLE_LABELS[role.role as keyof typeof ROLE_LABELS]?.split(' ')[0] || role.role}:
                                  </span>
                                  <span className="font-medium">
                                    {roleAssignments.map(a => a.volunteer_name?.split(' ')[0] || 'Unknown').join(', ')}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground italic">No volunteers assigned</p>
                        )}
                      </div>

                      {/* Validation status */}
                      <div className={cn(
                        "flex items-center gap-1.5 text-sm shrink-0",
                        validation.type === 'success' && "text-green-600",
                        validation.type === 'pending' && "text-blue-600",
                        validation.type === 'error' && "text-amber-600",
                        validation.type === 'warning' && "text-muted-foreground"
                      )}>
                        {validation.type === 'success' ? (
                          <CheckCircle2 className="h-4 w-4" />
                        ) : validation.type === 'pending' ? (
                          <HourglassIcon className="h-4 w-4" />
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

      {/* Publish Confirmation */}
      <AlertDialog open={publishConfirmOpen} onOpenChange={setPublishConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Publish {publishValidation.publishableCount} Events?</AlertDialogTitle>
            <AlertDialogDescription>
              This will publish all events that have confirmed volunteer assignments. 
              Published events will be visible to all volunteers on the schedule.
              {publishValidation.fullyConfirmedCount < publishValidation.publishableCount && (
                <span className="block mt-2 text-amber-600">
                  Note: {publishValidation.publishableCount - publishValidation.fullyConfirmedCount} event(s) still have pending invitations.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleBulkPublish}
              className="bg-green-600 hover:bg-green-700"
            >
              {bulkUpdateStatus.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Publish All
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminEventDetail;
