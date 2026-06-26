import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Loader2, CheckCircle, XCircle, AlertCircle, Mail } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { usePublicOrgSettings } from '@/hooks/usePublicOrgSettings';

const InvitationResponse = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const [status, setStatus] = useState<'loading' | 'confirming' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const [declineReason, setDeclineReason] = useState('');
  const [showDeclineForm, setShowDeclineForm] = useState(false);
  const { data: orgSettings } = usePublicOrgSettings();
  
  const token = searchParams.get('token');
  const tokens = searchParams.get('tokens');
  const action = searchParams.get('action') as 'accept' | 'decline' | null;

  useEffect(() => {
    // If action is provided via URL, show confirmation
    if ((token || tokens) && action) {
      if (action === 'decline') {
        setShowDeclineForm(true);
        setStatus('confirming');
      } else {
        // Auto-confirm accept
        handleResponse(action);
      }
    } else if (token || tokens) {
      setStatus('confirming');
    } else {
      setStatus('error');
      setMessage('No invitation token provided');
    }
  }, [token, tokens, action]);

  const handleResponse = async (responseAction: 'accept' | 'decline') => {
    setStatus('loading');
    
    try {
      const { data: result, error } = await supabase.functions.invoke('respond-invitation', {
        body: {
          token,
          tokens,
          action: responseAction,
          declineReason: responseAction === 'decline' ? declineReason : undefined,
        },
      });

      if (error) throw error;
      if (result.error) throw new Error(result.error);

      setStatus('success');
      setMessage(result.message);
    } catch (err: any) {
      setStatus('error');
      setMessage(err.message || 'Failed to process response');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 to-secondary/5 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          {status === 'loading' && (
            <>
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
              <CardTitle>Processing...</CardTitle>
              <CardDescription>Please wait while we process your response.</CardDescription>
            </>
          )}
          
          {status === 'confirming' && !showDeclineForm && (
            <>
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                <Mail className="h-6 w-6 text-primary" />
              </div>
              <CardTitle>Respond to Invitation</CardTitle>
              <CardDescription>Would you like to accept or decline this invitation from {orgSettings.organisationName}?</CardDescription>
            </>
          )}
          
          {status === 'confirming' && showDeclineForm && (
            <>
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
                <XCircle className="h-6 w-6 text-destructive" />
              </div>
              <CardTitle>Decline Invitation</CardTitle>
              <CardDescription>Please provide a reason (optional) and confirm.</CardDescription>
            </>
          )}
          
          {status === 'success' && (
            <>
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
              <CardTitle>Response Recorded</CardTitle>
              <CardDescription>{message}</CardDescription>
            </>
          )}
          
          {status === 'error' && (
            <>
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
                <AlertCircle className="h-6 w-6 text-destructive" />
              </div>
              <CardTitle>Error</CardTitle>
              <CardDescription>{message}</CardDescription>
            </>
          )}
        </CardHeader>
        
        <CardContent className="space-y-4">
          {status === 'confirming' && !showDeclineForm && (
            <div className="flex gap-3">
              <Button 
                onClick={() => handleResponse('accept')} 
                className="flex-1 bg-green-600 hover:bg-green-700"
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                Accept
              </Button>
              <Button 
                onClick={() => setShowDeclineForm(true)} 
                variant="destructive" 
                className="flex-1"
              >
                <XCircle className="h-4 w-4 mr-2" />
                Decline
              </Button>
            </div>
          )}
          
          {status === 'confirming' && showDeclineForm && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="reason">Reason (optional)</Label>
                <Textarea
                  id="reason"
                  placeholder="e.g., I'll be on holiday that week..."
                  value={declineReason}
                  onChange={(e) => setDeclineReason(e.target.value)}
                  rows={3}
                />
              </div>
              <div className="flex gap-3">
                <Button 
                  variant="outline" 
                  onClick={() => setShowDeclineForm(false)}
                  className="flex-1"
                >
                  Back
                </Button>
                <Button 
                  onClick={() => handleResponse('decline')} 
                  variant="destructive" 
                  className="flex-1"
                >
                  Confirm Decline
                </Button>
              </div>
            </div>
          )}
          
          {(status === 'success' || status === 'error') && (
            <div className="flex flex-col gap-3">
              <Button onClick={() => navigate('/schedule')} className="w-full">
                View Your Schedule
              </Button>
              <Button variant="outline" onClick={() => navigate('/dashboard')} className="w-full">
                Go to Dashboard
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default InvitationResponse;
