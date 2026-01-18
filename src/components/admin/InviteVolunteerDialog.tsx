import { useState } from 'react';
import { Copy, Check, Loader2, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';

interface InviteVolunteerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function InviteVolunteerDialog({ open, onOpenChange, onSuccess }: InviteVolunteerDialogProps) {
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim() || !email.trim()) {
      toast.error('Please fill in all fields');
      return;
    }

    if (!user) {
      toast.error('You must be logged in');
      return;
    }

    setIsSubmitting(true);

    try {
      // Check if email already exists in profiles
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', email.trim().toLowerCase())
        .maybeSingle();

      if (existingProfile) {
        toast.error('A volunteer with this email already exists');
        setIsSubmitting(false);
        return;
      }

      // Check for existing unused invite
      const { data: existingInvite } = await supabase
        .from('invite_tokens')
        .select('id')
        .eq('email', email.trim().toLowerCase())
        .is('used_at', null)
        .maybeSingle();

      if (existingInvite) {
        toast.error('An invitation has already been sent to this email');
        setIsSubmitting(false);
        return;
      }

      // Create invite token
      const { data: invite, error } = await supabase
        .from('invite_tokens')
        .insert({
          name: name.trim(),
          email: email.trim().toLowerCase(),
          invited_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;

      // Generate the invite link
      const link = `${window.location.origin}/invite?token=${invite.token}`;
      setInviteLink(link);
      
      // Send the invitation email
      try {
        const emailResponse = await supabase.functions.invoke('send-invite-email', {
          body: {
            name: name.trim(),
            email: email.trim().toLowerCase(),
            inviteLink: link,
          },
        });
        
        if (emailResponse.error) {
          console.error('Failed to send invite email:', emailResponse.error);
          toast.success('Invitation created! Email sending failed - please share the link manually.');
        } else {
          toast.success('Invitation sent! An email has been sent to the volunteer.');
        }
      } catch (emailErr) {
        console.error('Failed to send invite email:', emailErr);
        toast.success('Invitation created! Email sending failed - please share the link manually.');
      }
      
      onSuccess?.();
    } catch (err: any) {
      console.error('Failed to create invitation:', err);
      toast.error(err.message || 'Failed to create invitation');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopy = async () => {
    if (!inviteLink) return;
    
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      toast.success('Link copied to clipboard!');
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast.error('Failed to copy link');
    }
  };

  const handleClose = () => {
    setName('');
    setEmail('');
    setInviteLink(null);
    setCopied(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Invite Volunteer
          </DialogTitle>
          <DialogDescription>
            {inviteLink
              ? 'Share this link with the volunteer to let them create their account.'
              : 'Enter the volunteer\'s details to generate an invitation link.'}
          </DialogDescription>
        </DialogHeader>

        {!inviteLink ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                placeholder="John Smith"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="john@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  'Create Invitation'
                )}
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Invitation Link</Label>
              <div className="flex gap-2">
                <Input
                  value={inviteLink}
                  readOnly
                  className="bg-muted font-mono text-sm"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={handleCopy}
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-green-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                This link expires in 7 days.
              </p>
            </div>

            <DialogFooter>
              <Button onClick={handleClose}>Done</Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
