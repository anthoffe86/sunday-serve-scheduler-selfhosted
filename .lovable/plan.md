
## Why Send Invitations / Auto Assign fail in Test

Both buttons call backend edge functions:

- `send-invitations` (Send Invitations)
- `auto-scheduler` (Auto Assign)

I tested them directly against the Test backend and both return **404 NOT_FOUND — "Requested function was not found"**. I also checked `calendar-feed` and it's missing too. So this is not a code or auth bug — **none of the 17 edge functions are deployed in Test**. They only exist in Live (that's why everything worked in production earlier). The browser sees the 404 preflight as a generic "Failed to fetch", which is the error you saw.

### Fix

Deploy all 17 edge functions from the codebase to the Test environment. No code changes needed.

Functions to deploy:

```
accept-swap-request          mark-invite-used
admin-accept-swap            offer-swap
admin-user-management        respond-invitation
auto-scheduler               send-assignment-removal-notification
calendar-feed                send-event-notification
confirm-swap                 send-invitations
                             send-invite-email
                             send-swap-notification
                             send-swap-offer-notification
validate-invite-token
```

### After deploy I'll verify

1. Hit `send-invitations` and `auto-scheduler` directly against Test and confirm they respond (no more 404).
2. Confirm `RESEND_API_KEY` is present in Test (it shows in the project secrets, so it should be).
3. Let you click both buttons again to confirm end-to-end success.

### What this won't change

- No Live deployment. Live functions stay exactly as they are now until you next Publish.
- No edits to function source code — they're working code, they just aren't deployed in Test.
- No changes to Test data — the database reset only affected Live.
