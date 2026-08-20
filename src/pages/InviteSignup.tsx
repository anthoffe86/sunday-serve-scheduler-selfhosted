import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { usePublicOrgSettings } from '@/hooks/usePublicOrgSettings';
import { SeoMeta } from '@/components/seo/SeoMeta';

interface InviteTokenData {
  id: string;
  email: string;
  name: string;
  expires_at: string;
}

const InviteSignup = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');

  const [isValidating, setIsValidating] = useState(true);
  const [inviteData, setInviteData] = useState<InviteTokenData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { data: orgSettings } = usePublicOrgSettings();

  useEffect(() => {
    const validateToken = async () => {
      if (!token) {
        setError('No invitation token provided');
        setIsValidating(false);
        return;
      }

      try {
        // Validate token via edge function (server-side validation)
        const response = await supabase.functions.invoke('validate-invite-token', {
          body: { token },
        });

        if (response.error) {
          console.error('Token validation error:', response.error);
          setError('Failed to validate invitation');
        } else if (response.data?.error) {
          setError(response.data.error === 'Invalid or expired invitation' 
            ? 'This invitation link is invalid or has expired'
            : response.data.error);
        } else if (response.data?.data) {
          setInviteData(response.data.data);
        } else {
          setError('This invitation link is invalid or has expired');
        }
      } catch (err) {
        console.error('Token validation error:', err);
        setError('Failed to validate invitation');
      }
      setIsValidating(false);
    };

    validateToken();
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }

    if (password !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    if (!inviteData || !token) return;

    setIsSubmitting(true);

    try {
      // Created server-side rather than with auth.signUp: signUp leaves the account
      // unconfirmed while "Confirm email" is on, so the volunteer was bounced with
      // "email not verified" on their first login. Opening a link that was only ever
      // emailed to this address is the proof of ownership, so the edge function
      // confirms the address as it creates the account. It also consumes the token,
      // which is why mark-invite-used is no longer called here.
      const { data: result, error: invokeError } = await supabase.functions.invoke(
        'complete-invite-signup',
        { body: { token, password } }
      );

      if (invokeError) {
        // invoke collapses every non-2xx into a generic message, so the function's own
        // error text has to be read back off the raw Response it hangs on `context`.
        const context = (invokeError as { context?: Response }).context;
        let message = invokeError.message || 'Failed to create account';
        let code: string | undefined;

        if (context && typeof context.json === 'function') {
          try {
            const body = await context.json();
            if (typeof body?.error === 'string' && body.error) message = body.error;
            if (typeof body?.code === 'string') code = body.code;
          } catch {
            // Non-JSON body; fall through to the generic message.
          }
        }

        if (code === 'already_registered') {
          toast.error(message);
          navigate('/auth');
          return;
        }

        throw new Error(message);
      }

      if (result?.error) {
        throw new Error(result.error);
      }

      toast.success('Account created successfully! You can now log in.');
      navigate('/auth');
    } catch (err: any) {
      console.error('Signup error:', err);
      if (err.message?.includes('already registered')) {
        toast.error('This email is already registered. Please log in instead.');
        navigate('/auth');
      } else {
        toast.error(err.message || 'Failed to create account');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isValidating) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30">
        <SeoMeta
          title="Invitation Signup | ServeTogether"
          description="Complete your ServeTogether invitation and create your account password."
          path="/invite"
          noindex
        />

        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="mt-4 text-muted-foreground">Validating invitation...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
        <SeoMeta
          title="Invitation Signup | ServeTogether"
          description="Complete your ServeTogether invitation and create your account password."
          path="/invite"
          noindex
        />

        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <XCircle className="h-12 w-12 text-destructive" />
            <h2 className="mt-4 text-xl font-semibold">Invalid Invitation</h2>
            <p className="mt-2 text-muted-foreground">{error}</p>
            <Button className="mt-6" onClick={() => navigate('/auth')}>
              Go to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <SeoMeta
        title="Invitation Signup | ServeTogether"
        description="Complete your ServeTogether invitation and create your account password."
        path="/invite"
        noindex
      />

      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <CheckCircle className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="font-serif text-2xl">Welcome, {inviteData?.name}!</CardTitle>
          <CardDescription>
            You've been invited to join {orgSettings.organisationName} as a volunteer. Create your password to complete your account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={inviteData?.email || ''} disabled className="bg-muted" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Create a password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm Password</Label>
              <Input
                id="confirm-password"
                type="password"
                placeholder="Confirm your password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating Account...
                </>
              ) : (
                'Create Account'
              )}
            </Button>
          </form>

          <p className="mt-4 text-center text-sm text-muted-foreground">
            Already have an account?{' '}
            <Button variant="link" className="p-0" onClick={() => navigate('/auth')}>
              Log in
            </Button>
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default InviteSignup;
