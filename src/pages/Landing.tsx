import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { 
  Calendar, 
  Users, 
  RefreshCw, 
  Bell, 
  Shield, 
  Clock,
  CheckCircle2,
  ArrowRight
} from 'lucide-react';

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

const Landing = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <span className="font-serif text-xl font-bold">S</span>
            </div>
            <div>
              <h1 className="font-serif text-lg font-semibold leading-tight">St. Matthew's</h1>
              <p className="text-xs text-muted-foreground">Volunteer Rota</p>
            </div>
          </div>
          <Button asChild>
            <Link to="/auth">
              Sign In
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden border-b bg-gradient-to-b from-primary/5 to-background py-20 md:py-32">
        <div className="container mx-auto px-4 text-center">
          <div className="mx-auto max-w-3xl">
            <h2 className="font-serif text-4xl font-bold tracking-tight md:text-5xl lg:text-6xl">
              Volunteer Scheduling
              <span className="block text-primary">Made Simple</span>
            </h2>
            <p className="mt-6 text-lg text-muted-foreground md:text-xl">
              Streamline your church volunteer rota with smart scheduling, easy swaps, 
              and automatic notifications. Less admin work, more ministry.
            </p>
            <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:justify-center">
              <Button asChild size="lg" className="text-base">
                <Link to="/auth">
                  Sign In to Your Account
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
        
        {/* Decorative elements */}
        <div className="absolute -top-24 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-primary/10 blur-3xl" />
      </section>

      {/* Features Grid */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-2xl text-center">
            <h3 className="font-serif text-3xl font-bold md:text-4xl">
              Everything You Need
            </h3>
            <p className="mt-4 text-muted-foreground">
              A complete solution for managing church volunteer schedules
            </p>
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

      {/* Benefits Section */}
      <section className="border-y bg-muted/50 py-20">
        <div className="container mx-auto px-4">
          <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
            <div>
              <h3 className="font-serif text-3xl font-bold md:text-4xl">
                Why Choose Our System?
              </h3>
              <p className="mt-4 text-muted-foreground">
                Built specifically for church volunteer coordination, our system 
                handles the complexity so you can focus on what matters.
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

      {/* CTA Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-2xl rounded-2xl bg-primary p-8 text-center text-primary-foreground md:p-12">
            <h3 className="font-serif text-2xl font-bold md:text-3xl">
              Ready to Get Started?
            </h3>
            <p className="mt-4 text-primary-foreground/80">
              Sign in to access your volunteer schedule or contact your administrator for an invitation.
            </p>
            <Button asChild size="lg" variant="secondary" className="mt-8">
              <Link to="/auth">
                Sign In Now
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>&copy; {new Date().getFullYear()} St. Matthew's Church. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
