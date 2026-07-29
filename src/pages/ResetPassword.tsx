import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import serveTogetherLogo from '@/assets/servetogether-logo.png';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

type Status = 'verifying' | 'ready' | 'invalid';

const DEFAULT_INVALID_MESSAGE =
  'This password reset link is invalid or has expired. Please request a new one.';

/** Remove the recovery token from the address bar so it is not left in history. */
function stripTokensFromUrl() {
  window.history.replaceState({}, document.title, window.location.pathname);
}

const ResetPassword = () => {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState<Status>('verifying');
  const [invalidMessage, setInvalidMessage] = useState(DEFAULT_INVALID_MESSAGE);
  // Recovery tokens are single-use, so React StrictMode's double-invoked
  // effect must not redeem the same token twice.
  const hasVerified = useRef(false);

  useEffect(() => {
    if (hasVerified.current) return;
    hasVerified.current = true;

    const searchParams = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));

    const fail = (message?: string) => {
      setInvalidMessage(message || DEFAULT_INVALID_MESSAGE);
      setStatus('invalid');
    };

    const succeed = () => {
      stripTokensFromUrl();
      setStatus('ready');
    };

    const verify = async () => {
      // Supabase reports rejected links (expired, already used) as error params.
      const errorDescription =
        hashParams.get('error_description') ?? searchParams.get('error_description');
      if (errorDescription || hashParams.get('error') || searchParams.get('error')) {
        stripTokensFromUrl();
        fail(errorDescription ?? undefined);
        return;
      }

      // Primary flow: link built by the send-password-reset edge function.
      const tokenHash = searchParams.get('token_hash') ?? searchParams.get('token');
      if (tokenHash) {
        const { error } = await supabase.auth.verifyOtp({
          type: 'recovery',
          token_hash: tokenHash,
        });
        if (error) {
          stripTokensFromUrl();
          fail();
          return;
        }
        succeed();
        return;
      }

      // Fallback: PKCE-style link (?code=...) from Supabase's own mailer.
      const code = searchParams.get('code');
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          stripTokensFromUrl();
          fail();
          return;
        }
        succeed();
        return;
      }

      // Fallback: implicit-flow link (#access_token=...&type=recovery). The
      // client's detectSessionInUrl may already have consumed these, in which
      // case a session is present and getSession below picks it up.
      const accessToken = hashParams.get('access_token');
      const refreshToken = hashParams.get('refresh_token');
      if (accessToken && refreshToken) {
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (error) {
          stripTokensFromUrl();
          fail();
          return;
        }
        succeed();
        return;
      }

      if (hashParams.get('type') === 'recovery') {
        const { data } = await supabase.auth.getSession();
        if (data.session) {
          succeed();
          return;
        }
      }

      fail('No password reset token was found in this link. Please request a new one.');
    };

    verify();
  }, []);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }

    if (password !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    setIsSubmitting(true);
    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setIsSubmitting(false);
      toast.error(error.message);
      return;
    }

    // End the recovery session so the new password has to be used to get back
    // in, and so a shared/public browser is not left signed in.
    await supabase.auth.signOut();
    setIsSubmitting(false);
    toast.success('Password updated. Please sign in with your new password.');
    navigate('/auth');
  };

  if (status === 'verifying') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (status === 'invalid') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="font-serif">Invalid Reset Link</CardTitle>
            <CardDescription>{invalidMessage}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button className="w-full" onClick={() => navigate('/forgot-password')}>
              Request a New Link
            </Button>
            <Button variant="ghost" className="w-full" onClick={() => navigate('/auth')}>
              Back to Sign In
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md animate-fade-in">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-6">
            <img src={serveTogetherLogo} alt="ServeTogether" className="h-10 mx-auto" />
          </div>
          <p className="text-muted-foreground">Volunteer Scheduling</p>
        </div>

        <Card>
          <CardHeader className="text-center">
            <CardTitle className="font-serif">Set New Password</CardTitle>
            <CardDescription>
              Enter your new password below
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-password">New Password</Label>
                <Input
                  id="new-password"
                  type="password"
                  placeholder="••••••••"
                  autoComplete="new-password"
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
                  placeholder="••••••••"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={8}
                />
              </div>
              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Updating...
                  </>
                ) : (
                  'Update Password'
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          Powered by ServeTogether
        </p>
      </div>
    </div>
  );
};

export default ResetPassword;
