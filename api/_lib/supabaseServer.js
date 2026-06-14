// Server-side Supabase client (uses the service role key — bypasses RLS).
// Also a helper to validate a user-supplied JWT and extract the user.

import { createClient } from '@supabase/supabase-js'

let _admin = null
export function getAdminClient() {
  if (_admin) return _admin
  const url = process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars are required')
  }
  _admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  return _admin
}

// Returns { user_id } if the JWT in the Authorization header is valid,
// otherwise throws an Error('unauthorized').
export async function requireUser(req) {
  const auth = req.headers?.authorization || req.headers?.Authorization || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  if (!token) {
    console.warn('[auth] FAIL_NO_BEARER_TOKEN')
    throw new Error('unauthorized')
  }
  const url = process.env.SUPABASE_URL || ''
  const role = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  if (!url) console.warn('[auth] FAIL_URL_EMPTY')
  else console.warn('[auth] URL_OK_HOST_' + url.replace(/^https?:\/\//, '').split('.')[0])
  if (!role) console.warn('[auth] FAIL_ROLE_EMPTY')
  else console.warn('[auth] ROLE_OK_LEN_' + role.length)
  console.warn('[auth] TOKEN_LEN_' + token.length + '_PREFIX_' + token.slice(0, 8))

  const admin = getAdminClient()
  const { data, error } = await admin.auth.getUser(token)
  if (error) {
    console.warn('[auth] getUser error:', error?.status, error?.message || error)
    throw new Error('unauthorized')
  }
  if (!data?.user) {
    console.warn('[auth] getUser returned no user')
    throw new Error('unauthorized')
  }
  return { user_id: data.user.id, email: data.user.email }
}

export function jsonResponse(res, status, body) {
  res.setHeader('Content-Type', 'application/json')
  res.status(status).send(JSON.stringify(body))
}
