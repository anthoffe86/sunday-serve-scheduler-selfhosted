import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { supabase } from '@/integrations/supabase/client';
import serveTogetherLogo from '@/assets/servetogether-logo.png';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Loader2, ArrowLeft } from 'lucide-react';
import { z } from 'zod';

const emailSchema = z.string().email('Please enter a valid email address');
const SITE_URL = import.meta.env.VITE_SITE_URL || window.location.origin;

const GENERIC_ERROR = "We couldn't send the reset email. Please try again shortly.";

/**
 * supabase.functions.invoke surfaces non-2xx responses as an error whose
 * `context` is the raw Response, so the function's JSON message has to be read
 * back off it.
 */
async function readFunctionError(error: unknown): Promise<string> {
  const context = (error as { context?: Response })?.context;
  if (context && typeof context.json === 'function') {
    try {
      const body = await context.json();
      if (typeof body?.error === 'string' && body.error) return body.error;
    } catch {
      // Non-JSON body; fall through to the generic message.
    }
  }
  return GENERIC_ERROR;
}

const ForgotPassword = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      emailSchema.parse(email);
    } catch (err) {
      if (err instanceof z.ZodError) {
        toast.error(err.errors[0].message);
        return;
      }
    }

    setIsSubmitting(true);

    try {
      // Sent via our own edge function (Resend) rather than supabase.auth
      // .resetPasswordForEmail, so the link is built from the server-side
      // APP_BASE_URL instead of the Supabase project's Site URL.
      const { data, error } = await supabase.functions.invoke('send-password-reset', {
        body: { email: email.trim().toLowerCase(), baseUrl: window.location.origin },
      });

      if (error) {
        // Only configuration/transport failures reach here; the function
        // deliberately returns success whether or not the address is registered.
        const message = await readFunctionError(error);
        toast.error(message);
        return;
      }

      if (data?.error) {
        toast.error(data.error);
        return;
      }

      setEmailSent(true);
    } catch (err) {
      console.error('Password reset request failed:', err);
      toast.error(GENERIC_ERROR);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Helmet>
        <title>Forgot Password | ServeTogether</title>
        <meta
          name="description"
          content="Request a secure password reset link for your ServeTogether account."
        />
        <meta name="robots" content="noindex,follow" />
        <link rel="canonical" href={`${SITE_URL}/forgot-password`} />
      </Helmet>

      <div className="w-full max-w-md animate-fade-in">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-6">
            <img src={serveTogetherLogo} alt="ServeTogether" className="h-10 mx-auto" />
          </div>
          <p className="text-muted-foreground">Volunteer Scheduling</p>
        </div>

        <Card>
          <CardHeader className="text-center">
            <CardTitle className="font-serif">
              {emailSent ? 'Check Your Email' : 'Forgot Password'}
            </CardTitle>
            <CardDescription>
              {emailSent
                ? `We've sent a password reset link to ${email}`
                : 'Enter your email and we\'ll send you a reset link'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {emailSent ? (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground text-center">
                  Didn't receive the email? Check your spam folder or try again.
                </p>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => setEmailSent(false)}
                >
                  Try Again
                </Button>
                <Button
                  variant="ghost"
                  className="w-full"
                  onClick={() => navigate('/auth')}
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to Sign In
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="reset-email">Email</Label>
                  <Input
                    id="reset-email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    'Send Reset Link'
                  )}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full"
                  onClick={() => navigate('/auth')}
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to Sign In
                </Button>
              </form>
            )}
          </CardContent>
        </Card>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          Powered by ServeTogether
        </p>
      </div>
    </div>
  );
};

export default ForgotPassword;
