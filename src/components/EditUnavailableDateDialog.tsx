import { useState, useEffect } from 'react';
import { Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

interface EditUnavailableDateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentNotes?: string | null;
  onSave: (notes: string | undefined) => Promise<void>;
}

export function EditUnavailableDateDialog({
  open,
  onOpenChange,
  currentNotes,
  onSave,
}: EditUnavailableDateDialogProps) {
  const [notes, setNotes] = useState(currentNotes ?? '');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setNotes(currentNotes ?? '');
    }
  }, [open, currentNotes]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(notes.trim() || undefined);
      onOpenChange(false);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-serif">
            <Pencil className="h-5 w-5" />
            Edit Note
          </DialogTitle>
          <DialogDescription>
            Update the reason for your unavailability.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <Label htmlFor="edit-notes">Reason (optional)</Label>
          <Textarea
            id="edit-notes"
            placeholder="e.g., Holiday, work trip, exams..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="mt-2"
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
