import { authFetch, supabase } from './supabase.js'

// Fire-and-forget Telegram notification. Returns void.
export async function notify(text) {
  if (!supabase) return
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    await authFetch('/api/notify/telegram', {
      method: 'POST',
      body: JSON.stringify({ text }),
    })
  } catch { /* ignore */ }
}
