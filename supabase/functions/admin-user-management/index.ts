import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  PASSWORD_RESET_NOT_CONFIGURED,
  generateRecoveryLink,
  isResendConfigured,
  isValidEmail,
  resolveAppOrigin,
  sendAccountSetupEmail,
  sendPasswordResetEmail,
} from '../_shared/password-reset.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

type AuthIdentityCandidate = {
  identity_data?: {
    email?: string | null
  } | null
}

type AuthUserCandidate = {
  email?: string | null
  identities?: AuthIdentityCandidate[] | null
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    // Create admin client with service role
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    // Create regular client to verify the caller is an admin
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } }
    })

    // Get the calling user
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { data: roleRows, error: roleError } = await supabaseAdmin
      .from('user_roles')
      .select('role, org_id')
      .eq('user_id', user.id)

    if (roleError) {
      throw roleError
    }

    const roles = (roleRows ?? []) as Array<{ role: string; org_id: string | null }>
    const isSuperAdmin = roles.some((row) => row.role === 'super_admin')
    const isOrgAdmin = roles.some((row) => row.role === 'admin')
    const callerOrgId = roles.find((row) => row.role === 'admin' && row.org_id)?.org_id ?? null

    if (!isSuperAdmin && !isOrgAdmin) {
      return new Response(
        JSON.stringify({ error: 'Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { action, userId, data } = await req.json()

    const ensureSuperAdmin = () => {
      if (!isSuperAdmin) {
        throw new Error('Super admin access required')
      }
    }

    const isEmailExistsError = (error: unknown): error is { code?: string } => {
      return !!error && typeof error === 'object' && 'code' in error && error.code === 'email_exists'
    }

    const findAuthUserByEmail = async (email: string) => {
      let page = 1

      while (true) {
        const { data: listedUsers, error: listUsersError } = await supabaseAdmin.auth.admin.listUsers({
          page,
          perPage: 1000,
        })

        if (listUsersError) {
          throw listUsersError
        }

        const users = listedUsers.users ?? []
        const matchedUser = users.find((candidate: AuthUserCandidate) => {
          if (candidate.email?.toLowerCase() === email) {
            return true
          }

          const identityEmailMatch = (candidate.identities ?? []).some((identity: AuthIdentityCandidate) => {
            const identityEmail = identity.identity_data?.email
            return typeof identityEmail === 'string' && identityEmail.toLowerCase() === email
          })

          return identityEmailMatch
        })
        if (matchedUser) {
          return matchedUser
        }

        if (users.length < 1000) {
          return null
        }

        page += 1
      }
    }

    const findAuthUserByEmailOrIdentity = async (email: string) => {
      return await findAuthUserByEmail(email)
    }

    const ensureAuthUserCanOwnEmail = (resolvedAuthUser: { id: string; email?: string | null } | null, email: string) => {
      if (!resolvedAuthUser) {
        return
      }

      const resolvedEmail = resolvedAuthUser.email?.trim().toLowerCase() ?? null
      if (resolvedEmail && resolvedEmail !== email) {
        throw new Error(`Email address ${email} is already linked to auth user ${resolvedEmail}. Repair or update that existing account before creating a separate user.`)
      }
    }

    const assignExistingUserToOrg = async ({
      existingUserId,
      existingOrgId,
      name,
      email,
      orgId,
      role,
    }: {
      existingUserId: string
      existingOrgId: string | null
      name: string
      email: string
      orgId: string
      role: string
    }) => {
      const isOrgMove = !!existingOrgId && existingOrgId !== orgId

      const { error: profileUpdateError } = await supabaseAdmin
        .from('profiles')
        .upsert({
          user_id: existingUserId,
          name,
          email,
          active: true,
          org_id: orgId,
          ...(isOrgMove ? { family_group_id: null } : {}),
        }, { onConflict: 'user_id' })

      if (profileUpdateError) {
        throw profileUpdateError
      }

      if (isOrgMove) {
        const tablesToReassign = ['role_preferences', 'availability', 'service_history'] as const

        for (const tableName of tablesToReassign) {
          const { error: reassignmentError } = await supabaseAdmin
            .from(tableName)
            .update({ org_id: orgId })
            .eq('user_id', existingUserId)

          if (reassignmentError) {
            throw reassignmentError
          }
        }
      }

      const { error: roleCleanupError } = await supabaseAdmin
        .from('user_roles')
        .delete()
        .eq('user_id', existingUserId)
        .in('role', ['volunteer', 'admin'])

      if (roleCleanupError) {
        throw roleCleanupError
      }

      const { error: roleInsertError } = await supabaseAdmin
        .from('user_roles')
        .insert({
          user_id: existingUserId,
          role,
          org_id: orgId,
        })

      if (roleInsertError) {
        throw roleInsertError
      }

      // No email here on purpose. This account already has a password its owner
      // chose, so minting a recovery link for it would hand out a credential
      // nobody asked for. Use "Send Reset Email" if they have genuinely lost it.
      return new Response(
        JSON.stringify({
          success: true,
          message: isOrgMove
            ? 'Existing user moved to organisation and role updated'
            : 'Existing user assigned to organisation',
          userId: existingUserId,
          emailed: false,
          emailSkippedReason: 'existing-account',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const getTargetOrgId = async (targetUserId: string): Promise<string> => {
      const { data: targetProfile, error: targetProfileError } = await supabaseAdmin
        .from('profiles')
        .select('org_id')
        .eq('user_id', targetUserId)
        .maybeSingle()

      if (targetProfileError) {
        throw targetProfileError
      }

      const orgId = (targetProfile as { org_id?: string } | null)?.org_id
      if (!orgId) {
        throw new Error('Target user organisation not found')
      }

      return orgId
    }

    /**
     * Invite a freshly created account to choose its own password.
     *
     * createUser below sets a random throwaway password that is never disclosed,
     * so this link is the only way in. It is the same single-use recovery link
     * the reset flow uses, and it is emailed to the account holder rather than
     * returned to the caller because it is a bearer credential for that account.
     *
     * A send failure is reported, not thrown: the account already exists by this
     * point, so failing the whole action would misreport what happened. The
     * super admin can re-send with "Send Reset Email".
     */
    const sendSetupInvitation = async (email: string, requestedBaseUrl: unknown) => {
      // The origin is only honoured when allow-listed (see resolveAppOrigin), so
      // a caller cannot point the link at a site they control.
      const appOrigin = resolveAppOrigin(requestedBaseUrl)
      if (!appOrigin) {
        console.error('APP_BASE_URL is not set. Cannot build an account setup link.')
        return { emailed: false, emailError: PASSWORD_RESET_NOT_CONFIGURED }
      }

      if (!isResendConfigured()) {
        console.error('RESEND_API_KEY secret is not set. Cannot send the account setup email.')
        return { emailed: false, emailError: PASSWORD_RESET_NOT_CONFIGURED }
      }

      const setupLink = await generateRecoveryLink(supabaseAdmin, email, appOrigin)
      if (!setupLink) {
        return {
          emailed: false,
          emailError: 'The account was created but no set-password link could be generated.',
        }
      }

      const sendError = await sendAccountSetupEmail({ supabaseAdmin, email, setupLink })
      if (sendError) {
        return { emailed: false, emailError: sendError }
      }

      return { emailed: true, emailError: null }
    }

    switch (action) {
      case 'list-support-data': {
        ensureSuperAdmin()

        const [organisationsResult, usersResult, roleRowsResult] = await Promise.all([
          supabaseAdmin
            .from('organisations')
            .select('id, name, slug, active')
            .order('name', { ascending: true }),
          supabaseAdmin
            .from('profiles')
            .select('user_id, name, email, active, org_id')
            .order('name', { ascending: true }),
          supabaseAdmin
            .from('user_roles')
            .select('user_id, role')
            .order('user_id', { ascending: true }),
        ])

        if (organisationsResult.error) {
          throw organisationsResult.error
        }

        if (usersResult.error) {
          throw usersResult.error
        }

        if (roleRowsResult.error) {
          throw roleRowsResult.error
        }

        const superAdminUserIds = ((roleRowsResult.data ?? []) as Array<{ user_id: string; role: string }>)
          .filter((row) => row.role === 'super_admin')
          .map((row) => row.user_id)

        return new Response(
          JSON.stringify({
            organisations: organisationsResult.data ?? [],
            users: usersResult.data ?? [],
            superAdminUserIds,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      case 'reset-password': {
        ensureSuperAdmin()

        if (!isValidEmail(data?.email)) {
          throw new Error('A valid email address is required for password reset')
        }
        const targetEmail = (data.email as string).trim().toLowerCase()

        // Same pipeline as the self-service /forgot-password flow: the link is
        // built from APP_BASE_URL, not from Supabase's Site URL setting.
        const appOrigin = resolveAppOrigin(data?.baseUrl)
        if (!appOrigin) {
          console.error('APP_BASE_URL is not set. Cannot build a reset link.')
          return new Response(
            JSON.stringify({ error: PASSWORD_RESET_NOT_CONFIGURED }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        if (!isResendConfigured()) {
          console.error('RESEND_API_KEY secret is not set. Cannot send the reset email.')
          return new Response(
            JSON.stringify({ error: PASSWORD_RESET_NOT_CONFIGURED }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        const resetLink = await generateRecoveryLink(supabaseAdmin, targetEmail, appOrigin)
        if (!resetLink) {
          // The caller is an authenticated super admin acting on a user they can
          // already see, so a precise message is more useful than the
          // enumeration-safe wording used on the public endpoint.
          return new Response(
            JSON.stringify({ error: 'No account was found for that email address.' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        // Emailed to the account holder rather than returned to the caller: the
        // reset link is a bearer credential for that account, and sending it
        // leaves a trail instead of allowing a silent takeover.
        const sendError = await sendPasswordResetEmail({
          supabaseAdmin,
          email: targetEmail,
          resetLink,
          initiatedByAdmin: true,
        })

        if (sendError) {
          return new Response(
            JSON.stringify({ error: sendError }),
            { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        console.log(`Super admin ${user.id} sent a password reset to a user account.`)

        return new Response(
          JSON.stringify({
            success: true,
            emailed: true,
            email: targetEmail,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      case 'update-email': {
        ensureSuperAdmin()

        const nextEmail = data?.email as string | undefined
        if (!userId || !nextEmail) {
          throw new Error('userId and data.email are required')
        }

        const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
          email: nextEmail,
          email_confirm: true, // Auto-confirm the new email
        })

        if (updateError) {
          throw updateError
        }

        // Also update the profile
        await supabaseAdmin
          .from('profiles')
          .update({ email: nextEmail })
          .eq('user_id', userId)

        return new Response(
          JSON.stringify({ success: true, message: 'Email updated successfully' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      case 'update-role-preferences': {
        if (!userId) {
          throw new Error('userId is required')
        }

        const targetOrgId = await getTargetOrgId(userId)
        if (!isSuperAdmin) {
          if (!isOrgAdmin || !callerOrgId || targetOrgId !== callerOrgId) {
            throw new Error('Org admin can only manage users in their organisation')
          }
        }

        // Delete existing preferences
        await supabaseAdmin
          .from('role_preferences')
          .delete()
          .eq('user_id', userId)

        // Insert new preferences
        if (data.roles && data.roles.length > 0) {
          const { error: insertError } = await supabaseAdmin
            .from('role_preferences')
            .insert(
              data.roles.map((role: string, index: number) => ({
                user_id: userId,
                role: role,
                org_id: targetOrgId,
                preference_order: index + 1,
              }))
            )

          if (insertError) {
            throw insertError
          }
        }

        return new Response(
          JSON.stringify({ success: true, message: 'Role preferences updated' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      case 'add-user': {
        ensureSuperAdmin()

        const email = data?.email as string | undefined
        const name = data?.name as string | undefined
        const orgId = data?.orgId as string | undefined
        const role = (data?.role as string | undefined) ?? 'volunteer'

        if (!email || !name || !orgId) {
          throw new Error('data.email, data.name, and data.orgId are required')
        }
        if (!['volunteer', 'admin'].includes(role)) {
          throw new Error('data.role must be volunteer or admin')
        }

        const normalizedEmail = email.trim().toLowerCase()

        const { data: existingProfile, error: existingProfileError } = await supabaseAdmin
          .from('profiles')
          .select('user_id, org_id')
          .eq('email', normalizedEmail)
          .maybeSingle()

        if (existingProfileError) {
          throw existingProfileError
        }

        if (existingProfile) {
          return await assignExistingUserToOrg({
            existingUserId: existingProfile.user_id as string,
            existingOrgId: existingProfile.org_id as string | null,
            name,
            email: normalizedEmail,
            orgId,
            role,
          })
        }

        const existingAuthUser = await findAuthUserByEmailOrIdentity(normalizedEmail)
        ensureAuthUserCanOwnEmail(existingAuthUser, normalizedEmail)

        if (existingAuthUser) {
          const { data: fallbackProfile, error: fallbackProfileError } = await supabaseAdmin
            .from('profiles')
            .select('org_id')
            .eq('user_id', existingAuthUser.id)
            .maybeSingle()

          if (fallbackProfileError) {
            throw fallbackProfileError
          }

          return await assignExistingUserToOrg({
            existingUserId: existingAuthUser.id,
            existingOrgId: (fallbackProfile as { org_id?: string | null } | null)?.org_id ?? null,
            name,
            email: normalizedEmail,
            orgId,
            role,
          })
        }

        const temporaryPassword = `${crypto.randomUUID()}Aa1!`

        let createdUser: Awaited<ReturnType<typeof supabaseAdmin.auth.admin.createUser>>['data'] | null = null
        let createUserError: unknown = null

        try {
          const createUserResult = await supabaseAdmin.auth.admin.createUser({
            email: normalizedEmail,
            password: temporaryPassword,
            email_confirm: true,
            user_metadata: { name },
          })

          createdUser = createUserResult.data
          createUserError = createUserResult.error
        } catch (error) {
          createUserError = error
        }

        if (isEmailExistsError(createUserError)) {
          const existingAuthUserAfterCreate = await findAuthUserByEmailOrIdentity(normalizedEmail)
          ensureAuthUserCanOwnEmail(existingAuthUserAfterCreate, normalizedEmail)

          if (!existingAuthUserAfterCreate) {
            throw createUserError
          }

          const { data: fallbackProfile, error: fallbackProfileError } = await supabaseAdmin
            .from('profiles')
            .select('org_id')
            .eq('user_id', existingAuthUserAfterCreate.id)
            .maybeSingle()

          if (fallbackProfileError) {
            throw fallbackProfileError
          }

          return await assignExistingUserToOrg({
            existingUserId: existingAuthUserAfterCreate.id,
            existingOrgId: (fallbackProfile as { org_id?: string | null } | null)?.org_id ?? null,
            name,
            email: normalizedEmail,
            orgId,
            role,
          })
        }

        if (createUserError || !createdUser?.user) {
          throw createUserError ?? new Error('Failed to create user')
        }

        const createdUserId = createdUser.user.id

        const { error: profileError } = await supabaseAdmin
          .from('profiles')
          .upsert({
            user_id: createdUserId,
            name,
            email: normalizedEmail,
            active: true,
            org_id: orgId,
          }, { onConflict: 'user_id' })

        if (profileError) {
          throw profileError
        }

        const { error: roleCleanupError } = await supabaseAdmin
          .from('user_roles')
          .delete()
          .eq('user_id', createdUserId)
          .in('role', ['volunteer', 'admin'])

        if (roleCleanupError) {
          throw roleCleanupError
        }

        const { error: roleInsertError } = await supabaseAdmin
          .from('user_roles')
          .insert({
            user_id: createdUserId,
            role,
            org_id: orgId,
          })

        if (roleInsertError) {
          throw roleInsertError
        }

        const invitation = await sendSetupInvitation(normalizedEmail, data?.baseUrl)

        console.log(
          `Super admin ${user.id} created a user in org ${orgId} (setup email sent: ${invitation.emailed}).`
        )

        return new Response(
          JSON.stringify({
            success: true,
            message: invitation.emailed
              ? 'User created, assigned to organisation, and emailed a link to set their password'
              : 'User created and assigned to organisation, but the set-password email could not be sent',
            userId: createdUserId,
            emailed: invitation.emailed,
            emailError: invitation.emailError,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      case 'remove-user': {
        ensureSuperAdmin()

        if (!userId) {
          throw new Error('userId is required')
        }

        const targetOrgId = await getTargetOrgId(userId)

        const { error: roleDeleteError } = await supabaseAdmin
          .from('user_roles')
          .delete()
          .eq('user_id', userId)
          .eq('org_id', targetOrgId)
          .neq('role', 'super_admin')

        if (roleDeleteError) {
          throw roleDeleteError
        }

        const { error: profileUpdateError } = await supabaseAdmin
          .from('profiles')
          .update({ active: false })
          .eq('user_id', userId)
          .eq('org_id', targetOrgId)

        if (profileUpdateError) {
          throw profileUpdateError
        }

        return new Response(
          JSON.stringify({ success: true, message: 'User removed from organisation and deactivated' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      case 'delete-user-permanently': {
        ensureSuperAdmin()

        if (!userId) {
          throw new Error('userId is required')
        }

        // A super admin must not be able to delete their own account out from under themselves.
        if (userId === user.id) {
          throw new Error('You cannot permanently delete your own account')
        }

        // Super admin accounts are never deletable through this endpoint. The dashboard hides the
        // button for them, but the UI is not the security boundary — this check is.
        const { data: targetRoleRows, error: targetRoleError } = await supabaseAdmin
          .from('user_roles')
          .select('role')
          .eq('user_id', userId)

        if (targetRoleError) {
          throw targetRoleError
        }

        const targetIsSuperAdmin = ((targetRoleRows ?? []) as Array<{ role: string }>)
          .some((row) => row.role === 'super_admin')
        if (targetIsSuperAdmin) {
          throw new Error('Super admin accounts cannot be permanently deleted')
        }

        // Read the profile before anything is removed: the email is needed to purge invite tokens
        // (which have no foreign key), and the family group id to tidy up an emptied group.
        const { data: targetProfile, error: targetProfileError } = await supabaseAdmin
          .from('profiles')
          .select('email, family_group_id')
          .eq('user_id', userId)
          .maybeSingle()

        if (targetProfileError) {
          throw targetProfileError
        }

        const targetFamilyGroupId =
          (targetProfile as { family_group_id?: string | null } | null)?.family_group_id ?? null

        // Fall back to the auth record for the email so that re-running this action after a partial
        // failure still purges invite tokens, even though the profile row is already gone.
        let targetEmail = (targetProfile as { email?: string | null } | null)?.email ?? null
        if (!targetEmail) {
          const { data: targetAuthUser } = await supabaseAdmin.auth.admin.getUserById(userId)
          targetEmail = targetAuthUser?.user?.email ?? null
        }

        // Every delete below is keyed on user_id alone, never on org_id. A user moved between
        // organisations by assignExistingUserToOrg keeps rows under the previous org, so an
        // org-scoped delete would leave data behind.
        const runStep = async (label: string, step: () => PromiseLike<{ error: unknown }>) => {
          const { error } = await step()
          if (error) {
            console.error(`delete-user-permanently failed at step "${label}"`, error)
            throw error
          }
        }

        // 1. Release swap requests that merely point at the user, so they survive as history.
        await runStep('swap_requests.to_user_id', () =>
          supabaseAdmin.from('swap_requests').update({ to_user_id: null }).eq('to_user_id', userId))
        await runStep('swap_requests.approved_by', () =>
          supabaseAdmin.from('swap_requests').update({ approved_by: null }).eq('approved_by', userId))

        // 2. Swap requests the user raised go with them.
        await runStep('swap_requests.from_user_id', () =>
          supabaseAdmin.from('swap_requests').delete().eq('from_user_id', userId))

        // 3. Event assignments cascade to swap_requests.event_assignment_id and null out
        //    swap_requests.offered_assignment_id.
        await runStep('event_assignments', () =>
          supabaseAdmin.from('event_assignments').delete().eq('volunteer_id', userId))

        // 4. Legacy assignments table, superseded by event_assignments but still present.
        await runStep('assignments', () =>
          supabaseAdmin.from('assignments').delete().eq('volunteer_id', userId))

        // 5-6. Provenance columns on records that outlive the user.
        await runStep('event_templates.created_by', () =>
          supabaseAdmin.from('event_templates').update({ created_by: null }).eq('created_by', userId))
        await runStep('family_groups.created_by', () =>
          supabaseAdmin.from('family_groups').update({ created_by: null }).eq('created_by', userId))

        // 7. invite_tokens has no foreign key at all, so nothing cleans it up automatically, and it
        //    holds the invitee's name and email.
        await runStep('invite_tokens.invited_by', () =>
          supabaseAdmin.from('invite_tokens').delete().eq('invited_by', userId))
        if (targetEmail) {
          await runStep('invite_tokens.email', () =>
            supabaseAdmin.from('invite_tokens').delete().eq('email', targetEmail))
        }

        // 8-10. Per-user tables. These would cascade from auth.users anyway; doing them explicitly
        //       keeps the outcome deterministic if the deployed schema has drifted from the
        //       migrations. profiles must be last: the restrictive tenant RLS policies resolve a
        //       user's org through it.
        for (const tableName of ['availability', 'role_preferences', 'service_history', 'user_roles'] as const) {
          await runStep(tableName, () =>
            supabaseAdmin.from(tableName).delete().eq('user_id', userId))
        }
        await runStep('profiles', () =>
          supabaseAdmin.from('profiles').delete().eq('user_id', userId))

        // 11. Drop the family group if the deleted user was its last member.
        if (targetFamilyGroupId) {
          const { count: remainingMembers, error: familyCountError } = await supabaseAdmin
            .from('profiles')
            .select('user_id', { count: 'exact', head: true })
            .eq('family_group_id', targetFamilyGroupId)

          if (familyCountError) {
            throw familyCountError
          }

          if ((remainingMembers ?? 0) === 0) {
            await runStep('family_groups', () =>
              supabaseAdmin.from('family_groups').delete().eq('id', targetFamilyGroupId))
          }
        }

        // 12. Finally the auth account itself, which also clears identities, sessions and refresh
        //     tokens. Done last so a partial failure never leaves an orphaned auth user; the action
        //     is idempotent and can simply be re-run.
        const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(userId)
        if (authDeleteError) {
          throw authDeleteError
        }

        return new Response(
          JSON.stringify({ success: true, message: 'User permanently deleted' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
  } catch (error) {
    console.error('Error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
