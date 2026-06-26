import { EventWithDetails } from '@/hooks/useEventScheduler';
import { parseISO } from 'date-fns';

/**
 * Generates an ICS file for a single event
 */
export function generateSingleEventICS(
    event: EventWithDetails,
    userRole?: string,
    organisationName = "St Matthew's Church"
): string {
    const eventDate = parseISO(event.date);
    const [hours, minutes] = event.start_time.split(':');

    // Create start datetime
    const startDateTime = new Date(eventDate);
    startDateTime.setHours(parseInt(hours, 10), parseInt(minutes, 10), 0, 0);

    // Assume 1.5 hour duration for services
    const endDateTime = new Date(startDateTime);
    endDateTime.setHours(endDateTime.getHours() + 1, endDateTime.getMinutes() + 30);

    // Format dates for ICS (YYYYMMDDTHHMMSS)
    const formatICSDate = (date: Date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hour = String(date.getHours()).padStart(2, '0');
        const minute = String(date.getMinutes()).padStart(2, '0');
        const second = String(date.getSeconds()).padStart(2, '0');
        return `${year}${month}${day}T${hour}${minute}${second}`;
    };

    const dtstart = formatICSDate(startDateTime);
    const dtend = formatICSDate(endDateTime);
    const dtstamp = formatICSDate(new Date());

    // Create description with role info
    let description = event.name;
    if (event.subheading) {
        description += ` - ${event.subheading}`;
    }
    if (userRole) {
        description += `\\nYour role: ${userRole}`;
    }

    // Escape special characters in text fields
    const escapeText = (text: string) => {
        return text.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
    };

    const lines = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        `PRODID:-//${organisationName}//Service Rota//EN`,
        'CALSCALE:GREGORIAN',
        'METHOD:PUBLISH',
        'BEGIN:VEVENT',
        `UID:${event.id}@servetogether.co.uk`,
        `DTSTAMP:${dtstamp}`,
        `DTSTART:${dtstart}`,
        `DTEND:${dtend}`,
        `SUMMARY:${escapeText(event.name)}`,
        `DESCRIPTION:${escapeText(description)}`,
        `LOCATION:${escapeText(organisationName)}`,
        `STATUS:CONFIRMED`,
        'END:VEVENT',
        'END:VCALENDAR'
    ];

    return lines.join('\r\n');
}

/**
 * Triggers download of ICS file for a single event
 */
export function downloadEventICS(event: EventWithDetails, userRole?: string): void {
    const icsContent = generateSingleEventICS(event, userRole);
    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = `${event.name.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.ics`;
    link.style.display = 'none';

    document.body.appendChild(link);
    link.click();

    setTimeout(() => {
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }, 100);
}
