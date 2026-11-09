import { createClient, type SupabaseClient, type User } from 'npm:@supabase/supabase-js@2.119.0'

/**
 * Server-side Supabase access for Edge Functions, using the new API keys.
 *
 * Supabase injects the new keys into every Edge Function as JSON dictionaries
 * keyed by key name, e.g. SUPABASE_SECRET_KEYS = {"default":"sb_secret_..."}.
 * The injected SUPABASE_SERVICE_ROLE_KEY / SUPABASE_ANON_KEY carry the legacy
 * JWT keys, which stop working once legacy keys are disabled, so they are only
 * used as a fallback for projects that haven't created new keys yet.
 */

const SECRET_KEY_NAME = 'default'

const parseKeyDictionary = (raw: string | undefined): Record<string, string> => {
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    console.error('SUPABASE_SECRET_KEYS is not valid JSON')
    return {}
  }
}

let warnedLegacyFallback = false

/** The project's `default` secret key (sb_secret_...), or the legacy service_role key as a fallback. */
export const getSecretKey = (): string | null => {
  const secretKey = parseKeyDictionary(Deno.env.get('SUPABASE_SECRET_KEYS'))[SECRET_KEY_NAME]
  if (secretKey) return secretKey

  const legacyKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (legacyKey) {
    if (!warnedLegacyFallback) {
      warnedLegacyFallback = true
      console.warn(
        'SUPABASE_SECRET_KEYS has no "default" key; falling back to the legacy service_role key. ' +
          'Create a secret key under Settings → API Keys before disabling legacy keys.',
      )
    }
    return legacyKey
  }
  return null
}

/**
 * Admin client (bypasses RLS). Returns null if the URL or secret key is missing.
 * Never hand this client a caller's token: it must keep acting as the secret key.
 */
export const createAdminClient = (): SupabaseClient | null => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const secretKey = getSecretKey()
  if (!supabaseUrl || !secretKey) return null
  return createClient(supabaseUrl, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

/** The caller's access token from `Authorization: Bearer <jwt>`, or null. */
const getBearerToken = (req: Request): string | null => {
  const match = (req.headers.get('Authorization') ?? '').match(/^Bearer\s+(.+)$/i)
  const token = match?.[1]?.trim()
  // Publishable/secret keys aren't user tokens (supabase-js sends the API key
  // here when nobody is signed in), so treat them as "no user".
  if (!token || token.startsWith('sb_')) return null
  return token
}

/**
 * The signed-in user who made this request, verified by Supabase Auth.
 *
 * This replaces the platform `verify_jwt` gate (disabled in config.toml for
 * these functions): `auth.getUser(jwt)` asks the Auth server to validate the
 * token, which works for both legacy HS256 session tokens and the newer
 * asymmetric JWT signing keys, and rejects anon-key JWTs (they have no user).
 */
export const getCallerUser = async (admin: SupabaseClient, req: Request): Promise<User | null> => {
  const token = getBearerToken(req)
  if (!token) return null
  const { data, error } = await admin.auth.getUser(token)
  if (error) {
    console.error('Auth error getting caller:', error.message)
    return null
  }
  return data.user
}
