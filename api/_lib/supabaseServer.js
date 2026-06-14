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
    console.warn('[auth] no Bearer token in request')
    throw new Error('unauthorized')
  }
  // Helpful debug: confirm env vars are present and which project the
  // backend is talking to. We only log the host of the URL (no secrets).
  console.warn('[auth] SUPABASE_URL host:', (process.env.SUPABASE_URL || '').replace(/^https?:\/\//, '').split('.')[0])
  console.warn('[auth] SERVICE_ROLE present:', !!process.env.SUPABASE_SERVICE_ROLE_KEY, 'length:', (process.env.SUPABASE_SERVICE_ROLE_KEY || '').length)
  console.warn('[auth] token first 16 chars:', token.slice(0, 16), 'length:', token.length)

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
