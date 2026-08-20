import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MIN_PASSWORD_LENGTH = 8;
// bcrypt silently truncates past 72 bytes, so reject rather than accept a password
// that would not be stored in full.
const MAX_PASSWORD_LENGTH = 72;

interface CompleteInviteRequest {
  token: string;
  password: string;
}

const isEmailExistsError = (error: unknown): boolean => {
  if (!error || typeof error !== 'object') return false;
  if ('code' in error && (error as { code?: string }).code === 'email_exists') return true;
  const message = (error as { message?: string }).message ?? '';
  return /already (been )?registered|already exists/i.test(message);
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const json = (body: unknown, status: number) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  try {
    const { token, password } = (await req.json()) as CompleteInviteRequest;

    if (!token || typeof token !== 'string') {
      return json({ error: 'Token is required' }, 400);
    }

    if (!password || typeof password !== 'string') {
      return json({ error: 'A password is required' }, 400);
    }

    if (password.length < MIN_PASSWORD_LENGTH) {
      return json({ error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` }, 400);
    }

    if (password.length > MAX_PASSWORD_LENGTH) {
      return json({ error: `Password must be ${MAX_PASSWORD_LENGTH} characters or fewer` }, 400);
    }

    // Service role: this endpoint is reached by the invitee, who has no session yet.
    // The bearer credential is the invite token itself (32 random bytes, single use,
    // 7 day expiry), and it is the only thing that authorises account creation here.
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // The invite row is the source of truth for the address and the name. Nothing
    // about the identity is taken from the request body, so holding a token cannot
    // be turned into an account for some other address.
    const { data: invite, error: inviteError } = await supabaseAdmin
      .from('invite_tokens')
      .select('id, token, email, name, used_at, expires_at')
      .eq('token', token)
      .maybeSingle();

    if (inviteError) {
      console.error('Failed to load the invite token:', inviteError);
      return json({ error: 'Failed to validate invitation' }, 500);
    }

    if (!invite || invite.used_at || new Date(invite.expires_at as string) <= new Date()) {
      // Deliberately vague: this is also the response an outsider guessing tokens gets.
      return json({ error: 'This invitation link is invalid or has expired' }, 404);
    }

    const email = String(invite.email).trim().toLowerCase();
    const name = String(invite.name);

    // createUser with email_confirm, not a client-side auth.signUp: the invitee proved
    // control of the address by opening a link that was only ever emailed to it, so the
    // account is usable immediately. A plain signUp leaves the user unconfirmed and the
    // first login fails with "email not verified".
    //
    // invite_token is passed through in user_metadata because handle_new_user reads it
    // back to place the profile in the inviting organisation and to consume the token in
    // the same transaction that creates the account.
    let createdUser: Awaited<ReturnType<typeof supabaseAdmin.auth.admin.createUser>>['data'] | null = null;
    let createUserError: unknown = null;

    try {
      const result = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { name, invite_token: invite.token },
      });

      createdUser = result.data;
      createUserError = result.error;
    } catch (error) {
      createUserError = error;
    }

    if (isEmailExistsError(createUserError)) {
      // Not a leak: the caller already holds an invite issued to this exact address.
      return json(
        {
          error: 'This email is already registered. Please log in instead.',
          code: 'already_registered',
        },
        409
      );
    }

    if (createUserError || !createdUser?.user) {
      console.error('Failed to create the invited account:', createUserError);
      return json({ error: 'Failed to create account' }, 500);
    }

    // handle_new_user already consumes the token inside the insert transaction; this is a
    // no-op there, and the safety net for a deployment still running the older trigger.
    const { error: markUsedError } = await supabaseAdmin
      .from('invite_tokens')
      .update({ used_at: new Date().toISOString() })
      .eq('id', invite.id)
      .is('used_at', null);

    if (markUsedError) {
      // The account exists and the trigger has almost certainly burned the token, so this
      // is logged rather than failed: telling the invitee to try again would be wrong.
      console.error('Failed to mark the invite token as used:', markUsedError);
    }

    console.log(`Invited account created and confirmed for invite ${invite.id}.`);

    return json({ success: true, email }, 200);
  } catch (error) {
    console.error('Error in complete-invite-signup function:', error);
    return json({ error: 'Invalid request' }, 400);
  }
});
