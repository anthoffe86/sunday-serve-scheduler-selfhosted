import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { z } from 'zod';
import logoUrl from '@/assets/servetogether-logo.png';
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
  Wand2,
  CalendarCheck,
  Mail,
  Smartphone,
  Building2,
  HeartHandshake,
  Church,
  Utensils,
  GraduationCap,
  Trophy,
  LayoutDashboard,
  Download,
  KeyRound,
  ListChecks,
} from 'lucide-react';

const SITE_URL = import.meta.env.VITE_SITE_URL || window.location.origin;

const featureGroups = [
  {
    title: 'Scheduling & rota building',
    icon: Calendar,
    features: [
      { icon: Wand2, name: 'Auto-scheduler', desc: 'Builds rotas automatically while respecting every volunteer\'s role preferences and recorded availability.' },
      { icon: ListChecks, name: 'Event templates', desc: 'Define recurring services or shifts once - weekly, fortnightly or monthly - and generate events in bulk.' },
      { icon: CalendarCheck, name: 'Draft -> Publish workflow', desc: 'Plan in private, send invitations, then publish to lock the rota and notify confirmed volunteers.' },
      { icon: LayoutDashboard, name: 'Confidence metrics', desc: 'Dashboard shows fully-staffed, ready-to-publish and at-risk events so you always know what needs attention.' },
    ],
  },
  {
    title: 'Volunteer experience',
    icon: Users,
    features: [
      { icon: Smartphone, name: 'Personal schedule', desc: 'Mobile-friendly view of upcoming serving dates, roles and event details.' },
      { icon: Calendar, name: 'iCal calendar feed', desc: 'Subscribe in Apple Calendar, Google Calendar or Outlook with a secure personal feed - always up to date.' },
      { icon: Clock, name: 'Availability exceptions', desc: 'Available by default; volunteers simply mark the dates they can\'t serve, up to two years ahead.' },
      { icon: CheckCircle2, name: 'One-tap accept or decline', desc: 'Invitations confirm in a tap. Declining can instantly add the date to their unavailability.' },
    ],
  },
  {
    title: 'Fair swap system',
    icon: RefreshCw,
    features: [
      { icon: RefreshCw, name: 'Two-stage swaps', desc: 'Volunteers request a swap, eligible peers offer to trade, and the original volunteer chooses - fair and transparent.' },
      { icon: Shield, name: 'Admin oversight', desc: 'Coordinators see every open, pending and completed swap and can step in at any point.' },
      { icon: CheckCircle2, name: 'Smart trading rules', desc: 'Trades must be on different dates and only suggest volunteers who actually qualify for the role.' },
    ],
  },
  {
    title: 'Communications',
    icon: Mail,
    features: [
      { icon: Mail, name: 'Email invitations', desc: 'Branded invitation emails sent from your organisation, with secure accept/decline links - no login required to respond.' },
      { icon: Bell, name: 'Swap & publish notifications', desc: 'Automatic emails for swap requests, offers, acceptances, publishes and assignment changes.' },
      { icon: KeyRound, name: 'Configurable per organisation', desc: 'Toggle which notifications go out and customise the sender name shown to your volunteers.' },
    ],
  },
  {
    title: 'Admin tools',
    icon: Shield,
    features: [
      { icon: Users, name: 'Volunteer management', desc: 'Invite-only onboarding, role assignments, family groupings and serving-history tracking in one place.' },
      { icon: LayoutDashboard, name: 'Action-needed alerts', desc: 'Dashboard surfaces unfilled slots, declined invitations and events that need a rebuild.' },
      { icon: Download, name: 'Schedule export', desc: 'Export polished, print-ready rotas for noticeboards and welcome packs - declined volunteers excluded automatically.' },
      { icon: Wand2, name: 'Override authority', desc: 'Admins can assign anyone when needed, with clear visual indicators when preferences or availability are overridden.' },
    ],
  },
  {
    title: 'Security & privacy',
    icon: Shield,
    features: [
      { icon: KeyRound, name: 'Invite-only access', desc: 'No public signup. New volunteers join only through an admin invitation with a single-use, expiring token.' },
      { icon: Shield, name: 'Role-based permissions', desc: 'Row-level security enforces who can see what - volunteers see their own data, admins see the organisation.' },
      { icon: Calendar, name: 'Protected calendar feeds', desc: 'Each volunteer\'s iCal feed is guarded by a private token they can rotate at any time.' },
    ],
  },
];

