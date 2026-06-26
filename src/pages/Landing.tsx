import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import {
  Calendar,
  Users,
  RefreshCw,
  Bell,
  Shield,
  Clock,
  CheckCircle2,
  ArrowRight,
  Loader2,
} from 'lucide-react';
import serveTogetherLogo from '@/assets/servetogether-logo.png';
import { supabase } from '@/integrations/supabase/client';
import { z } from 'zod';

const features = [
  {
    icon: Calendar,
    title: 'Smart Scheduling',
    description: 'Automated event scheduling that respects volunteer availability and role preferences.',
  },
  {
    icon: Users,
    title: 'Volunteer Management',
    description: 'Easily manage your volunteer team with role assignments and family groupings.',
  },
  {
    icon: RefreshCw,
    title: 'Fair Swap System',
    description: 'Volunteers can request and offer swaps with each other when schedules conflict.',
  },
  {
    icon: Bell,
    title: 'Email Notifications',
    description: 'Automatic email updates for assignments, invitations, and swap requests.',
  },
  {
    icon: Shield,
    title: 'Secure Access',
    description: 'Invitation-only signup with role-based permissions for volunteers and admins.',
  },
  {
    icon: Clock,
    title: 'Availability Tracking',
    description: 'Volunteers mark unavailable dates so scheduling always works around their needs.',
  },
];

const benefits = [
  'Reduce scheduling conflicts and last-minute changes',
  'Empower volunteers to manage their own availability',
  'Save hours of admin time with automated scheduling',
  'Keep everyone informed with email notifications',
  'Fair distribution of roles across all volunteers',
];

const requestSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  organisationName: z.string().min(2, 'Organisation name must be at least 2 characters'),
  email: z.string().email('Please enter a valid email address'),
  notes: z.string().optional(),
});

function RequestAccessModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [name, setName] = useState('');
  const [organisationName, setOrganisationName] = useState('');
  const [email, setEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      requestSchema.parse({ name, organisationName, email, notes });
    } catch (err) {
      if (err instanceof z.ZodError) {
        toast.error(err.errors[0].message);
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase.from('access_requests').insert({
        name,
        organisation_name: organisationName,
        email,
        notes: notes || null,
        status: 'pending',
      });

      if (error) throw error;

      supabase.functions
        .invoke('notify-access-request', { body: { name, organisationName, email, notes } })
        .catch(() => {
          // best effort only
        });

      toast.success("Request submitted! We'll be in touch soon.");
      onClose();
      setName('');
      setOrganisationName('');
      setEmail('');
      setNotes('');
    } catch (err: any) {
      toast.error(err.message || 'Failed to submit request. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-serif text-xl">Request Access</DialogTitle>
          <DialogDescription>
            Tell us about your organisation and we will be in touch to get you set up.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-2">
            <Label htmlFor="req-name">Your name</Label>
            <Input
              id="req-name"
              placeholder="Jane Smith"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="req-org">Organisation name</Label>
            <Input
              id="req-org"
              placeholder="St Matthew's Church"
              value={organisationName}
              onChange={(e) => setOrganisationName(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="req-email">Email address</Label>
            <Input
              id="req-email"
              type="email"
              placeholder="jane@example.org"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="req-notes">
              Notes <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <Textarea
              id="req-notes"
              placeholder="Tell us about your team size and scheduling needs..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" className="flex-1" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Send Request
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

const Landing = () => {
  const [requestAccessOpen, setRequestAccessOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <img src={serveTogetherLogo} alt="ServeTogether" className="h-10" />
          <div className="flex items-center gap-3">
            <Button variant="ghost" asChild>
              <Link to="/auth">Sign In</Link>
            </Button>
            <Button onClick={() => setRequestAccessOpen(true)}>
              Request Access
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden border-b bg-gradient-to-b from-primary/5 to-background py-20 md:py-32">
        <div className="container mx-auto px-4 text-center">
          <div className="mx-auto max-w-3xl">
            <div className="mb-8 flex justify-center">
              <img src={serveTogetherLogo} alt="ServeTogether" className="h-16 sm:h-20 md:h-24" />
            </div>
            <h2 className="font-serif text-4xl font-bold tracking-tight md:text-5xl lg:text-6xl">
              Volunteer Scheduling
              <span className="block text-primary">Made Simple</span>
            </h2>
            <p className="mt-6 text-lg text-muted-foreground md:text-xl">
              Streamline your volunteer rota with smart scheduling, easy swaps,
              and automatic notifications - built for churches and volunteer organisations.
            </p>
            <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:justify-center">
              <Button asChild size="lg" className="text-base">
                <Link to="/auth">
                  Sign In to Your Account
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" className="text-base" onClick={() => setRequestAccessOpen(true)}>
                Request Access
              </Button>
            </div>
          </div>
        </div>

        <div className="absolute -top-24 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-primary/10 blur-3xl" />
      </section>

      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-2xl text-center">
            <h3 className="font-serif text-3xl font-bold md:text-4xl">Everything You Need</h3>
            <p className="mt-4 text-muted-foreground">A complete solution for managing volunteer schedules</p>
          </div>

          <div className="mt-16 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => (
              <Card key={feature.title} className="border-2 transition-colors hover:border-primary/50">
                <CardContent className="pt-6">
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <feature.icon className="h-6 w-6" />
                  </div>
                  <h4 className="font-serif text-xl font-semibold">{feature.title}</h4>
                  <p className="mt-2 text-muted-foreground">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="border-y bg-muted/50 py-20">
        <div className="container mx-auto px-4">
          <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
            <div>
              <h3 className="font-serif text-3xl font-bold md:text-4xl">Why ServeTogether?</h3>
              <p className="mt-4 text-muted-foreground">
                Built for volunteer coordination, ServeTogether handles the scheduling complexity
                so your team can focus on what matters.
              </p>
              <ul className="mt-8 space-y-4">
                {benefits.map((benefit) => (
                  <li key={benefit} className="flex items-start gap-3">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                    <span>{benefit}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-2xl border-2 bg-background p-8 shadow-lg">
              <div className="space-y-6">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Users className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="font-semibold">For Volunteers</p>
                    <p className="text-sm text-muted-foreground">View your schedule, mark availability, request swaps</p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Shield className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="font-semibold">For Administrators</p>
                    <p className="text-sm text-muted-foreground">Manage events, auto-schedule, send invitations</p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Bell className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="font-semibold">Stay Connected</p>
                    <p className="text-sm text-muted-foreground">Email notifications keep everyone in the loop</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-2xl rounded-2xl bg-primary p-8 text-center text-primary-foreground md:p-12">
            <h3 className="font-serif text-2xl font-bold md:text-3xl">Ready to Get Started?</h3>
            <p className="mt-4 text-primary-foreground/80">
              Already have an account? Sign in below. New organisation? Request access and we will get you set up.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
              <Button asChild size="lg" variant="secondary">
                <Link to="/auth">
                  Sign In
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="border-white bg-white text-primary hover:bg-white/90 hover:text-primary"
                onClick={() => setRequestAccessOpen(true)}
              >
                Request Access
              </Button>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t py-8">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>&copy; {new Date().getFullYear()} ServeTogether. All rights reserved.</p>
        </div>
      </footer>

      <RequestAccessModal open={requestAccessOpen} onClose={() => setRequestAccessOpen(false)} />
    </div>
  );
};

export default Landing;
