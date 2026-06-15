// Consolidated settings endpoint: /api/settings/get (GET) and
// /api/settings/save (POST). One Vercel function.

import { encrypt } from '../_lib/encryption.js'
import { getAdminClient, requireUser, jsonResponse } from '../_lib/supabaseServer.js'

async function get(req, res, user, admin) {
  if (req.method !== 'GET') return jsonResponse(res, 405, { error: 'method not allowed' })
  const { data, error } = await admin
    .from('user_notifications')
    .select('telegram_bot_token_encrypted, telegram_chat_id, enabled, daily_loss_limit, updated_at')
    .eq('user_id', user.user_id)
    .maybeSingle()
  if (error) {
    console.error('settings/get db error:', error)
    return jsonResponse(res, 500, { error: 'failed to fetch settings' })
  }
  return jsonResponse(res, 200, {
    settings: {
      telegramConfigured: !!data?.telegram_bot_token_encrypted,
      telegramChatId: data?.telegram_chat_id || '',
      telegramEnabled: data?.enabled !== false,
      dailyLossLimit: data?.daily_loss_limit ? +data.daily_loss_limit : null,
      updatedAt: data?.updated_at,
    },
  })
}

async function save(req, res, user, admin) {
  if (req.method !== 'POST') return jsonResponse(res, 405, { error: 'method not allowed' })
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
  const { error } = await admin
    .from('user_notifications')
    .upsert(update, { onConflict: 'user_id' })
  if (error) {
    console.error('settings/save db error:', error)
    return jsonResponse(res, 500, { error: 'failed to save settings' })
  }
  return jsonResponse(res, 200, { saved: true })
}

export default async function handler(req, res) {
  let user
  try { user = await requireUser(req) }
  catch { return jsonResponse(res, 401, { error: 'unauthorized' }) }
  const admin = getAdminClient()
  const { action } = req.query
  if (action === 'get') return get(req, res, user, admin)
  if (action === 'save') return save(req, res, user, admin)
  return jsonResponse(res, 404, { error: 'action not found' })
}
