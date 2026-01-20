import { useRef } from "react";
import { format, parseISO } from "date-fns";
import { Printer, Download, FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EventWithDetails } from "@/hooks/useEventScheduler";
import { toast } from "sonner";

interface ScheduleExportProps {
  events: EventWithDetails[];
  monthLabel: string;
}

const SIDESMAN_ROLES = ['sidesman-standard', 'sidesman-sound', 'sidesman-welcome'];

export function ScheduleExport({ events, monthLabel }: ScheduleExportProps) {
  const printRef = useRef<HTMLDivElement>(null);

  const getSidesmenDisplay = (event: EventWithDetails) => {
    const sidesmen: string[] = [];
    event.assignments
      .filter(a => SIDESMAN_ROLES.includes(a.role))
      .forEach(a => {
        const type = a.role === 'sidesman-standard' ? ' '
          : a.role === 'sidesman-sound' ? '(S)'
            : '(W)';
        sidesmen.push(`${a.volunteer_name || 'Unknown'} ${type}`);
      });
    return sidesmen;
  };

  const getVolunteersForRole = (event: EventWithDetails, role: string) => {
    return event.assignments
      .filter(a => a.role === role)
      .map(a => a.volunteer_name || 'Unknown');
  };

  const handlePrint = () => {
    const printContent = generatePrintHTML();
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
      }, 250);
    }
  };

  const generatePrintHTML = () => {
    const rows = events.map(event => {
      const date = parseISO(event.date);
      const dateStr = format(date, "d MMM");
      const subheading = event.subheading || '';
      const sidesmen = getSidesmenDisplay(event);
      const readers = getVolunteersForRole(event, 'reader');
      const reading = event.reading || '';
      const intercessions = getVolunteersForRole(event, 'intercessions');
      const collection = getVolunteersForRole(event, 'collection');

      return `
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd; vertical-align: top;">
            <strong>${dateStr}</strong>
            ${subheading ? `<br><em style="font-size: 11px; color: #666;">${subheading}</em>` : ''}
          </td>
          <td style="padding: 8px; border: 1px solid #ddd; vertical-align: top;">
            ${sidesmen.length > 0 ? sidesmen.join('<br>') : '-'}
          </td>
          <td style="padding: 8px; border: 1px solid #ddd; vertical-align: top;">
            ${readers.length > 0 ? readers.join('<br>') : '-'}
          </td>
          <td style="padding: 8px; border: 1px solid #ddd; vertical-align: top;">
            ${reading || '-'}
          </td>
          <td style="padding: 8px; border: 1px solid #ddd; vertical-align: top;">
            ${intercessions.length > 0 ? intercessions.join('<br>') : '-'}
          </td>
          <td style="padding: 8px; border: 1px solid #ddd; vertical-align: top;">
            ${collection.length > 0 ? collection.join('<br>') : '-'}
          </td>
        </tr>
      `;
    }).join('');

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Rota - ${monthLabel}</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            font-size: 12px;
            padding: 20px;
            max-width: 100%;
          }
          h1 {
            font-size: 18px;
            text-align: center;
            margin-bottom: 20px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 10px;
          }
          th {
            background-color: #f5f5f5;
            padding: 10px 8px;
            border: 1px solid #ddd;
            text-align: left;
            font-weight: bold;
            font-size: 11px;
          }
          td {
            font-size: 11px;
          }
          @media print {
            body { padding: 10px; }
            h1 { font-size: 16px; }
          }
        </style>
      </head>
      <body>
        <h1>Rota for St Matthew's Church - ${monthLabel}</h1>
        <table>
          <thead>
            <tr>
              <th style="width: 80px;">Sunday</th>
              <th style="width: 150px;">Sidesmen</th>
              <th style="width: 100px;">Reader</th>
              <th style="width: 120px;">Reading</th>
              <th style="width: 100px;">Intercessions</th>
              <th style="width: 120px;">Collection Count</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
      </body>
      </html>
    `;
  };

  const handleExportCSV = () => {
    const headers = ['Date', 'Subheading', 'Sidesmen', 'Reader', 'Reading', 'Intercessions', 'Collection Count'];

    const rows = events.map(event => {
      const date = parseISO(event.date);
      const dateStr = format(date, "d MMM yyyy");
      const subheading = event.subheading || '';
      const sidesmen = getSidesmenDisplay(event).join('; ');
      const readers = getVolunteersForRole(event, 'reader').join('; ');
      const reading = event.reading || '';
      const intercessions = getVolunteersForRole(event, 'intercessions').join('; ');
      const collection = getVolunteersForRole(event, 'collection').join('; ');

      return [dateStr, subheading, sidesmen, readers, reading, intercessions, collection];
    });

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `rota-${monthLabel.toLowerCase().replace(/\s+/g, '-')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('CSV exported successfully');
  };

  const handleCopyForEmail = () => {
    const textContent = events.map(event => {
      const date = parseISO(event.date);
      const dateStr = format(date, "EEEE d MMMM");
      const subheading = event.subheading ? ` (${event.subheading})` : '';
      const sidesmen = getSidesmenDisplay(event);
      const readers = getVolunteersForRole(event, 'reader');
      const reading = event.reading || 'TBC';
      const intercessions = getVolunteersForRole(event, 'intercessions');
      const collection = getVolunteersForRole(event, 'collection');

      return `${dateStr}${subheading}
  Sidesmen: ${sidesmen.length > 0 ? sidesmen.join(', ') : 'TBC'}
  Reader: ${readers.length > 0 ? readers.join(', ') : 'TBC'} - ${reading}
  Intercessions: ${intercessions.length > 0 ? intercessions.join(', ') : 'TBC'}
  Collection Count: ${collection.length > 0 ? collection.join(', ') : 'TBC'}`;
    }).join('\n\n');

    const fullText = `Rota for St Matthew's Church - ${monthLabel}\n\n${textContent}`;

    navigator.clipboard.writeText(fullText).then(() => {
      toast.success('Copied to clipboard - ready to paste into email');
    }).catch(() => {
      toast.error('Failed to copy to clipboard');
    });
  };

  if (events.length === 0) {
    return null;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Download className="h-4 w-4" />
          Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={handlePrint} className="gap-2 cursor-pointer">
          <Printer className="h-4 w-4" />
          Print / Save as PDF
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleExportCSV} className="gap-2 cursor-pointer">
          <FileSpreadsheet className="h-4 w-4" />
          Export as CSV
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleCopyForEmail} className="gap-2 cursor-pointer">
          <Download className="h-4 w-4" />
          Copy for Email
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
