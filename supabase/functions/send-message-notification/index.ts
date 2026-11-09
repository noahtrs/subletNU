import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'
import { corsHeaders } from '../_shared/cors.ts'

const escapeHtml = (value: string | null | undefined) =>
  (value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

const jsonResponse = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status,
  })

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const resendKey = Deno.env.get('RESEND_API_KEY')

    if (!supabaseUrl || !serviceRoleKey || !resendKey) {
      throw new Error('Missing required environment variables')
    }

    const supabaseClient = createClient(supabaseUrl, serviceRoleKey)

    const jwt = (req.headers.get('Authorization') ?? '').replace('Bearer ', '')
    const { data: { user: caller } } = await supabaseClient.auth.getUser(jwt)
    if (!caller) {
      return jsonResponse({ error: 'Not authenticated' }, 401)
    }

    const { messageId } = await req.json()

    const { data: message } = await supabaseClient
      .from('messages')
      .select('*')
      .eq('id', messageId)
      .single()

    if (!message) {
      return jsonResponse({ error: 'Message not found' }, 404)
    }
    if (message.sender_id !== caller.id) {
      return jsonResponse({ error: 'Forbidden' }, 403)
    }

    const { data: receiverProfile } = await supabaseClient
      .from('profiles')
      .select('email, first_name, last_name')
      .eq('id', message.receiver_id)
      .single()

    const { data: senderProfile } = await supabaseClient
      .from('profiles')
      .select('email, first_name, last_name')
      .eq('id', message.sender_id)
      .single()

    if (!receiverProfile?.email || !senderProfile) {
      return jsonResponse({ error: 'Profile not found' }, 404)
    }

    const senderFirstName = escapeHtml(senderProfile.first_name)
    const senderLastName = escapeHtml(senderProfile.last_name)

    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'no-reply@subletnu.com',
        to: receiverProfile.email,
        reply_to: senderProfile.email,
        subject: `New message from ${senderProfile.first_name ?? 'a SubletNU user'}`,
        html: `
          <div>
            <h2>You have a new message on SubletNU</h2>
            <p><strong>${senderFirstName} ${senderLastName}</strong> sent you a message:</p>
            <p style="padding: 15px; background-color: #f5f5f5; border-radius: 5px; white-space: pre-wrap;">${escapeHtml(message.text)}</p>
            <p>
              <a href="https://subletnu.com/messages/${message.sender_id}"
                 style="padding: 10px 20px; background-color: #E31837; color: white; text-decoration: none; border-radius: 5px; display: inline-block;">
                View Message
              </a>
            </p>
          </div>
        `,
      }),
    });

    return jsonResponse({ success: true }, 200)

  } catch (error) {
    return jsonResponse({ error: error.message }, 500)
  }
})
