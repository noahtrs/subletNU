import { corsHeaders } from '../_shared/cors.ts'
import { createAdminClient, getCallerUser } from '../_shared/supabase-admin.ts'

Deno.serve(async (req) => {
  // Handle CORS preflight request
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Admin client using the project's secret key (see _shared/supabase-admin.ts)
    const supabaseAdmin = createAdminClient()
    if (!supabaseAdmin) {
      console.error('Missing SUPABASE_URL or secret key')
      return new Response(
        JSON.stringify({ 
          error: 'Server configuration error',
          details: 'Missing required environment variables'
        }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      })
    }

    // Only the signed-in user can delete themselves: verify the caller's
    // session token with Supabase Auth (verify_jwt is off for this function).
    const user = await getCallerUser(supabaseAdmin, req)
    if (!user) {
      return new Response(JSON.stringify({ error: 'User not authenticated' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      })
    }

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
      return new Response((error as Error).message || 'Internal Server Error', {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }
  } catch (error) {
    // Catch errors in the initial setup (env vars, client creation)
    console.error('Function setup error:', error);
    return new Response((error as Error).message || 'Function Setup Error', {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
