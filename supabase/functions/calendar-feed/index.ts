import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Event {
    id: string;
    name: string;
    subheading: string | null;
    date: string;
    start_time: string;
    status: string;
    assignments: Array<{
        id: string;
        volunteer_id: string;
        volunteer_name: string;
        role: string;
    }>;
}

function formatICSDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hour = String(date.getHours()).padStart(2, '0');
    const minute = String(date.getMinutes()).padStart(2, '0');
    const second = String(date.getSeconds()).padStart(2, '0');
    return `${year}${month}${day}T${hour}${minute}${second}`;
}

function escapeText(text: string): string {
    return text
        .replace(/\\/g, '\\\\')
        .replace(/;/g, '\\;')
        .replace(/,/g, '\\,')
        .replace(/\n/g, '\\n');
}

function generateICS(events: Event[], userId: string): string {
    const lines: string[] = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//St Matthews Church//Service Rota//EN',
        'CALSCALE:GREGORIAN',
        'METHOD:PUBLISH',
        'X-WR-CALNAME:St Matthews Service Rota',
        'X-WR-TIMEZONE:Europe/London',
        'X-PUBLISHED-TTL:PT1H', // Refresh every hour
    ];

    for (const event of events) {
        const eventDate = new Date(event.date);
        const [hours, minutes] = event.start_time.split(':');

        const startDateTime = new Date(eventDate);
        startDateTime.setHours(parseInt(hours, 10), parseInt(minutes, 10), 0, 0);

        const endDateTime = new Date(startDateTime);
        endDateTime.setHours(endDateTime.getHours() + 1, endDateTime.getMinutes() + 30);

        const dtstart = formatICSDate(startDateTime);
        const dtend = formatICSDate(endDateTime);
        const dtstamp = formatICSDate(new Date());

        // Find user's assignment
        const assignment = event.assignments.find(a => a.volunteer_id === userId);

        let description = event.name;
        if (event.subheading) {
            description += ` - ${event.subheading}`;
        }
        if (assignment) {
            description += `\\nYour role: ${assignment.role}`;
        }

        lines.push(
            'BEGIN:VEVENT',
            `UID:${event.id}@stmatthews.church`,
            `DTSTAMP:${dtstamp}`,
            `DTSTART:${dtstart}`,
            `DTEND:${dtend}`,
            `SUMMARY:${escapeText(event.name)}`,
            `DESCRIPTION:${escapeText(description)}`,
            `LOCATION:St Matthews Church`,
            `STATUS:CONFIRMED`,
            'END:VEVENT'
        );
    }

    lines.push('END:VCALENDAR');
    return lines.join('\r\n');
}

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const url = new URL(req.url);
        const userId = url.pathname.split('/').pop()?.replace('.ics', '');

        if (!userId) {
            return new Response('User ID required', {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
            });
        }

        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_ANON_KEY') ?? ''
        );

        // Get events for the next 6 months where user is assigned
        const today = new Date();
        const sixMonthsLater = new Date();
        sixMonthsLater.setMonth(sixMonthsLater.getMonth() + 6);

        const startDate = today.toISOString().split('T')[0];
        const endDate = sixMonthsLater.toISOString().split('T')[0];

        // Fetch events with assignments
        const { data: events, error } = await supabaseClient
            .from('events')
            .select(`
        id,
        name,
        subheading,
        date,
        start_time,
        status,
        assignments:event_assignments(
          id,
          volunteer_id,
          volunteer_name,
          role
        )
      `)
            .eq('status', 'published')
            .gte('date', startDate)
            .lte('date', endDate)
            .order('date', { ascending: true });

        if (error) {
            console.error('Error fetching events:', error);
            return new Response('Error fetching events', {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
            });
        }

        // Filter events where user is assigned
        const userEvents = (events || []).filter(event =>
            event.assignments.some((a: any) => a.volunteer_id === userId)
        );

        const icsContent = generateICS(userEvents as Event[], userId);

        return new Response(icsContent, {
            headers: {
                ...corsHeaders,
                'Content-Type': 'text/calendar; charset=utf-8',
                'Content-Disposition': 'inline; filename="st-matthews-rota.ics"',
                'Cache-Control': 'no-cache, must-revalidate',
            },
        });
    } catch (error) {
        console.error('Error:', error);
        return new Response('Internal server error', {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
        });
    }
});
