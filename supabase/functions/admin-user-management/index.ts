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

    // Verify the caller is an admin
    const { data: isAdmin } = await supabaseAdmin.rpc('is_admin', { _user_id: user.id })
    if (!isAdmin) {
      return new Response(
        JSON.stringify({ error: 'Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { action, userId, data } = await req.json()

    switch (action) {
      case 'reset-password': {
        // Generate a password reset link
        const { data: resetData, error: resetError } = await supabaseAdmin.auth.admin.generateLink({
          type: 'recovery',
          email: data.email,
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
        const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
          email: data.email,
          email_confirm: true, // Auto-confirm the new email
        })

        if (updateError) {
          throw updateError
        }

        // Also update the profile
        await supabaseAdmin
          .from('profiles')
          .update({ email: data.email })
          .eq('user_id', userId)

        return new Response(
          JSON.stringify({ success: true, message: 'Email updated successfully' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      case 'update-role-preferences': {
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
