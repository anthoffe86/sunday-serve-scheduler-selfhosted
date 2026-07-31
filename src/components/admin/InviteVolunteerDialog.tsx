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

    const normalisedEmail = email.trim().toLowerCase();

    try {
      // A plain profiles lookup runs under the restrictive tenant policy, so it
      // cannot see an address registered in another organisation -- the duplicate
      // would only surface as a raw "already registered" at the end of signup.
      // invite_email_status is admin-gated and checks every org plus auth.users.
      const { data: emailStatus, error: statusError } = await supabase
        .rpc('invite_email_status', { _email: normalisedEmail });

      if (statusError) throw statusError;

      if (emailStatus === 'in_org') {
        toast.error('A volunteer with this email already exists');
        setIsSubmitting(false);
        return;
      }

      if (emailStatus === 'registered_elsewhere') {
        // Which organisation is deliberately not disclosed.
        toast.error(
          'This email is already registered on ServeTogether. Ask the volunteer to log in with their existing account, or contact support to move them.'
        );
        setIsSubmitting(false);
        return;
      }

      // Delete any existing unused invites for this email (allows re-inviting)
      await supabase
        .from('invite_tokens')
        .delete()
        .eq('email', normalisedEmail)
        .is('used_at', null);

      // org_id defaults to the caller's organisation, and handle_new_user reads it
      // back at signup so the volunteer joins this org rather than the default one.
      const { data: invite, error } = await supabase
        .from('invite_tokens')
        .insert({
          name: name.trim(),
          email: normalisedEmail,
          invited_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;

      // The link is built server-side from the allow-listed APP_BASE_URL, not from
      // window.location.origin: an invite created on a deploy preview or localhost
      // must not hand out a link to that origin.
      const { data: emailResult, error: emailError } = await supabase.functions.invoke(
        'send-invite-email',
        { body: { token: invite.token, baseUrl: window.location.origin } }
      );

      if (emailError || !emailResult?.inviteLink) {
        console.error('Failed to prepare the invitation link:', emailError ?? emailResult);
        toast.error(
          'Invitation created, but the link could not be generated. Check that APP_BASE_URL is configured, then re-invite.'
        );
      } else {
        setInviteLink(emailResult.inviteLink);
        if (emailResult.emailed) {
          toast.success('Invitation sent! An email has been sent to the volunteer.');
        } else if (emailResult.emailSkippedReason === 'disabled') {
          toast.success('Invitation created! Invite emails are switched off - share the link below.');
        } else {
          toast.success('Invitation created! Email sending failed - please share the link manually.');
        }
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
