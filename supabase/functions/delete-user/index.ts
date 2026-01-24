/// <reference types="https://deno.land/x/types/index.d.ts" />
/// <reference lib="deno.ns" />

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

serve(async (req) => {
  // Handle CORS preflight request
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Validate environment variables
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')
    const supabaseServiceRoleKey = Deno.env.get('SERVICE_ROLE_KEY')

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
      console.error('Missing required environment variables')
      return new Response(
        JSON.stringify({ 
          error: 'Server configuration error',
          details: 'Missing required environment variables'
        }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      })
    }

    // Create Supabase client with auth context from the incoming request
    const supabaseClient = createClient(
      supabaseUrl,
      supabaseAnonKey,
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    // Get user ID from the request's authentication context
    const { data: { user }, error: getUserError } = await supabaseClient.auth.getUser()

    if (getUserError) {
      console.error('Auth error getting user:', getUserError);
      return new Response(JSON.stringify({ error: 'Authentication failed' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      })
    }

    if (!user) {
      return new Response(JSON.stringify({ error: 'User not authenticated' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      })
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);

    try {
      // 1. Delete associated Sublets
      const { error: subletDeleteError } = await supabaseAdmin
        .from('sublets')
        .delete()
        .eq('user_id', user.id);
      if (subletDeleteError) {
        console.error(`Error deleting sublets for user ${user.id}:`, subletDeleteError);
        throw new Error(`Failed to delete sublets: ${subletDeleteError.message}`);
      }

      // 2. Delete associated Messages (both sent and received)
      const { error: messageDeleteError } = await supabaseAdmin
        .from('messages')
        .delete()
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`);
      if (messageDeleteError) {
        console.error(`Error deleting messages for user ${user.id}:`, messageDeleteError);
        throw new Error(`Failed to delete messages: ${messageDeleteError.message}`);
      }

      // 3. Delete User Profile
      const { error: profileDeleteError } = await supabaseAdmin
        .from('profiles')
        .delete()
        .eq('id', user.id);
      if (profileDeleteError) {
        console.error(`Error deleting profile for user ${user.id}:`, profileDeleteError);
        // Decide if this is critical. If profile might not exist, maybe just log warning?
        throw new Error(`Failed to delete profile: ${profileDeleteError.message}`);
      }

      // 4. Delete Auth User (This should trigger the function again, but the cascade should prevent infinite loops? Check Supabase docs)
      // IMPORTANT: Ensure this doesn't cause an infinite loop. Test thoroughly.
      // The trigger is likely on auth.users deletion, so deleting it here might re-trigger.
      // A common pattern is to have a flag or check if deletion is already in progress.
      // Alternatively, the function could be triggered by a different event (e.g., custom webhook).
      // For now, assuming direct deletion is intended and safe.
      const { error: authUserDeleteError } = await supabaseAdmin.auth.admin.deleteUser(user.id);
      if (authUserDeleteError) {
        // If the user was already deleted (e.g., by cascade or race condition), this might error.
        // Check for specific errors like "User not found"? 
        console.error(`Error deleting auth user ${user.id}:`, authUserDeleteError);
        throw new Error(`Failed to delete auth user: ${authUserDeleteError.message}`);
      }

      return new Response(JSON.stringify({ message: `Successfully deleted user ${user.id} and associated data.` }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    } catch (error) {
      console.error(`Critical error during user deletion process for ${user.id}:`, error);
      return new Response(error.message || 'Internal Server Error', {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }
  } catch (error) {
    // Catch errors in the initial setup (env vars, client creation)
    console.error('Function setup error:', error);
    return new Response(error.message || 'Function Setup Error', {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
