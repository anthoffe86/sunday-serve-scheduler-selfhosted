import { useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Trash2, Loader2 } from 'lucide-react';
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
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
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
  roles: z.array(z.object({
    role: z.string().min(1, 'Role is required'),
    quantity: z.number().min(1, 'Quantity must be at least 1'),
  })),
});

type FormData = z.infer<typeof formSchema>;

interface EditEventTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template: EventTemplateWithRoles;
}

export function EditEventTemplateDialog({ open, onOpenChange, template }: EditEventTemplateDialogProps) {
  const updateTemplate = useUpdateEventTemplate();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: template.name,
      description: template.description || '',
      day_of_week: template.day_of_week,
      start_time: template.start_time,
      roles: template.roles.map(r => ({ role: r.role, quantity: r.quantity })),
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'roles',
  });

  useEffect(() => {
    if (open) {
      form.reset({
        name: template.name,
        description: template.description || '',
        day_of_week: template.day_of_week,
        start_time: template.start_time,
        roles: template.roles.map(r => ({ role: r.role, quantity: r.quantity })),
      });
    }
  }, [open, template, form]);

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
      await updateTemplate.mutateAsync({
        id: template.id,
        name: data.name,
        description: data.description || undefined,
        day_of_week: data.day_of_week,
        start_time: data.start_time,
        roles,
      });

      toast.success('Event template updated');
      onOpenChange(false);
    } catch (err: any) {
      console.error('Update template error:', err);
      toast.error(err?.message || 'Failed to update template');
    }
  };

  const availableRoles = Object.entries(ROLE_LABELS) as [Role, string][];
  const isPending = updateTemplate.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-serif">Edit Event Template</DialogTitle>
          <DialogDescription>
            Update the event settings. Note: Changes won't affect existing event instances.
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

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
