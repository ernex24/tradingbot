import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabaseConfigured = !!(url && anonKey)

if (!supabaseConfigured) {
  // Make a missing env var loud in the browser console instead of
  // silently producing a null client (which makes Account look broken).
  console.warn(
    '[supabase] Missing env vars at build time:',
    { hasUrl: !!url, hasKey: !!anonKey }
  )
}

export const supabase = supabaseConfigured
  ? createClient(url, anonKey, {
      auth: { persistSession: true, autoRefreshToken: true },
    })
  : null

// Helper that adds the Bearer token to a fetch call when authenticated.
export async function authFetch(path, opts = {}) {
  if (!supabase) throw new Error('Supabase not configured')
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('not authenticated')
  return fetch(path, {
    ...opts,
    headers: {
      ...(opts.headers || {}),
      Authorization: `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
  })
}
