import { useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Trash2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  useCreateEventTemplate, 
  useUpdateEventTemplate,
  DAYS_OF_WEEK,
  EventTemplateWithRoles
} from '@/hooks/useEventScheduler';
import { ROLE_LABELS, Role } from '@/types';
import { toast } from 'sonner';

const formSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  day_of_week: z.number().min(0).max(6),
  start_time: z.string().min(1, 'Start time is required'),
  is_recurring: z.boolean(),
  recurrence_end_type: z.enum(['indefinite', 'date', 'count']).nullable(),
  recurrence_end_date: z.string().nullable(),
  recurrence_count: z.number().nullable(),
  active: z.boolean(),
  roles: z.array(z.object({
    role: z.string().min(1, 'Role is required'),
    quantity: z.number().min(1, 'Quantity must be at least 1'),
  })),
});

type FormData = z.infer<typeof formSchema>;

interface EventTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template?: EventTemplateWithRoles | null;
}

export function EventTemplateDialog({ open, onOpenChange, template }: EventTemplateDialogProps) {
  const createTemplate = useCreateEventTemplate();
  const updateTemplate = useUpdateEventTemplate();
  const isEditing = !!template;

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      description: '',
      day_of_week: 0,
      start_time: '10:00',
      is_recurring: true,
      recurrence_end_type: 'indefinite',
      recurrence_end_date: null,
      recurrence_count: null,
      active: true,
      roles: [],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'roles',
  });

  const isRecurring = form.watch('is_recurring');
  const recurrenceEndType = form.watch('recurrence_end_type');

  useEffect(() => {
    if (template) {
      form.reset({
        name: template.name,
        description: template.description || '',
        day_of_week: template.day_of_week,
        start_time: template.start_time,
        is_recurring: template.is_recurring,
        recurrence_end_type: template.recurrence_end_type,
        recurrence_end_date: template.recurrence_end_date,
        recurrence_count: template.recurrence_count,
        active: template.active,
        roles: template.roles.map(r => ({ role: r.role, quantity: r.quantity })),
      });
    } else {
      form.reset({
        name: '',
        description: '',
        day_of_week: 0,
        start_time: '10:00',
        is_recurring: true,
        recurrence_end_type: 'indefinite',
        recurrence_end_date: null,
        recurrence_count: null,
        active: true,
        roles: [],
      });
    }
  }, [template, form]);

  const onSubmit = async (data: FormData) => {
    try {
      if (isEditing && template) {
        await updateTemplate.mutateAsync({
          id: template.id,
          ...data,
          description: data.description || undefined,
          recurrence_end_type: data.is_recurring ? data.recurrence_end_type : null,
          recurrence_end_date: data.recurrence_end_type === 'date' ? data.recurrence_end_date : null,
          recurrence_count: data.recurrence_end_type === 'count' ? data.recurrence_count : null,
        });
        toast.success('Event template updated');
      } else {
        await createTemplate.mutateAsync({
          ...data,
          description: data.description || undefined,
          recurrence_end_type: data.is_recurring ? data.recurrence_end_type || undefined : undefined,
          recurrence_end_date: data.recurrence_end_type === 'date' ? data.recurrence_end_date || undefined : undefined,
          recurrence_count: data.recurrence_end_type === 'count' ? data.recurrence_count || undefined : undefined,
        });
        toast.success('Event template created');
      }
      onOpenChange(false);
    } catch (error) {
      toast.error(isEditing ? 'Failed to update template' : 'Failed to create template');
    }
  };

  const availableRoles = Object.entries(ROLE_LABELS) as [Role, string][];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-serif">
            {isEditing ? 'Edit Event Template' : 'Create Event Template'}
          </DialogTitle>
          <DialogDescription>
            {isEditing 
              ? 'Update the event template settings and volunteer requirements.'
              : 'Create a new event template to schedule recurring or one-off services.'
            }
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Event Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., 10am Sunday Service" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description (Optional)</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Add any additional notes about this event..."
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="day_of_week"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Day of Week</FormLabel>
                    <Select
                      value={field.value.toString()}
                      onValueChange={(value) => field.onChange(parseInt(value, 10))}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {DAYS_OF_WEEK.map((day) => (
                          <SelectItem key={day.value} value={day.value.toString()}>
                            {day.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="start_time"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Start Time</FormLabel>
                    <FormControl>
                      <Input type="time" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="space-y-4 rounded-lg border p-4">
              <FormField
                control={form.control}
                name="is_recurring"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between">
                    <div>
                      <FormLabel>Recurring Event</FormLabel>
                      <FormDescription>
                        Enable to create multiple events on a weekly schedule
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              {isRecurring && (
                <div className="space-y-4 pt-4 border-t">
                  <FormField
                    control={form.control}
                    name="recurrence_end_type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Recurrence End</FormLabel>
                        <Select
                          value={field.value || 'indefinite'}
                          onValueChange={field.onChange}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="indefinite">Indefinite (no end date)</SelectItem>
                            <SelectItem value="date">Until specific date</SelectItem>
                            <SelectItem value="count">After number of events</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {recurrenceEndType === 'date' && (
                    <FormField
                      control={form.control}
                      name="recurrence_end_date"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>End Date</FormLabel>
                          <FormControl>
                            <Input 
                              type="date" 
                              value={field.value || ''} 
                              onChange={(e) => field.onChange(e.target.value || null)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                  {recurrenceEndType === 'count' && (
                    <FormField
                      control={form.control}
                      name="recurrence_count"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Number of Events</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              min={1}
                              value={field.value || ''} 
                              onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value, 10) : null)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                </div>
              )}
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium">Volunteer Requirements</h4>
                  <p className="text-sm text-muted-foreground">
                    Define the roles and quantities needed for this event
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => append({ role: '', quantity: 1 })}
                  className="gap-1.5"
                >
                  <Plus className="h-4 w-4" />
                  Add Role
                </Button>
              </div>

              {fields.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4 border rounded-lg">
                  No roles defined. Add roles to specify volunteer requirements.
                </p>
              ) : (
                <div className="space-y-3">
                  {fields.map((field, index) => (
                    <div key={field.id} className="flex items-end gap-3">
                      <FormField
                        control={form.control}
                        name={`roles.${index}.role`}
                        render={({ field }) => (
                          <FormItem className="flex-1">
                            {index === 0 && <FormLabel>Role</FormLabel>}
                            <Select value={field.value} onValueChange={field.onChange}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select role" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {availableRoles.map(([value, label]) => (
                                  <SelectItem key={value} value={value}>
                                    {label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name={`roles.${index}.quantity`}
                        render={({ field }) => (
                          <FormItem className="w-24">
                            {index === 0 && <FormLabel>Qty</FormLabel>}
                            <FormControl>
                              <Input 
                                type="number" 
                                min={1}
                                {...field}
                                onChange={(e) => field.onChange(parseInt(e.target.value, 10) || 1)}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => remove(index)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {isEditing && (
              <FormField
                control={form.control}
                name="active"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-4">
                    <div>
                      <FormLabel>Active</FormLabel>
                      <FormDescription>
                        Inactive templates won't be shown when generating events
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={createTemplate.isPending || updateTemplate.isPending}
              >
                {(createTemplate.isPending || updateTemplate.isPending) && (
                  <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                )}
                {isEditing ? 'Save Changes' : 'Create Template'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
