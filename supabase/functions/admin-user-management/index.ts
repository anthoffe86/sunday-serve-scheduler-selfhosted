import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

    switch (action) {
      case 'reset-password': {
        ensureSuperAdmin()

        const targetEmail = data?.email as string | undefined
        if (!targetEmail) {
          throw new Error('Email is required for password reset')
        }

        // Generate a password reset link
        const { data: resetData, error: resetError } = await supabaseAdmin.auth.admin.generateLink({
          type: 'recovery',
          email: targetEmail,
        })

        if (resetError) {
          throw resetError
        }

        return new Response(
          JSON.stringify({ 
            success: true, 
            message: 'Password reset link generated',
            resetLink: resetData.properties?.action_link 
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
          const existingUserId = existingProfile.user_id as string
          const existingOrgId = existingProfile.org_id as string | null
          const isOrgMove = !!existingOrgId && existingOrgId !== orgId

          const { error: profileUpdateError } = await supabaseAdmin
            .from('profiles')
            .update({
              name,
              email: normalizedEmail,
              active: true,
              org_id: orgId,
              family_group_id: isOrgMove ? null : undefined,
            })
            .eq('user_id', existingUserId)

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

          return new Response(
            JSON.stringify({
              success: true,
              message: isOrgMove
                ? 'Existing user moved to organisation and role updated'
                : 'Existing user assigned to organisation',
              userId: existingUserId,
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        const temporaryPassword = `${crypto.randomUUID()}Aa1!`

        const { data: createdUser, error: createUserError } = await supabaseAdmin.auth.admin.createUser({
          email: normalizedEmail,
          password: temporaryPassword,
          email_confirm: true,
          user_metadata: { name },
        })

        if (createUserError || !createdUser.user) {
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

        return new Response(
          JSON.stringify({
            success: true,
            message: 'User created and assigned to organisation',
            userId: createdUserId,
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
