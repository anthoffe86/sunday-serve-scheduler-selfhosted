import { useEffect, useMemo } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Trash2, Loader2, CalendarIcon } from "lucide-react";
import {
  format,
  addMonths,
  addWeeks,
  getDay,
  getDate,
  parseISO,
  isAfter,
  setDate,
  addDays,
  startOfMonth,
  getWeeksInMonth,
} from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useCreateEventTemplate, DAYS_OF_WEEK } from "@/hooks/useEventScheduler";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { ROLE_LABELS, Role } from "@/types";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { Database } from "@/integrations/supabase/types";

type ServiceRole = Database["public"]["Enums"]["service_role"];

// Recurrence pattern options
const RECURRENCE_PATTERNS = [
  { value: "none", label: "One-off (single event)" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly-day", label: "Monthly (same day of month)" },
  { value: "monthly-nth", label: "Monthly (e.g., 2nd Sunday)" },
] as const;

type RecurrencePattern = (typeof RECURRENCE_PATTERNS)[number]["value"];

const formSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  start_date: z.date({ required_error: "Start date is required" }),
  start_time: z.string().min(1, "Start time is required"),
  recurrence_pattern: z.enum(["none", "weekly", "monthly-day", "monthly-nth"]),
  recurrence_end_type: z.enum(["indefinite", "date", "count"]),
  recurrence_end_date: z.string().optional(),
  recurrence_count: z.number().min(1).max(104).optional().nullable(),
  roles: z.array(
    z.object({
      role: z.string().min(1, "Role is required"),
      quantity: z.number().min(1, "Quantity must be at least 1"),
    }),
  ),
});

type FormData = z.infer<typeof formSchema>;

interface CreateEventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Helper to get the nth weekday occurrence in month (e.g., "2nd Sunday")
function getNthWeekdayInfo(date: Date): { nth: number; dayOfWeek: number; label: string } {
  const dayOfWeek = getDay(date);
  const dayOfMonth = getDate(date);
  const nth = Math.ceil(dayOfMonth / 7);
  const dayLabel = DAYS_OF_WEEK.find((d) => d.value === dayOfWeek)?.label || "";
  const ordinal = ["1st", "2nd", "3rd", "4th", "5th"][nth - 1] || `${nth}th`;
  return { nth, dayOfWeek, label: `${ordinal} ${dayLabel}` };
}

// Helper to find the nth occurrence of a weekday in a given month
function getNthWeekdayOfMonth(year: number, month: number, dayOfWeek: number, nth: number): Date | null {
  const firstOfMonth = startOfMonth(new Date(year, month, 1));
  let date = firstOfMonth;

  // Find first occurrence of the weekday
  while (getDay(date) !== dayOfWeek) {
    date = addDays(date, 1);
  }

  // Move to nth occurrence
  date = addDays(date, (nth - 1) * 7);

  // Check if still in the same month
  if (date.getMonth() !== month) {
    return null;
  }

  return date;
}

