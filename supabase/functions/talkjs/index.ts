import { serve } from 'https://deno.land/std@0.208.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status,
  })

const base64url = (data: string | ArrayBuffer) =>
  btoa(typeof data === 'string' ? data : String.fromCharCode(...new Uint8Array(data)))
    .replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')

async function signToken(appId: string, secretKey: string, userId: string) {
  const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const payload = base64url(JSON.stringify({
    tokenType: 'user',
    iss: appId,
    sub: userId,
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24,
  }))
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secretKey), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  )
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${header}.${payload}`))
  return `${header}.${payload}.${base64url(signature)}`
}

type Profile = { id: string; first_name: string | null; last_name: string | null; email: string }

const displayName = (p: Profile) =>
  [p.first_name, p.last_name].filter(Boolean).join(' ') || p.email.split('@')[0]

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const appId = Deno.env.get('TALKJS_APP_ID')
    const secretKey = Deno.env.get('TALKJS_SECRET_KEY')
    if (!supabaseUrl || !serviceRoleKey || !appId || !secretKey) {
      throw new Error('Missing required environment variables')
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey)
    const jwt = (req.headers.get('Authorization') ?? '').replace('Bearer ', '')
    const { data: { user } } = await supabase.auth.getUser(jwt)
    if (!user) return json({ error: 'Not authenticated' }, 401)

    const talk = (path: string, body: unknown) =>
      fetch(`https://api.talkjs.com/v1/${appId}/${path}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${secretKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).then(async (res) => {
        if (!res.ok) throw new Error(`TalkJS ${path}: ${res.status} ${await res.text()}`)
      })

    const syncUser = async (id: string) => {
      const { data: profile } = await supabase
        .from('profiles').select('id, first_name, last_name, email').eq('id', id).single()
      if (!profile) return false
      await talk(`users/${id}`, { name: displayName(profile), email: [profile.email], role: 'default' })
      return true
    }

    const { otherUserId } = await req.json().catch(() => ({}))

    if (!otherUserId) {
      if (!(await syncUser(user.id))) return json({ error: 'Profile not found' }, 404)
      return json({ token: await signToken(appId, secretKey, user.id) })
    }

    if (typeof otherUserId !== 'string' || otherUserId === user.id) {
      return json({ error: 'Invalid user' }, 400)
    }
    if (!(await syncUser(otherUserId))) return json({ error: 'User not found' }, 404)

    const conversationId = [user.id, otherUserId].sort().join('_')
    await talk(`conversations/${conversationId}`, { participants: [user.id, otherUserId] })
    return json({ conversationId })
  } catch (error) {
    console.error(error)
    return json({ error: error.message }, 500)
  }
})
