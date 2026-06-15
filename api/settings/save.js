// POST /api/settings/save
// Body: { telegramBotToken?, telegramChatId?, telegramEnabled?, dailyLossLimit? }
// Requires Authorization: Bearer <Supabase JWT>.
// Each field is optional — only the present ones get updated.
// telegramBotToken is encrypted before storage.

import { encrypt } from '../_lib/encryption.js'
import { getAdminClient, requireUser, jsonResponse } from '../_lib/supabaseServer.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return jsonResponse(res, 405, { error: 'method not allowed' })
  let user
  try { user = await requireUser(req) }
  catch { return jsonResponse(res, 401, { error: 'unauthorized' }) }

  const body = req.body || {}
  const update = {
    user_id: user.user_id,
    updated_at: new Date().toISOString(),
  }

  if (typeof body.telegramBotToken === 'string' && body.telegramBotToken.length > 0) {
    update.telegram_bot_token_encrypted = encrypt(body.telegramBotToken.trim())
  }
  if (typeof body.telegramChatId === 'string') {
    update.telegram_chat_id = body.telegramChatId.trim() || null
  }
  if (typeof body.telegramEnabled === 'boolean') {
    update.enabled = body.telegramEnabled
  }
  if (body.dailyLossLimit === null) {
    update.daily_loss_limit = null
  } else if (typeof body.dailyLossLimit === 'number' && body.dailyLossLimit >= 0) {
    update.daily_loss_limit = body.dailyLossLimit
  }

  const admin = getAdminClient()
  const { error } = await admin
    .from('user_notifications')
    .upsert(update, { onConflict: 'user_id' })

  if (error) {
    console.error('settings/save db error:', error)
    return jsonResponse(res, 500, { error: 'failed to save settings' })
  }

  return jsonResponse(res, 200, { saved: true })
}