export function CreateEventDialog({ open, onOpenChange }: CreateEventDialogProps) {
  const createTemplate = useCreateEventTemplate();
  const queryClient = useQueryClient();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      description: "",
      start_date: undefined,
      start_time: "10:00",
      recurrence_pattern: "weekly",
      recurrence_end_type: "count",
      recurrence_end_date: format(addMonths(new Date(), 3), "yyyy-MM-dd"),
      recurrence_count: 12,
      roles: [],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "roles",
  });

  const recurrencePattern = form.watch("recurrence_pattern");
  const recurrenceEndType = form.watch("recurrence_end_type");
  const startDate = form.watch("start_date");

  // Derived info about the selected start date
  const startDateInfo = useMemo(() => {
    if (!startDate) return null;
    const dayOfWeek = getDay(startDate);
    const dayOfMonth = getDate(startDate);
    const dayLabel = DAYS_OF_WEEK.find((d) => d.value === dayOfWeek)?.label || "";
    const nthInfo = getNthWeekdayInfo(startDate);
    return { dayOfWeek, dayOfMonth, dayLabel, nthInfo };
  }, [startDate]);

  const isRecurring = recurrencePattern !== "none";

  useEffect(() => {
    if (open) {
      form.reset({
        name: "",
        description: "",
        start_date: undefined,
        start_time: "10:00",
        recurrence_pattern: "weekly",
        recurrence_end_type: "count",
        recurrence_end_date: format(addMonths(new Date(), 3), "yyyy-MM-dd"),
        recurrence_count: 12,
        roles: [],
      });
    }
  }, [open, form]);

  const generateEventDates = (
    startDate: Date,
    pattern: RecurrencePattern,
    endType: "indefinite" | "date" | "count",
    endDate?: string,
    count?: number,
  ): string[] => {
    const dates: string[] = [];

    // One-off event
    if (pattern === "none") {
      return [format(startDate, "yyyy-MM-dd")];
    }

    const maxDate = endType === "date" && endDate ? parseISO(endDate) : addMonths(startDate, 24); // 2 year max for indefinite

    const maxCount =
      endType === "count" && count
        ? count
        : endType === "indefinite"
          ? 52 // 1 year for indefinite
          : 104;

    let currentDate = startDate;

    if (pattern === "weekly") {
      while (dates.length < maxCount && !isAfter(currentDate, maxDate)) {
        dates.push(format(currentDate, "yyyy-MM-dd"));
        currentDate = addWeeks(currentDate, 1);
      }
    } else if (pattern === "monthly-day") {
      // Same day of month (e.g., 15th)
      const targetDay = getDate(startDate);
      while (dates.length < maxCount && !isAfter(currentDate, maxDate)) {
        dates.push(format(currentDate, "yyyy-MM-dd"));
        // Move to next month
        let nextMonth = addMonths(currentDate, 1);
        // Set to target day (handle months with fewer days)
        const daysInNextMonth = new Date(nextMonth.getFullYear(), nextMonth.getMonth() + 1, 0).getDate();
        nextMonth = setDate(nextMonth, Math.min(targetDay, daysInNextMonth));
        currentDate = nextMonth;
      }
    } else if (pattern === "monthly-nth") {
      // Nth weekday of month (e.g., 2nd Sunday)
      const { nth, dayOfWeek } = getNthWeekdayInfo(startDate);
      while (dates.length < maxCount && !isAfter(currentDate, maxDate)) {
        dates.push(format(currentDate, "yyyy-MM-dd"));
        // Find same pattern in next month
        let nextMonth = addMonths(currentDate, 1);
        const nextOccurrence = getNthWeekdayOfMonth(nextMonth.getFullYear(), nextMonth.getMonth(), dayOfWeek, nth);
        if (nextOccurrence) {
          currentDate = nextOccurrence;
        } else {
          // Skip months where nth weekday doesn't exist (e.g., 5th Sunday)
          nextMonth = addMonths(nextMonth, 1);
          const fallback = getNthWeekdayOfMonth(nextMonth.getFullYear(), nextMonth.getMonth(), dayOfWeek, nth);
          if (fallback) {
            currentDate = fallback;
          } else {
            break; // Safety exit
          }
        }
      }
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

    const dayOfWeek = getDay(data.start_date);

    try {
      // 1. Create the template
      const template = await createTemplate.mutateAsync({
        name: data.name,
        description: data.description || undefined,
        day_of_week: dayOfWeek,
        start_time: data.start_time,
        is_recurring: data.recurrence_pattern !== "none",
        recurrence_end_type: isRecurring ? data.recurrence_end_type : undefined,
        recurrence_end_date: data.recurrence_end_type === "date" ? data.recurrence_end_date : undefined,
        recurrence_count: data.recurrence_end_type === "count" ? data.recurrence_count : undefined,
        roles,
        // New fields
        start_date: format(data.start_date, "yyyy-MM-dd"),
        recurrence_pattern: data.recurrence_pattern === "none" ? null : data.recurrence_pattern,
      });

      // 2. Generate event dates
      const dates = generateEventDates(
        data.start_date,
        data.recurrence_pattern,
        data.recurrence_end_type,
        data.recurrence_end_date,
        data.recurrence_count ?? undefined,
      );

      // 3. Create events
      const eventsToCreate = dates.map((date) => ({
        template_id: template.id,
        name: data.name,
        date,
        start_time: data.start_time,
        status: "draft" as const,
      }));

      const { data: createdEvents, error: eventsError } = await supabase.from("events").insert(eventsToCreate).select();

      if (eventsError) throw eventsError;

      // 4. Create event roles for each event
      if (roles.length > 0 && createdEvents) {
        const eventRolesToCreate = createdEvents.flatMap((event) =>
          roles.map((role) => ({
            event_id: event.id,
            role: role.role as ServiceRole,
            quantity: role.quantity,
          })),
        );

        const { error: rolesError } = await supabase.from("event_roles").insert(eventRolesToCreate);

        if (rolesError) throw rolesError;
      }

      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ["events"] });

      toast.success(`Created ${createdEvents?.length || 0} event${(createdEvents?.length || 0) !== 1 ? "s" : ""}`);
      onOpenChange(false);
    } catch (err: any) {
      console.error("Create event error:", err);
      toast.error(err?.message || "Failed to create event");
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
                    <Textarea placeholder="Add any additional notes..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              {/* Start Date Picker */}
              <FormField
                control={form.control}
                name="start_date"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Start Date</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}
                          >
                            {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                          disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
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

            {/* Show derived day info when date is selected */}
            {startDateInfo && (
              <p className="text-sm text-muted-foreground -mt-2">
                {startDateInfo.dayLabel}, {format(startDate!, "MMMM d, yyyy")}
                {recurrencePattern === "monthly-nth" && ` (${startDateInfo.nthInfo.label} of the month)`}
                {recurrencePattern === "monthly-day" && ` (day ${startDateInfo.dayOfMonth} of each month)`}
              </p>
            )}

            <div className="space-y-4 rounded-lg border p-4">
              {/* Recurrence Pattern */}
              <FormField
                control={form.control}
                name="recurrence_pattern"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Recurrence</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {RECURRENCE_PATTERNS.map((pattern) => (
                          <SelectItem key={pattern.value} value={pattern.value}>
                            {pattern.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      {recurrencePattern === "weekly" && "Creates events every week on the same day"}
                      {recurrencePattern === "monthly-day" &&
                        `Creates events on the same date each month${startDateInfo ? ` (${startDateInfo.dayOfMonth}${["st", "nd", "rd"][startDateInfo.dayOfMonth - 1] || "th"})` : ""}`}
                      {recurrencePattern === "monthly-nth" &&
                        `Creates events on the same weekday pattern${startDateInfo ? ` (${startDateInfo.nthInfo.label})` : ""}`}
                      {recurrencePattern === "none" && "Creates a single event only"}
                    </FormDescription>
                    <FormMessage />
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
                        <FormLabel>End After</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="count">Number of events</SelectItem>
                            <SelectItem value="date">Specific date</SelectItem>
                            <SelectItem value="indefinite">Indefinite (1 year)</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {recurrenceEndType === "date" && (
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

                  {recurrenceEndType === "count" && (
                    <FormField
                      control={form.control}
                      name="recurrence_count"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Number of Events</FormLabel>
                          <FormControl>
                            <Input
                              type="text"
                              inputMode="numeric"
                              pattern="[0-9]*"
                              placeholder="e.g., 12"
                              value={field.value ?? ""}
                              onChange={(e) => {
                                const val = e.target.value;
                                // Allow empty or numeric input only
                                if (val === "") {
                                  field.onChange(null);
                                  return;
                                }
                                // Only allow digits
                                if (!/^\d*$/.test(val)) return;
                                const num = parseInt(val, 10);
                                if (!isNaN(num)) {
                                  field.onChange(Math.min(104, num));
                                }
                              }}
                              onBlur={() => {
                                field.onBlur();
                                // On blur, if empty or invalid, leave as is (schema will validate)
                                if (field.value === null || field.value === undefined) return;
                                if (field.value < 1) {
                                  field.onChange(1);
                                }
                              }}
                            />
                          </FormControl>
                          <FormDescription>Enter a number between 1 and 104</FormDescription>
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
                  <p className="text-sm text-muted-foreground">Define the roles needed for this event</p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => append({ role: "", quantity: 1 })}
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
                                type="text"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                value={field.value ?? ""}
                                onChange={(e) => {
                                  const val = e.target.value;

                                  if (!/^\d*$/.test(val)) return;
                                  const num = parseInt(val, 10);
                                  if (!isNaN(num)) {
                                    field.onChange(num);
                                  }
                                }}
                                onBlur={() => {
                                  field.onBlur();
                                  if (!field.value || field.value < 1) {
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