const benefits = [
  'Cut rota-building from hours to minutes each week',
  'Let volunteers manage their own availability instead of chasing them',
  'Stop scrambling for last-minute substitutes - the swap system handles it',
  'Distribute serving roles fairly across your whole team',
  'Keep everyone in the loop with automatic, branded emails',
  'Give volunteers a clear personal schedule on any device',
  'Maintain a full audit trail of who served when',
  'Onboard new churches and organisations in minutes',
];

const audiences = [
  { icon: Church, name: 'Churches', desc: 'Welcome teams, worship bands, sound & AV, children\'s ministry, coffee, communion, prayer.' },
  { icon: HeartHandshake, name: 'Charities', desc: 'Coordinate volunteer shifts across programmes and events without spreadsheet juggling.' },
  { icon: Utensils, name: 'Foodbanks & community groups', desc: 'Keep weekly sessions covered with reliable rotas and easy swaps.' },
  { icon: GraduationCap, name: 'Schools & PTAs', desc: 'Fairs, parents\' evenings, fundraisers - anything that needs a volunteer rota.' },
  { icon: Trophy, name: 'Clubs & sports teams', desc: 'Marshals, coaches, refreshments, set-up crews - keep it organised end to end.' },
  { icon: Building2, name: 'Any volunteer-led team', desc: 'If you run a rota, ServeTogether will save you time. Built generic, used widely.' },
];

const howItWorks = [
  { step: '01', title: 'Set up your organisation', desc: 'We onboard your team and configure your branding, roles and event templates.' },
  { step: '02', title: 'Invite your volunteers', desc: 'Send secure invitations. Volunteers set up an account and record their availability.' },
  { step: '03', title: 'Build & auto-schedule', desc: 'Generate events from templates and let the auto-scheduler produce a balanced rota in seconds.' },
  { step: '04', title: 'Publish & notify', desc: 'Send invitation emails, collect confirmations, publish the final rota and watch it sync to everyone\'s calendar.' },
];

const faqs = [
  {
    q: 'Who is ServeTogether for?',
    a: 'Any organisation that runs on a volunteer rota - churches, charities, foodbanks, community groups, schools, PTAs and sports clubs. It is built first for churches but designed to work for any volunteer-led team.',
  },
  {
    q: 'Can volunteers swap shifts themselves?',
    a: 'Yes. Our two-stage fair swap system lets a volunteer request a swap, eligible peers offer to trade, and the original volunteer picks who to swap with. Admins see every request and can step in if needed.',
  },
  {
    q: 'Do volunteers need to download an app?',
    a: 'No. ServeTogether runs in the browser on any device - phone, tablet or desktop. Volunteers can also subscribe their personal serving rota to Apple Calendar, Google Calendar or Outlook with a secure iCal feed.',
  },
  {
    q: 'How are emails sent?',
    a: 'All invitations, swap notifications and publish emails are sent automatically from your organisation\'s sender name via a trusted email provider. Admins can toggle which notifications are active.',
  },
  {
    q: 'Is my data secure and private?',
    a: 'Yes. Signup is invite-only with single-use expiring tokens. Row-level security ensures volunteers only see their own data and admins only see their own organisation. Calendar feeds are protected by private tokens that can be rotated.',
  },
  {
    q: 'How do I get started?',
    a: 'Request access using the form on this page. We onboard new organisations manually so we can set up your branding, roles and templates correctly from day one.',
  },
  {
    q: 'Can I export the rota for printing?',
    a: 'Yes. Admins can export polished, print-ready schedules suitable for noticeboards and welcome packs. Declined volunteers are excluded automatically.',
  },
  {
    q: 'What happens if a volunteer becomes unavailable?',
    a: 'Volunteers mark unavailable dates in their own calendar (up to two years ahead) and the auto-scheduler avoids those dates. They can also decline an invitation and add the date to their unavailability in a single tap.',
  },
];

