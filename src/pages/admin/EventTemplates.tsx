import { useState } from 'react';
import { 
  Plus, 
  Edit2, 
  Trash2, 
  Calendar,
  Clock,
  Repeat,
  Users,
  Loader2,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import { Navigate } from 'react-router-dom';
import { 
  useEventTemplates, 
  useDeleteEventTemplate,
  DAYS_OF_WEEK,
  EventTemplateWithRoles
} from '@/hooks/useEventScheduler';
import { ROLE_LABELS } from '@/types';
import { toast } from 'sonner';
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
import { EventTemplateDialog } from '@/components/admin/EventTemplateDialog';
import { GenerateEventsDialog } from '@/components/admin/GenerateEventsDialog';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

const EventTemplates = () => {
  const { isAdmin, isLoading: authLoading } = useAuth();
  const { data: templates, isLoading } = useEventTemplates();
  const deleteTemplate = useDeleteEventTemplate();

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editTemplate, setEditTemplate] = useState<EventTemplateWithRoles | null>(null);
  const [deleteTemplateId, setDeleteTemplateId] = useState<string | null>(null);
  const [generateTemplateId, setGenerateTemplateId] = useState<string | null>(null);
  const [expandedTemplates, setExpandedTemplates] = useState<Set<string>>(new Set());

  if (authLoading || isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  const handleDelete = async () => {
    if (!deleteTemplateId) return;
    
    try {
      await deleteTemplate.mutateAsync(deleteTemplateId);
      toast.success('Event template deleted');
      setDeleteTemplateId(null);
    } catch (error) {
      toast.error('Failed to delete template');
    }
  };

  const toggleExpanded = (id: string) => {
    setExpandedTemplates(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  const getRecurrenceLabel = (template: EventTemplateWithRoles) => {
    if (!template.is_recurring) return 'One-off';
    if (template.recurrence_end_type === 'indefinite') return 'Recurring (Indefinite)';
    if (template.recurrence_end_type === 'date') return `Recurring (Until ${template.recurrence_end_date})`;
    if (template.recurrence_end_type === 'count') return `Recurring (${template.recurrence_count} events)`;
    return 'Recurring';
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-serif text-3xl font-bold">Event Templates</h1>
          <p className="text-muted-foreground">
            Create and manage recurring or one-off event templates
          </p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)} className="gap-2 self-start">
          <Plus className="h-4 w-4" />
          Create Template
        </Button>
      </div>

      {!templates || templates.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Calendar className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="font-medium text-lg mb-2">No Event Templates</h3>
            <p className="text-muted-foreground text-center mb-4">
              Create your first event template to start scheduling services.
            </p>
            <Button onClick={() => setCreateDialogOpen(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              Create Template
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {templates.map((template) => (
            <Card key={template.id} className={!template.active ? 'opacity-60' : ''}>
              <Collapsible 
                open={expandedTemplates.has(template.id)}
                onOpenChange={() => toggleExpanded(template.id)}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <CardTitle className="font-serif text-lg">{template.name}</CardTitle>
                        {!template.active && (
                          <Badge variant="secondary">Inactive</Badge>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-4 mt-2 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1.5">
                          <Calendar className="h-4 w-4" />
                          {DAYS_OF_WEEK.find(d => d.value === template.day_of_week)?.label}
                        </span>
                        <span className="flex items-center gap-1.5">
                          <Clock className="h-4 w-4" />
                          {formatTime(template.start_time)}
                        </span>
                        <span className="flex items-center gap-1.5">
                          <Repeat className="h-4 w-4" />
                          {getRecurrenceLabel(template)}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <CollapsibleTrigger asChild>
                        <Button variant="ghost" size="sm">
                          {expandedTemplates.has(template.id) ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                        </Button>
                      </CollapsibleTrigger>
                    </div>
                  </div>
                </CardHeader>

                <CollapsibleContent>
                  <CardContent className="pt-4 border-t">
                    {template.description && (
                      <p className="text-sm text-muted-foreground mb-4">
                        {template.description}
                      </p>
                    )}

                    <div className="mb-4">
                      <h4 className="text-sm font-medium mb-2 flex items-center gap-1.5">
                        <Users className="h-4 w-4" />
                        Volunteer Requirements
                      </h4>
                      {template.roles.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No roles defined</p>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {template.roles.map((role) => (
                            <Badge key={role.id} variant="outline">
                              {ROLE_LABELS[role.role as keyof typeof ROLE_LABELS] || role.role} × {role.quantity}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setGenerateTemplateId(template.id)}
                        className="gap-1.5"
                      >
                        <Calendar className="h-4 w-4" />
                        Generate Events
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setEditTemplate(template)}
                        className="gap-1.5"
                      >
                        <Edit2 className="h-4 w-4" />
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setDeleteTemplateId(template.id)}
                        className="gap-1.5 text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                        Delete
                      </Button>
                    </div>
                  </CardContent>
                </CollapsibleContent>
              </Collapsible>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <EventTemplateDialog
        open={createDialogOpen || !!editTemplate}
        onOpenChange={(open) => {
          if (!open) {
            setCreateDialogOpen(false);
            setEditTemplate(null);
          }
        }}
        template={editTemplate}
      />

      {/* Generate Events Dialog */}
      <GenerateEventsDialog
        open={!!generateTemplateId}
        onOpenChange={(open) => !open && setGenerateTemplateId(null)}
        templateId={generateTemplateId}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTemplateId} onOpenChange={(open) => !open && setDeleteTemplateId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Event Template?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this event template. Existing events created from this template will not be affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default EventTemplates;
