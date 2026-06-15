// POST /api/notify/telegram
// Body: { text }
// Requires Authorization: Bearer <Supabase JWT>.
// Forwards the message to Telegram using the user's stored bot token.

import { decrypt } from '../_lib/encryption.js'
import { getAdminClient, requireUser, jsonResponse } from '../_lib/supabaseServer.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return jsonResponse(res, 405, { error: 'method not allowed' })
  let user
  try { user = await requireUser(req) }
  catch { return jsonResponse(res, 401, { error: 'unauthorized' }) }

  const { text } = req.body || {}
  if (!text || typeof text !== 'string') {
    return jsonResponse(res, 400, { error: 'missing text' })
  }

  const admin = getAdminClient()
  const { data: row, error: dbError } = await admin
    .from('user_notifications')
    .select('telegram_bot_token_encrypted, telegram_chat_id, enabled')
    .eq('user_id', user.user_id)
    .maybeSingle()

  if (dbError) {
    console.error('notify/telegram db error:', dbError)
    return jsonResponse(res, 500, { error: 'failed to load notifications config' })
  }
  if (!row?.telegram_bot_token_encrypted || !row?.telegram_chat_id) {
    return jsonResponse(res, 400, { error: 'Telegram not configured' })
  }
  if (row.enabled === false) {
    return jsonResponse(res, 200, { sent: false, reason: 'disabled' })
  }

  let token
  try { token = decrypt(row.telegram_bot_token_encrypted) }
  catch { return jsonResponse(res, 500, { error: 'failed to decrypt token' }) }

  try {
    const tgr = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: row.telegram_chat_id,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
      signal: AbortSignal.timeout(7000),
    })
    const data = await tgr.json().catch(() => ({}))
    if (!tgr.ok || !data.ok) {
      return jsonResponse(res, 502, { error: 'Telegram: ' + (data.description || tgr.status) })
    }
    return jsonResponse(res, 200, { sent: true })
  } catch (e) {
    return jsonResponse(res, 502, { error: 'Telegram unreachable: ' + e.message })
  }
}
