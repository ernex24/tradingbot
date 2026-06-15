// GET /api/settings/get
// Requires Authorization: Bearer <Supabase JWT>.
// Returns the user's safety settings (daily limit, Telegram enabled
// and chat id). NEVER returns the Telegram bot token; only whether
// one is configured.

import { getAdminClient, requireUser, jsonResponse } from '../_lib/supabaseServer.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') return jsonResponse(res, 405, { error: 'method not allowed' })
  let user
  try { user = await requireUser(req) }
  catch { return jsonResponse(res, 401, { error: 'unauthorized' }) }

  const admin = getAdminClient()
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