const requestSchema = z.object({
  name: z.string().trim().min(2, 'Please enter your name').max(120),
  email: z.string().trim().email('Please enter a valid email'),
  organisation_name: z.string().trim().min(2, 'Please enter your organisation\'s name').max(160),
  notes: z.string().trim().max(2000).optional().or(z.literal('')),
});

const Landing = () => {
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({
    name: '',
    email: '',
    organisation_name: '',
    notes: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = requestSchema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.errors[0].message);
      return;
    }

    setSubmitting(true);
    const { error } = await supabase.from('access_requests').insert({
      name: parsed.data.name,
      email: parsed.data.email,
      organisation_name: parsed.data.organisation_name,
      notes: parsed.data.notes || null,
      status: 'pending',
    });

    supabase.functions
      .invoke('notify-access-request', {
        body: {
          name: parsed.data.name,
          email: parsed.data.email,
          organisationName: parsed.data.organisation_name,
          notes: parsed.data.notes || '',
        },
      })
      .catch(() => {
        // best effort only
      });

    setSubmitting(false);
    if (error) {
      console.error(error);
      toast.error('Something went wrong submitting your request. Please try again.');
      return;
    }

    setSubmitted(true);
    setForm({ name: '', email: '', organisation_name: '', notes: '' });
  };

  const softwareJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'ServeTogether',
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    description:
      'ServeTogether is volunteer rota and church scheduling software. Build rotas automatically, manage swaps, track availability and notify volunteers - all in one place.',
    url: SITE_URL,
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'GBP',
      availability: 'https://schema.org/InStock',
    },
    audience: {
      '@type': 'Audience',
      audienceType: 'Churches, charities and volunteer-led organisations',
    },
  };

  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  };

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>ServeTogether - Volunteer & Church Rota Software</title>
        <meta name="description" content="ServeTogether is volunteer scheduling and church rota software. Build rotas automatically, manage swaps, track availability and notify volunteers - without spreadsheets." />
        <link rel="canonical" href={`${SITE_URL}/`} />
        <meta property="og:title" content="ServeTogether - Volunteer & Church Rota Software" />
        <meta property="og:description" content="Build rotas automatically, manage swaps, track availability and notify volunteers - for churches and volunteer-led organisations." />
        <meta property="og:url" content={`${SITE_URL}/`} />
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="ServeTogether - Volunteer & Church Rota Software" />
        <meta name="twitter:description" content="Volunteer scheduling and church rota software for churches, charities and community groups." />
        <script type="application/ld+json">{JSON.stringify(softwareJsonLd)}</script>
        <script type="application/ld+json">{JSON.stringify(faqJsonLd)}</script>
      </Helmet>

      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto flex h-20 items-center justify-between px-4">
          <Link to="/" className="flex items-center gap-2">
            <img src={logoUrl} alt="ServeTogether - volunteer scheduling for churches and organisations" className="h-12 w-auto md:h-14" />
          </Link>
          <nav className="hidden items-center gap-6 text-sm font-medium md:flex">
            <a href="#features" className="text-muted-foreground transition-colors hover:text-foreground">Features</a>
            <a href="#how-it-works" className="text-muted-foreground transition-colors hover:text-foreground">How it works</a>
            <a href="#who-its-for" className="text-muted-foreground transition-colors hover:text-foreground">Who it is for</a>
            <a href="#faq" className="text-muted-foreground transition-colors hover:text-foreground">FAQ</a>
          </nav>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" className="hidden sm:inline-flex"><a href="#request-access">Request access</a></Button>
            <Button asChild><Link to="/auth">Sign in<ArrowRight className="ml-2 h-4 w-4" /></Link></Button>
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden border-b bg-gradient-to-b from-primary/5 to-background py-20 md:py-28">
        <div className="container mx-auto px-4 text-center">
          <div className="mx-auto max-w-4xl">
            <img src={logoUrl} alt="ServeTogether logo" className="mx-auto mb-10 h-32 w-auto md:h-40 lg:h-48" />
            <h1 className="font-serif text-4xl font-bold tracking-tight md:text-5xl lg:text-6xl">Volunteer & church rota software<span className="block text-primary">that runs itself</span></h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground md:text-xl">ServeTogether helps churches, charities and volunteer-led organisations build rotas, manage swaps, track availability and notify their teams - automatically, and without spreadsheets.</p>
            <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:justify-center">
              <Button asChild size="lg" className="text-base"><a href="#request-access">Request access for your organisation<ArrowRight className="ml-2 h-5 w-5" /></a></Button>
              <Button asChild size="lg" variant="outline" className="text-base"><Link to="/auth">Sign in to your account</Link></Button>
            </div>
            <p className="mt-6 text-sm text-muted-foreground">Invite-only · Mobile-friendly · Built for churches, designed for any volunteer team</p>
          </div>
        </div>
        <div className="absolute -top-24 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-primary/10 blur-3xl" />
      </section>

      <section id="features" className="py-20"><div className="container mx-auto px-4"><div className="mx-auto max-w-3xl text-center"><h2 className="font-serif text-3xl font-bold md:text-4xl">The full feature set</h2><p className="mt-4 text-muted-foreground">Everything you need to coordinate a volunteer team - from auto-scheduling and swaps to email notifications, calendar feeds and admin oversight.</p></div><div className="mt-16 space-y-16">{featureGroups.map((group) => (<div key={group.title}><div className="mb-8 flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary"><group.icon className="h-5 w-5" /></div><h3 className="font-serif text-2xl font-semibold">{group.title}</h3></div><div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">{group.features.map((f) => (<Card key={f.name} className="border-2 transition-colors hover:border-primary/50"><CardContent className="pt-6"><div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary"><f.icon className="h-5 w-5" /></div><h4 className="font-serif text-lg font-semibold">{f.name}</h4><p className="mt-2 text-sm text-muted-foreground">{f.desc}</p></CardContent></Card>))}</div></div>))}</div></div></section>

      <section id="how-it-works" className="border-y bg-muted/50 py-20"><div className="container mx-auto px-4"><div className="mx-auto max-w-2xl text-center"><h2 className="font-serif text-3xl font-bold md:text-4xl">How it works</h2><p className="mt-4 text-muted-foreground">Four steps from sign-up to a published, fairly-built rota.</p></div><div className="mx-auto mt-12 grid max-w-5xl gap-6 md:grid-cols-2 lg:grid-cols-4">{howItWorks.map((s) => (<div key={s.step} className="rounded-2xl border-2 bg-background p-6"><div className="font-serif text-3xl font-bold text-primary">{s.step}</div><h3 className="mt-3 font-serif text-lg font-semibold">{s.title}</h3><p className="mt-2 text-sm text-muted-foreground">{s.desc}</p></div>))}</div></div></section>

      <section id="who-its-for" className="py-20"><div className="container mx-auto px-4"><div className="mx-auto max-w-2xl text-center"><h2 className="font-serif text-3xl font-bold md:text-4xl">Who it is for</h2><p className="mt-4 text-muted-foreground">Built first for churches. Used by any organisation that runs on volunteers.</p></div><div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">{audiences.map((a) => (<Card key={a.name} className="border-2"><CardContent className="pt-6"><div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary"><a.icon className="h-5 w-5" /></div><h3 className="font-serif text-lg font-semibold">{a.name}</h3><p className="mt-2 text-sm text-muted-foreground">{a.desc}</p></CardContent></Card>))}</div></div></section>

      <section className="border-y bg-muted/50 py-20"><div className="container mx-auto px-4"><div className="grid gap-12 lg:grid-cols-2 lg:items-center"><div><h2 className="font-serif text-3xl font-bold md:text-4xl">Why ServeTogether?</h2><p className="mt-4 text-muted-foreground">Built for the people who actually run the rota. Whether you are a church administrator, a charity coordinator or a community group lead, ServeTogether takes the admin off your plate so you can focus on the work itself.</p><ul className="mt-8 space-y-3">{benefits.map((benefit) => (<li key={benefit} className="flex items-start gap-3"><CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" /><span>{benefit}</span></li>))}</ul></div><div className="rounded-2xl border-2 bg-background p-8 shadow-lg"><div className="space-y-6"><div className="flex items-start gap-4"><div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"><Users className="h-6 w-6" /></div><div><p className="font-semibold">For volunteers</p><p className="text-sm text-muted-foreground">See your schedule, mark availability, accept invitations and request swaps - all from your phone.</p></div></div><div className="flex items-start gap-4"><div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"><Shield className="h-6 w-6" /></div><div><p className="font-semibold">For coordinators</p><p className="text-sm text-muted-foreground">Build events from templates, auto-schedule, send invitations, monitor confidence and publish in a click.</p></div></div><div className="flex items-start gap-4"><div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"><Bell className="h-6 w-6" /></div><div><p className="font-semibold">Always in sync</p><p className="text-sm text-muted-foreground">Email notifications and personal calendar feeds keep every volunteer in the loop, automatically.</p></div></div></div></div></div></div></section>

      <section id="faq" className="py-20"><div className="container mx-auto px-4"><div className="mx-auto max-w-3xl"><div className="text-center"><h2 className="font-serif text-3xl font-bold md:text-4xl">Frequently asked questions</h2><p className="mt-4 text-muted-foreground">Quick answers about how ServeTogether works.</p></div><Accordion type="single" collapsible className="mt-10">{faqs.map((f, i) => (<AccordionItem key={i} value={`item-${i}`}><AccordionTrigger className="text-left font-serif text-base">{f.q}</AccordionTrigger><AccordionContent className="text-muted-foreground">{f.a}</AccordionContent></AccordionItem>))}</Accordion></div></div></section>

      <section id="request-access" className="border-t bg-muted/50 py-20"><div className="container mx-auto px-4"><div className="mx-auto max-w-2xl"><div className="text-center"><h2 className="font-serif text-3xl font-bold md:text-4xl">Bring ServeTogether to your organisation</h2><p className="mt-4 text-muted-foreground">Tell us about your church or organisation and we will be in touch to set up your own ServeTogether instance.</p></div><Card className="mt-10 border-2"><CardContent className="pt-6">{submitted ? (<div className="py-8 text-center"><CheckCircle2 className="mx-auto h-12 w-12 text-primary" /><h3 className="mt-4 font-serif text-xl font-semibold">Thanks - we have got your request</h3><p className="mt-2 text-muted-foreground">We will be in touch by email shortly to get you set up.</p><Button variant="outline" className="mt-6" onClick={() => setSubmitted(false)}>Send another</Button></div>) : (<form onSubmit={handleSubmit} className="space-y-4"><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="ra-name">Your name</Label><Input id="ra-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div><div className="space-y-2"><Label htmlFor="ra-email">Email</Label><Input id="ra-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></div></div><div className="space-y-2"><Label htmlFor="ra-org">Organisation name</Label><Input id="ra-org" placeholder="e.g. St Matthew's Church, North Park Foodbank" value={form.organisation_name} onChange={(e) => setForm({ ...form, organisation_name: e.target.value })} required /></div><div className="space-y-2"><Label htmlFor="ra-notes">Anything we should know? (optional)</Label><Textarea id="ra-notes" rows={4} placeholder="How many volunteers, what kind of rota, any specific needs..." value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div><Button type="submit" className="w-full" disabled={submitting}>{submitting ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Sending...</>) : ('Request access')}</Button></form>)}</CardContent></Card></div></div></section>

      <footer className="border-t py-10"><div className="container mx-auto flex flex-col items-center justify-between gap-4 px-4 text-sm text-muted-foreground sm:flex-row"><div className="flex items-center gap-3"><img src={logoUrl} alt="ServeTogether" className="h-8 w-auto" /><span>&copy; {new Date().getFullYear()} ServeTogether. All rights reserved.</span></div><div className="flex items-center gap-5"><a href="#features" className="hover:text-foreground">Features</a><a href="#how-it-works" className="hover:text-foreground">How it works</a><a href="#faq" className="hover:text-foreground">FAQ</a><Link to="/auth" className="hover:text-foreground">Sign in</Link></div></div></footer>
    </div>
  );
};

export default Landing;
