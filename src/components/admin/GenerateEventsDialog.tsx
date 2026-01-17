import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format, addMonths } from 'date-fns';
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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useGenerateEvents } from '@/hooks/useEventScheduler';
import { toast } from 'sonner';

const formSchema = z.object({
  startDate: z.string().min(1, 'Start date is required'),
  endType: z.enum(['date', 'count']),
  endDate: z.string().optional(),
  count: z.number().min(1).optional(),
});

type FormData = z.infer<typeof formSchema>;

interface GenerateEventsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templateId: string | null;
}

export function GenerateEventsDialog({ open, onOpenChange, templateId }: GenerateEventsDialogProps) {
  const generateEvents = useGenerateEvents();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      startDate: format(new Date(), 'yyyy-MM-dd'),
      endType: 'date',
      endDate: format(addMonths(new Date(), 3), 'yyyy-MM-dd'),
      count: 12,
    },
  });

  const endType = form.watch('endType');

  const onSubmit = async (data: FormData) => {
    if (!templateId) return;

    try {
      const result = await generateEvents.mutateAsync({
        templateId,
        startDate: data.startDate,
        endDate: data.endType === 'date' ? data.endDate : undefined,
        count: data.endType === 'count' ? data.count : undefined,
      });
      
      toast.success(`Generated ${result?.length || 0} events`);
      onOpenChange(false);
    } catch (error) {
      toast.error('Failed to generate events');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-serif">Generate Events</DialogTitle>
          <DialogDescription>
            Create event instances from this template. You can specify a date range or number of events to generate.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="startDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Start Date</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormDescription>
                    Events will be generated starting from the first matching day after this date
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="endType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Generation Limit</FormLabel>
                  <FormControl>
                    <RadioGroup
                      onValueChange={field.onChange}
                      value={field.value}
                      className="flex flex-col gap-3"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="date" id="end-date" />
                        <label htmlFor="end-date" className="text-sm font-medium cursor-pointer">
                          Until specific date
                        </label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="count" id="end-count" />
                        <label htmlFor="end-count" className="text-sm font-medium cursor-pointer">
                          Fixed number of events
                        </label>
                      </div>
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {endType === 'date' && (
              <FormField
                control={form.control}
                name="endDate"
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

            {endType === 'count' && (
              <FormField
                control={form.control}
                name="count"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Number of Events</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        min={1}
                        max={52}
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value, 10) || 1)}
                      />
                    </FormControl>
                    <FormDescription>
                      Maximum 52 events (1 year of weekly events)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={generateEvents.isPending}>
                {generateEvents.isPending && (
                  <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                )}
                Generate Events
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
