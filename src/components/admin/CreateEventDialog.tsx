import { useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Trash2, Loader2 } from 'lucide-react';
import { format, addMonths, addWeeks, getDay, nextDay, parseISO, isAfter } from 'date-fns';
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
  DAYS_OF_WEEK,
} from '@/hooks/useEventScheduler';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { ROLE_LABELS, Role } from '@/types';
import { toast } from 'sonner';
import type { Database } from '@/integrations/supabase/types';

type ServiceRole = Database['public']['Enums']['service_role'];

const formSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  day_of_week: z.number().min(0).max(6),
  start_time: z.string().min(1, 'Start time is required'),
  is_recurring: z.boolean(),
  recurrence_end_type: z.enum(['indefinite', 'date', 'count']),
  recurrence_end_date: z.string().optional(),
  recurrence_count: z.number().min(1).max(104).optional(),
  roles: z.array(z.object({
    role: z.string().min(1, 'Role is required'),
    quantity: z.number().min(1, 'Quantity must be at least 1'),
  })),
});

type FormData = z.infer<typeof formSchema>;

interface CreateEventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateEventDialog({ open, onOpenChange }: CreateEventDialogProps) {
  const createTemplate = useCreateEventTemplate();
  const queryClient = useQueryClient();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      description: '',
      day_of_week: 0,
      start_time: '10:00',
      is_recurring: true,
      recurrence_end_type: 'count',
      recurrence_end_date: format(addMonths(new Date(), 3), 'yyyy-MM-dd'),
      recurrence_count: 12,
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
    if (open) {
      form.reset({
        name: '',
        description: '',
        day_of_week: 0,
        start_time: '10:00',
        is_recurring: true,
        recurrence_end_type: 'count',
        recurrence_end_date: format(addMonths(new Date(), 3), 'yyyy-MM-dd'),
        recurrence_count: 12,
        roles: [],
      });
    }
  }, [open, form]);

  const generateEventDates = (
    dayOfWeek: number,
    startDate: Date,
    endType: 'indefinite' | 'date' | 'count',
    endDate?: string,
    count?: number
  ): string[] => {
    const dates: string[] = [];
    let currentDate = startDate;
    
    // Find next occurrence of the target day
    if (getDay(currentDate) !== dayOfWeek) {
      currentDate = nextDay(currentDate, dayOfWeek as 0 | 1 | 2 | 3 | 4 | 5 | 6);
    }

    const maxDate = endType === 'date' && endDate 
      ? parseISO(endDate) 
      : addMonths(currentDate, 24); // 2 year max for indefinite
    
    const maxCount = endType === 'count' && count 
      ? count 
      : endType === 'indefinite' 
        ? 52 // 1 year for indefinite
        : 104;

    while (dates.length < maxCount && !isAfter(currentDate, maxDate)) {
      dates.push(format(currentDate, 'yyyy-MM-dd'));
      currentDate = addWeeks(currentDate, 1);
    }

    return dates;
  };

  const onSubmit = async (data: FormData) => {
    // Merge duplicate roles
    const mergedRolesMap = new Map<string, number>();
    for (const r of data.roles) {
      if (!r.role) continue;
      const qty = Number(r.quantity) || 0;
      if (qty <= 0) continue;
      mergedRolesMap.set(r.role, (mergedRolesMap.get(r.role) || 0) + qty);
    }
    const roles = Array.from(mergedRolesMap.entries()).map(([role, quantity]) => ({ role, quantity }));

    try {
      // 1. Create the template
      const template = await createTemplate.mutateAsync({
        name: data.name,
        description: data.description || undefined,
        day_of_week: data.day_of_week,
        start_time: data.start_time,
        is_recurring: data.is_recurring,
        recurrence_end_type: data.is_recurring ? data.recurrence_end_type : undefined,
        recurrence_end_date: data.recurrence_end_type === 'date' ? data.recurrence_end_date : undefined,
        recurrence_count: data.recurrence_end_type === 'count' ? data.recurrence_count : undefined,
        roles,
      });

      // 2. Generate event dates
      const dates = data.is_recurring
        ? generateEventDates(
            data.day_of_week,
            new Date(),
            data.recurrence_end_type,
            data.recurrence_end_date,
            data.recurrence_count
          )
        : [format(nextDay(new Date(), data.day_of_week as 0 | 1 | 2 | 3 | 4 | 5 | 6), 'yyyy-MM-dd')];

      // 3. Create events
      const eventsToCreate = dates.map(date => ({
        template_id: template.id,
        name: data.name,
        date,
        start_time: data.start_time,
        status: 'draft' as const,
      }));

      const { data: createdEvents, error: eventsError } = await supabase
        .from('events')
        .insert(eventsToCreate)
        .select();

      if (eventsError) throw eventsError;

      // 4. Create event roles for each event
      if (roles.length > 0 && createdEvents) {
        const eventRolesToCreate = createdEvents.flatMap(event =>
          roles.map(role => ({
            event_id: event.id,
            role: role.role as ServiceRole,
            quantity: role.quantity,
          }))
        );

        const { error: rolesError } = await supabase
          .from('event_roles')
          .insert(eventRolesToCreate);

        if (rolesError) throw rolesError;
      }

      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ['events'] });

      toast.success(`Created ${createdEvents?.length || 0} event${(createdEvents?.length || 0) !== 1 ? 's' : ''}`);
      onOpenChange(false);
    } catch (err: any) {
      console.error('Create event error:', err);
      toast.error(err?.message || 'Failed to create event');
    }
  };

  const availableRoles = Object.entries(ROLE_LABELS) as [Role, string][];
  const isPending = createTemplate.isPending || form.formState.isSubmitting;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-serif">Create Event</DialogTitle>
          <DialogDescription>
            Create a new event. For recurring events, all instances will be automatically generated.
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
                      placeholder="Add any additional notes..."
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
                        Create multiple events on a weekly schedule
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
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="indefinite">Indefinite (1 year)</SelectItem>
                            <SelectItem value="date">Until specific date</SelectItem>
                            <SelectItem value="count">Number of events</SelectItem>
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
                            <Input type="date" {...field} />
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
                              max={104}
                              value={field.value ?? ''}
                              onChange={(e) => {
                                const val = e.target.value;
                                if (val === '') {
                                  field.onChange(undefined);
                                } else {
                                  const num = parseInt(val, 10);
                                  if (!isNaN(num)) {
                                    field.onChange(Math.min(104, Math.max(1, num)));
                                  }
                                }
                              }}
                              onBlur={(e) => {
                                // Ensure valid value on blur
                                const val = parseInt(e.target.value, 10);
                                if (isNaN(val) || val < 1) {
                                  field.onChange(1);
                                }
                              }}
                            />
                          </FormControl>
                          <FormDescription>
                            Maximum 104 events (2 years weekly)
                          </FormDescription>
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
                  <h4 className="font-medium">Volunteer Roles</h4>
                  <p className="text-sm text-muted-foreground">
                    Define the roles needed for this event
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
                  No roles defined yet.
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
                                value={field.value ?? ''}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  if (val === '') {
                                    field.onChange(undefined);
                                  } else {
                                    const num = parseInt(val, 10);
                                    if (!isNaN(num)) {
                                      field.onChange(Math.max(1, num));
                                    }
                                  }
                                }}
                                onBlur={(e) => {
                                  const val = parseInt(e.target.value, 10);
                                  if (isNaN(val) || val < 1) {
                                    field.onChange(1);
                                  }
                                }}
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

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Event
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
